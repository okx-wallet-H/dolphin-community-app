import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const base = 'https://8081-ikrklnolujvsgoyc8nrb4-f0563e0e.us2.manus.computer';
const outputDir = '/home/ubuntu/h-wallet-ui-rebuild/review-shots-v3';
const pages = [
  { name: '01-login.png', url: `${base}/` },
  { name: '02-wallet.png', url: `${base}/wallet` },
  { name: '03-chat.png', url: `${base}/chat` },
  { name: '04-earn.png', url: `${base}/earn` },
  { name: '05-community.png', url: `${base}/community` },
];

fs.mkdirSync(outputDir, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  for (const item of pages) {
    await page.goto(item.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await page.screenshot({ path: path.join(outputDir, item.name), fullPage: false });
    console.log(`saved ${item.name}`);
  }
} finally {
  await browser.close();
}
