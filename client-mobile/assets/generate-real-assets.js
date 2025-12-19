/**
 * BotBuilder Mobile App Asset Generator
 * Generates real PNG assets for the mobile app using Jimp
 *
 * Run: npm install jimp && node assets/generate-real-assets.js
 */

const Jimp = require('jimp');
const path = require('path');

// Colors (as hex integers for Jimp)
const PRIMARY_START = 0x6366f1ff;
const PRIMARY_END = 0x8b5cf6ff;
const WHITE = 0xffffffff;
const TRANSPARENT = 0x00000000;

/**
 * Linear interpolation between two colors
 */
function lerpColor(color1, color2, t) {
  const r1 = (color1 >> 24) & 0xff;
  const g1 = (color1 >> 16) & 0xff;
  const b1 = (color1 >> 8) & 0xff;
  const a1 = color1 & 0xff;

  const r2 = (color2 >> 24) & 0xff;
  const g2 = (color2 >> 16) & 0xff;
  const b2 = (color2 >> 8) & 0xff;
  const a2 = color2 & 0xff;

  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  const a = Math.round(a1 + (a2 - a1) * t);

  return (r << 24) | (g << 16) | (b << 8) | a;
}

/**
 * Fill image with gradient
 */
function fillGradient(image, startColor, endColor, direction = 'diagonal') {
  const width = image.getWidth();
  const height = image.getHeight();

  image.scan(0, 0, width, height, function(x, y, idx) {
    let t;
    if (direction === 'diagonal') {
      t = (x / width + y / height) / 2;
    } else if (direction === 'vertical') {
      t = y / height;
    } else {
      t = x / width;
    }
    const color = lerpColor(startColor, endColor, t);
    this.bitmap.data[idx + 0] = (color >> 24) & 0xff; // R
    this.bitmap.data[idx + 1] = (color >> 16) & 0xff; // G
    this.bitmap.data[idx + 2] = (color >> 8) & 0xff;  // B
    this.bitmap.data[idx + 3] = color & 0xff;         // A
  });
}

/**
 * Draw "BB" text pattern (pixel art style for reliability)
 */
function drawBBText(image, centerX, centerY, scale, color) {
  // Simple "BB" pattern (11x7 basic pattern)
  const pattern = [
    '11110 11110',
    '1   1 1   1',
    '1   1 1   1',
    '11110 11110',
    '1   1 1   1',
    '1   1 1   1',
    '11110 11110'
  ];

  const patternWidth = 11;
  const patternHeight = 7;
  const startX = centerX - (patternWidth * scale) / 2;
  const startY = centerY - (patternHeight * scale) / 2;

  const r = (color >> 24) & 0xff;
  const g = (color >> 16) & 0xff;
  const b = (color >> 8) & 0xff;
  const a = color & 0xff;

  for (let py = 0; py < patternHeight; py++) {
    for (let px = 0; px < patternWidth; px++) {
      const char = pattern[py][px];
      if (char === '1') {
        // Fill a scaled block
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const x = Math.round(startX + px * scale + dx);
            const y = Math.round(startY + py * scale + dy);
            if (x >= 0 && x < image.getWidth() && y >= 0 && y < image.getHeight()) {
              const idx = (y * image.getWidth() + x) * 4;
              image.bitmap.data[idx + 0] = r;
              image.bitmap.data[idx + 1] = g;
              image.bitmap.data[idx + 2] = b;
              image.bitmap.data[idx + 3] = a;
            }
          }
        }
      }
    }
  }
}

/**
 * Draw "BotBuilder" text pattern
 */
