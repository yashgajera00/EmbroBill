const fs = require('fs');
const path = require('path');

const cleanAll = process.argv.includes('--all');

const dirs = [
  path.join(__dirname, 'dist')
];

if (cleanAll) {
  dirs.push(path.join(__dirname, 'dist_electron'));
}

dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`Cleaning directory: ${dir}`);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`Successfully cleaned: ${dir}`);
    } catch (err) {
      console.error(`Failed to clean ${dir}:`, err.message);
    }
  } else {
    console.log(`Directory does not exist, skipping: ${dir}`);
  }
});
