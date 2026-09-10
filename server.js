require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Set default env paths for frontend integration if not provided
if (!process.env.PANOS_DIR) {
  process.env.PANOS_DIR = path.resolve(__dirname, './frontend/panos');
}
if (!process.env.VR_TOUR_SRC_DIR) {
  process.env.VR_TOUR_SRC_DIR = path.resolve(__dirname, './frontend/src');
}

const scenesRouter = require('./backend/routes/scenes');
const hotspotsRouter = require('./backend/routes/hotspots');
const projectRouter = require('./backend/routes/project');
const publishRouter = require('./backend/routes/publish');
const db = require('./backend/lib/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const { seedInitialScenesIfEmpty } = require('./backend/lib/seeder');
seedInitialScenesIfEmpty();

app.post('/api/system/set-active-tour', (req, res) => {
  let tourId = req.body.tourId || null;

  if (tourId && fs.existsSync(tourId)) {
    const stats = fs.statSync(tourId);
    if (stats.isFile()) {
      if (tourId.toLowerCase().endsWith('.s360')) {
        // Auto extract zip file!
        try {
          const AdmZip = require('adm-zip');
          const zip = new AdmZip(tourId);
          const originalName = path.basename(tourId, '.s360').replace(/[^a-zA-Z0-9 -]/g, '').trim() || 'Imported_Project';
          let targetDir = path.join(__dirname, 'database', originalName);
          let counter = 1;
          while (fs.existsSync(targetDir)) {
            targetDir = path.join(__dirname, 'database', `${originalName}_${counter}`);
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
    const { publishTour } = require('./backend/lib/publisher');
    publishTour(tourId);
  } catch (e) {
    console.error("Auto-publish on tour switch failed:", e);
  }
  res.json({ success: true, activeTourId: db.getActiveTour() });
});

app.get('/api/system/recent-projects', (req, res) => {
  res.json({ projects: db.getRecentProjects() });
});

app.get('/api/health', (req, res) => res.json({ ok: true, dbFile: db.DB_FILE }));

app.get('/api/system/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  if (process.platform !== 'win32') {
    return res.json({ path: null, error: 'Native OS folder picker is only available in local desktop mode' });
  }
  try {
    const scriptPath = path.join(__dirname, 'backend', 'scripts', 'pick-folder.ps1');
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
  if (process.platform !== 'win32') {
    return res.json({ path: null, error: 'Native OS save picker is only available in local desktop mode' });
  }
  try {
    const scriptPath = path.join(__dirname, 'backend', 'scripts', 'pick-save.ps1');
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
app.use('/api', require('./backend/routes/custom-icons'));
app.use('/api', require('./backend/routes/gemini-voice'));

app.get('/api/tours/:tourId/thumbnail', (req, res) => {
  const tourId = req.params.tourId;
  const tourDir = db.resolveTourPath(tourId);
  if (!tourDir || !fs.existsSync(tourDir)) {
    return res.status(404).send('Tour not found');
  }

  const pJsonPath = path.join(tourDir, 'project.json');
  let projDb = { scenes: [] };
  if (fs.existsSync(pJsonPath)) {
    try {
      projDb = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
    } catch (e) {}
  }

  // 1. Look for first valid thumbnail in scene records
  if (Array.isArray(projDb.scenes)) {
    for (const sc of projDb.scenes) {
      if (sc.tilesFolder) {
        const tPath = path.join(tourDir, 'panos', sc.tilesFolder, 'thumb.jpg');
        if (fs.existsSync(tPath)) {
          return res.sendFile(tPath);
        }
        const pPath = path.join(tourDir, 'panos', sc.tilesFolder, 'preview.jpg');
        if (fs.existsSync(pPath)) {
          return res.sendFile(pPath);
        }
      }
    }
  }

  // 2. Check if any thumb.jpg or preview.jpg exists anywhere in panos/
  const panosDir = path.join(tourDir, 'panos');
  if (fs.existsSync(panosDir)) {
    try {
      const dirs = fs.readdirSync(panosDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const tPath = path.join(panosDir, d.name, 'thumb.jpg');
          if (fs.existsSync(tPath)) return res.sendFile(tPath);
          const pPath = path.join(panosDir, d.name, 'preview.jpg');
          if (fs.existsSync(pPath)) return res.sendFile(pPath);
        }
      }
    } catch (e) {}
  }

  return res.status(404).send('No thumbnail found');
});

function sendStaticFile(res, filePath) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  return res.sendFile(path.resolve(filePath));
}

function getEffectiveTourDir(req) {
  let tourId = null;
  if (req.query && req.query.tour) {
    tourId = req.query.tour;
  } else if (req.headers && req.headers.referer) {
    try {
      const refUrl = new URL(req.headers.referer);
      tourId = refUrl.searchParams.get('tour');
    } catch(e) {}
  }
  if (!tourId) tourId = db.getActiveTour();
  return db.resolveTourPath(tourId);
}

// Dynamic serving for panos, src, and assets with smart fallback across all database/ projects
app.use(['/panos', '/vtour/panos', '/frontend/panos', '/vtour/src/panos', '/frontend/src/panos'], (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const tourDir = getEffectiveTourDir(req);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'panos', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const frontendFile = path.join(__dirname, 'frontend', 'panos', relPath);
  if (fs.existsSync(frontendFile) && fs.statSync(frontendFile).isFile()) {
    return sendStaticFile(res, frontendFile);
  }

  const dataDir = path.join(__dirname, 'database');
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

app.use(['/src', '/vtour/src', '/frontend/src'], (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const tourDir = getEffectiveTourDir(req);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'src', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const frontendFile = path.join(__dirname, 'frontend', 'src', relPath);
  if (fs.existsSync(frontendFile) && fs.statSync(frontendFile).isFile()) {
    return sendStaticFile(res, frontendFile);
  }

  const dataDir = path.join(__dirname, 'database');
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

app.use(['/assets', '/vtour/assets', '/frontend/assets', '/vtour/src/assets', '/frontend/src/assets'], (req, res, next) => {
  const relPath = decodeURIComponent(req.path.replace(/^\//, ''));
  const tourDir = getEffectiveTourDir(req);

  if (tourDir) {
    const activeFile = path.join(tourDir, 'assets', relPath);
    if (fs.existsSync(activeFile) && fs.statSync(activeFile).isFile()) {
      return sendStaticFile(res, activeFile);
    }
  }

  const frontendFile = path.join(__dirname, 'frontend', 'assets', relPath);
  if (fs.existsSync(frontendFile) && fs.statSync(frontendFile).isFile()) {
    return sendStaticFile(res, frontendFile);
  }

  const dataDir = path.join(__dirname, 'database');
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

// Serve static frontend directory with no-cache headers for instant dev updates
const frontendDir = path.resolve(__dirname, './frontend');

// Make editor panel the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'editor-panel.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendDir, 'editor-panel.html'));
});

app.use(express.static(frontendDir, {
  index: ['editor-panel.html', 'index.html'],
  setHeaders: (res, path) => {
    if (path.endsWith('.html') || path.endsWith('.js') || path.endsWith('.css') || path.endsWith('.xml')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`Showcase 360 backend listening on :${PORT}`);
  console.log(`Database directory: ${path.resolve(__dirname, './database')}`);
  console.log(`Serving frontend from: ${frontendDir}`);
  console.log(`Open Editor at: http://localhost:${PORT}/`);
});

app.post('/api/system/rename-tour', (req, res) => {
  const activeTourId = db.getActiveTour();
  if (!activeTourId || activeTourId === 'default') return res.status(400).json({ error: 'No active project to rename' });
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: 'New name required' });

  const oldPath = activeTourId;
  let newPath = newName;

  try {
    if (path.isAbsolute(oldPath)) {
      newPath = path.join(path.dirname(oldPath), newName);
      if (fs.existsSync(newPath)) return res.status(400).json({ error: 'Folder already exists' });
      fs.renameSync(oldPath, newPath);
    }

    db.renameTour(oldPath, newPath);
    db.setActiveTour(newPath);
    res.json({ success: true, newTourId: newPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