function drawBotBuilderText(image, centerX, centerY, scale, color) {
  // Simplified "BotBuilder" pattern (45x5)
  const pattern = [
    '1110 000 111 1110 0 0 0 1 0 000 1110 1110 1110',
    '1  1 0 0  1  1  1 0 0 0 0 0 0 0 0 1  0 1  0 1  1',
    '1110 0 0  1  1110 0 0 0 1 0 0 0 0 1  0 1110 1110',
    '1  1 0 0  1  1  1 0 0 0 1 0 0 0 0 1  0 1  0 1 1 ',
    '1110 000  1  1110 000 0 1 0 000 1110 1110 1  1'
  ];

  const patternWidth = 45;
  const patternHeight = 5;
  const startX = centerX - (patternWidth * scale) / 2;
  const startY = centerY - (patternHeight * scale) / 2;

  const r = (color >> 24) & 0xff;
  const g = (color >> 16) & 0xff;
  const b = (color >> 8) & 0xff;
  const a = color & 0xff;

  for (let py = 0; py < patternHeight; py++) {
    const row = pattern[py];
    for (let px = 0; px < row.length && px < patternWidth; px++) {
      const char = row[px];
      if (char === '1' || char === '0') {
        const filled = char === '1';
        if (filled) {
          for (let dy = 0; dy < scale; dy++) {
            for (let dx = 0; dx < scale; dx++) {
              const x = Math.round(startX + px * scale + dx);
              const y = Math.round(startY + py * scale + dy);
              if (x >= 0 && x < image.getWidth() && y >= 0 && y < image.getHeight()) {
                const idx = (y * image.getWidth() + x) * 4;
                image.bitmap.data[idx + 0] = r;
                image.bitmap.data[idx + 1] = g;
                image.bitmap.data[idx + 2] = b;
                image.bitmap.data[idx + 3] = a;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Apply rounded corners to image
 */
function applyRoundedCorners(image, radius) {
  const width = image.getWidth();
  const height = image.getHeight();

  image.scan(0, 0, width, height, function(x, y, idx) {
    // Check corners
    const corners = [
      { cx: radius, cy: radius }, // top-left
      { cx: width - radius, cy: radius }, // top-right
      { cx: radius, cy: height - radius }, // bottom-left
      { cx: width - radius, cy: height - radius } // bottom-right
    ];

    for (const corner of corners) {
      const inCornerRegion =
        (x < radius && y < radius && corner.cx === radius && corner.cy === radius) ||
        (x >= width - radius && y < radius && corner.cx === width - radius && corner.cy === radius) ||
        (x < radius && y >= height - radius && corner.cx === radius && corner.cy === height - radius) ||
        (x >= width - radius && y >= height - radius && corner.cx === width - radius && corner.cy === height - radius);

      if (inCornerRegion) {
        const dx = x - corner.cx;
        const dy = y - corner.cy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > radius) {
          this.bitmap.data[idx + 3] = 0; // Make transparent
        }
      }
    }
  });
}

/**
 * Generate icon.png (1024x1024)
 */
async function generateIcon() {
  const size = 1024;
  const image = new Jimp(size, size);

  // Fill with gradient
  fillGradient(image, PRIMARY_START, PRIMARY_END, 'diagonal');

  // Apply rounded corners
  applyRoundedCorners(image, Math.round(size * 0.22));

  // Draw "BB" text
  drawBBText(image, size / 2, size / 2, 60, WHITE);

  return image;
}

/**
 * Generate splash.png (1284x2778)
 */
async function generateSplash() {
  const width = 1284;
  const height = 2778;
  const image = new Jimp(width, height);

  // Fill with vertical gradient
  fillGradient(image, PRIMARY_START, PRIMARY_END, 'vertical');

  // Draw small "BB" logo
  drawBBText(image, width / 2, height / 2 - 100, 15, WHITE);

  // Draw "BotBuilder" text (simplified - just use BB for now)
  // Since pixel-perfect text is complex, we'll make it simple
  drawBBText(image, width / 2, height / 2 + 150, 8, WHITE);

  return image;
}

/**
 * Generate adaptive-icon.png (1024x1024)
 */
async function generateAdaptiveIcon() {
  const size = 1024;
  const image = new Jimp(size, size, TRANSPARENT);

  // Draw "BB" text in primary color
  drawBBText(image, size / 2, size / 2, 55, PRIMARY_START);

  return image;
}

/**
 * Generate favicon.png (48x48)
 */
async function generateFavicon() {
  const size = 48;
  const image = new Jimp(size, size);

  // Fill with gradient
  fillGradient(image, PRIMARY_START, PRIMARY_END, 'diagonal');

  // Apply rounded corners
  applyRoundedCorners(image, Math.round(size * 0.2));

  // Draw small "BB"
  drawBBText(image, size / 2, size / 2, 3, WHITE);

  return image;
}

/**
 * Generate notification-icon.png (96x96)
 */
async function generateNotificationIcon() {
  const size = 96;
  const image = new Jimp(size, size, TRANSPARENT);

  // Draw white "BB"
  drawBBText(image, size / 2, size / 2, 6, WHITE);

  return image;
}

/**
 * Main execution
 */
async function main() {
  const assetsDir = __dirname;

  console.log('Generating BotBuilder Mobile Assets...\n');

  const assets = [
    { name: 'icon.png', generator: generateIcon, desc: '1024x1024 App Icon' },
    { name: 'splash.png', generator: generateSplash, desc: '1284x2778 Splash Screen' },
    { name: 'adaptive-icon.png', generator: generateAdaptiveIcon, desc: '1024x1024 Adaptive Icon' },
    { name: 'favicon.png', generator: generateFavicon, desc: '48x48 Favicon' },
    { name: 'notification-icon.png', generator: generateNotificationIcon, desc: '96x96 Notification Icon' }
  ];

  for (const asset of assets) {
    try {
      const image = await asset.generator();
      const filePath = path.join(assetsDir, asset.name);
      await image.writeAsync(filePath);
      console.log(`✓ Generated ${asset.name} (${asset.desc})`);
    } catch (error) {
      console.error(`✗ Failed to generate ${asset.name}:`, error.message);
    }
  }

  console.log('\n=== Asset Generation Complete ===');
  console.log('Assets saved to:', assetsDir);
}

main().catch(console.error);
