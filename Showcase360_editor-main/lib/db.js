/**
 * db.js
 * Project-specific file-based store.
 * Data lives in project.json within the active project directory.
 */

const fs = require('fs');
const path = require('path');

const RECENT_PROJECTS_FILE = path.join(__dirname, '../data/recent_projects.json');
const LEGACY_DB_FILE = path.join(__dirname, '../data/db.json');

let activeTourId = 'default';

function getRecentProjects() {
  if (!fs.existsSync(RECENT_PROJECTS_FILE)) {
    return [];
  }
  try {
    return JSON.parse(fs.readFileSync(RECENT_PROJECTS_FILE, 'utf8'));
  } catch(e) {
    return [];
  }
}

function addRecentProject(tourId) {
  let projects = getRecentProjects();
  if (!projects.includes(tourId)) {
    projects.push(tourId);
    fs.writeFileSync(RECENT_PROJECTS_FILE, JSON.stringify(projects, null, 2));
  }
}

function getActiveTour() {
  return activeTourId;
}

function setActiveTour(tourId) {
  activeTourId = tourId || 'default';
  if (activeTourId !== 'default' && path.isAbsolute(activeTourId)) {
    addRecentProject(activeTourId);
  }
}

function resolveTourPath(tourId) {
  if (!tourId || tourId === 'default') return null;
  if (path.isAbsolute(tourId) && fs.existsSync(tourId)) return tourId;

  // Check in data folder by basename
  const name = path.basename(tourId);
  const inData = path.join(__dirname, '../data', name);
  if (fs.existsSync(inData)) return inData;

  const rel = path.resolve(__dirname, '..', tourId);
  if (fs.existsSync(rel)) return rel;

  return null;
}

function getDbPath(tourId = activeTourId) {
  if (!tourId || tourId === 'default') {
    return LEGACY_DB_FILE;
  }
  const resolved = resolveTourPath(tourId);
  if (resolved) {
    return path.join(resolved, 'project.json');
  }
  if (path.isAbsolute(tourId)) {
    return path.join(tourId, 'project.json');
  }
  return LEGACY_DB_FILE;
}

function ensureFile(dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ scenes: [], hotspots: [], assets: [] }, null, 2));
  }
}

function readDB(tourId = activeTourId) {
  const dbPath = getDbPath(tourId);
  ensureFile(dbPath);
  try {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    if (!db.assets) db.assets = [];
    if (!db.scenes) db.scenes = [];
    if (!db.hotspots) db.hotspots = [];
    return db;
  } catch(e) {
    return { scenes: [], hotspots: [], assets: [] };
  }
}

function writeDB(data, tourId = activeTourId) {
  const dbPath = getDbPath(tourId);
  ensureFile(dbPath);
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function listScenes(tourId = activeTourId) {
  let dbData = readDB(tourId);
  let scenes = dbData.scenes || [];
  if (getDbPath(tourId) === LEGACY_DB_FILE) {
    scenes = scenes.filter(s => (s.tourId || 'default') === tourId);
  }

  // Auto-scan panos folder for any tiles directories on disk that might not be in db yet
  const tourDir = resolveTourPath(tourId);
  if (tourDir) {
    const panosDir = path.join(tourDir, 'panos');
    if (fs.existsSync(panosDir)) {
      try {
        const entries = fs.readdirSync(panosDir, { withFileTypes: true });
        let modified = false;
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.endsWith('.tiles')) {
            const folderName = entry.name;
            const exists = scenes.some(s => s.tilesFolder === folderName || `${s.slug}.tiles` === folderName);
            if (!exists) {
              const baseName = folderName.replace(/\.tiles$/, '');
              // Clean up title (e.g. vesu_1_1 -> Vesu 1)
              let cleanTitle = baseName.replace(/_/g, ' ');
              cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
              const newScene = {
                _id: generateId(),
                tourId: tourId || activeTourId,
                title: cleanTitle,
                slug: baseName,
                tilesFolder: folderName,
                order: scenes.length,
                lat: null,
                lng: null,
                createdAt: new Date().toISOString()
              };
              scenes.push(newScene);
              modified = true;
            }
          }
        }
        if (modified) {
          dbData.scenes = scenes;
          writeDB(dbData, tourId);
        }
      } catch (e) {
        console.warn('Auto-scan panos directory failed:', e.message);
      }
    }
  }

  return scenes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function createScene({ tourId, title, slug, tilesFolder, lat, lng }) {
  tourId = tourId || activeTourId;
  const db = readDB(tourId);
  const order = db.scenes.length;
  const scene = { _id: generateId(), tourId, title, slug, tilesFolder, order, lat, lng, createdAt: new Date().toISOString() };
  db.scenes.push(scene);
  writeDB(db, tourId);
  return scene;
}

