import { faker } from '@faker-js/faker';
import { siteConfigs } from './siteConfigs';

/**
 * สุ่ม IP address
 */
function generateRandomIP(): string {
  return `${faker.number.int({ min: 1, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 1, max: 255 })}`;
}

/**
 * สุ่ม country code สำหรับ CF-IPCountry
 */
function getRandomCountryCode(): string {
  const countries = ['TH', 'VN', 'SG', 'PH', 'MY', 'ID', 'KR', 'JP', 'TW', 'HK'];
  return faker.helpers.arrayElement(countries);
}


/**
 * คืนค่าคงที่สำหรับ referer
 */
function getStaticReferer(hostUrl: string): string {
  return `${hostUrl}/`;
}

/**
 * คืนค่าคงที่สำหรับ origin
 */
function getStaticOrigin(hostUrl: string): string {
  return hostUrl;
}


/**
 * สุ่ม user-agent จากรายการที่กำหนดและ faker
 */

function getRandomUserAgent(): { userAgent: string; platform: string; viewportWidth: number } {
  const devices = [
    {
      name: "iPhone 14 Pro",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      platform: '"iOS"',
      viewportWidth: 393
    },
    {
      name: "Samsung Galaxy S23",
      userAgent: "Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Mobile Safari/537.36",
      platform: '"Android"',
      viewportWidth: 412
    },
    {
      name: "iPad Pro 12.9",
      userAgent: "Mozilla/5.0 (iPad; CPU OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      platform: '"iOS"',
      viewportWidth: 1024
    },
    {
      name: "MacBook Pro M2",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      platform: '"macOS"',
      viewportWidth: 1440
    },
    {
      name: "Windows PC (Chrome)",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      platform: '"Windows"',
      viewportWidth: 1920
    },
  ];

  return faker.helpers.arrayElement(devices);
}

export function generateMockSiteHeaders(hostUrl: string, site: string): Record<string, string> {
  const config = siteConfigs.find(s => s.name === site);
  if (!config) {
    throw new Error(`Site config not found for "${site}"`);
  }

  // ใช้ object ที่คืนมาจาก getRandomUserAgent
  const { userAgent, platform, viewportWidth } = getRandomUserAgent();
  const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);

  const secChUa = /CriOS|Chrome/i.test(userAgent)
    ? `"Chromium";v="${faker.number.int({ min: 110, max: 137 })}", "Not.A/Brand";v="24", "Google Chrome";v="137"`
    : `"Not.A/Brand";v="24", "Safari";v="${faker.number.int({ min: 14, max: 17 })}"`;


  const downlink = faker.helpers.arrayElement(['0.9', '1.3', '2.5', '4.0', '10.0']);
  const saveData = faker.datatype.boolean() ? 'on' : 'off';

  return {
    'Accept': '*/*',
    'Accept-Language': faker.helpers.arrayElement([
      'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7',
      'en-US,en;q=0.9',
      'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7'
    ]),
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Content-Type': 'application/json',
    'Origin': getStaticOrigin(hostUrl),
    'Referer': getStaticReferer(hostUrl),
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',

    'Sec-Ch-Ua': secChUa,
    'Sec-Ch-Ua-Mobile': isMobile ? '?1' : '?0',
    'Sec-Ch-Ua-Platform': platform,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1',

    'User-Agent': userAgent,
    'Viewport-Width': viewportWidth.toString(),
    'Downlink': downlink,
    'Save-Data': saveData,

    'X-Forwarded-For': generateRandomIP(),
    'CF-IPCountry': getRandomCountryCode(),
  };
}


