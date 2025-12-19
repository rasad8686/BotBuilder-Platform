/**
 * Asset Generation Script for BotBuilder Mobile
 *
 * This script creates placeholder PNG assets for Expo.
 * Run: node generate-assets.js
 *
 * For production, replace with properly designed assets.
 */

const fs = require('fs');
const path = require('path');

// Simple 1x1 indigo pixel PNG (base64)
const indigoPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// Create placeholder files
const assets = [
  { name: 'icon.png', desc: '1024x1024 app icon' },
  { name: 'splash.png', desc: '1284x2778 splash screen' },
  { name: 'adaptive-icon.png', desc: '1024x1024 Android adaptive icon' },
  { name: 'notification-icon.png', desc: '96x96 notification icon' },
  { name: 'favicon.png', desc: '48x48 web favicon' }
];

assets.forEach(asset => {
  const filePath = path.join(__dirname, asset.name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, indigoPNG);
    console.log(`Created placeholder: ${asset.name} (${asset.desc})`);
  } else {
    console.log(`Skipped (exists): ${asset.name}`);
  }
});

console.log('\n=== IMPORTANT ===');
console.log('These are 1x1 pixel placeholders!');
console.log('Replace with properly sized assets before production build.');
console.log('See ASSETS_README.md for specifications.');
console.log('\nTo convert SVG to PNG, use online tools like:');
console.log('- https://svgtopng.com');
console.log('- https://cloudconvert.com/svg-to-png');
