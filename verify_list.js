const fs = require('fs');
const path = require('path');

// Pattern to match common UI emojis
const emojiPattern = /[✅⚠️❌✏️💾📋🔒🔓⏳🚀🎉🤖💡📊📈🔑📝⭐🔥💬🎯📧🔔💰👤🌐🔄📁📂🎨🛠️⚙️🔧🗂️📑📄📃🎁🏆💎✨🗑️📌🔗🔐]/g;

// Files to skip (already updated)
const skipFiles = new Set(['GlobalSearch.jsx', 'Breadcrumb.jsx', 'EditBot.jsx', 'CreateBot.jsx', 'Dashboard.jsx']);

const results = {};

function walkDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else if ((file.endsWith('.jsx') || file.endsWith('.js')) && !skipFiles.has(file)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const matches = content.match(emojiPattern) || [];
          if (matches.length > 0) {
            results[fullPath] = {
              count: matches.length,
              emojis: [...new Set(matches)].sort()
            };
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}

walkDir('client/src');

// Sort and display top 10
const sorted = Object.entries(results)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 10);

console.log('TOP 10 FILES WITH UI EMOJIS NEEDING REPLACEMENT\n');
console.log('=' + '='.repeat(100) + '\n');

sorted.forEach(([file, data], idx) => {
  const parts = file.split(path.sep);
  const normalizedPath = parts.join('/');
  console.log(String(idx + 1).padStart(2) + '. ' + String(data.count).padStart(3) + ' emojis - ' + normalizedPath);
  console.log('    Found emojis: ' + data.emojis.join(' '));
  console.log('');
});
