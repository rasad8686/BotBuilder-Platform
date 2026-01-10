const fs = require('fs');
const path = require('path');

// Pattern to match common UI emojis
const emojiPattern = /[✅⚠️❌✏️💾📋🔒🔓⏳🚀🎉🤖💡📊📈🔑📝⭐🔥💬🎯📧🔔💰👤🌐🔄📁📂🎨🛠️⚙️🔧🗂️📑📄📃🎁🏆💎✨🗑️📌🔗]/g;

// Files to skip
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
            results[fullPath] = matches.length;
          }
        } catch (e) {}
      }
    });
  } catch (e) {}
}

walkDir('client/src');

// Sort and display top 10
const sorted = Object.entries(results)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

sorted.forEach(([file, count]) => {
  console.log(count + '  ' + file);
});
