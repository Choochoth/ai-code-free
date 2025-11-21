//main.ts
import * as fs from 'fs';
import path from 'path';
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";
import { NewMessage } from 'telegram/events';  // Import the correct events
import { NewMessageEvent } from "telegram/events/NewMessage";
import { Raw } from "telegram/events/Raw";
import Bottleneck from "bottleneck";
import cron from 'node-cron';
import axios from "axios";
import viewRoutes from "./routes/viewRoutes";
import apiRoutes from "./routes/apiRoutes";

import { encryptText, getInputCaptcha, parserCodeMessage} from "./okvip";
import {
  sendCodeToPlayer,
  postCaptchaCode,
  getVerificationCode,
  addTemplate,
  ocr
} from "./services/promoCodeApi";



import  { updatePlayersLock, resetDailySentIfNeeded, updateApplyCodeLog, getSinglePlayer, getPlayerPool, clearApplyCodeTemplateForSite } from "./player";
import { SiteSentPlayers } from "./types/player";


import {
  checkNetworkConnectivity,
  promptInput,
  delay,
  shuffleArray,
  removeImage
} from "./utils";

import { markPlayerTried, cleanupExpiredBlocks } from "./playerTracker";


import {
  detectSite,
  detectSiteFromChatId,
} from "./siteDetector";

import { SiteQueue } from "./types/siteConfigs";

dotenv.config();


const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH || "";
const phoneNumber = process.env.APP_YOUR_PHONE || "";
const userPassword = process.env.APP_YOUR_PWD || "";
const port = Number(process.env.PORT) || 5300;
const MAX_RETRIES = 3;
let retryInterval = 6000;
let lastRestartTime = 0;
let isRestarting: boolean = false;
const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";
const appSession = process.env.APP_SESSION;

const processedMessageIds = new Set<string>();
let  informationSet:any={};
const siteQueues: { [siteName: string]: SiteQueue } = {};
const captchaLimiter = new Bottleneck({
  minTime: 300,
  maxConcurrent: 1,
});

// 🔧 กำหนดระยะเวลา Lock ตามสถานะ
const lockDurations: Record<number, number> = {
  403: 30 * 60 * 1000,
  9002: 30 * 60 * 1000,
  9003: 30 * 60 * 1000,
  9004: 3 * 60 * 1000,
  9007: 30 * 60 * 1000,
  0: 30 * 60 * 1000,
  4044: 30 * 24 * 60 * 60 * 1000,
};

const baseDir = __dirname;
const dataDir = path.join(baseDir, "data");
const sessionDir = path.join(dataDir, "session");
const applyCodePath = path.join(dataDir, "apply_code.json");
const packagePath = path.join(dataDir, "package.json");

try {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
} catch (error: any) {
  console.error(`Error creating session directory: ${error.message}`);
}

// Assume phoneNumber is defined before this line
const sessionFilePath = path.join(sessionDir, `${appSession}_${phoneNumber.slice(-4)}.txt`);

let sessionClient = "";
try {
  if (fs.existsSync(sessionFilePath)) {
    sessionClient = fs.readFileSync(sessionFilePath, "utf-8");
  }
} catch (error: any) {
  console.error(`Error reading session file: ${error.message}`);
}

let client: TelegramClient | null = null;
let expressServer: any;
let lastHandledMessage: string | null = null;
let minPoint: number = 8;

async function initializeClient() {
  if (!client) {
    client = new TelegramClient(
      new StringSession(sessionClient),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
        timeout: 30000, // 30 seconds
        useWSS: true,
      }
    );
  }

  try {
    await client.connect();
    console.log("Telegram client initialized and connected.");
  } catch (error) {
    console.error("Error initializing Telegram client:", error);
    handleTelegramError(error as Error);
  }
}

