// copy-static.js
const fs = require("fs");
const path = require("path");
const fsp = fs.promises;

const baseDir = __dirname;
const distDir = path.join(baseDir, "dist");

const foldersToCopy = ["views", "public"]; // <-- อยู่ใต้ src/

async function copyDirectory(src, dest) {
  try {
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
  } catch (err) {
    console.error(`❌ Failed to copy directory from ${src} to ${dest}:`, err);
  }
}

(async () => {
  for (const folder of foldersToCopy) {
    const srcPath = path.join(baseDir, "src", folder);
    const destPath = path.join(distDir, folder);

    if (fs.existsSync(srcPath)) {
      console.log(`📁 Copying ${folder}...`);
      await copyDirectory(srcPath, destPath);
      console.log(`✅ Copied ${folder} to dist/${folder}`);
    } else {
      console.warn(`⚠️ Source folder 'src/${folder}' does not exist.`);
    }
  }
})();
