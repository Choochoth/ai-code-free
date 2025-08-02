import axios from "axios";
import fs from "fs";
import https from 'https';
import FormData from "form-data";

const agent = new https.Agent({ keepAlive: false });

/**
 * ส่งไฟล์ภาพไปที่ /api/add-template?label=xxx
 * @param filePath ที่อยู่ไฟล์ภาพ
 * @param label ค่า label query param
 */
export async function addTemplate(filePath: string, label: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = `http://localhost:8000/api/add-template?label=${encodeURIComponent(label)}`;

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
      httpsAgent: agent,
    });
    console.log(response.data);
    //return response.data;
  } catch (error) {
    console.error("addTemplate error:", error);
    throw error;
  }
}


/**
 * ส่งไฟล์ภาพไปที่ /api/ocr
 * @param filePath ที่อยู่ไฟล์ภาพ
 */
export async function ocr(filePath: string) {
  try {
    const form = new FormData();
    form.append("file", fs.createReadStream(filePath));

    const url = "http://localhost:8000/api/ocr";

    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
     httpsAgent: agent,
    });
    console.log(response.data);
    return response.data;
  } catch (error) {
    console.error("ocr error:", error);
    throw error;
  }
}