async function initializeSession() {
  if (!client) await initializeClient();

  if (sessionClient) {
    console.log("Using existing session...");
    try {
      await client!.connect();
    } catch (error) {
      console.error("Error using existing session:", error);
      handleTelegramError(error as Error);
    }
  } else {
    console.log("No existing session found. Initiating new session...");
    try {
      await client!.start({
        phoneNumber: async () => phoneNumber,
        password: async () => userPassword,
        phoneCode: async () =>
          await promptInput("Please enter the code you received: "),
        onError: (err: Error) => {
          if (err.message.includes("AUTH_KEY_DUPLICATED")) {
            console.log(
              "AUTH_KEY_DUPLICATED error detected. Regenerating session..."
            );
            regenerateSession();
          } else {
            console.log("Client start error:", err);
            handleTelegramError(err);
          }
        },
      });

      const savedSession = client!.session.save();
      if (typeof savedSession === "string" && savedSession.length > 0) {
        fs.writeFileSync(sessionFilePath, savedSession);
        sessionClient = savedSession;
        console.log("Session saved at:", sessionFilePath);
      } else {
        console.error("Session is invalid or empty.");
      }      
    } catch (error) {
      console.error("Error initiating new session:", error);
      handleTelegramError(error as Error);
    }
  }
}

async function regenerateSession() {
  console.log("Regenerating session...");
  try {
    if (fs.existsSync(sessionFilePath)) {
      fs.unlinkSync(sessionFilePath);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error("Unexpected error deleting session file:", e);
    }
  }

  sessionClient = "";
  initializeSession().catch((error) => {
    console.error("Error re-initializing session:", error);
    setTimeout(initializeSession, retryInterval);
  });
}

