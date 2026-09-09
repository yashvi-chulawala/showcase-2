const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { processPano, resolveTourDir } = require('../lib/panoProcessor');
const { slugify } = require('../lib/xmlGenerator');
const db = require('../lib/db');
const exifr = require('exifr');

const router = express.Router();
const tmpUploadsDir = path.join(__dirname, '../tmp_uploads');
if (!fs.existsSync(tmpUploadsDir)) {
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: tmpUploadsDir,
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

/** POST /api/tours/:tourId/scenes/upload — form-data: file=<image>, title="..." */
router.post('/tours/:tourId/scenes/upload', upload.single('file'), async (req, res) => {
  const { tourId } = req.params;
  const { title } = req.body;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (!title) return res.status(400).json({ error: 'title is required' });

  const { processPano, resolveTourDir } = require('../lib/panoProcessor');
  
  const baseSlug = slugify(title);
  let slug = baseSlug;
  const tourDir = resolveTourDir(tourId);
  const panosDir = path.join(tourDir, 'panos');
  
  let counter = 1;
  while (fs.existsSync(path.join(panosDir, `${slug}.tiles`))) {
    slug = `${baseSlug}_${counter}`;
    counter++;
  }
  const tilesFolderName = `${slug}.tiles`;

  try {
    let lat = null;
    let lng = null;
    try {
      const gps = await exifr.gps(req.file.path);
      if (gps) {
        lat = gps.latitude;
        lng = gps.longitude;
      }
    } catch (e) {
      console.warn("Failed to extract GPS data:", e);
    }
    const result = await processPano(req.file.path, tilesFolderName, tourId);
    const scene = db.createScene({ tourId, title, slug, tilesFolder: result.tilesFolder, lat, lng });
    res.json({ scene });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

/** GET /api/tours */
router.get('/tours', (req, res) => {
  res.json({ tours: db.listToursWithDetails() });
});

/** POST /api/tours/:tourId/clone — body: { newTourId: "..." } */
router.post('/tours/:tourId/clone', (req, res) => {
  const { newTourId } = req.body;
  if (!newTourId) return res.status(400).json({ error: 'newTourId is required' });
  db.cloneTour(req.params.tourId, newTourId);
  res.json({ success: true, newTourId });
});

/** GET /api/tours/:tourId/scenes */
router.get('/tours/:tourId/scenes', (req, res) => {
  res.json({ scenes: db.listScenes(req.params.tourId) });
});

/** GET /api/scenes/:sceneId */
router.get('/scenes/:sceneId', (req, res) => {
  const scene = db.getSceneById(req.params.sceneId);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });
  res.json({ scene });
});

/** PATCH /api/scenes/:sceneId — body: { title?, hlookat?, vlookat?, fov?, thumbBase64? } */
router.patch('/scenes/:sceneId', (req, res) => {
  const { title, hlookat, vlookat, fov, fovspeed, thumbBase64, tags, lat, lng, openPanoMode, customAth, customAtv } = req.body;
  const patch = {};
  if (title !== undefined) patch.title = title;
  if (hlookat !== undefined) patch.hlookat = Number(hlookat);
  if (vlookat !== undefined) patch.vlookat = Number(vlookat);
  if (fov !== undefined) patch.fov = Number(fov);
  if (fovspeed !== undefined) patch.fovspeed = Number(fovspeed);
  if (tags !== undefined) patch.tags = tags;
  if (lat !== undefined) patch.lat = lat === null || lat === '' ? null : Number(lat);
  if (lng !== undefined) patch.lng = lng === null || lng === '' ? null : Number(lng);
  if (openPanoMode !== undefined) patch.openPanoMode = openPanoMode;
  if (customAth !== undefined) patch.customAth = customAth === null || customAth === '' ? null : Number(customAth);
  if (customAtv !== undefined) patch.customAtv = customAtv === null || customAtv === '' ? null : Number(customAtv);


  const scene = db.updateScene(req.params.sceneId, patch);
  if (!scene) return res.status(404).json({ error: 'Scene not found' });

  // If a custom 3D canvas screenshot is provided, save it over thumb.jpg
    if (thumbBase64 && typeof thumbBase64 === 'string' && thumbBase64.startsWith('data:image/')) {
      try {
        const tourDir = db.resolveTourPath(scene.tourId) || path.resolve(__dirname, '../vtour');
        const PANOS_DIR = path.join(tourDir, 'panos');
        const tilesFolder = scene.tilesFolder || `${scene.slug || scene.title}.tiles`;
        let thumbPath = path.join(PANOS_DIR, tilesFolder, 'thumb.jpg');
        
        const base64Data = thumbBase64.replace(/^data:image\/\w+;base64,/, '');
        if (fs.existsSync(path.dirname(thumbPath))) {
          fs.writeFileSync(thumbPath, Buffer.from(base64Data, 'base64'));
          console.log("Updated custom thumbnail for scene:", scene._id, "at", thumbPath);
        } else {
          console.warn("Tiles directory not found for thumbnail save:", thumbPath);
        }
    } catch (err) {
      console.error("Error saving custom thumbnail:", err.message);
    }
  }

  res.json({ scene });
});

/** DELETE /api/scenes/:sceneId */
router.delete('/scenes/:sceneId', (req, res) => {
  db.deleteScene(req.params.sceneId);
  res.json({ deleted: true });
});

/** POST /api/tours/:tourId/scenes/reorder — body: { orderedSceneIds: [...] } */
router.post('/tours/:tourId/scenes/reorder', (req, res) => {
  const { orderedSceneIds } = req.body;
  if (!Array.isArray(orderedSceneIds)) return res.status(400).json({ error: 'orderedSceneIds must be an array' });
  res.json({ scenes: db.reorderScenes(orderedSceneIds, req.params.tourId) });
});

/** POST /api/tours/:tourId/scenes/:sceneId/set-start */
router.post('/tours/:tourId/scenes/:sceneId/set-start', (req, res) => {
  const scene = db.setStartScene(req.params.sceneId, req.params.tourId);
  if (!scene) return res.status(404).json({ error: 'Scene not found in this tour' });
  res.json({ scene });
});

/** POST /api/tours/:tourId/reset */
router.post('/tours/:tourId/reset', (req, res) => {
  db.resetTour(req.params.tourId);
  res.json({ reset: true });
});

/** POST /api/tours/:tourId/assets/upload */
router.post('/tours/:tourId/assets/upload', upload.single('file'), async (req, res) => {
  const { tourId } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const tourDir = resolveTourDir(tourId);
    const assetsDir = path.join(tourDir, 'assets');
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const originalName = req.file.originalname;
    let finalName = originalName;
    let counter = 1;
    while (fs.existsSync(path.join(assetsDir, finalName))) {
      const ext = path.extname(originalName);
      const name = path.basename(originalName, ext);
      finalName = `${name}_${counter}${ext}`;
      counter++;
    }

    const finalPath = path.join(assetsDir, finalName);
    fs.copyFileSync(req.file.path, finalPath);
    
    const asset = db.createAsset({ tourId, name: finalName, url: `assets/${finalName}` });
    res.json({ asset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

/** GET /api/tours/:tourId/assets */
router.get('/tours/:tourId/assets', (req, res) => {
  res.json({ assets: db.listAssets(req.params.tourId) });
});

/** DELETE /api/assets/:assetId */
router.delete('/assets/:assetId', (req, res) => {
  db.deleteAsset(req.params.assetId);
  res.json({ success: true });
});

/** PATCH /api/assets/:assetId */
router.patch('/assets/:assetId', express.json(), (req, res) => {
  const updated = db.updateAsset(req.params.assetId, req.body);
  if (!updated) return res.status(404).json({ error: 'Asset not found' });
  res.json({ asset: updated });
});

module.exports = router;

