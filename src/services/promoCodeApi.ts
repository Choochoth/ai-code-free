import axios, { AxiosInstance, AxiosResponse } from "axios";
import https from "https";
import fs from "fs";
import FormData from "form-data";
import "dotenv/config";
import Bottleneck from "bottleneck";
import { generateMockSiteHeaders } from "../device";
import { sendResultToTelegram } from "../telegramBot";
import { formatTelegramMessage, getTelegramId } from "../utils";
import { reloadPollingTargets } from "../main";

const agent = new https.Agent({
  keepAlive: true,
  secureProtocol: "TLS_method",
});

const OCR_API_BASE = process.env.OCR_API_BASE || "";
const baseUrl = process.env.BASE_URL || "";
let reloading = false;
let reloadTimer: NodeJS.Timeout | null = null;

// ---------------- Axios + Bottleneck ----------------
const api: AxiosInstance = axios.create({
  httpsAgent: agent,
  validateStatus: () => true,
});

const limiter = new Bottleneck({
  minTime: 50,
  maxConcurrent: 5,
});

// ฟังก์ชัน axios ปกติ
async function axiosGet<T = any>(url: string, config?: any): Promise<AxiosResponse<T>> {
  return api.get<T>(url, config);
}

async function axiosPost<T = any>(
  url: string,
  data?: any,
  config?: any
): Promise<AxiosResponse<T>> {
  return api.post<T>(url, data, config);
}

// wrap ด้วย limiter แล้ว cast type กลับ
const limitedGet = limiter.wrap(axiosGet) as typeof axiosGet;
const limitedPost = limiter.wrap(axiosPost) as typeof axiosPost;

// ---------------- Helpers ----------------
function getAxiosConfig(headers: any) {
  return {
    headers,
    validateStatus: () => true,
    httpsAgent: agent,
  };
}

async function safeReload() {
  if (reloading) {
    console.log("⏭️ Reload already running, skip");
    return;
  }

  reloading = true;
  try {
    await reloadPollingTargets();
  } finally {
    reloading = false;
  }
}

function triggerReload() {
  if (reloadTimer) return;

  reloadTimer = setTimeout(async () => {
    reloadTimer = null;
    await safeReload();
  }, 1000); // reload สูงสุด 1 ครั้ง/วินาที
}

// ---------------- API Functions ----------------

export async function sendCodeToPlayer(
  playerId: string,
  promoCode: string,
  key: string,
  apiEndPoint: string,
  site: string,
  token: string,
  hostUrl: string
) {
  // ---------- F168 ไม่ต้อง call เลย ----------
  if (site === "thai_f168") {
    return { skip: true, reason: "F168 does not use send-to-player API." };
  }

  const url = `${apiEndPoint}/client?player_id=${playerId}&promo_code=${promoCode}&site=${site}`;
  const payload = { key };
  const headers = generateMockSiteHeaders(hostUrl, site);
  headers.Authorization = token;

  if (site === "thai_789bet") {
    headers.cookie = `token=${token}`;
  }

  try {
    const res = await limitedPost(url, payload, getAxiosConfig(headers));

    if (res.data.status_code === 200 && res.data.valid) {
      res.data.site = site;
      res.data.link = `${baseUrl}/package`;

      const telegram_id = getTelegramId(res.data.player_id); // ✅ now correct

      await sendResultToTelegram(
        formatTelegramMessage(res.data),
        telegram_id
      );
    }


    return res.data;
  } catch (err: any) {
    console.error(`❌ Error sending code to player ${playerId}:`, err.message || err);
    throw new Error(`Failed to send code to player: ${err.message || "Unknown error"}`);
  }
}

