require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Set default env paths for vtour integration if not provided
if (!process.env.PANOS_DIR) {
  process.env.PANOS_DIR = path.resolve(__dirname, './vtour/panos');
}
if (!process.env.VR_TOUR_SRC_DIR) {
  process.env.VR_TOUR_SRC_DIR = path.resolve(__dirname, './vtour/src');
}

const scenesRouter = require('./routes/scenes');
const hotspotsRouter = require('./routes/hotspots');
const projectRouter = require('./routes/project');
const publishRouter = require('./routes/publish');
const db = require('./lib/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const { seedInitialScenesIfEmpty } = require('./lib/seeder');
seedInitialScenesIfEmpty();
app.post('/api/system/set-active-tour', (req, res) => {
  let tourId = req.body.tourId || null;
  const fs = require('fs');

  if (tourId && fs.existsSync(tourId)) {
    const stats = fs.statSync(tourId);
    if (stats.isFile()) {
      if (tourId.toLowerCase().endsWith('.s360')) {
        // Auto extract zip file!
        try {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(tourId);
          const originalName = path.basename(tourId, '.s360').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Imported_Project';
          let targetDir = path.join(__dirname, 'data', originalName);
          let counter = 1;
          while (fs.existsSync(targetDir)) {
            targetDir = path.join(__dirname, 'data', `${originalName}_${counter}`);
            counter++;
          }
          fs.mkdirSync(targetDir, { recursive: true });
          zip.extractAllTo(targetDir, true);
          tourId = targetDir; // Switch to the newly extracted folder
        } catch (err) {
          console.error("Failed to auto-extract .s360 zip:", err);
          return res.status(400).json({ error: "Failed to extract .s360 project archive." });
        }
      } else {
        // They picked a random file (like project.json) inside a folder. Use its parent directory.
        tourId = path.dirname(tourId);
      }
    }
  }

  db.setActiveTour(tourId);
  try {
    const { publishTour } = require('./lib/publisher');
    publishTour(tourId);
  } catch (e) {
    console.error("Auto-publish on tour switch failed:", e);
  }
  res.json({ success: true, activeTourId: db.getActiveTour() });
});

app.get('/api/system/recent-projects', (req, res) => {
  const dbModule = require('./lib/db');
  res.json({ projects: dbModule.getRecentProjects() });
});

app.get('/api/health', (req, res) => res.json({ ok: true, dbFile: db.DB_FILE }));

app.get('/api/system/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  const path = require('path');
  if (process.platform !== 'win32') {
    return res.json({ path: null, error: 'Native OS folder picker is only available in local desktop mode' });
  }
  try {
    const scriptPath = path.join(__dirname, 'pick-folder.ps1');
    const title = req.query.title || 'Select Project Folder';
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
    if (!result) return res.json({ path: null });
    res.json({ path: result });
  } catch (e) {
    res.json({ path: null, error: e.message });
  }
});

app.get('/api/system/pick-save', (req, res) => {
  const { execSync } = require('child_process');
  const path = require('path');
  if (process.platform !== 'win32') {
    return res.json({ path: null, error: 'Native OS save picker is only available in local desktop mode' });
  }
  try {
    const scriptPath = path.join(__dirname, 'pick-save.ps1');
    const title = req.query.title || 'Save Project As';
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
    if (!result) return res.json({ path: null });
    res.json({ path: result });
  } catch (e) {
    res.json({ path: null, error: e.message });
  }
});

app.use('/api', scenesRouter);
app.use('/api', hotspotsRouter);
app.use('/api/project', projectRouter);
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
    thumbPath = path.join(__dirname, './vtour', tour.thumbnail);
  }

  if (require('fs').existsSync(thumbPath)) {
    res.sendFile(thumbPath);
  } else {
    res.status(404).send('Not found');
  }
});

function sendStaticFile(res, filePath) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(path.resolve(filePath));
}