async function restartService() {
  if (isRestarting) {
    console.warn("⚠️ Restart already in progress. Skipping.");
    return;
  }

  isRestarting = true;
  try {
    console.log("🔁 Restarting service...");

    if (expressServer) {
      await new Promise<void>((resolve, reject) => {
        expressServer.close((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
      expressServer = null;
    }

    if (client) {
      await client.disconnect();
      client = null;
    }

    await initializeService();
    console.log("✅ Service restarted successfully.");
  } catch (error) {
    console.error("❌ Error restarting service:", error);
    setTimeout(restartService, retryInterval);
  } finally {
    isRestarting = false;
  }
}

async function handleTelegramError(error: Error) {
  console.error("Telegram error:", error);

  const msg = error.message || "";

  if (msg.includes("USER_DEACTIVATED")) {
    console.warn("Session invalid: Telegram account was deactivated.");
    await regenerateSession(); // Remove session and reinit
    return;
  }

  if (msg.includes("TIMEOUT") || msg.includes("Not connected")) {
    console.warn("Connection issue, retrying...");
    retryInterval = Math.min(retryInterval * 2, 60000); // Exponential backoff
    await retryConnection(startClient, retryInterval);
  } else if (msg.includes("Conflict") || msg.includes("EADDRINUSE")) {
    console.warn("Conflict detected, restarting service...");
    await restartService();
  } else if (msg.includes("AUTH_KEY_DUPLICATED")) {
    console.log("AUTH_KEY_DUPLICATED detected. Regenerating session...");
    await regenerateSession();
  } else {
    console.error("Unhandled error, restarting client...");
    setTimeout(startClient, retryInterval);
  }
}

async function retryConnection(
  startClient: () => Promise<void>,
  retryInterval: number
) {
  let retries = 0;
  const maxRetries = 5;
  let connected = false;

  while (!connected && retries < maxRetries) {
    try {
      await startClient();
      console.log("Service restarted successfully.");
      connected = true;
    } catch (error) {
      console.error(`Retry attempt ${retries + 1} failed:`, error);
      retries++;
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
      retryInterval = Math.min(retryInterval * 2, 60000); // Exponential backoff, max 60 seconds
    }
  }

  if (!connected) {
    console.error("Failed to reconnect after maximum attempts.");
    process.exit(1);
  }
}

async function sendCaptchaProCode(
  promoCode: string,
  key: any,
  captchaCode: string,
  token: string,
  apiEndPoint: string,
  site: string,
  hostUrl: string,
  retryCount: number = 0
): Promise<any> {
  return captchaLimiter.schedule(async () => {
    try {
      const result = await postCaptchaCode(promoCode, { key, captchaCode, token }, apiEndPoint, site, hostUrl);
      const statusCode = result?.status_code ?? 0;
      const message = result?.text_mess?.th || "";

      if (statusCode === 500 && message.includes("ระบบมีผู้ใช้งานจำนวนมาก")) {
        if (retryCount < MAX_RETRIES) {
          const delayMs = Math.min(5000 * Math.pow(2, retryCount), 60000);
          console.warn(`🚫 Server busy. Retrying in ${delayMs / 3000}s...`);
          await delay(delayMs);
          return sendCaptchaProCode(promoCode, key, captchaCode, token, apiEndPoint, site, hostUrl, retryCount + 1);
        } else {
          console.error("❌ Maximum retry attempts for Captcha.");
          return null;
        }
      }
      return result;
    } catch (err) {
      console.error("❌ Error while sending captcha:", err);
      return null;
    }
  });
}


function abortCurrentSite(siteName: string) {
  const queue = siteQueues[siteName];
  if (queue && queue.isProcessing && queue.abortFlag) {
    console.log(`🛑 Aborting current processing for ${siteName}...`);
    queue.abortFlag.canceled = true;
  }
}

async function initializeService() {
  // 🚀 Initialize client
  if (!client) await initializeSession();

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));
  app.use("/", viewRoutes);
  app.use("/api", apiRoutes);

  // 🩺 Health check with auto restart
  app.get("/health", async (req, res) => {
    try {
      if (!client || !client.connected) await initializeSession();
      res.status(200).json({ status: "Healthy" });
    } catch (err: any) {
      console.error("❌ Health check failed:", err);
      res.status(500).json({ status: "Unhealthy", error: err.message });

      const now = Date.now();
      if (now - lastRestartTime > 3 * 60 * 1000) {
        lastRestartTime = now;
        console.log("🔄 Restarting service...");
        try {
          await restartService();
          console.log("✅ Restart complete.");
        } catch (restartErr) {
          console.error("🚨 Restart failed:", restartErr);
        }
      } else {
        console.warn("⚠️ Restart skipped to avoid rapid restart loop.");
      }
    }
  });

  // 🟢 Initialize or reconnect client
  if (!client) {
    await initializeSession();
  } else {
    await initializeClient();
    await getChatsList(client);
  }

  // 🎯 Handle incoming message
  const handleIncomingMessage = async (message: string, chatId?: string) => {
    if (!message) return;
    const text = message.toLowerCase();
    if (text === lastHandledMessage) return;
    lastHandledMessage = text;

    const parsedCodes = parserCodeMessage(message);
    if (parsedCodes.length < 10) return;
    const shuffledCodes = shuffleArray(parsedCodes);
    console.log("🎯 Valid Bonus Codes:", parsedCodes);

    // 🔍 Detect site: Chat ID → keyword
    let siteConfig = chatId ? detectSiteFromChatId(chatId) : null;
    if (!siteConfig) siteConfig = detectSite(text);
    if (!siteConfig) {
      console.log("⚠️ Unrecognized message source.");
      return;
    }

    const site = siteConfig.name;
    const apiEndPoint = siteConfig.endpoint;
    const players = siteConfig.players;
    const hostUrl = process.env[siteConfig.envVar] || "";

    informationSet = {
      site,
      cskh_url: siteConfig.cskh_url,
      cskh_home: siteConfig.cskh_url,
      endpoint: apiEndPoint,
      key_free: siteConfig.key_free,
    };
    // console.log("Site", informationSet);

    // 📝 Create site queue if not exists
    if (!siteQueues[site]) {
      siteQueues[site] = {
        remainingCodes: [],
        isProcessing: false,
        abortFlag: { canceled: false },
        players,
        apiEndPoint,
        site,
        hostUrl,
      };
    }

    // 🔄 Add unique codes to queue
    const existing = new Set(siteQueues[site].remainingCodes);
    const newCodes = shuffledCodes.filter(c => !existing.has(c));
    siteQueues[site].remainingCodes.unshift(...newCodes);

    // 🔁 Start processing loop if needed
    const active = Object.values(siteQueues).find(q => q.isProcessing);
    if (active) {
      if (active.site !== site) {
        abortCurrentSite(active.site);
        startProCodeLoop(site).catch(err => console.error(err));
      } else {
        console.log(`♻️ Added new codes to ${site} queue.`);
      }
    } else {
      startProCodeLoop(site).catch(err => console.error(err));
    }
  };

  // 📩 Telegram Event Handlers
  const addEventHandlers = async (client: any) => {
    client.addEventHandler(
      (event: NewMessageEvent) => {
        const message = event.message;
        if (!message || !message.text || !message.peerId) return;

        const id = `${message.peerId.toString()}_${message.id}`;
        if (processedMessageIds.has(id)) return;

        processedMessageIds.add(id);
        handleIncomingMessage(message.text, message.peerId.toString());
        setTimeout(() => processedMessageIds.delete(id), 300_000);
      },
      new NewMessage({})
    );

    client.addEventHandler(
      async (update: any) => {
        const type = update.className || update?.constructor?.name;
        if (type === "UpdateConnectionState") return;

        if (type === "UpdateEditMessage" || type === "UpdateEditChannelMessage") {
          const msg = update.message;
          if (!msg || typeof msg.message !== "string" || !msg.peerId) return;

          const id = `${msg.peerId.toString()}_${msg.id}`;
          if (processedMessageIds.has(id)) return;

          processedMessageIds.add(id);
          await handleIncomingMessage(msg.message, msg.peerId.toString());
          setTimeout(() => processedMessageIds.delete(id), 10_000);
        }
      },
      new Raw({})
    );
  };

  // 🔌 Ensure client connection
  const ensureConnectedAndAddHandlers = async () => {
    if (client && client.connected) {
      console.log("✅ Client is connected.");
      await addEventHandlers(client);
    } else {
      console.log("🔁 Reconnecting client...");
      await initializeClient();
      if (client && client.connected) {
        console.log("✅ Reconnected and ready.");
        await addEventHandlers(client);
      } else {
        console.log("❌ Failed to reconnect client.");
        await restartService();
      }
    }
  };

  await ensureConnectedAndAddHandlers();

  // 🌐 Start Express server
  const startServer = (port: number) =>
    new Promise<void>((resolve, reject) => {
      expressServer = app
        .listen(port, () => {
          console.log(`🚀 Server running on port ${port}`);
          resolve();
        })
        .on("error", (err: any) => {
          if ((err as any).code === "EADDRINUSE") {
            console.warn(`⚠️ Port ${port} in use. Trying port ${port + 1}...`);
            resolve(startServer(port + 1));
          } else {
            reject(err);
          }
        });
    });

  try {
    await startServer(port);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }

  // 🛑 Graceful shutdown
  const gracefulShutdown = () => {
    console.log("🛑 Shutting down gracefully...");
    expressServer?.close(() => console.log("🪣 Express server closed."));
    if (client) client.disconnect().then(() => process.exit(0));
    else process.exit(0);
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
}

// 🚀 startProCodeLoop (รองรับ abort)
async function startProCodeLoop(siteName: string) {
  if (siteName == "thai_jun88k36") {
    minPoint = 18;
  } else {
    minPoint = 15;
  }

  const siteQueue = siteQueues[siteName];
  if (!siteQueue) return;

  if (siteQueue.isProcessing) return;

  siteQueue.isProcessing = true;
  siteQueue.abortFlag.canceled = false; // reset flag
  const abortFlag = siteQueue.abortFlag;

  try {
    const { remainingCodes, players, apiEndPoint, site, hostUrl } = siteQueue;
    const rawSentPlayers = await resetDailySentIfNeeded();

    const siteData: SiteSentPlayers = rawSentPlayers[siteName]
      ? {
          appliedPlayers: rawSentPlayers[siteName],
          playersLock: [],
        }
      : { appliedPlayers: [], playersLock: [] };

    const now = Date.now();

    const sentPlayerIds = new Set(
      siteData.appliedPlayers
        .filter(p => now < (p.time_limit ?? p.time + 24 * 60 * 60 * 1000))
        .map(p => p.player)
    );

    const playerLocks = new Set(siteData.playersLock.map(lock => lock.player));
    const playersSkip = new Set<string>();
    cleanupExpiredBlocks();

    console.log("Start Loop Code in site : ",siteName)
    while (true) {
      if (abortFlag?.canceled) {
        console.log(`⏹️ Processing for ${site} aborted.`);
        break;
      }

      if (remainingCodes.length === 0) {
        await new Promise(res => setTimeout(res, 1000));
        if (remainingCodes.length === 0) break;
        else continue;
      }

      const promoCode = remainingCodes.shift();
      if (!promoCode) continue;

      try {
        const key = await encryptText(promoCode, informationSet.key_free);
        const { captchaUrl, token } = await getVerificationCode(
          apiEndPoint,
          site,
          hostUrl
        );
        const { captchaCode, captchaPath } = await getInputCaptcha(captchaUrl, site);

        const result = await sendCaptchaProCode(
          promoCode,
          key,
          captchaCode,
          token,
          apiEndPoint,
          site,
          hostUrl
        );
        if (!result) continue;

          const statusCode = result.status_code ?? result?.ststus_code ?? 0;
          const message = result?.text_mess?.th || "";

          // if (siteName === "thai_f168") {
          //   console.log(result);
          //   return false;
          //   // thai_168: ถ้าไม่ใช่ข้อความผิดแคปต์ชา → addTemplate
          //   const isCaptchaError = result.message.includes("แคปต์ชาไม่ถูกต้องจ้า ลองพิมพ์ใหม่อีกครั้งนะ 💕");
          //   if (!isCaptchaError) {
          //     addTemplate(captchaPath, captchaCode, site);
          //   } else {
          //     console.log("แคปต์ชาไม่ถูกต้องจ้า ไม่เพิ่ม addTemplates");
          //   }
          // } else {
          //   // site อื่นๆ: ถ้า status 400 และข้อความบอก captcha ผิด → ไม่ add
          //   const isCaptchaError = statusCode === 400 && message.includes("รหัส Captcha ไม่ถูกต้อง");
          //   if (!isCaptchaError) {
          //     addTemplate(captchaPath, captchaCode, site);
          //   }
          // }


        // const isCaptchaError = statusCode === 400 && message.includes("รหัส Captcha ไม่ถูกต้อง");
        // if (!isCaptchaError) {
        //   addTemplate(captchaPath, captchaCode, site);
        // }

        
        if (statusCode === 502 || message.includes("กรุณาลองใหม่อีกครั้ง")) {
          console.warn("🚫 Code already used (502), skipping.");
          continue;
        }

        if (statusCode === 429 || statusCode === 400) {
          console.warn("⏳ Rate limited. Resetting IP and retrying...");
          remainingCodes.unshift(promoCode);
          continue;
        }

        if (statusCode === 9001) {
          console.log(`⚠️ Invalid promo code: ${promoCode}`);
          continue;
        }

        if (statusCode === 200 && result.valid) {
          const point = result?.detail?.point ?? 0;

          if (point > minPoint) {
            try {
              let singlePlayer: string | undefined;
              singlePlayer = await getSinglePlayer(point, site);

              if (singlePlayer && !playerLocks.has(singlePlayer)) {

                // ✅ บันทึกว่า player นี้ถูกยิงไปแล้ว
                markPlayerTried(site, singlePlayer);          
                      
                const singleResult = await sendCodeToPlayer(
                  singlePlayer,
                  promoCode.trim(),
                  key,
                  apiEndPoint,
                  site,
                  token,
                  hostUrl
                );

                console.log(
                  `📩 Full Result in getSinglePlayers ${singlePlayer}:`,
                  singleResult
                );

                const singleCodeStatus =
                  singleResult.status_code ?? singleResult?.ststus_code ?? 0;
                const singleMessage = singleResult?.text_mess?.th || "";

                if (singleCodeStatus === 200 && singleResult?.valid) {
                  await updateApplyCodeLog(
                    site,
                    singlePlayer,
                    promoCode,
                    point
                  );
                  sentPlayerIds.add(singlePlayer);
                  playersSkip.add(singlePlayer);
                } else {
                  const rawPlayers = await getPlayerPool(point, site);
                  if (singleCodeStatus === 502) {
                    continue;
                  } else if ([9001, 9002].includes(singleCodeStatus)) {
                    remainingCodes.unshift(promoCode);
                    continue;
                  }

                  if (lockDurations[singleCodeStatus]) {
                    playerLocks.add(singlePlayer);
                    try {
                      await updatePlayersLock(
                        site,
                        singlePlayer,
                        singleMessage,
                        lockDurations[singleCodeStatus],
                        singleCodeStatus
                      );
                      console.log("✔️ Add PlayersLock complete.");
                    } catch (err) {
                      console.error("❌ Failed to add PlayersLock:", err);
                    }

                    if ([403, 4044, 9003, 9004, 9007].includes(singleCodeStatus)) {
                      remainingCodes.unshift(promoCode);
                      continue;
                    }
                  }

                  await applyCodeToPlayers(
                    promoCode,
                    key,
                    token,
                    apiEndPoint,
                    site,
                    hostUrl,
                    rawPlayers,
                    sentPlayerIds,
                    playersSkip,
                    playerLocks,
                    remainingCodes
                  );
                }
                continue;
              } else {
                const rawPlayers = await getPlayerPool(point, site);
                await applyCodeToPlayers(
                  promoCode,
                  key,
                  token,
                  apiEndPoint,
                  site,
                  hostUrl,
                  rawPlayers,
                  sentPlayerIds,
                  playersSkip,
                  playerLocks,
                  remainingCodes
                );
              }
            } catch (err) {
              console.error("❌ Error in getSinglePlayer:", err);
              const rawPlayers = await getPlayerPool(point, site);
              await applyCodeToPlayers(
                promoCode,
                key,
                token,
                apiEndPoint,
                site,
                hostUrl,
                rawPlayers,
                sentPlayerIds,
                playersSkip,
                playerLocks,
                remainingCodes
              );
              continue;
            }
          } else {
            console.log(
              `⚠️ Promo code: ${promoCode} is Point not target (${point})`
            );
          }

          continue;
        }
      } catch (err) {
        console.error("❌ Unexpected error:", err);
      }
    }
  } finally {
    console.log(`⏹️ Processing remainingCodes End.`);
    siteQueue.isProcessing = false;

    // ❌ ป้องกันไม่ให้ site ที่ถูก abort รีสตาร์ทตัวเอง
    if (!siteQueue.abortFlag?.canceled &&
        siteQueue.remainingCodes.length > 0 &&
        !siteQueue.isProcessing) {

      console.log(`🔄 New codes detected after end, restarting loop for ${siteName}...`);
      startProCodeLoop(siteName).catch(err => {
        console.error(`❌ Error restarting loop for site ${siteName}:`, err);
      });
    }
  }

}

async function applyCodeToPlayers(
  promoCode: string,
  key: string,
  token: string,
  apiEndPoint: string,
  site: string,
  hostUrl: string,
  players: string[],
  sentPlayersToday: Set<string>,
  playersSkip: Set<string>,
  playerLocks: Set<string>,
  remainingCodes: string[]
): Promise<boolean> {
  const availablePlayers = players.filter(
    (p) => !sentPlayersToday.has(p) && !playersSkip.has(p)
  );

  for (const player of availablePlayers) {
    if (playerLocks.has(player)) {
      console.log(`🔒 Skip player ${player}, already locked.`);
      playersSkip.add(player);
      continue;
    }

    playerLocks.add(player);

    try {
      const res = await sendCodeToPlayer(
        player,
        promoCode.trim(),
        key,
        apiEndPoint,
        site,
        token,
        hostUrl
      );

      console.log(`📩 Full Result in applyCodeToPlayers ${player}::`, res); // ตรวจสอบโครงสร้างก่อน


      const statusCode = res.status_code ?? res?.ststus_code ?? 0;
      const msg = res?.title_mess?.th || "";
      const codeText = res?.text_mess?.th || "";

      console.log(`📩 Result for player ${player}:`, { statusCode, msg });

      switch (statusCode) {
        case 200:
          if (res?.valid) {
            const point = res?.point ?? 0;
            updateApplyCodeLog(site, player, promoCode, point);
            console.log(`✅ Code applied successfully to player ${player} (${point} points)`);
            sentPlayersToday.add(player);
            return true;
          } else {
            console.warn(`⚠️ Response 200 but code is not valid for ${player}`);
            playersSkip.add(player);
          }
          break;
        case 502:
          break;
        case 9010:
        case 9001:
        case 9002:
        case 4044:
          remainingCodes.unshift(promoCode);
          await updatePlayersLock(site, player, codeText, lockDurations[statusCode], statusCode);
          console.log(`✔️ Added ${player} to PlayersLock`);
          break;          
        case 429:
          console.warn("⚠️ Rate limited. Retrying after delay...");
          remainingCodes.unshift(promoCode);
          return false;
        default:
          if (lockDurations[statusCode]) {
            console.warn(`🚫 Player ${player} blocked or not eligible (${statusCode}). Locking.`);
            try {
              await updatePlayersLock(site, player, codeText, lockDurations[statusCode], statusCode);
              console.log(`✔️ Added ${player} to PlayersLock`);
            } catch (err) {
              console.error(`❌ Failed to lock player ${player}:`, err);
            }
            playersSkip.add(player);
            remainingCodes.unshift(promoCode);
          } else {
            console.warn(`❗️Unhandled response for ${player}: ${statusCode} | ${msg} | ${codeText}`);
          }
          break;
      }
    } catch (err) {
      console.error(`❌ Error while applying code to ${player}:`, err);
    } finally {
      playersSkip.add(player);
    }
  }

  return false;
}

async function startClient() {
  try {
    if (!client) await initializeClient();
    console.log("Client Connected:", client!.connected);
    await initializeService();
  } catch (error: any) {
    console.error("💥 Error during startup:", error.message);
    setTimeout(startClient, 3000);
  }
}

async function getChatsList(client: TelegramClient) {
  try {
    const dialogs = await client.getDialogs();
    dialogs.forEach((dialog: any) => {
      console.log(`Chat ID: ${dialog.id}, Title: ${dialog.title}`);
    });
  } catch (error) {
    console.error("Client get ChatsList Error:", error);
    handleTelegramError(error as Error);
  }
}

(async () => {
  await startClient();

  try {
    const me = (await client!.getEntity("me")) as Api.User;
    const displayName = [me.firstName, me.lastName].filter(Boolean).join(" ");
    console.log(`🤖 Signed in as: ${displayName}`);
    console.log(`🆔 Telegram ID: ${me.id.toString()}`);
  } catch (err) {
    console.error("❌ Failed to fetch Telegram user info:", err);
  }

// Update Code: Keep-alive ping every 5 minutes 
const baseUrl = `${process.env.BASE_URL}/health`;

cron.schedule("*/5 * * * *", async () => {
  try {
    const res = await axios.get(`${process.env.BASE_URL}/health`);
    console.log(`[${new Date().toISOString()}] 🔁 Self-ping: ${res.data.status}`);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] 🛑 Self-ping failed:`, err.message);
  }
});

cron.schedule("*/5 * * * *", async () => {
  try {
    const response = await axios.get(`${process.env.OCR_API_BASE}/health`);
    console.log(`[${new Date().toISOString()}] ✅ OCR API OK. Status: ${response.status}`);
  } catch (err: any) {
    console.error(`[${new Date().toISOString()}] 🛑 OCR API ping failed:`, err.message);
  }
});


//thai_789bet: reset เวลา 11:00 (GMT+7)
cron.schedule('0 0 11 * * *', () => {
  try {
    clearApplyCodeTemplateForSite("thai_789bet");
  } catch (err) {
    console.error("❌ Failed to reset thai_789bet:", err);
  }
}, {
  timezone: "Asia/Bangkok"
});

// thai_jun88k36: reset เวลา 24:00 (GMT+7)
cron.schedule('0 0 0 * * *', () => {
  try {
    clearApplyCodeTemplateForSite("thai_jun88k36");
  } catch (err) {
    console.error("❌ Failed to reset thai_jun88k36:", err);
  }
}, {
  timezone: "Asia/Bangkok"
});

})();


