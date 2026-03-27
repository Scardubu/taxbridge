/**
 * fix-lightningcss-win32.js
 *
 * Ensures the lightningcss Windows x64 native binary is present where the
 * nested react-native-css-interop lightningcss module expects to find it.
 *
 * Run automatically via "postinstall" on Windows. No-op on other platforms.
 */

const os   = require('os');
const fs   = require('fs');
const path = require('path');
const https = require('https');

if (os.platform() !== 'win32' || os.arch() !== 'x64') {
  process.exit(0);
}

const BINARY_NAME   = 'lightningcss.win32-x64-msvc.node';
const PKG_NAME      = 'lightningcss-win32-x64-msvc';
const PKG_VERSION   = '1.27.0';
const REGISTRY_URL  = `https://registry.npmjs.org/${PKG_NAME}/-/${PKG_NAME}-${PKG_VERSION}.tgz`;
const NODE_MODULES  = path.resolve(__dirname, '..', 'node_modules');

// Destination: top-level package dir for the win32 native binary
const DEST_PKG_DIR = path.join(NODE_MODULES, PKG_NAME);

const FALLBACK_BINARY = path.join(
  NODE_MODULES,
  'react-native-css-interop', 'node_modules', 'lightningcss',
  BINARY_NAME,
);

function fileValid(p) {
  try {
    const stat = fs.statSync(p);
    return stat.size > 1_000_000; // native binary must be > 1 MB
  } catch { return false; }
}

// Already healthy?
const pkgBinary = path.join(NODE_MODULES, PKG_NAME, BINARY_NAME);
if (fileValid(pkgBinary) && fileValid(FALLBACK_BINARY)) {
  process.exit(0);
}

console.log('[fix-lightningcss] Downloading win32-x64 native binary...');

function download(url, cb) {
  https.get(url, res => {
    if (res.statusCode === 301 || res.statusCode === 302) {
      return download(res.headers.location, cb);
    }
    if (res.statusCode !== 200) {
      return cb(new Error(`HTTP ${res.statusCode}`));
    }
    const chunks = [];
    res.on('data', c => chunks.push(c));
    res.on('end', () => cb(null, Buffer.concat(chunks)));
    res.on('error', cb);
  }).on('error', cb);
}

function extractTgz(tgzBuf, destDir, cb) {
  const zlib = require('zlib');

  try {
    const unzipped = zlib.gunzipSync(tgzBuf);
    // Parse tar manually — we only need files from /package/
    let offset = 0;
    while (offset < unzipped.length - 512) {
      const header = unzipped.slice(offset, offset + 512);
      if (header.every(b => b === 0)) break;

      const nameBuf = header.slice(0, 100);
      const name    = nameBuf.toString('utf8').replace(/\0/g, '');
      const size    = parseInt(header.slice(124, 136).toString('utf8').trim(), 8) || 0;

      offset += 512; // skip header block
      if (size > 0 && name) {
        const content    = unzipped.slice(offset, offset + size);
        const fileName   = path.basename(name);
        const destFile   = path.join(destDir, fileName);
        fs.mkdirSync(destDir, { recursive: true });
        fs.writeFileSync(destFile, content);
      }
      offset += Math.ceil(size / 512) * 512;
    }
    cb(null);
  } catch (e) {
    cb(e);
  }
}

download(REGISTRY_URL, (err, buf) => {
  if (err) {
    console.warn('[fix-lightningcss] Download failed:', err.message);
    process.exit(0); // non-fatal — EAS builds don't need this
  }

  const destPkg = DEST_PKG_DIR;
  extractTgz(buf, destPkg, (err2) => {
    if (err2) {
      console.warn('[fix-lightningcss] Extract failed:', err2.message);
      process.exit(0);
    }

    // Copy binary to fallback path
    const srcBin = path.join(destPkg, BINARY_NAME);
    if (fileValid(srcBin)) {
      try {
        fs.mkdirSync(path.dirname(FALLBACK_BINARY), { recursive: true });
        fs.copyFileSync(srcBin, FALLBACK_BINARY);
        console.log('[fix-lightningcss] Binary installed successfully.');
      } catch (e) {
        console.warn('[fix-lightningcss] Copy failed:', e.message);
      }
    }
  });
});
