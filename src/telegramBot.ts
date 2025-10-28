import { Telegraf, Context } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
const bot = new Telegraf(botToken);
const ADMIN_IDS = (process.env.ADMIN_IDS || "")
  .split(",")
  .map(id => id.trim())
  .filter(id => id.length > 0)
  .map(id => Number(id)); // แปลงเป็น number
// const ADMIN_IDS: (number | string)[] = [7841730633, 7551758092];

// Map to track pending CAPTCHA replies
const pendingCaptchas = new Map<number, {
  resolve: (code: string) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Global handler for all incoming text messages
bot.on('text', async (ctx: Context<Update.MessageUpdate<Message.TextMessage>>) => {
  const message = ctx.message;

  if (!message.reply_to_message) return;

  const replyToId = message.reply_to_message.message_id;
  const entry = pendingCaptchas.get(replyToId);
  if (!entry) return;

  const code = message.text?.trim();
  if (!code || code.length < 4) return;

  console.log(`🔤 Received CAPTCHA: ${code}`);

  clearTimeout(entry.timeout);
  pendingCaptchas.delete(replyToId);
  entry.resolve(code);
});

export async function sendCaptchaToTelegram(imagePath: string): Promise<string> {
  const captchaId = path.basename(imagePath, '.png');
  const caption = `🔒 CAPTCHA for ID: ${captchaId}\nPlease reply to this message with the code`;

  let sentMessageId: number | null = null;

  for (const adminId of ADMIN_IDS) {
    try {
      const sent = await bot.telegram.sendPhoto(adminId, { source: imagePath }, { caption });
      console.log(`✅ CAPTCHA sent to ${adminId}`);
      // Use the first successful one to track reply
      if (sentMessageId === null) {
        sentMessageId = sent.message_id;
      }
    } catch (err) {
      console.error(`❌ Failed to send CAPTCHA to ${adminId}:`, err);
    }
  }

  if (sentMessageId === null) {
    throw new Error("❌ Failed to send CAPTCHA to all admins.");
  }

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingCaptchas.delete(sentMessageId!);
      reject(new Error("⏰ CAPTCHA reply timeout"));
    }, 2 * 60 * 1000); // 2-minute timeout

    pendingCaptchas.set(sentMessageId, { resolve, reject, timeout });
  });
}

// export async function sendResultToTelegram(result: {
//   site: string;
//   link: string;
//   status_code: number;
//   valid: boolean;
//   status_mess: string;
//   player_id: string;
//   point: number;
// }): Promise<void> {
//   const caption = `
// Site: ${result.site}
// Link: ${result.link}
// Status Code: ${result.status_code}
// Valid: ${result.valid}
// Message: ${result.status_mess}
// Player ID: ${result.player_id}
// Points: ${result.point}
// `.trim();

//   for (const adminId of ADMIN_IDS) {
//     try {
//       await bot.telegram.sendMessage(adminId, caption);
//     } catch (error) {
//       console.error(`❌ Failed to send result to ${adminId}:`, error);
//     }
//   }
// }

export async function sendResultToTelegram(message: string, usertelegram?: number | null): Promise<void> {
  // 1) Send to the user (only if ID exists and is a real number)
  if (typeof usertelegram === "number" && usertelegram > 0) {
    try {
      await bot.telegram.sendMessage(usertelegram, message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error(`❌ Failed to send result to user ${usertelegram}:`, error);
    }
  }

  // 2) Broadcast to admins
  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendMessage(adminId, message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error(`❌ Failed to send result to admin ${adminId}:`, error);
    }
  }
}

export async function sendSlipToTelegram(packageName: string, imagePath: string): Promise<void> {
  const caption = `📦 มีการสั่งซื้อแพ็กเกจใหม่!\n\nแพ็กเกจ: *${packageName}*\nเวลา: ${new Date().toLocaleString('th-TH')}`;

  for (const adminId of ADMIN_IDS) {
    try {
      await bot.telegram.sendPhoto(adminId, { source: imagePath }, {
        caption,
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.error(`❌ Failed to send slip to ${adminId}:`, error);
    }
  }
}

// Start polling
bot.launch()
  .then(() => console.log('🤖 Bot started'))
  .catch(console.error);

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));



