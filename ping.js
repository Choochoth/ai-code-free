import axios from "axios";

const url = "https://my-app.onrender.com/health";

async function ping() {
  try {
    await axios.get(url);
    console.log(`[${new Date().toISOString()}] 🔁 keep-alive ping sent`);
  } catch (err) {
    console.error("⚠️ ping failed:", err.message);
  }
}

setInterval(ping, 5 * 60 * 1000); // ทุก 5 นาที
ping(); // run ทันทีตอนเริ่ม
