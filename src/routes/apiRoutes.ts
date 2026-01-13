import { Router } from "express";
import fs from "fs/promises";
import path from "path";

const router = Router();

const applyCodePath = path.join(__dirname, "..", "data", "apply_codes.json");
const packagePath = path.join(__dirname, "..", "data", "package_payment.json");

// API: applied codes
router.get("/applied-codes", async (_req, res) => {
  try {
    const data = await fs.readFile(applyCodePath, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Read error:", err);
    res.status(500).json({ error: "อ่านข้อมูลไม่สำเร็จ" });
  }
});

// API: package payment
router.get("/package-payment", async (_req, res) => {
  try {
    const data = await fs.readFile(packagePath, "utf8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Read error:", err);
    res.status(500).json({ error: "อ่านข้อมูลไม่สำเร็จ" });
  }
});

export default router;