export async function getVerificationCode(apiEndPoint: string, site: string, hostUrl: string) {
  const cleanApiEndpoint = apiEndPoint.replace(/\/+$/, "");

  // ---------- F168 ----------
  if (site === "thai_f168") {
    const url = `${cleanApiEndpoint}/captcha/get-verification-code`;
    const fullUrl = `${url}?site=${"68d63c5e056c355a7243a39f"}&date=${Date.now()}`;

    try {
      const res = await limitedGet(fullUrl);
      if (res.data?.captchaUrl && res.data?.token) {
        return { captchaUrl: res.data.captchaUrl, token: res.data.token };
      } else {
        throw new Error("API response is missing necessary fields (F168).");
      }
    } catch (error: any) {
      console.error("❌ Failed to get verification code (F168):", error.message || error);
      throw error;
    }
  }

  // ---------- DEFAULT (jun88, 789bet) ----------
  const url = `${cleanApiEndpoint}/api/get-verification-code`;
  const headers = generateMockSiteHeaders(hostUrl, site);

  try {
    const res = await limitedGet(url, { params: { site }, headers });

    if (res.data?.captchaUrl && res.data?.token) {
      return { captchaUrl: res.data.captchaUrl, token: res.data.token };
    } else {
      throw new Error("API response is missing necessary fields.");
    }
  } catch (error: any) {
    console.error("❌ Failed to get verification code:", error.message || error);
    throw error;
  }
}

export async function postCaptchaCode(
  promoCode: string,
  {
    key,
    captchaCode,
    token,
  }: { key: string; captchaCode: string; token: string },
  apiEndPoint: string,
  site: string,
  hostUrl: string
) {
  const cleanApiEndpoint = apiEndPoint.replace(/\/+$/, "");

  // ---------- F168 ----------
  if (site === "thai_f168") {
    const url = `${cleanApiEndpoint}/f168/api/client/get-code?promo_code=${promoCode}&site=${"68d63c5e056c355a7243a39f"}`;
    const payload = { captchaCode, token }; // ❗ no key for F168

    try {
      const res = await limitedPost(url, payload);
      console.log(res.data);

      if (res.data?.status_code && res.data?.status_code !== 200) {
        throw new Error(`Error from server: ${res.data?.text_mess?.th || "Unknown error"}`);
      }

      return res.data;
    } catch (err: any) {
      console.error("❌ Error during postCaptchaCode (F168):", err.message || err);
      throw new Error(`Failed to post captcha code (F168): ${err.message || "Unknown error"}`);
    }
  }

  // ---------- DEFAULT (jun88, 789bet) ----------
  const url = `${cleanApiEndpoint}/client/get-code?promo_code=${promoCode}&site=${site}`;
  const payload = { key, captchaCode, token };
  const headers = generateMockSiteHeaders(hostUrl, site);
  headers.Authorization = token;

  try {
    const res = await limitedPost(url, payload, getAxiosConfig(headers));
    console.log(res.data);

    if (res.data?.status_code && res.data?.status_code !== 200) {
      throw new Error(`Error from server: ${res.data?.text_mess?.th || "Unknown error"}`);
    }

    return res.data;
  } catch (err: any) {
    console.error("❌ Error during postCaptchaCode:", err.message || err);
    throw new Error(`Failed to post captcha code: ${err.message || "Unknown error"}`);
  }
}

export async function addTemplate(filePath: string, label: string, site: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = `${OCR_API_BASE}/api/${site}/add-template?label=${encodeURIComponent(label)}`;
    const response = await limitedPost(url, form, {
      headers: { ...form.getHeaders() },
      httpsAgent: agent,
    });

    // console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ addTemplate error:", error.message || error);
    throw error;
  }
}

export async function ocr(filePath: string, site: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = `${OCR_API_BASE}/api/${site}/ocr`;
    const response = await limitedPost(url, form, {
      headers: { ...form.getHeaders() },
      httpsAgent: agent,
    });

    // console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ ocr error:", error.message || error);
    throw error;
  }
}


export async function jun88PollTarget() {
  const url = `${OCR_API_BASE}/api/poll-targets`;

  try {
    const response = await limitedGet(url, {
      timeout: 5000, // 🔥 ไม่ต้อง 15s
    });
    console.log("✅ poll-targets:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(
      "❌ load-poll-targets error:",
      error?.message || error
    );
    throw error;
  }
}

export async function updatePollTarget(
  channelId: string,
  messageId: number
) {
  const url = `${OCR_API_BASE}/api/poll-update`;
  const payload = { channelId, messageId };

  try {
    const response = await limitedPost(url, payload, {
      timeout: 3000, // 👈 พอ
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ poll-update:", response.data);

    setImmediate(() => {
      triggerReload();
    });

    return response.data;
  } catch (error: any) {
    console.error(
      "❌ poll-update error:",
      error?.code || error?.message
    );
    return null; // ⬅️ สำคัญ: อย่า throw
  }
}
