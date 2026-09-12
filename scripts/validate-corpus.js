const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const corpusDir = path.join(__dirname, '..', 'Master_EPUB_Library_All');

function findEpubs(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...findEpubs(fullPath));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.epub')) files.push(fullPath);
  }
  return files;
}

async function validate(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 4 || buffer.readUInt32BE(0) !== 0x504b0304) throw new Error('not a ZIP archive');
  const zip = await JSZip.loadAsync(buffer);
  if (zip.file('META-INF/rights.xml')) throw new Error('DRM marker present');
  if (zip.file('META-INF/encryption.xml')) throw new Error('encrypted resources present');
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('missing META-INF/container.xml');
  const xml = await container.async('text');
  const match = xml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  if (!match || !zip.file(match[1])) throw new Error('missing OPF package document');
}

(async () => {
  const files = findEpubs(corpusDir);
  const failures = [];
  for (const filePath of files) {
    try {
      await validate(filePath);
    } catch (error) {
      failures.push(`${path.relative(corpusDir, filePath)}\t${error.message}`);
    }
  }
  console.log(`Corpus EPUBs: ${files.length}`);
  console.log(`Pass: ${files.length - failures.length}`);
  console.log(`Fail: ${failures.length}`);
  if (failures.length) {
    console.log(failures.join('\n'));
    process.exitCode = 1;
  }
})();