const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = ['main.js', 'preload.js'];
for (const directory of ['js', 'scripts']) {
  for (const name of fs.readdirSync(path.join(root, directory))) {
    if (name.endsWith('.js')) files.push(path.join(directory, name));
  }
}

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}
process.exitCode = failed ? 1 : 0;