function updateScene(sceneId, patch) {
  const db = readDB();
  const scene = db.scenes.find(s => s._id === sceneId);
  if (!scene) return null;
  Object.assign(scene, patch);
  writeDB(db);
  return scene;
}

function deleteScene(sceneId) {
  const db = readDB();
  db.scenes = db.scenes.filter(s => s._id !== sceneId);
  db.hotspots = db.hotspots.filter(h => h.sceneId !== sceneId && h.targetSceneId !== sceneId);
  writeDB(db);
}

function reorderScenes(orderedSceneIds, tourId = activeTourId) {
  const db = readDB(tourId);
  const map = new Map(db.scenes.map(s => [s._id, s]));
  const reordered = [];
  orderedSceneIds.forEach((id, idx) => {
    const s = map.get(id);
    if (s) {
      s.order = idx;
      reordered.push(s);
      map.delete(id);
    }
  });
  // Keep any scenes not mentioned at the end
  map.forEach(s => {
    s.order = reordered.length;
    reordered.push(s);
  });
  db.scenes = reordered;
  writeDB(db, tourId);
  return db.scenes;
}

function getSceneById(sceneId) {
  const db = readDB();
  return db.scenes.find(s => s._id === sceneId) || null;
}

function setStartScene(sceneId, tourId = activeTourId) {
  const db = readDB(tourId);
  let found = null;
  db.scenes.forEach(s => {
    s.isStartScene = s._id === sceneId;
    if (s._id === sceneId) found = s;
  });
  writeDB(db, tourId);
  return found;
}

function resetTour(tourId = activeTourId) {
  const db = readDB(tourId);
  db.scenes = [];
  db.hotspots = [];
  writeDB(db, tourId);
}

// ---- Tours -------------------------------------------------------------

