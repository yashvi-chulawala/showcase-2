require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Set default env paths for vtour integration if not provided
if (!process.env.PANOS_DIR) {
  process.env.PANOS_DIR = path.resolve(__dirname, '../vtour/panos');
}
if (!process.env.VR_TOUR_SRC_DIR) {
  process.env.VR_TOUR_SRC_DIR = path.resolve(__dirname, '../vtour/src');
}

const scenesRouter = require('./routes/scenes');
const hotspotsRouter = require('./routes/hotspots');
const publishRouter = require('./routes/publish');
const db = require('./lib/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const { seedInitialScenesIfEmpty } = require('./lib/seeder');
seedInitialScenesIfEmpty();
let activeTourId = null;

app.post('/api/system/set-active-tour', (req, res) => {
  activeTourId = req.body.tourId || null;
  res.json({ success: true, activeTourId });
});

app.get('/api/health', (req, res) => res.json({ ok: true, dbFile: db.DB_FILE }));

app.get('/api/system/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  const path = require('path');
  try {
    const scriptPath = path.join(__dirname, 'pick-folder.ps1');
    const title = req.query.title || 'Select Project Folder';
    const result = execSync(`powershell -NoProfile -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
    if (!result) return res.json({ path: null });
    res.json({ path: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/system/pick-save', (req, res) => {
  const { execSync } = require('child_process');
  const path = require('path');
  try {
    const scriptPath = path.join(__dirname, 'pick-save.ps1');
    const title = req.query.title || 'Save Project As';
    const result = execSync(`powershell -NoProfile -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
    if (!result) return res.json({ path: null });
    res.json({ path: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api', scenesRouter);
app.use('/api', hotspotsRouter);
app.use('/api', publishRouter);
app.use('/api', require('./routes/gemini-voice'));

app.get('/api/tours/:tourId/thumbnail', (req, res) => {
  const tourId = req.params.tourId;
  const tours = db.listToursWithDetails();
  const tour = tours.find(t => t.id === tourId);
  if (!tour || !tour.thumbnail) {
    return res.status(404).send('Not found');
  }
  
  let thumbPath;
  if (tourId && path.isAbsolute(tourId)) {
    thumbPath = path.join(tourId, tour.thumbnail);
  } else {
    thumbPath = path.join(__dirname, '../vtour', tour.thumbnail);
  }
  
  if (require('fs').existsSync(thumbPath)) {
    res.sendFile(thumbPath);
  } else {
    res.status(404).send('Not found');
  }
});

const noCacheOpts = {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
};

// Dynamic serving for panos, src, and assets based on active tour
app.use('/panos', (req, res, next) => {
  if (activeTourId && path.isAbsolute(activeTourId)) {
    return express.static(path.join(activeTourId, 'panos'), noCacheOpts)(req, res, next);
  }
  return express.static(path.join(__dirname, '../vtour/panos'), noCacheOpts)(req, res, next);
});

app.use('/src', (req, res, next) => {
  if (activeTourId && path.isAbsolute(activeTourId)) {
    return express.static(path.join(activeTourId, 'src'), noCacheOpts)(req, res, next);
  }
  return express.static(path.join(__dirname, '../vtour/src'), noCacheOpts)(req, res, next);
});

app.use('/assets', (req, res, next) => {
  if (activeTourId && path.isAbsolute(activeTourId)) {
    return express.static(path.join(activeTourId, 'assets'), noCacheOpts)(req, res, next);
  }
  return express.static(path.join(__dirname, '../vtour/assets'), noCacheOpts)(req, res, next);
});

// Serve static vtour directory with no-cache headers for instant dev updates
const vtourDir = path.resolve(__dirname, '../vtour');
app.use(express.static(vtourDir, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.xml')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Serve the extracted Shreepad Corporate Park project
const shreepadDir = path.resolve(__dirname, '../extracted_project/shreepadcorporatepark');
app.use('/shreepad', express.static(shreepadDir, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`vr-tour-cms-backend listening on :${PORT}`);
  console.log(`Data file: ${db.DB_FILE}`);
  console.log(`Serving static tour files from: ${vtourDir}`);
  console.log(`Open Editor at: http://localhost:${PORT}/editor-panel.html`);
});

app.post('/api/system/rename-tour', (req, res) => {
  if (!activeTourId) return res.status(400).json({ error: 'No active project' });
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'New name required' });

  const path = require('path');
  const db = require('./lib/db');
  
  const oldPath = activeTourId;
  let newPath = newName; // If it's a legacy virtual project, new ID is just the name

  try {
    if (path.isAbsolute(oldPath)) {
      const fs = require('fs');
      newPath = path.join(path.dirname(oldPath), newName);
      if (fs.existsSync(newPath)) return res.status(400).json({ error: 'Folder already exists' });
      fs.renameSync(oldPath, newPath);
    }

    db.renameTour(oldPath, newPath);
    activeTourId = newPath;
    res.json({ success: true, newTourId: newPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


