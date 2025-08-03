import axios from "axios";
import https from "https";
import fs from "fs";
import FormData from "form-data";
import 'dotenv/config';
import { generateMockSiteHeaders } from "../device";
import { sendResultToTelegram } from "../telegramBot";
import { formatTelegramMessage } from "../utils";

const agent = new https.Agent({
  keepAlive: false,
  secureProtocol: 'TLS_method',
});

const OCR_API_BASE = process.env.OCR_API_BASE || "http://localhost:8000";

function getAxiosConfig(headers: any) {
  return {
    headers,
    validateStatus: () => true,
    httpsAgent: agent,
  };
}

export async function sendCodeToPlayer(
  playerId: string,
  promoCode: string,
  key: string,
  apiEndPoint: string,
  site: string,
  token: string,
  hostUrl: string
) {
  const url = `${apiEndPoint}/client?player_id=${playerId}&promo_code=${promoCode}&site=${site}`;
  const payload = { key };
  const headers = generateMockSiteHeaders(hostUrl, site);
  headers.Authorization = token;

  if (site === "thai_789bet") {
    headers.cookie = `token=${token}`;
  }

  try {
    const res = await axios.post(url, payload, getAxiosConfig(headers));

    if (res.data.status_code === 200 && res.data.valid) {
      res.data.site = site;
      res.data.link = "https://shorturl.at/tdFu4";
      await sendResultToTelegram(formatTelegramMessage(res.data)); // ปรับข้อความให้สวยงาม
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
    const res = await axios.post(url, payload, getAxiosConfig(headers));
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
    const res = await axios.get(url, {
      params: { site },
      headers,
    });

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
    const response = await axios.post(url, form, {
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
    const response = await axios.post(url, form, {
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