function listToursWithDetails() {
  const toursMap = new Map();
  const dataDir = path.join(__dirname, '../data');

  // 1. Scan data directory directly for projects
  if (fs.existsSync(dataDir)) {
    try {
      const entries = fs.readdirSync(dataDir, { withFileTypes: true });
      entries.forEach(entry => {
        if (entry.isDirectory()) {
          const tourPath = path.join(dataDir, entry.name);
          const pJsonPath = path.join(tourPath, 'project.json');
          let projDb = { scenes: [] };
          let mtime = new Date().toISOString();
          if (fs.existsSync(pJsonPath)) {
            try {
              projDb = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
              mtime = fs.statSync(pJsonPath).mtime.toISOString();
            } catch(e) {}
          }
          const latestScene = projDb.scenes && projDb.scenes.length > 0 ? 
            projDb.scenes.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] : null;

          toursMap.set(tourPath, {
            id: tourPath,
            title: entry.name,
            date: latestScene ? latestScene.createdAt : mtime,
            thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
          });
        }
      });
    } catch (err) {
      console.error("Error scanning data dir for projects:", err);
    }
  }

  // 2. Scan recent projects
  const recent = getRecentProjects();
  recent.forEach(tourPath => {
    const resolved = resolveTourPath(tourPath);
    if (resolved && !toursMap.has(resolved)) {
      const pJsonPath = path.join(resolved, 'project.json');
      if (fs.existsSync(pJsonPath)) {
        try {
          const projDb = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
          const title = path.basename(resolved);
          const latestScene = projDb.scenes && projDb.scenes.length > 0 ? 
            projDb.scenes.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] : null;
          
          toursMap.set(resolved, {
            id: resolved,
            title: title,
            date: latestScene ? latestScene.createdAt : fs.statSync(pJsonPath).mtime.toISOString(),
            thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
          });
        } catch (e) {
          console.error("Error reading project.json in listToursWithDetails for", resolved, e);
        }
      }
    }
  });

  // 3. Add default legacy tour if legacy DB has scenes
  const legacyDb = readDB('default');
  if (legacyDb.scenes && legacyDb.scenes.length > 0 && !toursMap.has('default')) {
    const latestScene = legacyDb.scenes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    toursMap.set('default', {
      id: 'default',
      title: 'Legacy Project (Please Migrate)',
      date: latestScene ? latestScene.createdAt : new Date().toISOString(),
      thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
    });
  }

  return Array.from(toursMap.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function listTours() {
  return listToursWithDetails().map(t => t.id);
}

function cloneTour(oldTourId, newTourId) {
  const oldDb = readDB(oldTourId);
  const newDb = { scenes: [], hotspots: [], assets: [] };
  
  const sceneIdMap = {};
  oldDb.scenes.forEach(s => {
    const newId = generateId();
    sceneIdMap[s._id] = newId;
    newDb.scenes.push({ ...s, _id: newId, tourId: newTourId, createdAt: new Date().toISOString() });
  });

  oldDb.hotspots.forEach(h => {
    newDb.hotspots.push({
      ...h,
      _id: generateId(),
      sceneId: sceneIdMap[h.sceneId] || h.sceneId,
      targetSceneId: sceneIdMap[h.targetSceneId] || h.targetSceneId,
      createdAt: new Date().toISOString()
    });
  });

  oldDb.assets.forEach(a => {
    newDb.assets.push({ ...a, _id: generateId(), tourId: newTourId, createdAt: new Date().toISOString() });
  });

  writeDB(newDb, newTourId);
  
  // Physical copying logic
  const oldResolved = resolveTourPath(oldTourId);
  const newResolved = resolveTourPath(newTourId) || newTourId;

  const oldPanosPath = oldResolved ? path.join(oldResolved, 'panos') : path.join(__dirname, '../vtour/panos');
  const oldAssetsPath = oldResolved ? path.join(oldResolved, 'assets') : path.join(__dirname, '../vtour/assets');
  
  const newPanosPath = path.isAbsolute(newResolved) ? path.join(newResolved, 'panos') : path.join(__dirname, '../vtour/panos');
  const newAssetsPath = path.isAbsolute(newResolved) ? path.join(newResolved, 'assets') : path.join(__dirname, '../vtour/assets');

  if (oldTourId !== newTourId) {
    if (fs.existsSync(oldPanosPath)) {
      fs.cpSync(oldPanosPath, newPanosPath, { recursive: true, force: true });
    }
    if (fs.existsSync(oldAssetsPath)) {
      fs.cpSync(oldAssetsPath, newAssetsPath, { recursive: true, force: true });
    }
  }

  if (newTourId !== 'default' && path.isAbsolute(newTourId)) {
    addRecentProject(newTourId);
  }
}

// ---- Hotspots -------------------------------------------------------------

function listHotspots(tourId = activeTourId) {
  const db = readDB(tourId);
  let scenes = db.scenes || [];
  if (getDbPath(tourId) === LEGACY_DB_FILE) {
    scenes = scenes.filter(s => (s.tourId || 'default') === tourId);
  }
  const sceneIds = new Set(scenes.map(s => s._id));
  return db.hotspots.filter(h => sceneIds.has(h.sceneId));
}

function createHotspot({ sceneId, targetSceneId, ath, atv, style, title, kind, info, color, transition, action, textProps, width, height }) {
  const db = readDB(); // uses activeTourId
  const hotspot = {
    _id: generateId(),
    sceneId,
    title: title || '',
    kind: kind || 'scene',           // 'scene' (jump) or 'info' (popup)
    targetSceneId: targetSceneId || null,  // only meaningful when kind === 'scene'
    info: info || '',                // only meaningful when kind === 'info'
    ath,
    atv,
    style: style || 'Arrow',
    color: color || '#ffffff',
    transition: transition || 'BLEND(0.5)',
    action: action || 'scene',
    textProps: textProps || {},
    width: width || null,
    height: height || null,
    createdAt: new Date().toISOString()
  };
  db.hotspots.push(hotspot);
  writeDB(db);
  return hotspot;
}

function updateHotspot(hotspotId, patch) {
  const db = readDB();
  const hotspot = db.hotspots.find(h => h._id === hotspotId);
  if (!hotspot) return null;
  Object.assign(hotspot, patch);
  writeDB(db);
  return hotspot;
}

function deleteHotspot(hotspotId) {
  const db = readDB();
  db.hotspots = db.hotspots.filter(h => h._id !== hotspotId);
  writeDB(db);
}

function renameTour(oldTourId, newTourId) {
  // handled externally via fs.renameSync
  if (path.isAbsolute(newTourId)) addRecentProject(newTourId);
}

// ---- Assets -------------------------------------------------------------

function listAssets(tourId = activeTourId) {
  let dbData = readDB(tourId);
  let assets = dbData.assets || [];
  if (getDbPath(tourId) === LEGACY_DB_FILE) {
    assets = assets.filter(a => (a.tourId || 'default') === tourId);
  }

  // Auto-scan physical assets on disk
  const tourDir = resolveTourPath(tourId);
  if (tourDir) {
    const assetsDir = path.join(tourDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      try {
        const files = fs.readdirSync(assetsDir);
        let modified = false;
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
            const exists = assets.some(a => a.name === file || a.url === `assets/${file}` || a.url === file);
            if (!exists) {
              const newAsset = {
                _id: generateId(),
                tourId: tourId || activeTourId,
                name: file,
                url: `assets/${file}`,
                createdAt: new Date().toISOString()
              };
              assets.push(newAsset);
              modified = true;
            }
          }
        }
        if (modified) {
          dbData.assets = assets;
          writeDB(dbData, tourId);
        }
      } catch (e) {
        console.warn('Auto-scan assets directory failed:', e.message);
      }
    }
  }

  // Fallback: check vtour/assets and other data projects if list is still empty
  if (assets.length === 0) {
    const fallbackDirs = [
      path.join(__dirname, '../vtour/assets'),
      path.join(__dirname, '../data/City tour demo/assets'),
      path.join(__dirname, '../data/City tour/assets')
    ];
    for (const fDir of fallbackDirs) {
      if (fs.existsSync(fDir)) {
        try {
          const files = fs.readdirSync(fDir);
          for (const file of files) {
            const ext = path.extname(file).toLowerCase();
            if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
              const exists = assets.some(a => a.name === file || a.url === `assets/${file}` || a.url === file);
              if (!exists) {
                assets.push({
                  _id: generateId(),
                  tourId: tourId || activeTourId,
                  name: file,
                  url: `assets/${file}`,
                  createdAt: new Date().toISOString()
                });
              }
            }
          }
        } catch(e) {}
      }
    }
  }

  return assets;
}

