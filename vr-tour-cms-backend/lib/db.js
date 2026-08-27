/**
 * db.js
 * Project-specific storage using Google Drive.
 * Data lives in project.json within the active project directory on Google Drive.
 */

const fs = require('fs');
const path = require('path');
const driveStorage = require('./driveStorage');

let activeTourId = 'default';
let inMemoryDB = { scenes: [], hotspots: [], assets: [] };

function getActiveTour() {
  return activeTourId;
}

/**
 * Async function to set the active tour and load its data from Drive.
 * Called by /api/project/active or server startup.
 */
async function setActiveTourAsync(tourId) {
  activeTourId = tourId || 'default';
  
  if (activeTourId === 'default') {
    inMemoryDB = { scenes: [], hotspots: [], assets: [] };
    return;
  }
  
  try {
    inMemoryDB = await driveStorage.readProjectJson(activeTourId);
  } catch (err) {
    console.warn(`Could not read project.json from Drive for ${tourId}, initializing new...`);
    inMemoryDB = { scenes: [], hotspots: [], assets: [] };
    await driveStorage.initProject(tourId, inMemoryDB);
  }
}

// Keep setActiveTour for backwards compatibility if needed synchronously, 
// though it won't load from Drive immediately.
function setActiveTour(tourId) {
  setActiveTourAsync(tourId).catch(err => {
    console.error("Error setting active tour:", err);
  });
}

function readDB(tourId = activeTourId) {
  // We assume the requested tourId is the active one.
  // If it's not, we have a problem because we can't synchronously load from Drive here.
  // In the normal flow, the client sets active tour before requesting data.
  if (tourId !== activeTourId) {
    console.warn(`readDB called for ${tourId} but active is ${activeTourId}. This may return wrong data!`);
  }
  
  if (!inMemoryDB.assets) inMemoryDB.assets = [];
  if (!inMemoryDB.scenes) inMemoryDB.scenes = [];
  if (!inMemoryDB.hotspots) inMemoryDB.hotspots = [];
  return inMemoryDB;
}

function writeDB(data, tourId = activeTourId) {
  if (tourId === activeTourId) {
    inMemoryDB = data;
  }
  
  // Fire and forget upload to Drive
  driveStorage.writeProjectJson(tourId, data).catch(err => {
    console.error('Failed to sync project.json to drive:', err);
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---- Scenes -------------------------------------------------------------

function listScenes(tourId = activeTourId) {
  let db = readDB(tourId);
  let scenes = db.scenes || [];
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

function getSceneById(sceneId) {
  const db = readDB();
  return db.scenes.find(s => s._id === sceneId);
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

async function listToursWithDetailsAsync() {
  const projects = await driveStorage.listProjects();
  const tours = [];
  
  for (const proj of projects) {
    try {
      const projDb = await driveStorage.readProjectJson(proj.id);
      const latestScene = projDb.scenes && projDb.scenes.length > 0 ? 
        projDb.scenes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] : null;
      
      tours.push({
        id: proj.id,
        title: proj.name, // Will be something like "project-..."
        date: latestScene ? latestScene.createdAt : new Date().toISOString(),
        thumbnail: latestScene ? `panos/${latestScene.tilesFolder}/thumb.jpg` : null
      });
    } catch (e) {
      console.error("Error reading project.json in listToursWithDetailsAsync for", proj.id, e);
    }
  }
  
  return tours.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Legacy synchronous listToursWithDetails is tricky, better to just return what we can
function listToursWithDetails() {
  // Routes should use the async version now
  return [];
}

function listTours() {
  return [];
}

function cloneTour(oldTourId, newTourId) {
  // Clones are harder to implement synchronously with Drive.
  // We'll leave it as a no-op for now.
}

function renameTour(oldTourId, newTourId) {
  // Handled in routes via drive API now
}

// ---- Hotspots -------------------------------------------------------------

function listHotspots(tourId = activeTourId) {
  const db = readDB(tourId);
  let scenes = db.scenes || [];
  const sceneIds = new Set(scenes.map(s => s._id));
  return db.hotspots.filter(h => sceneIds.has(h.sceneId));
}

function createHotspot({ sceneId, targetSceneId, ath, atv, style, title, kind, info, color, transition, action, textProps, width, height }) {
  const db = readDB();
  const hotspot = {
    _id: generateId(),
    sceneId,
    title: title || '',
    kind: kind || 'scene',
    targetSceneId: targetSceneId || null,
    info: info || '',
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

// ---- Assets -------------------------------------------------------------

function listAssets(tourId = activeTourId) {
  let db = readDB(tourId);
  return db.assets || [];
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

function getRecentProjects() {
  return [];
}

module.exports = {
  setActiveTourAsync,
  setActiveTour,
  getActiveTour,
  getRecentProjects,
  listTours,
  listToursWithDetails,
  listToursWithDetailsAsync,
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
