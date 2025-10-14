
import {
  shuffleArray
} from "./utils";

const players789bet = ["aroon11", "koonogk", "nus9331", "kaimook11", "wat3366" ,"VIP0955171905", "borvon", "manus9331", "kootong"];
const playersj88 = ["nus9331", "koonogk", "manus9331", "aroon11", "kaimook11", "aroon2511", "goft22", "poiy88", "tong234", "tata5511", "manusj88", "manuchai", "hinjun88", "mn3206", "manusvip"];
const siteConfigs = [
    {
        name: "thai_789bet",
        priority: 2,
        keywords: ["789bet-th", "789bethai", "06789bet", "789BETTHAILAND", "789BET", "เฮฮา 789BET", "สาวสวย 789BET"],
        endpoint: "https://api-code-thai789bet.freecodevip.org",
        players: shuffleArray(players789bet),
        cskh_url: "https://333789.vip",
        key_free: "att.code.hau-dai.thai_789-bet@2030$",
        envVar: "API_ENDPOINT_789",
        log: "🌟 Starting process for 789Bet THAILAND",
    },
    {
        name: "thai_jun88k36",
        priority: 1,
        keywords: ["jun88-th", "เกรียนjun88", "พรีเมี่ยม", "Jun88-TH", "codeJun88", "Jun88th", "freecodeJun88", "Jun88THAILAND", "Jun88Talk"],
        endpoint: "https://api-thai-jun88k36.freecodevip.org",
        players: shuffleArray(playersj88),
        cskh_url: "https://ajun88.vip",
        key_free: "att.code-free.hau-dai.thai-Jun88-AE@2030$",
        envVar: "API_ENDPOINT_J88",
        log: "🔹 Message from Jun88 THAILAND",
    }
];

export{siteConfigs}

