
const fs = require("fs");
const path = require("path");

const fsp = fs.promises;

const baseDir = __dirname;
const distDir = path.join(baseDir, "dist");

(async () => {
  try {
    // ลบ dist เก่าก่อนเริ่ม Build ใหม่
    await fsp.rm(distDir, {
      recursive: true,
      force: true
    });

    console.log("✅ Cleaned old dist directory");

  } catch (err) {
    console.error("❌ Failed to clean dist:", err);
    process.exitCode = 1;
  }
})();
