const fs = require('fs');
const path = require('path');
const db = require('./db');
const { generateScenesXML } = require('./xmlGenerator');
const driveStorage = require('./driveStorage');

const TOUR_SRC_DIR = process.env.VR_TOUR_SRC_DIR || path.resolve(__dirname, '../vtour/src');

function timestamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}-${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

const { seedInitialScenesIfEmpty } = require('./seeder');

async function publishTour(tourId) {
  const scenes = db.listScenes(tourId);
  const hotspots = db.listHotspots(tourId);

  const xml = generateScenesXML(scenes, hotspots);
  
  const tourDir = db.resolveTourPath(tourId) || path.resolve(__dirname, '../vtour');
  const targetDir = path.join(tourDir, 'src');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.writeFileSync(path.join(targetDir, 'scenes.xml'), xml);

  if (tourId && tourId !== 'default') {
    try {
      await driveStorage.writeTourXml(tourId, xml);
      console.log(`Published tour.xml to Drive for tour: ${tourId}`);
    } catch (err) {
      console.error(`Failed to publish tour.xml to Drive for tour: ${tourId}`, err);
    }
  }

  return { sceneCount: scenes.length, hotspotCount: hotspots.length };
}

module.exports = { publishTour };
