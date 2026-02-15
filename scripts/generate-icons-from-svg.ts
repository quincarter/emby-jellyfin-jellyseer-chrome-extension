import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SIZES = [16, 32, 48, 128];
const SVG_PATH = path.resolve('assets/icons/combined.svg');
const OUTPUT_DIR = path.resolve('public/icons');

async function generateIcons() {
  const svgContent = fs.readFileSync(SVG_PATH, 'utf-8');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const size of SIZES) {
    console.log(`Generating ${size}x${size} icon...`);

    // Set viewport to the target size
    await page.setViewportSize({ width: size, height: size });

    // Set the content to the SVG, styled to fill the viewport exactly
    await page.setContent(`
      <style>
        body, html {
          margin: 0;
          padding: 0;
          width: ${size}px;
          height: ${size}px;
          overflow: hidden;
          background: transparent;
        }
        svg {
          width: 100%;
          height: 100%;
          display: block;
        }
      </style>
      ${svgContent}
    `);

    await page.screenshot({
      path: path.join(OUTPUT_DIR, `icon-${size}.png`),
      omitBackground: true, // Transparent background
      type: 'png',
    });
  }

  await browser.close();
  console.log('Icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
