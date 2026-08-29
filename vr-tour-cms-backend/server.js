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
const projectRouter = require('./routes/project');
const publishRouter = require('./routes/publish');
const db = require('./lib/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

const { seedInitialScenesIfEmpty } = require('./lib/seeder');
seedInitialScenesIfEmpty();
app.post('/api/system/set-active-tour', async (req, res) => {
  let tourId = req.body.tourId || null;
  
  if (!tourId) {
    return res.status(400).json({ error: 'Missing tourId' });
  }

  await db.setActiveTourAsync(tourId);
  try {
    const { publishTour } = require('./lib/publisher');
    publishTour(tourId);
  } catch (e) {
    console.error("Auto-publish on tour switch failed:", e);
  }
  res.json({ success: true, activeTourId: db.getActiveTour() });
});

app.get('/api/system/recent-projects', async (req, res) => {
  try {
    const dbModule = require('./lib/db');
    const projectsDetails = await dbModule.listToursWithDetailsAsync();
    // Frontend expects an array of strings (the tour IDs)
    const projects = projectsDetails.map(p => p.id);
    res.json({ projects });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true, dbFile: db.DB_FILE }));

app.get('/api/system/pick-folder', (req, res) => {
  const { execSync } = require('child_process');
  const path = require('path');
  try {
    const scriptPath = path.join(__dirname, 'pick-folder.ps1');
    const title = req.query.title || 'Select Project Folder';
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
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
    const result = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -STA -File "${scriptPath}" -Title "${title}"`, { encoding: 'utf8' }).trim();
    if (!result) return res.json({ path: null });
    res.json({ path: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api', scenesRouter);
app.use('/api', hotspotsRouter);
app.use('/api/project', projectRouter);
app.use('/api', publishRouter);

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
const driveStorage = require('./lib/driveStorage');

async function serveFromDrive(req, res, next, folderPrefix, fallbackLocalPath) {
  const activeTourId = db.getActiveTour();
  if (!activeTourId || activeTourId === 'default') {
    return express.static(fallbackLocalPath, noCacheOpts)(req, res, next);
  }
  
  const relativePath = req.params[0];
  const localFilePath = require('path').join(fallbackLocalPath, relativePath);

  // HYBRID CACHE: Always serve local files instantly if they exist on disk!
  if (require('fs').existsSync(localFilePath)) {
    return res.sendFile(localFilePath);
  }

  try {
    const stream = await driveStorage.resolveFileStream(activeTourId + '/' + folderPrefix + '/' + relativePath);
    if (!stream) {
      console.warn(`Drive file not found: ${folderPrefix}/${relativePath}`);
      return res.status(404).send('Not found in Drive');
    }
    
    if (relativePath.endsWith('.jpg')) res.setHeader('Content-Type', 'image/jpeg');
    else if (relativePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    else if (relativePath.endsWith('.xml')) res.setHeader('Content-Type', 'text/xml');
    
    stream.pipe(res);
  } catch (err) {
    console.error(`Error serving ${folderPrefix}/${relativePath} from drive:`, err);
    res.status(500).send('Error loading from Drive');
  }
}

app.get('/panos/*', (req, res, next) => {
  serveFromDrive(req, res, next, 'panos', path.join(__dirname, '../vtour/panos'));
});



app.get('/assets/*', (req, res, next) => {
  serveFromDrive(req, res, next, 'assets', path.join(__dirname, '../vtour/assets'));
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