// Dynamic serving for panos, src, and assets with smart fallback across all data/ projects
app.use('/panos', (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const activeTourId = db.getActiveTour();
  const tourDir = db.resolveTourPath(activeTourId);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'panos', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const vtourFile = path.join(__dirname, 'vtour', 'panos', relPath);
  if (fs.existsSync(vtourFile) && fs.statSync(vtourFile).isFile()) {
    return sendStaticFile(res, vtourFile);
  }

  const dataDir = path.join(__dirname, 'data');
  if (fs.existsSync(dataDir)) {
    try {
      const projects = fs.readdirSync(dataDir, { withFileTypes: true });
      for (const p of projects) {
        if (p.isDirectory()) {
          const candidate = path.join(dataDir, p.name, 'panos', relPath);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return sendStaticFile(res, candidate);
          }
        }
      }
    } catch (e) {}
  }

  next();
});

app.use('/src', (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const activeTourId = db.getActiveTour();
  const tourDir = db.resolveTourPath(activeTourId);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'src', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const vtourFile = path.join(__dirname, 'vtour', 'src', relPath);
  if (fs.existsSync(vtourFile) && fs.statSync(vtourFile).isFile()) {
    return sendStaticFile(res, vtourFile);
  }

  const dataDir = path.join(__dirname, 'data');
  if (fs.existsSync(dataDir)) {
    try {
      const projects = fs.readdirSync(dataDir, { withFileTypes: true });
      for (const p of projects) {
        if (p.isDirectory()) {
          const candidate = path.join(dataDir, p.name, 'src', relPath);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return sendStaticFile(res, candidate);
          }
        }
      }
    } catch (e) {}
  }

  next();
});

app.use('/assets', (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const activeTourId = db.getActiveTour();
  const tourDir = db.resolveTourPath(activeTourId);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'assets', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const vtourFile = path.join(__dirname, 'vtour', 'assets', relPath);
  if (fs.existsSync(vtourFile) && fs.statSync(vtourFile).isFile()) {
    return sendStaticFile(res, vtourFile);
  }

  const dataDir = path.join(__dirname, 'data');
  if (fs.existsSync(dataDir)) {
    try {
      const projects = fs.readdirSync(dataDir, { withFileTypes: true });
      for (const p of projects) {
        if (p.isDirectory()) {
          const candidate = path.join(dataDir, p.name, 'assets', relPath);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
            return sendStaticFile(res, candidate);
          }
        }
      }
    } catch (e) {}
  }

  next();
});

// Serve static vtour directory with no-cache headers for instant dev updates
const vtourDir = path.resolve(__dirname, './vtour');
app.use(express.static(vtourDir, {
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.xml')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Auto-redirect root to editor-panel.html
app.get('/', (req, res) => {
  res.redirect('/editor-panel.html');
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`vr-tour-cms-backend listening on :${PORT}`);
  console.log(`Data file: ${db.DB_FILE}`);
  console.log(`Serving static tour files from: ${vtourDir}`);
  console.log(`Open Editor at: http://localhost:${PORT}/editor-panel.html`);
});

app.post('/api/system/rename-tour', (req, res) => {
  const activeTourId = db.getActiveTour();
  if (!activeTourId || activeTourId === 'default') return res.status(400).json({ error: 'No active project to rename' });
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'New name required' });

  const path = require('path');
  const dbModule = require('./lib/db');

  const oldPath = activeTourId;
  let newPath = newName; // If it's a legacy virtual project, new ID is just the name

  try {
    if (path.isAbsolute(oldPath)) {
      const fs = require('fs');
      newPath = path.join(path.dirname(oldPath), newName);
      if (fs.existsSync(newPath)) return res.status(400).json({ error: 'Folder already exists' });
      fs.renameSync(oldPath, newPath);
    }

    dbModule.renameTour(oldPath, newPath);
    dbModule.setActiveTour(newPath);
    res.json({ success: true, newTourId: newPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


