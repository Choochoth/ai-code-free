import { siteConfigs } from "./siteConfigs";

// ตัวอย่าง mapping Chat ID → site
export const chatIdMap: Record<string, string> = {
  // Jun88
  "-1002519263985": "thai_jun88k36",
  "-1002668963498": "thai_jun88k36",
  "-1002142874457": "thai_jun88k36",
  // 789BET
  "-1002040396559": "thai_789bet",
  "-1002406062886": "thai_789bet",
  "-1002544749433": "thai_789bet",  
};

// ฟังก์ชัน detect site จากข้อความ
export function detectSite(message: string) {
  const lowerMsg = message.toLowerCase();

  // เรียงตรวจสอบตาม priority
  const sortedSites = siteConfigs.sort((a, b) => (a.priority || 99) - (b.priority || 99));

  for (const site of sortedSites) {
    if (site.keywords.some(k => lowerMsg.includes(k.toLowerCase()))) {
      return site;
    }
  }

  return null;
}

// ฟังก์ชันตรวจสอบจาก Chat ID
export function detectSiteFromChatId(chatId: string) {
  const siteName = chatIdMap[chatId];
  if (!siteName) return null;
  return siteConfigs.find(site => site.name === siteName) || null;
}
