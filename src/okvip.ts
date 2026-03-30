import axios from 'axios';
import FormData from 'form-data';  // Correct import
import CryptoJS from "crypto-js";
import md5 from "md5";
import * as fs from 'fs';
import sharp from 'sharp';
import path from "path";
import { exec } from 'child_process';
import { promisify } from 'util';
import {
sendCaptchaToTelegram
} from "./telegramBot";
import {
  promptInput,
  removeImage
} from "./utils";

import {
  ocr,
  addTemplate
} from "./services/promoCodeApi";

const execAsync = promisify(exec);

const baseDir = __dirname;  // Current directory of this script
const dataDir = path.join(baseDir, "data");
const captchaDirectory = path.join(dataDir, "images", "captchas");
const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8002";

try {
  if (!fs.existsSync(captchaDirectory)) {
    fs.mkdirSync(captchaDirectory, { recursive: true });
  }
} catch (error: any) {
  console.error(`Error creating directories: ${error.message}`);
}


// ฟังก์ชันสำหรับเข้ารหัสข้อความเป็น JSON
async function encryptText(text: string, key_free: string) {
    const jsonObject = { promo_code: text }; // ข้อมูล JSON ที่ต้องการเข้ารหัส
    
    // แปลงเป็นสตริง JSON
    const jsonString = JSON.stringify(jsonObject);
  
    const md5Key = md5(key_free).toLowerCase(); // ใช้ MD5 ของ key_free เป็นคีย์
    let cipherText = CryptoJS.AES.encrypt(jsonString, md5Key).toString(); // เข้ารหัสด้วย AES
    return cipherText;
  };
  
  // ฟังก์ชันสำหรับถอดรหัสข้อความที่เป็น JSON
  async function decryptText(cipherText: string, key_free: string) {
    const md5Key = md5(key_free).toLowerCase(); // ใช้ MD5 ของ key_free เป็นคีย์
    let bytes = CryptoJS.AES.decrypt(cipherText, md5Key); // ถอดรหัสด้วย AES
    let originalText = bytes.toString(CryptoJS.enc.Utf8); // แปลงเป็นข้อความธรรมดา
  
    // ตรวจสอบว่าข้อความที่ถอดรหัสไม่เป็นค่าว่างหรือไม่ได้ผลลัพธ์ที่คาดหวัง
    if (!originalText) {
      throw new Error("Decryption failed or the result is empty.");
    }
  
    // พิมพ์ค่าที่ถอดรหัสออกมาเพื่อการตรวจสอบ
    console.log("Decrypted Text:", originalText);
  
    try {
      // แปลงข้อความ JSON กลับเป็นอ็อบเจ็กต์ JSON
      return JSON.parse(originalText);
    } catch (error:any) {
      throw new Error("Failed to parse decrypted text as JSON: " + error.message);
    }
  };


