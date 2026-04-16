import puppeteer from 'puppeteer-core';

const url = 'https://8081-ikrklnolujvsgoyc8nrb4-f0563e0e.us2.manus.computer/';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
  defaultViewport: { width: 390, height: 844, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1500));

  const result = await page.evaluate(() => {
    const vw = window.innerWidth;
    const bodyScrollWidth = document.body.scrollWidth;
    const docScrollWidth = document.documentElement.scrollWidth;
    const selectors = Array.from(document.querySelectorAll('*'));
    const offenders = selectors
      .map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: (el.getAttribute('class') || '').toString(),
          text: (el.textContent || '').trim().slice(0, 40),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter((item) => item.right > vw + 1 || item.left < -1)
      .slice(0, 30);

    return { vw, bodyScrollWidth, docScrollWidth, offenders };
  });

  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
