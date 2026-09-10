const fs = require('fs');
const path = require('path');
const db = require('./db');
const { generateScenesXML } = require('./xmlGenerator');

const TOUR_SRC_DIR = process.env.VR_TOUR_SRC_DIR || path.resolve(__dirname, '../../frontend/src');

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

const { seedInitialScenesIfEmpty } = require('./seeder');

function publishTour(tourId) {
  const scenes = db.listScenes(tourId);
  const hotspots = db.listHotspots(tourId);
  const customIcons = db.getCustomIcons(tourId);
  // Allow publishing 0 scenes to clear out the previous scenes.xml

  const xml = generateScenesXML(scenes, hotspots, customIcons);
  
  const tourDir = db.resolveTourPath(tourId) || path.resolve(__dirname, '../../frontend');
  const TOUR_SRC_DIR = path.join(tourDir, 'src');
  
  if (!fs.existsSync(TOUR_SRC_DIR)) {
    fs.mkdirSync(TOUR_SRC_DIR, { recursive: true });
  }

  const scenesFile = path.join(TOUR_SRC_DIR, 'scenes.xml');
  let backupFile = null;
  
  fs.writeFileSync(scenesFile, xml, { encoding: 'utf8' });

  // Also sync to frontend/src/scenes.xml so all fallbacks receive the latest scenes
  const frontendScenes = path.resolve(__dirname, '../../frontend/src/scenes.xml');
  if (scenesFile !== frontendScenes) {
    try {
      fs.writeFileSync(frontendScenes, xml, { encoding: 'utf8' });
    } catch(e) {}
  }

  return { scenesFile, backupFile, sceneCount: scenes.length, hotspotCount: hotspots.length };
}

module.exports = { publishTour };