async function getInputCaptcha(imageUrl: string, site:string): Promise<{ captchaCode: string, captchaPath: string }> {
  await fs.promises.mkdir(captchaDirectory, { recursive: true });

  const buffer = imageUrl.startsWith('data:image/svg+xml')
    ? Buffer.from(imageUrl.split(',')[1], 'base64')
    : await axios.get(imageUrl, { responseType: 'arraybuffer' }).then(res => res.data);

  const timestamp = Date.now();
  const tempPath = path.join(captchaDirectory, `temp-${timestamp}.png`);

  try {
    const svgString = buffer.toString('utf8');

    const processedBuffer = await sharp(Buffer.from(svgString))
      .resize(250, 100, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#FFFFFF' })
      .grayscale()
      .threshold(180)
      .median(1)
      .sharpen({ sigma: 2 })
      .normalize()
      .toBuffer();

    await fs.promises.writeFile(tempPath, processedBuffer);
    // console.log('✅ CAPTCHA image saved to:', tempPath);

    const captchas = await ocr(tempPath, site);
    console.log(`✅Before OCR Result: ${captchas.text}`);
    console.log(`📊 Confidence: ${captchas.confidence}% (ความมั่นใจเฉลี่ยของทั้ง 4 ตัว)`);
    let captchaCode: string = captchas.text.trim();
    // let captchaCode: string;
    // if (captchas.confidence >= 93) {
    //   captchaCode = captchas.text;
    // } else {
    //   console.warn("⚠️ IrfanView check removed, using default viewer...");
    //   await execAsync(`start "" "${tempPath.replace(/\\/g, '\\\\')}"`);

    //   try {
    //     captchaCode = await Promise.race([
    //       promptInput('🔤 Enter CAPTCHA code from image (within 30s): '),
    //       new Promise<string>((resolve) =>
    //         setTimeout(() => {
    //           console.warn("⏰ Timeout - using OCR result instead");
    //           resolve(captchas.text);
    //         }, 15000)
    //       ),
    //     ]);
    //   } catch (error) {
    //     console.warn("⚠️ Error or timeout, using OCR result");
    //     captchaCode = captchas.text;
    //   }
    // }

    // if (!captchaCode || captchaCode.trim().length < 4) {
    //   console.warn(`❗️Invalid CAPTCHA input. Skipping. Input: ${captchaCode}`);
    //   await removeImage(tempPath);
    //   throw new Error("Invalid CAPTCHA input");
    // }

    const finalPath = path.join(captchaDirectory, `${captchaCode}_${timestamp}.png`);
    await fs.promises.rename(tempPath, finalPath);
    // console.log('📦 Image renamed to:', finalPath);
    // await addTemplate(finalPath, captchaCode.toUpperCase())
    return {
      captchaCode: captchaCode,
      captchaPath: finalPath,
    };

  } catch (error) {
    console.error("❌ Failed to process SVG CAPTCHA:", error);

    // Cleanup
    if (await fs.promises.stat(tempPath).catch(() => false)) {
      await removeImage(tempPath);
    }

    throw new Error("Image conversion failed");
  }
}

async function getCaptchaMessage(imageUrl: string): Promise<{ captchaCode: string, captchaPath: string }> {
  await fs.promises.mkdir(captchaDirectory, { recursive: true });

  const buffer = imageUrl.startsWith('data:image/svg+xml')
    ? Buffer.from(imageUrl.split(',')[1], 'base64')
    : await axios.get(imageUrl, { responseType: 'arraybuffer' }).then(res => res.data);

  const timestamp = Date.now();
  const tempPath = path.join(captchaDirectory, `temp-${timestamp}.png`);

  try {
    const svgString = buffer.toString('utf8');

    const processedBuffer = await sharp(Buffer.from(svgString))
      .resize(250, 100, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .flatten({ background: '#FFFFFF' })
      .grayscale()
      .threshold(180)
      .median(1)
      .sharpen({ sigma: 2 })
      .normalize()
      .toBuffer();

    await fs.promises.writeFile(tempPath, processedBuffer);
    // console.log('✅ CAPTCHA image saved to:', tempPath);

    const captchaText = (await sendCaptchaToTelegram(tempPath)).trim().toUpperCase();

    if (captchaText.length !== 4) {
      console.warn(`❗️Invalid CAPTCHA input. Skipping. Input: ${captchaText}`);
      await removeImage(tempPath);
      throw new Error("Invalid CAPTCHA input");
    }

    const finalPath = path.join(captchaDirectory, `${captchaText}_${timestamp}.png`);
    await fs.promises.rename(tempPath, finalPath);
    // console.log('📦 Image renamed to:', finalPath);

    return { captchaCode: captchaText, captchaPath: finalPath };

  } catch (error) {
    console.error("❌ Failed to process SVG CAPTCHA:", error);

    if (await fs.promises.stat(tempPath).catch(() => false)) {
      await removeImage(tempPath);
    }

    throw new Error("Image conversion failed");
  }
}

function parserCodeMessage(message: string): string[] {
  if (!message) return [];

  /*
  =============================
  ✅ VALID CODE
  =============================
  */
  const validCodeRegex = /^[A-Z0-9]{5,12}$/i;

  /*
  =============================
  ✅ PREFIX BLACKLIST
  =============================
  */
  const blacklistPrefixes = [
    "#",
    "@",
    "HTTP",
    "HTTPS",
    "WWW",
    "M.",
    "789BET",
    "JUN88",
    "TWITTER"
  ];

  /*
  =============================
  ✅ WORD BLACKLIST
  =============================
  */
  const blacklistRegex =
    /^(FREECODE|GOOGLE|CHROME|TELEGRAM|FACEBOOK|INSTAGRAM|OFFICIAL|CODEJUN88|CODEJUN88|CASINOJUN88|BACARAT|06789BET|TWITTER|SLOTGAME|SlotJun88|Jun88th|Jun88|Cashback|ht99th|codeth99|freecodht99|ht99THAILAND|Slotth99|casinoht99)$/i;

  /*
  =============================
  ✅ CLEAN MESSAGE
  IMPORTANT ⭐
  emoji → SPACE
  =============================
  */
  const normalized = message
    // remove url
    .replace(/https?:\/\/\S+/gi, " ")

    // emoji → space (สำคัญสุด)
    .replace(/\p{Extended_Pictographic}/gu, " ")

    // keep only letters+numbers
    .replace(/[^a-zA-Z0-9]/g, " ")

    // normalize space
    .replace(/\s+/g, " ")
    .trim();

  /*
  =============================
  ✅ SPLIT TOKEN
  =============================
  */
  const tokens = normalized.split(" ");

  /*
  =============================
  ✅ FILTER CODE
  =============================
  */
  const codes = tokens.filter(token => {
    if (!validCodeRegex.test(token)) return false;
    // const upper = token.toUpperCase();

    const upper = token;

    if (blacklistPrefixes.some(p => upper.startsWith(p)))
      return false;

    if (blacklistRegex.test(upper))
      return false;

    return true;
  });

  /*
  =============================
  ✅ UNIQUE + NORMALIZE
  =============================
  */
  return [...new Set(codes.map(c => c))];
}

async function openImage(captchaPath: string, ocrResult: string): Promise<string> {
  let captchaCode: string = ocrResult; // default fallback จาก OCR

  // เปิดรูป (Windows)
  await execAsync(`start "" "${captchaPath.replace(/\\/g, '\\\\')}"`).catch(() => {
    console.warn("⚠️ ไม่สามารถเปิดรูปอัตโนมัติได้ กรุณาเปิดเอง:", captchaPath);
  });

  try {
    captchaCode = await Promise.race([
      promptInput("🔤 Enter CAPTCHA code from image (within 30s): "), // user input
      new Promise<string>((resolve) =>
        setTimeout(() => {
          console.warn("⏰ Timeout - ใช้ค่า OCR แทน");
          resolve(ocrResult); // fallback
        }, 30000)
      ),
    ]);
  } catch (error) {
    console.warn("⚠️ Error หรือ exception, ใช้ค่า OCR แทน");
    captchaCode = ocrResult;
  }

  return captchaCode || ocrResult;
}

export { encryptText, decryptText,  getInputCaptcha, parserCodeMessage, getCaptchaMessage, openImage};
  
