const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const defaultBin = process.platform === 'win32' ? 'C:\\Users\\Yashvi Chulawala\\Downloads\\krpano-1.20.12\\krpanotools.exe' : '/opt/krpano/krpanotools';
const KRPANOTOOLS_BIN = process.env.KRPANOTOOLS_BIN || defaultBin;
const db = require('./db');
const PANOS_DIR = process.env.PANOS_DIR || path.resolve(__dirname, '../vtour/panos');

// The .config file lives next to krpanotools.exe itself, in a "templates" subfolder.
// krpanotools resolves -config= relative to its OWN working directory at the time
// it's spawned, not relative to this project — so a bare "templates/..." path only
// works if node's cwd happens to be the krpanotools folder. It isn't. We build an
// absolute path from KRPANOTOOLS_BIN's own folder instead, which always works
// regardless of where the backend process is running from.
const KRPANOTOOLS_DIR = path.dirname(KRPANOTOOLS_BIN);
const CONFIG_PATH = path.join(KRPANOTOOLS_DIR, 'templates', 'vtour-multires.config');

function resolveTourDir(tourId) {
  return db.resolveTourPath(tourId) || path.resolve(__dirname, '../vtour');
}

function processPano(inputImagePath, tilesFolderName, tourId) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(inputImagePath)) {
      return reject(new Error(`Input image not found: ${inputImagePath}`));
    }

    const baseName = tilesFolderName.replace(/\.tiles$/i, '');
    const tmpDir = path.join(__dirname, '../../vtour/panos');
    const tilesPath = path.join(tmpDir, `${baseName}.tiles`);

    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    const driveStorage = require('./driveStorage');

    const finishAndUpload = () => {
      // Resolve immediately so the user doesn't wait!
      resolve({
        tilesFolder: `${baseName}.tiles`,
        thumburl: `panos/${baseName}.tiles/thumb.jpg`,
        previewurl: `panos/${baseName}.tiles/preview.jpg`
      });
      // Fire-and-forget the Google Drive upload in the background
      driveStorage.uploadTilesFolder(tourId, baseName, tilesPath)
        .then(() => console.log(`\n☁️ Background sync to Google Drive finished for ${baseName}\n`))
        .catch(err => console.error(`Background upload for ${baseName} failed:`, err));
      // NOTE: We no longer delete the local tilesPath so it acts as a local cache!
    };

    if (!fs.existsSync(CONFIG_PATH) || !fs.existsSync(KRPANOTOOLS_BIN)) {
      console.warn(`krpano config or binary not found. Simulating processing for: ${baseName}`);
      fs.mkdirSync(tilesPath, { recursive: true });
      try {
        fs.copyFileSync(inputImagePath, path.join(tilesPath, 'thumb.jpg'));
        fs.copyFileSync(inputImagePath, path.join(tilesPath, 'preview.jpg'));
        finishAndUpload();
      } catch (err) {
        return reject(new Error(`Failed to simulate pano processing: ${err.message}`));
      }
    } else {
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
        finishAndUpload();
      });
    }
  });
}

module.exports = { processPano, KRPANOTOOLS_BIN, PANOS_DIR, CONFIG_PATH, resolveTourDir };
