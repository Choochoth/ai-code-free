const fs = require("fs");
const path = require("path");
const fsp = fs.promises;

const baseDir = __dirname;
const distDir = path.join(baseDir, "dist");
const sourceCaptchas = path.join(distDir, "data");
const targetCaptchas = path.join(baseDir, "data"); // ปลอดภัยกว่า

async function copyDirectory(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });

  for (let entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

(async () => {
  try {
    if (fs.existsSync(sourceCaptchas)) {
      await copyDirectory(sourceCaptchas, targetCaptchas);
      console.log("✅ Copied 'dist/data' to 'data'");
    } else {
      console.warn("⚠️ Source folder 'dist/data' does not exist.");
    }

    // ลบ dist แบบ await ให้ชัวร์ว่าเสร็จก่อนจบ
    await fsp.rm(distDir, { recursive: true, force: true });
    console.log("🗑️ Deleted 'dist' directory");

  } catch (err) {
    console.error("❌ Operation failed:", err);
  }
})();
