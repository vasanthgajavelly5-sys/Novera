const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const packageJson = require('../package.json');

const publisher = process.env.APPX_PUBLISHER;
if (!publisher || publisher === 'CN=ms') {
  console.error('Store build blocked: set APPX_PUBLISHER to the exact Partner Center publisher identity before running npm run dist:store.');
  process.exit(1);
}

const config = JSON.parse(JSON.stringify(packageJson.build));
config.appx = {
  ...(config.appx || {}),
  publisher,
  publisherDisplayName: process.env.APPX_PUBLISHER_DISPLAY_NAME || packageJson.author
};
config.win = { ...(config.win || {}), target: [{ target: 'appx', arch: ['x64'] }] };
const configPath = path.join(os.tmpdir(), `novera-store-${process.pid}.json`);
fs.writeFileSync(configPath, JSON.stringify(config));
const result = spawnSync(process.execPath, [require.resolve('electron-builder/cli.js'), '--win', 'appx', '--config', configPath], {
  stdio: 'inherit',
  env: { ...process.env }
});
fs.rmSync(configPath, { force: true });
process.exitCode = result.status === null ? 1 : result.status;
