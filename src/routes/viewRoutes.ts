import { Router } from "express";
import path from "path";

const router = Router();

// หน้า apply codes
router.get("/", async (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "apply_codes.html"));
});

// หน้า package
router.get("/package", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "views", "package.html"));
});

export default router;
