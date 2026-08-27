const fs = require('fs');
const path = require('path');
const db = require('./db');
const { generateScenesXML } = require('./xmlGenerator');

const TOUR_SRC_DIR = process.env.VR_TOUR_SRC_DIR || path.resolve(__dirname, '../../vtour/src');

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

const { seedInitialScenesIfEmpty } = require('./seeder');

function publishTour(tourId) {
  const scenes = db.listScenes(tourId);
  const hotspots = db.listHotspots(tourId);
  if (scenes.length === 0) throw new Error(`No scenes found for tourId "${tourId}" — nothing to publish`);

  const xml = generateScenesXML(scenes, hotspots);
  
  const tourDir = (tourId && path.isAbsolute(tourId)) ? tourId : path.resolve(__dirname, '../../vtour');
  const TOUR_SRC_DIR = path.join(tourDir, 'src');
  
  if (!fs.existsSync(TOUR_SRC_DIR)) {
    fs.mkdirSync(TOUR_SRC_DIR, { recursive: true });
  }

  const scenesFile = path.join(TOUR_SRC_DIR, 'scenes.xml');
  let backupFile = null;
  if (fs.existsSync(scenesFile)) {
    backupFile = path.join(TOUR_SRC_DIR, `scenes.xml - backup-${timestamp()}.xml`);
    fs.copyFileSync(scenesFile, backupFile);
  }
  fs.writeFileSync(scenesFile, xml, { encoding: 'utf8' });

  return { scenesFile, backupFile, sceneCount: scenes.length, hotspotCount: hotspots.length };
}

module.exports = { publishTour };
