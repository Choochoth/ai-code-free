const fs = require("fs");
const path = require("path");
const fsp = fs.promises;

const baseDir = __dirname;
const sourceData = path.join(baseDir, "data");
const distDir = path.join(baseDir, "dist");
const distData = path.join(distDir, "data");

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
    if (fs.existsSync(sourceData)) {
      await copyDirectory(sourceData, distData);
      console.log("✅ Copied 'data' to 'dist/data'");
    } else {
      console.warn("⚠️ Source folder 'data' does not exist.");
    }
  } catch (err) {
    console.error("❌ Copy operation failed:", err);
  }
})();
