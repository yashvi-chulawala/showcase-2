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

function getDbPath(tourId = activeTourId) {
  if (!tourId || tourId === 'default' || !path.isAbsolute(tourId)) {
    return LEGACY_DB_FILE;
  }
  return path.join(tourId, 'project.json');
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

// ---- Scenes -------------------------------------------------------------

function listScenes(tourId = activeTourId) {
  let db = readDB(tourId);
  let scenes = db.scenes || [];
  if (getDbPath(tourId) === LEGACY_DB_FILE) {
    scenes = scenes.filter(s => (s.tourId || 'default') === tourId);
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

function getSceneById(sceneId) {
  const db = readDB(); // uses activeTourId
  return db.scenes.find(s => String(s._id) === String(sceneId)) || null;
}

function updateScene(sceneId, patch) {
  const db = readDB();
  const scene = db.scenes.find(s => s._id === sceneId);
  if (!scene) return null;
  Object.assign(scene, patch);
  if (patch.title) {
    db.hotspots.forEach(h => {
      if (h.targetSceneId === sceneId && h.kind === 'scene') {
        h.title = patch.title;
      }
    });
  }
  writeDB(db);
  return scene;
}

function deleteScene(sceneId) {
  const db = readDB();
  db.scenes = db.scenes.filter(s => s._id !== sceneId);
  db.hotspots = db.hotspots.filter(h => h.sceneId !== sceneId && h.targetSceneId !== sceneId);
  db.scenes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((s, idx) => {
    s.order = idx;
  });
  writeDB(db);
}

function reorderScenes(tourId, orderedSceneIds) {
  tourId = tourId || activeTourId;
  const db = readDB(tourId);
  orderedSceneIds.forEach((id, index) => {
    const scene = db.scenes.find(s => s._id === id);
    if (scene) scene.order = index;
  });
  writeDB(db, tourId);
  return db.scenes.sort((a, b) => a.order - b.order);
}

function setStartScene(tourId, sceneId) {
  tourId = tourId || activeTourId;
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

  // Add default legacy tour if legacy DB has scenes
  const legacyDb = readDB('default');
  if (legacyDb.scenes && legacyDb.scenes.length > 0) {
    const latestScene = legacyDb.scenes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    toursMap.set('default', {
      id: 'default',
      title: 'Legacy Project (Please Migrate)',
      date: latestScene ? latestScene.createdAt : new Date().toISOString(),
      thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
    });
  }

  // Iterate recent projects
  const recent = getRecentProjects();
  recent.forEach(tourPath => {
    const pJsonPath = path.join(tourPath, 'project.json');
    if (fs.existsSync(pJsonPath)) {
      try {
        const projDb = JSON.parse(fs.readFileSync(pJsonPath, 'utf8'));
        const title = path.basename(tourPath);
        const latestScene = projDb.scenes && projDb.scenes.length > 0 ? 
          projDb.scenes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
        
        toursMap.set(tourPath, {
          id: tourPath,
          title: title,
          date: latestScene ? latestScene.createdAt : fs.statSync(pJsonPath).mtime.toISOString(),
          thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
        });
      } catch (e) {
        console.error("Error reading project.json in listToursWithDetails for", tourPath, e);
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
  const oldPanosPath = (!oldTourId || oldTourId === 'default' || !path.isAbsolute(oldTourId)) ? path.join(__dirname, '../../vtour/panos') : path.join(oldTourId, 'panos');
  const oldAssetsPath = (!oldTourId || oldTourId === 'default' || !path.isAbsolute(oldTourId)) ? path.join(__dirname, '../../vtour/assets') : path.join(oldTourId, 'assets');
  
  const newPanosPath = (!newTourId || newTourId === 'default' || !path.isAbsolute(newTourId)) ? path.join(__dirname, '../../vtour/panos') : path.join(newTourId, 'panos');
  const newAssetsPath = (!newTourId || newTourId === 'default' || !path.isAbsolute(newTourId)) ? path.join(__dirname, '../../vtour/assets') : path.join(newTourId, 'assets');

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
  let db = readDB(tourId);
  let assets = db.assets || [];
  if (getDbPath(tourId) === LEGACY_DB_FILE) {
    assets = assets.filter(a => (a.tourId || 'default') === tourId);
  }
  return assets;
}

function createAsset({ tourId, name, url }) {
  tourId = tourId || activeTourId;
  const db = readDB(tourId);
  const asset = { _id: generateId(), tourId, name, url, createdAt: new Date().toISOString() };
  db.assets.push(asset);
  writeDB(db, tourId);
  return asset;
}

function deleteAsset(assetId) {
  const db = readDB();
  db.assets = db.assets.filter(a => a._id !== assetId);
  writeDB(db);
}

function updateAsset(assetId, patch) {
  const db = readDB();
  const asset = db.assets.find(a => a._id === assetId);
  if (!asset) return null;
  Object.assign(asset, patch);
  writeDB(db);
  return asset;
}

module.exports = {
  DB_FILE: LEGACY_DB_FILE,
  setActiveTour,
  getActiveTour,
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