function createAsset({ tourId, name, url }) {
  tourId = tourId || activeTourId;
  const dbData = readDB(tourId);
  const asset = { _id: generateId(), tourId, name, url, createdAt: new Date().toISOString() };
  if (!dbData.assets) dbData.assets = [];
  dbData.assets.push(asset);
  writeDB(dbData, tourId);
  return asset;
}

function deleteAsset(assetId) {
  const dbData = readDB();
  if (dbData.assets) {
    dbData.assets = dbData.assets.filter(a => a._id !== assetId);
    writeDB(dbData);
  }
}

function updateAsset(assetId, patch) {
  const dbData = readDB();
  if (!dbData.assets) return null;
  const asset = dbData.assets.find(a => a._id === assetId);
  if (!asset) return null;
  Object.assign(asset, patch);
  writeDB(dbData);
  return asset;
}

module.exports = {
  DB_FILE: LEGACY_DB_FILE,
  setActiveTour,
  getActiveTour,
  resolveTourPath,
  getRecentProjects,
  listTours,
  listToursWithDetails,
  cloneTour,
  renameTour,
  listScenes,
  createScene,
  updateScene,
  deleteScene,
  reorderScenes,
  setStartScene,
  getSceneById,
  resetTour,
  listHotspots,
  createHotspot,
  updateHotspot,
  deleteHotspot,
  listAssets,
  createAsset,
  deleteAsset,
  updateAsset,
};
