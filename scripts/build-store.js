const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const packageJson = require('../package.json');

const config = JSON.parse(JSON.stringify(packageJson.build));
config.appx = {
  ...(config.appx || {}),
  publisher: 'CN=65585C77-A179-46B9-B0CA-60D868923F03',
  publisherDisplayName: 'Lirune',
  identityName: 'Lirune.LiruneReader',
  applicationId: 'Lirune.LiruneReader'
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
