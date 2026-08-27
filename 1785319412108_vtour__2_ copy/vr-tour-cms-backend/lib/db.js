/**
 * db.js
 * Simple file-based store — no MongoDB needed at this scale.
 * Data lives in data/db.json, created automatically on first write.
 */

const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '../data/db.json');

function ensureFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ scenes: [], hotspots: [], assets: [] }, null, 2));
  }
}

function readDB() {
  ensureFile();
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.assets) db.assets = [];
  return db;
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Scenes -------------------------------------------------------------

function listScenes(tourId) {
  return readDB().scenes
    .filter(s => s.tourId === tourId)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function createScene({ tourId, title, slug, tilesFolder, lat, lng }) {
  const db = readDB();
  const order = db.scenes.filter(s => s.tourId === tourId).length;
  const scene = { _id: generateId(), tourId, title, slug, tilesFolder, order, lat, lng, createdAt: new Date().toISOString() };
  db.scenes.push(scene);
  writeDB(db);
  return scene;
}

function getSceneById(sceneId) {
  const db = readDB();
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
  const tourId = db.scenes.find(s => String(s._id) === String(sceneId))?.tourId;
  db.scenes = db.scenes.filter(s => String(s._id) !== String(sceneId));
  db.hotspots = db.hotspots.filter(h => String(h.sceneId) !== String(sceneId) && String(h.targetSceneId) !== String(sceneId));
  if (tourId) {
    db.scenes.filter(s => s.tourId === tourId).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((s, idx) => {
      s.order = idx;
    });
  }
  writeDB(db);
}

function reorderScenes(tourId, orderedSceneIds) {
  const db = readDB();
  orderedSceneIds.forEach((id, index) => {
    const scene = db.scenes.find(s => s._id === id && s.tourId === tourId);
    if (scene) scene.order = index;
  });
  writeDB(db);
  return db.scenes.filter(s => s.tourId === tourId).sort((a, b) => a.order - b.order);
}

function setStartScene(tourId, sceneId) {
  const db = readDB();
  let found = null;
  db.scenes.forEach(s => {
    if (s.tourId === tourId) {
      s.isStartScene = s._id === sceneId;
      if (s._id === sceneId) found = s;
    }
  });
  writeDB(db);
  return found;
}

function resetTour(tourId) {
  const db = readDB();
  db.scenes = db.scenes.filter(s => s.tourId !== tourId);
  const remainingSceneIds = new Set(db.scenes.map(s => s._id));
  db.hotspots = db.hotspots.filter(h => remainingSceneIds.has(h.sceneId));
  writeDB(db);
}

// ---- Tours -------------------------------------------------------------

function listTours() {
  const db = readDB();
  const tours = new Set();
  db.scenes.forEach(s => s.tourId && tours.add(s.tourId));
  tours.add('default');
  return Array.from(tours);
}

function listToursWithDetails() {
  const db = readDB();
  const toursMap = new Map();

  db.scenes.forEach(s => {
    if (!s.tourId) return;
    if (!toursMap.has(s.tourId)) {
      toursMap.set(s.tourId, {
        id: s.tourId,
        title: s.tourId,
        date: s.createdAt,
        thumbnail: `panos/${s.tilesFolder}/thumb.jpg`
      });
    } else {
      const existing = toursMap.get(s.tourId);
      if (new Date(s.createdAt) > new Date(existing.date)) {
        existing.date = s.createdAt;
      }
    }
  });

  if (!toursMap.has('default')) {
    toursMap.set('default', { id: 'default', title: 'default', date: new Date().toISOString(), thumbnail: null });
  }

  return Array.from(toursMap.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function cloneTour(oldTourId, newTourId) {
  const db = readDB();

  const oldScenes = db.scenes.filter(s => s.tourId === oldTourId);
  const sceneIdMap = {};

  oldScenes.forEach(s => {
    const newId = generateId();
    sceneIdMap[s._id] = newId;
    db.scenes.push({
      ...s,
      _id: newId,
      tourId: newTourId,
      createdAt: new Date().toISOString()
    });
  });

  const oldSceneIds = new Set(oldScenes.map(s => s._id));
  const oldHotspots = db.hotspots.filter(h => oldSceneIds.has(h.sceneId));

  oldHotspots.forEach(h => {
    db.hotspots.push({
      ...h,
      _id: generateId(),
      sceneId: sceneIdMap[h.sceneId] || h.sceneId,
      targetSceneId: sceneIdMap[h.targetSceneId] || h.targetSceneId,
      createdAt: new Date().toISOString()
    });
  });

  const oldAssets = db.assets.filter(a => a.tourId === oldTourId);
  oldAssets.forEach(a => {
    db.assets.push({
      ...a,
      _id: generateId(),
      tourId: newTourId,
      createdAt: new Date().toISOString()
    });
  });

  writeDB(db);
}

// ---- Hotspots -------------------------------------------------------------

function listHotspots(tourId) {
  const db = readDB();
  const sceneIds = new Set(db.scenes.filter(s => s.tourId === tourId).map(s => s._id));
  return db.hotspots.filter(h => sceneIds.has(h.sceneId));
}

function createHotspot({ sceneId, targetSceneId, ath, atv, style, title, kind, info, color }) {
  const db = readDB();
  const hotspot = {
    _id: generateId(),
    sceneId,
    title: title || '',
    kind: kind || 'scene',           // 'scene' (jump) or 'info' (popup)
    targetSceneId: targetSceneId || null,  // only meaningful when kind === 'scene'
    info: info || '',                       // only meaningful when kind === 'info'
    ath,
    atv,
    style,
    color: color || '#ffffff',
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
  const db = readDB();
  db.scenes.forEach(s => {
    if (s.tourId === oldTourId) {
      s.tourId = newTourId;
    }
  });
  db.assets.forEach(a => {
    if (a.tourId === oldTourId) {
      a.tourId = newTourId;
    }
  });
  writeDB(db);
}

// ---- Assets -------------------------------------------------------------

function listAssets(tourId) {
  return readDB().assets.filter(a => a.tourId === tourId);
}

function createAsset({ tourId, name, url }) {
  const db = readDB();
  const asset = { _id: generateId(), tourId, name, url, createdAt: new Date().toISOString() };
  db.assets.push(asset);
  writeDB(db);
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
  DB_FILE,
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
