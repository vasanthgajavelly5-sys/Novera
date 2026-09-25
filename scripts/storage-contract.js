const crypto = require('crypto');

function fingerprintBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function storageIdForFingerprint(fingerprint) {
  if (!/^[a-f0-9]{64}$/i.test(fingerprint)) throw new Error('Invalid EPUB fingerprint');
  return `${fingerprint.toLowerCase()}.epub`;
}

function isStorageId(value) {
  return typeof value === 'string' && (/^[a-f0-9]{64}\.epub$/i.test(value) || /^[a-f0-9-]{16,80}\.epub$/i.test(value));
}

module.exports = { fingerprintBuffer, storageIdForFingerprint, isStorageId };