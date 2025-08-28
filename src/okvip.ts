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

// ฟังก์ชันสำหรับส่งภาพพร้อม label ไปยัง /api/train
async function sendImageRecognizeText(imagePath: string) {
  try {
    const formData = new FormData();  // Create instance using the correct constructor
    const fileStream = fs.createReadStream(imagePath);

    // ใช้ path.basename เพื่อดึงชื่อไฟล์จากเส้นทาง
    const filename = path.basename(imagePath);

    formData.append('file', fileStream, filename);  // ส่งไฟล์และชื่อไฟล์ไป

    // ส่งคำขอ POST โดยใช้ axios และ formData
    const response = await axios.post('http://localhost:8000/api/predict', formData, {
      headers: {
        ...formData.getHeaders(),  // ใช้ getHeaders() จาก form-data
      },
    });

    console.log('Response from API:', response.data);
    return response.data.text;
  } catch (error) {
    console.error('Error sending image for training:', error);
  }
}

// ฟังก์ชันสำหรับส่งภาพพร้อม label ไปยัง /api/train
async function sendImageForTraining(imagePath: string, label: string) {
  try {
    const formData = new FormData();  // Create instance using the correct constructor
    const fileStream = fs.createReadStream(imagePath);

    // ใช้ path.basename เพื่อดึงชื่อไฟล์จากเส้นทาง
    const filename = path.basename(imagePath);

    formData.append('file', fileStream, filename);  // ส่งไฟล์และชื่อไฟล์ไป
    formData.append('label', label);  // เพิ่ม label

    // ส่งคำขอ POST โดยใช้ axios และ formData
    const response = await axios.post('http://localhost:8000/api/train', formData, {
      headers: {
        ...formData.getHeaders(),  // ใช้ getHeaders() จาก form-data
      },
    });

    console.log('Response from API:', response.data);
  } catch (error) {
    console.error('Error sending image for training:', error);
  }
}
/**
 * Resets and renews the IP address on Windows using ipconfig.
 * Requires administrative privileges to work correctly.
 */
async function resetAndRenewIP_Windows(): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🔄 Releasing IP address...");
    const batPath = path.join(__dirname, '../resetnet/reset_network.bat');

    exec(`start "" "${batPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`เกิดข้อผิดพลาด: ${error.message}`);
        return reject(error);
      }
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        // สามารถเลือก resolve หรือ reject ตามกรณี
        return reject(new Error(stderr));
      }
      console.log(`stdout: ${stdout}`);
      return resolve();
    });
  });
}

async function getInputCaptcha(imageUrl: string): Promise<{ captchaCode: string, captchaPath: string }> {
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

    const captchas = await ocr(tempPath);
    // console.log(`✅Before OCR Result: ${captchas.text}`);
    // console.log(`📊 Confidence: ${captchas.confidence}% (ความมั่นใจเฉลี่ยของทั้ง 4 ตัว)`);
    let captchaCode: string = captchas.text.trim();
    // let captchaCode: string;
    // if (captchas.confidence >= 100) {
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
    //         }, 20000)
    //       ),
    //     ]);
    //   } catch (error) {
    //     console.warn("⚠️ Error or timeout, using OCR result");
    //     captchaCode = captchas.text;
    //   }
    // }

    if (!captchaCode || captchaCode.trim().length < 4) {
      console.warn(`❗️Invalid CAPTCHA input. Skipping. Input: ${captchaCode}`);
      await removeImage(tempPath);
      throw new Error("Invalid CAPTCHA input");
    }

    const finalPath = path.join(captchaDirectory, `${captchaCode.toUpperCase()}_${timestamp}.png`);
    await fs.promises.rename(tempPath, finalPath);
    // console.log('📦 Image renamed to:', finalPath);
    // await addTemplate(finalPath, captchaCode.toUpperCase())
    return {
      captchaCode: captchaCode.toUpperCase(),
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

  // Remove emojis, keep letters, numbers
  const cleanedText = message
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')  // symbols & pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')  // transport & map symbols
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // flags
    .replace(/\s+/g, ' ') // normalize spaces
    .trim();

  const tokens = cleanedText.split(' ');

  const validCodeRegex = /\b[A-Za-z0-9]{6,}\b/; // (6 ตัวขึ้นไป) ตัวอักษร+ตัวเลข ไม่มีเว้นวรรค

  const codes = tokens.filter(token => 
    validCodeRegex.test(token) &&
    !token.startsWith("#") &&
    !token.startsWith("*") &&
    !token.startsWith("@") &&
    !token.endsWith("*") &&
    !token.startsWith("https://") &&
    !token.startsWith("(https://") &&
    !token.startsWith("F*") &&
    !token.startsWith("(") &&
    !token.endsWith(")") &&
    !token.startsWith("m.") &&
    !token.startsWith("789BET") &&
    !token.startsWith("JUN88") &&
    !token.startsWith("Jun88") &&
    !token.startsWith("789") &&
    !token.startsWith("Twitter") &&
    !token.startsWith("ติดตาม") &&
    !token.startsWith("เพื่มความรวด") &&
    !/^("🫠🤫🤭🫡🥺🤥Bigger|Frenzy|88OKPAY|Official|คาสโน|สลอต|แจก|เกม|โปรโมท|ราย|ได|การ|เงน|facebook|promotion|telegarm|instagram|twitter|789betthailand|https|freecode.06789bet.com|m.99789bet.vip|88Talk|789BET|JUN88|LiveChat|Bounty|Google|Chrome|Youtude|TELEGRAM|Scatter|SCATTER|MINITERE|88OKPAY|)$/i.test(token)
  );

  const cleanedCodes = codes
    .filter(code => code.trim() !== '')
    .map(code => code.replace(/`/g, '')); // ลบ backtick ออก
  
  // Return [] if less than 10 valid codes
  if (cleanedCodes.length < 10) return [];

  return cleanedCodes;
}

function openImage(path: string) {
  const platform = process.platform;
  if (platform === "win32") {
    return execAsync(`start "" "${path}"`);
  } else if (platform === "darwin") {
    return execAsync(`open "${path}"`);
  } else {
    return execAsync(`xdg-open "${path}"`);
  }
}

export { encryptText, decryptText, sendImageForTraining, resetAndRenewIP_Windows, sendImageRecognizeText, getInputCaptcha, parserCodeMessage, getCaptchaMessage, openImage};
  
