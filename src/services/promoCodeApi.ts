import axios, { AxiosInstance, AxiosResponse } from "axios";
import https from "https";
import fs from "fs";
import FormData from "form-data";
import "dotenv/config";
import Bottleneck from "bottleneck";
import { generateMockSiteHeaders } from "../device";
import { sendResultToTelegram } from "../telegramBot";
import { formatTelegramMessage, getTelegramId } from "../utils";

const agent = new https.Agent({
  keepAlive: true,
  secureProtocol: "TLS_method",
});

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";

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
      res.data.link = "https://shorturl.at/tdFu4";

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
  const url = `${apiEndPoint}/client/get-code?promo_code=${promoCode}&site=${site}`;
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

export async function getVerificationCode(apiEndPoint: string, site: string, hostUrl: string) {
  const cleanApiEndpoint = apiEndPoint.replace(/\/+$/, "");
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

export async function addTemplate(filePath: string, label: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = `${OCR_API_BASE}/api/add-template?label=${encodeURIComponent(label)}`;
    const response = await limitedPost(url, form, {
      headers: { ...form.getHeaders() },
      httpsAgent: agent,
    });

    console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ addTemplate error:", error.message || error);
    throw error;
  }
}

export async function ocr(filePath: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = `${OCR_API_BASE}/api/ocr`;
    const response = await limitedPost(url, form, {
      headers: { ...form.getHeaders() },
      httpsAgent: agent,
    });

    console.log(response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ ocr error:", error.message || error);
    throw error;
  }
}
