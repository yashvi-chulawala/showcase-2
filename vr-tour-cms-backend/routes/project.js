const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const db = require('../lib/db');

const upload = multer({ dest: path.join(__dirname, '../temp_uploads/') });

// GET /api/project/export — download active tour as a .s360 zip archive
router.get('/export', (req, res) => {
  const activeTourId = db.getActiveTour();
  if (!activeTourId || activeTourId === 'default') {
    return res.status(400).json({ error: 'No active project to export' });
  }

  try {
    const zip = new AdmZip();
    const tourName = path.basename(activeTourId);

    if (path.isAbsolute(activeTourId) && fs.existsSync(activeTourId)) {
      zip.addLocalFolder(activeTourId);
    } else {
      return res.status(400).json({ error: 'Active project folder not found on disk' });
    }

    const zipBuffer = zip.toBuffer();
    const fileName = `${tourName}.s360`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/project/import — upload a .s360 zip and extract it as a new tour
router.post('/import', upload.single('projectFile'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const tempPath = req.file.path;
  try {
    const zip = new AdmZip(tempPath);
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
    zip.extractAllTo(targetDir, true);

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
