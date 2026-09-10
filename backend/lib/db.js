/**
 * db.js
 * Project-specific file-based store.
 * Data lives in project.json within the active project directory.
 */

const fs = require('fs');
const path = require('path');

const RECENT_PROJECTS_FILE = path.join(__dirname, '../../database/recent_projects.json');
const LEGACY_DB_FILE = path.join(__dirname, '../../database/db.json');

let activeTourId = 'default';

function getRecentProjects() {
  if (!fs.existsSync(RECENT_PROJECTS_FILE)) {
    return [];
  }
  try {
    const list = JSON.parse(fs.readFileSync(RECENT_PROJECTS_FILE, 'utf8'));
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const result = [];
    for (const item of list) {
      const resolved = resolveTourPath(item);
      if (resolved && fs.existsSync(resolved)) {
        const norm = path.resolve(resolved).toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          result.push(path.basename(resolved));
        }
      }
    }
    return result;
  } catch(e) {
    return [];
  }
}

function addRecentProject(tourId) {
  if (!tourId || tourId === 'default') return;
  const resolved = resolveTourPath(tourId) || tourId;
  const name = path.basename(resolved);
  let projects = getRecentProjects();
  projects = projects.filter(p => p.toLowerCase() !== name.toLowerCase());
  projects.unshift(name);
  projects = projects.slice(0, 10);
  try {
    fs.writeFileSync(RECENT_PROJECTS_FILE, JSON.stringify(projects, null, 2));
  } catch(e) {}
}

function getActiveTour() {
  return activeTourId;
}

function setActiveTour(tourId) {
  activeTourId = tourId || 'default';
  if (activeTourId !== 'default') {
    addRecentProject(activeTourId);
  }
}

