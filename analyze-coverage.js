const fs = require('fs');
const data = JSON.parse(fs.readFileSync('coverage/coverage-summary.json', 'utf8'));

const files = Object.entries(data)
  .filter(([k]) => k !== 'total')
  .map(([file, stats]) => {
    const name = file.split(/[/\\]/).pop();
    return {
      name,
      total: stats.lines.total,
      covered: stats.lines.covered,
      uncovered: stats.lines.total - stats.lines.covered,
      pct: stats.lines.pct
    };
  })
  .filter(f => f.uncovered > 30)
  .sort((a, b) => b.uncovered - a.uncovered)
  .slice(0, 20);

console.log('Top 20 files with most uncovered lines:');
console.log('========================================');
files.forEach(f => {
  console.log(`${f.uncovered} uncovered lines in ${f.name} (${f.pct}% covered)`);
});

console.log('\nTotal uncovered in top 20:', files.reduce((sum, f) => sum + f.uncovered, 0));
