// // polling.ts
// import { TelegramClient } from "telegram";
// import {
//   promptInput,
//   delay,
//   shuffleArray,
//   loadPollTargets,
// } from "./utils";
// import { SiteQueue, ChannelMessageResult, PollTarget, MessageSnapshot,  ChannelSnapshot } from "./types/siteConfigs";

// let client: TelegramClient | null = null;
// let POLL_TARGETS: PollTarget[] = [];

// const messageCache = new Map<string, MessageSnapshot>();
// const latestMessageCache = new Map<string, ChannelSnapshot>();
// let pollInterval: NodeJS.Timeout | null = null;
// let latestPollInterval: NodeJS.Timeout | null = null;
// let isPollingById = false;
// let isPollingLatest = false;

// export function setPollingClient(c: TelegramClient) {
//   client = c;
// }

// // =======================
// // 🛑 Stop Polling
// // =======================
// export function stopPolling() {
//   if (pollInterval) {
//     clearInterval(pollInterval);
//     pollInterval = null;
//   }

//   if (latestPollInterval) {
//     clearInterval(latestPollInterval);
//     latestPollInterval = null;
//   }

//   isPollingById = false;
//   isPollingLatest = false;

//   console.log("🛑 Polling stopped");
// }

// // =======================
// // ▶️ Start Polling
// // =======================
// export async function startPolling() {
//   if (!client) {
//     console.warn("⚠️ startPolling called without client");
//     return;
//   }

//     POLL_TARGETS = await loadPollTargets();
  
//   // 🔁 POLL BY MESSAGE ID
//   if (!pollInterval) {
//     pollInterval = setInterval(async () => {
//       if (isPollingById || !client) return;
//       if (POLL_TARGETS.length === 0) return;

//       isPollingById = true;
//       try {
//         for (const target of POLL_TARGETS) {
//           await pollMessageById(
//             client,
//             target.channelId,
//             target.messageId
//           );
//           await delay(1500);
//         }
//       } finally {
//         isPollingById = false;
//       }
//     }, 10_000);

//     console.log("🟢 Polling by messageId started");
//   }

//   // 🔁 POLL LATEST MESSAGE
//   if (!latestPollInterval) {
//     latestPollInterval = setInterval(async () => {
//       if (isPollingLatest || !client) return;

//       isPollingLatest = true;
//       try {
//         for (const channelId of channel789Ids) {
//           await pollLatestMessageByChannel(client, channelId);
//           await delay(1500);
//         }
//       } finally {
//         isPollingLatest = false;
//       }
//     }, 10_000);

//     console.log("🟢 Polling latest messages started");
//   }
// }
