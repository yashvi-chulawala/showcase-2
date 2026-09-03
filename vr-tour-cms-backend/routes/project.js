const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const db = require('../lib/db');

const tempUploadsDir = path.join(__dirname, '../temp_uploads');
if (!fs.existsSync(tempUploadsDir)) {
  fs.mkdirSync(tempUploadsDir, { recursive: true });
}

const upload = multer({
  dest: tempUploadsDir,
  limits: { fileSize: 2000 * 1024 * 1024 } // Support large project files up to 2GB
});

const archiver = require('archiver');

// GET /api/project/export — stream active tour as a .s360 zip archive (Low memory streaming)
router.get('/export', (req, res) => {
  const activeTourId = db.getActiveTour();
  if (!activeTourId || activeTourId === 'default') {
    return res.status(400).json({ error: 'No active project to export' });
  }

  const tourDir = db.resolveTourPath(activeTourId);
  if (!tourDir || !fs.existsSync(tourDir)) {
    return res.status(400).json({ error: 'Active project folder not found on disk' });
  }

  try {
    const tourName = path.basename(tourDir);
    const fileName = `${tourName}.s360`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const archive = typeof archiver === 'function' ? archiver('zip', { store: true }) : new (archiver.ZipArchive || archiver)({ store: true });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archiver warning:', err);
      } else {
        console.error('Archiver error:', err);
      }
    });

    archive.on('error', (err) => {
      console.error('Export archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    });

    // Pipe directly to client response
    archive.pipe(res);

    // Append entire active tour directory
    archive.directory(tourDir, false);

    // Finalize stream
    archive.finalize();
  } catch (err) {
    console.error('Export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// POST /api/project/create — create a new project directory on the server
router.post('/create', (req, res) => {
  const { name } = req.body || {};
  const originalName = (name || 'New_Project').replace(/[^a-zA-Z0-9 \-_]/g, '').trim() || 'New_Project';
  const dataDir = path.join(__dirname, '../data');
  fs.mkdirSync(dataDir, { recursive: true });

  let targetDir = path.join(dataDir, originalName);
  let counter = 1;
  while (fs.existsSync(targetDir)) {
    targetDir = path.join(dataDir, `${originalName}_${counter}`);
    counter++;
  }

  try {
    fs.mkdirSync(targetDir, { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'panos'), { recursive: true });
    fs.mkdirSync(path.join(targetDir, 'assets'), { recursive: true });

    // Initialize clean project.json
    fs.writeFileSync(path.join(targetDir, 'project.json'), JSON.stringify({ scenes: [], hotspots: [], assets: [] }, null, 2));

    db.setActiveTour(targetDir);
    try {
      const { publishTour } = require('../lib/publisher');
      publishTour(targetDir);
    } catch (e) {
      console.warn('Auto-publish after project create failed:', e.message);
    }

    res.json({ success: true, newTourId: targetDir, name: path.basename(targetDir) });
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: err.message });
  }
});

function extractZipArchive(zipFilePath, targetDir) {
  const { execSync } = require('child_process');
  
  // On Linux/Render/Docker, use native unzip (streaming, zero RAM usage, very fast)
  if (process.platform !== 'win32') {
    try {
      execSync(`unzip -q -o "${zipFilePath}" -d "${targetDir}"`);
      return true;
    } catch (e) {
      console.warn('Native unzip command failed, trying AdmZip fallback:', e.message);
    }
  } else {
    // On Windows, try PowerShell Expand-Archive for memory-safe extraction
    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zipFilePath}' -DestinationPath '${targetDir}' -Force"`);
      return true;
    } catch (e) {
      console.warn('PowerShell Expand-Archive failed, trying AdmZip fallback:', e.message);
    }
  }

  // AdmZip fallback
  const zip = new AdmZip(zipFilePath);
  zip.extractAllTo(targetDir, true);
  return true;
}

// POST /api/project/import — upload a .s360 zip and extract it as a new tour
router.post('/import', upload.single('projectFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tempPath = req.file.path;
  try {
    const originalName = path.basename(req.file.originalname, '.s360').replace(/[^a-zA-Z0-9 \-_]/g, '').trim() || 'Imported_Project';
    const dataDir = path.join(__dirname, '../data');
    fs.mkdirSync(dataDir, { recursive: true });

    let targetDir = path.join(dataDir, originalName);
    let counter = 1;
    while (fs.existsSync(targetDir)) {
      targetDir = path.join(dataDir, `${originalName}_${counter}`);
      counter++;
    }

    fs.mkdirSync(targetDir, { recursive: true });
    extractZipArchive(tempPath, targetDir);

    // Set as active tour and publish
    db.setActiveTour(targetDir);
    try {
      const { publishTour } = require('../lib/publisher');
      publishTour(targetDir);
    } catch (e) {
      console.warn('Auto-publish after import failed:', e.message);
    }

    res.json({ success: true, newTourId: targetDir });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(tempPath, () => {});
  }
});

module.exports = router;
