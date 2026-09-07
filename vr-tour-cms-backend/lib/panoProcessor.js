const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const os = require('os');
const defaultBin = process.platform === 'win32' ? 'C:\\Users\\Yashvi Chulawala\\Downloads\\krpano-1.20.12\\krpanotools.exe' : '/opt/krpano/krpanotools';
const KRPANOTOOLS_BIN = process.env.KRPANOTOOLS_BIN || defaultBin;
const db = require('./db');
const PANOS_DIR = process.env.PANOS_DIR || path.resolve(__dirname, '../vtour/panos');

// The .config file lives next to krpanotools.exe itself, in a "templates" subfolder.
const KRPANOTOOLS_DIR = path.dirname(KRPANOTOOLS_BIN);
const CONFIG_PATH = path.join(KRPANOTOOLS_DIR, 'templates', 'vtour-multires.config');

const KRPANO_LICENSE_KEY = process.env.KRPANO_LICENSE_KEY || "vR36fDXTMcEEdJ6j1G8G+xh72yjEJlyU2W4BpP3Ld6Ho0uFkAZPCTK6SdktN2+Pa50hWEa9kVfhTmMX7UqhxGFl1C9kFzYoRRSKBODWJtElJmBbe89Rs1hWP5AZN3amgpHJU48G+8UM4tJe+YV42PsFTZVSsp9nF3bCMDWsNqakos3nuqCqAH5odemYkp1pkGledN+XNNSRCBgURghtte7JnghQev2E0qk9oFkIBSFOj62+U6sL0QPBUSkJ8xABSUCW9MM2V1QZu5m6BDhBGwlR0qTR512DE15Zw5CnR9DSHrc/UEJKNcwSk0cVXF4nTcZPv0Bg4DlbW3mz04uS2xsHmT+tehwm6BfyBsA==";

// Automatically register license and ensure .krpanolicense is available in all system paths
function ensureKrpanoLicense() {
  if (fs.existsSync(KRPANOTOOLS_BIN)) {
    try {
      const { execFileSync } = require('child_process');
      execFileSync(KRPANOTOOLS_BIN, ['register', KRPANO_LICENSE_KEY], { stdio: 'ignore' });
      console.log('[krpano] Successfully registered license code with krpanotools binary.');
    } catch (e) {
      console.warn('[krpano] Failed to execute register code:', e.message);
    }
  }

  const possibleSourceLocations = [
    path.resolve(__dirname, '../.krpanolicense'),
    path.resolve(__dirname, '../../.krpanolicense'),
    path.resolve(__dirname, '.krpanolicense'),
    path.join(process.env.APPDATA || '', 'krpano', '.krpanolicense')
  ];

  let licenseBuffer = null;
  for (const src of possibleSourceLocations) {
    if (src && fs.existsSync(src)) {
      try {
        licenseBuffer = fs.readFileSync(src);
        break;
      } catch (e) {}
    }
  }

  if (licenseBuffer) {
    const targetDirs = [
      os.homedir(),
      path.join(os.homedir(), '.krpano'),
      '/root',
      '/root/.krpano',
      '/opt/krpano',
      KRPANOTOOLS_DIR
    ];

    for (const dir of targetDirs) {
      if (!dir) continue;
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        const targetFile = path.join(dir, '.krpanolicense');
        if (!fs.existsSync(targetFile)) {
          fs.writeFileSync(targetFile, licenseBuffer);
          console.log(`[krpano] Placed .krpanolicense into ${targetFile}`);
        }
      } catch (e) {}
    }
  }
}

try {
  ensureKrpanoLicense();
} catch (err) {
  console.warn('[krpano] ensureKrpanoLicense error:', err.message);
}

function resolveTourDir(tourId) {
  return db.resolveTourPath(tourId) || path.resolve(__dirname, '../vtour');
}

function processPano(inputImagePath, tilesFolderName, tourId) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputImagePath)) {
      return reject(new Error(`Input image not found: ${inputImagePath}`));
    }

    const baseName = tilesFolderName.replace(/\.tiles$/i, '');
    const tourDir = resolveTourDir(tourId);
    const PANOS_DIR = path.join(tourDir, 'panos');
    const outputPath = path.join(PANOS_DIR, baseName);
    const tilesPath = path.join(PANOS_DIR, `${baseName}.tiles`);

    if (!fs.existsSync(PANOS_DIR)) {
      fs.mkdirSync(PANOS_DIR, { recursive: true });
    }

    console.log("DEBUG KRPANOTOOLS_BIN:", KRPANOTOOLS_BIN, "exists:", fs.existsSync(KRPANOTOOLS_BIN));
    console.log("DEBUG CONFIG_PATH:", CONFIG_PATH, "exists:", fs.existsSync(CONFIG_PATH));

    if (!fs.existsSync(CONFIG_PATH) || !fs.existsSync(KRPANOTOOLS_BIN)) {
      console.warn(`krpano config or binary not found. Simulating processing for: ${baseName}`);
      // MOCK PROCESSING: Just create the tiles folder and copy the image as thumb and preview
      fs.mkdirSync(tilesPath, { recursive: true });
      try {
        // Copy the uploaded image to use as thumb and preview
        fs.copyFileSync(inputImagePath, path.join(tilesPath, 'thumb.jpg'));
        fs.copyFileSync(inputImagePath, path.join(tilesPath, 'preview.jpg'));
        // Resolve successfully
        return resolve({
          tilesFolder: `${baseName}.tiles`,
          thumburl: `panos/${baseName}.tiles/thumb.jpg`,
          previewurl: `panos/${baseName}.tiles/preview.jpg`
        });
      } catch (err) {
        return reject(new Error(`Failed to simulate pano processing: ${err.message}`));
      }
    }

    const krpanoTilesPath = tilesPath.replace(/\\/g, '/');
    const args = [
      'makepano',
      `-config=${CONFIG_PATH}`,
      `-outputpath=${krpanoTilesPath}`,
      `-tilepath=${krpanoTilesPath}/[c/]l%Al/%Av/l%Al[_c]_%Av_%Ah.jpg`,
      `-previewpath=${krpanoTilesPath}/preview.jpg`,
      `-thumbpath=${krpanoTilesPath}/thumb.jpg`,
      inputImagePath
    ];

    execFile(KRPANOTOOLS_BIN, args, { timeout: 5 * 60 * 1000, maxBuffer: 1024 * 1024 * 50 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(`krpanotools makepano failed: ${err.message}\n${stderr}`));
      if (!fs.existsSync(tilesPath)) {
        return reject(new Error(`Pano processing failed. Output not found at ${tilesPath}. \nStdout: ${stdout}\nStderr: ${stderr}`));
      }
      resolve({
        tilesFolder: `${baseName}.tiles`,
        thumburl: `panos/${baseName}.tiles/thumb.jpg`,
        previewurl: `panos/${baseName}.tiles/preview.jpg`
      });
    });
  });
}

module.exports = { processPano, KRPANOTOOLS_BIN, PANOS_DIR, CONFIG_PATH, resolveTourDir };