function resolveTourPath(tourId) {
  if (!tourId || tourId === 'default') return null;
  if (path.isAbsolute(tourId) && fs.existsSync(tourId)) return tourId;

  // Check in database folder by basename
  const name = path.basename(tourId);
  const inData = path.join(__dirname, '../../database', name);
  if (fs.existsSync(inData)) return inData;

  const rel = path.resolve(__dirname, '../..', tourId);
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
    fs.writeFileSync(dbPath, JSON.stringify({ scenes: [], hotspots: [], assets: [], customIcons: [] }, null, 2));
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
    if (!db.customIcons) db.customIcons = [];
    return db;
  } catch(e) {
    return { scenes: [], hotspots: [], assets: [], customIcons: [] };
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
  let deletedTiles = dbData.deletedTiles || [];
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
            const isDeleted = deletedTiles.includes(folderName) || deletedTiles.includes(folderName.replace(/\.tiles$/, ''));
            if (!exists && !isDeleted) {
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

function deleteScene(sceneId, tourId = activeTourId) {
  const db = readDB(tourId);
  const sc = db.scenes.find(s => s._id === sceneId);
  if (sc) {
    if (!db.deletedTiles) db.deletedTiles = [];
    if (sc.tilesFolder && !db.deletedTiles.includes(sc.tilesFolder)) {
      db.deletedTiles.push(sc.tilesFolder);
    }
    if (sc.slug && !db.deletedTiles.includes(sc.slug)) {
      db.deletedTiles.push(sc.slug);
    }

    const tourDir = resolveTourPath(tourId);
    if (tourDir && sc.tilesFolder) {
      const tilesPath = path.join(tourDir, 'panos', sc.tilesFolder);
      if (fs.existsSync(tilesPath)) {
        try { fs.rmSync(tilesPath, { recursive: true, force: true }); } catch (e) {}
      }
    }
  }
  db.scenes = db.scenes.filter(s => s._id !== sceneId);
  db.hotspots = db.hotspots.filter(h => h.sceneId !== sceneId && h.targetSceneId !== sceneId);
  writeDB(db, tourId);
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

function findProjectThumbnail(tourPath, projDb) {
  if (projDb && Array.isArray(projDb.scenes)) {
    // 1. Try scenes in reverse order to find existing thumb.jpg
    for (const sc of projDb.scenes) {
      if (sc.tilesFolder) {
        const thumbRel = `panos/${sc.tilesFolder}/thumb.jpg`;
        if (fs.existsSync(path.join(tourPath, thumbRel))) {
          return thumbRel;
        }
        const prevRel = `panos/${sc.tilesFolder}/preview.jpg`;
        if (fs.existsSync(path.join(tourPath, prevRel))) {
          return prevRel;
        }
      }
    }
  }

  // 2. Scan panos folder on disk directly
  const panosDir = path.join(tourPath, 'panos');
  if (fs.existsSync(panosDir)) {
    try {
      const dirs = fs.readdirSync(panosDir, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          const tRel = `panos/${d.name}/thumb.jpg`;
          if (fs.existsSync(path.join(tourPath, tRel))) return tRel;
          const pRel = `panos/${d.name}/preview.jpg`;
          if (fs.existsSync(path.join(tourPath, pRel))) return pRel;
        }
      }
    } catch(e) {}
  }
  return null;
}

function listToursWithDetails() {
  const toursMap = new Map();
  const dataDir = path.join(__dirname, '../../database');

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

          const title = entry.name;
          const normKey = title.toLowerCase();
          toursMap.set(normKey, {
            id: title,
            title: title,
            date: latestScene ? latestScene.createdAt : mtime,
            thumbnail: findProjectThumbnail(tourPath, projDb)
          });
        }
      });
    } catch (err) {
      console.error("Error scanning data dir for projects:", err);
    }
  }

  // 2. Scan recent projects
  const recent = getRecentProjects();
  recent.forEach(nameOrPath => {
    const resolved = resolveTourPath(nameOrPath);
    if (resolved && fs.existsSync(resolved)) {
      const title = path.basename(resolved);
      const normKey = title.toLowerCase();
      if (!toursMap.has(normKey)) {
        const pJsonPath = path.join(resolved, 'project.json');
        let projDb = { scenes: [] };
        let mtime = new Date().toISOString();
        if (fs.existsSync(pJsonPath)) {
          try {
            projDb = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
            mtime = fs.statSync(pJsonPath).mtime.toISOString();
          } catch (e) {}
        }
        const latestScene = projDb.scenes && projDb.scenes.length > 0 ? 
          projDb.scenes.sort((a,b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0] : null;
        
        toursMap.set(normKey, {
          id: title,
          title: title,
          date: latestScene ? latestScene.createdAt : mtime,
          thumbnail: findProjectThumbnail(resolved, projDb)
        });
      }
    }
  });

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

  const oldPanosPath = oldResolved ? path.join(oldResolved, 'panos') : path.join(__dirname, '../../frontend/panos');
  const oldAssetsPath = oldResolved ? path.join(oldResolved, 'assets') : path.join(__dirname, '../../frontend/assets');
  
  const newPanosPath = path.isAbsolute(newResolved) ? path.join(newResolved, 'panos') : path.join(__dirname, '../../frontend/panos');
  const newAssetsPath = path.isAbsolute(newResolved) ? path.join(newResolved, 'assets') : path.join(__dirname, '../../frontend/assets');

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

  let deletedAssets = dbData.deletedAssets || [];

  // Auto-scan project assets directory
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
            const isDeleted = deletedAssets.includes(file);
            if (!exists && !isDeleted) {
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

  // Only fall back to vtour/assets if this is the legacy default tour and assets is empty
  if (assets.length === 0 && (!tourId || tourId === 'default')) {
    const defaultAssetsDir = path.join(__dirname, '../../frontend/assets');
    if (fs.existsSync(defaultAssetsDir)) {
      try {
        const files = fs.readdirSync(defaultAssetsDir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].includes(ext)) {
            const exists = assets.some(a => a.name === file || a.url === `assets/${file}` || a.url === file);
            const isDeleted = deletedAssets.includes(file);
            if (!exists && !isDeleted) {
              assets.push({
                _id: generateId(),
                tourId: 'default',
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

function deleteAsset(assetId, tourId = activeTourId) {
  const dbData = readDB(tourId);
  if (dbData && dbData.assets) {
    const asset = dbData.assets.find(a => a._id === assetId);
    if (asset) {
      if (!dbData.deletedAssets) dbData.deletedAssets = [];
      if (asset.name && !dbData.deletedAssets.includes(asset.name)) {
        dbData.deletedAssets.push(asset.name);
      }
      const tourDir = resolveTourPath(tourId);
      if (tourDir && asset.name) {
        const filePath = path.join(tourDir, 'assets', asset.name);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }
      dbData.assets = dbData.assets.filter(a => a._id !== assetId);
      writeDB(dbData, tourId);
      return;
    }
  }
  // Search other project folders if needed
  const dataDir = path.join(__dirname, '../../database');
  if (fs.existsSync(dataDir)) {
    try {
      const dirs = fs.readdirSync(dataDir, { withFileTypes: true });
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          const pDir = path.join(dataDir, dir.name);
          const pDb = readDB(pDir);
          if (pDb && pDb.assets && pDb.assets.some(a => a._id === assetId)) {
            const asset = pDb.assets.find(a => a._id === assetId);
            if (asset && asset.name) {
              const filePath = path.join(pDir, 'assets', asset.name);
              if (fs.existsSync(filePath)) {
                try { fs.unlinkSync(filePath); } catch (e) {}
              }
            }
            pDb.assets = pDb.assets.filter(a => a._id !== assetId);
            writeDB(pDb, pDir);
            break;
          }
        }
      }
    } catch (e) {}
  }
}

function updateAsset(assetId, patch, tourId = activeTourId) {
  const dbData = readDB(tourId);
  if (dbData && dbData.assets) {
    const asset = dbData.assets.find(a => a._id === assetId);
    if (asset) {
      Object.assign(asset, patch);
      writeDB(dbData, tourId);
      return asset;
    }
  }
  return null;
}

function getCustomIcons(tourId = activeTourId) {
  const data = readDB(tourId);
  return data.customIcons || [];
}

function saveCustomIcon(iconObj, tourId = activeTourId) {
  const data = readDB(tourId);
  if (!data.customIcons) data.customIcons = [];
  const existingIdx = data.customIcons.findIndex(x => String(x.id) === String(iconObj.id) || String(x.name).toLowerCase() === String(iconObj.name).toLowerCase());
  if (existingIdx >= 0) {
    data.customIcons[existingIdx] = Object.assign({}, data.customIcons[existingIdx], iconObj);
  } else {
    data.customIcons.push(iconObj);
  }
  writeDB(data, tourId);
  return iconObj;
}

function deleteCustomIcon(iconId, tourId = activeTourId) {
  const data = readDB(tourId);
  if (!data.customIcons) data.customIcons = [];
  data.customIcons = data.customIcons.filter(x => String(x.id) !== String(iconId) && String(x.name).toLowerCase() !== String(iconId).toLowerCase());
  writeDB(data, tourId);
}

function setCustomIcons(icons, tourId = activeTourId) {
  const data = readDB(tourId);
  data.customIcons = Array.isArray(icons) ? icons : [];
  writeDB(data, tourId);
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
  getCustomIcons,
  saveCustomIcon,
  deleteCustomIcon,
  setCustomIcons,
};
