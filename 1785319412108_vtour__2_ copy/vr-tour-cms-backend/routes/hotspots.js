const express = require('express');
const db = require('../lib/db');

const router = express.Router();

/**
 * POST /api/hotspots
 * body: { tourId, sceneId, title, kind, targetSceneId?, info?, ath, atv, style? }
 * body: { tourId, sceneId, title, kind, targetSceneId?, info?, ath, atv, style?, color? }
 *
 * kind: "scene" (jump to another scene) or "info" (show a popup)
 *   - kind "scene" requires targetSceneId (and it can't equal sceneId)
 *   - kind "info" requires info (non-empty text)
 */
router.post('/hotspots', (req, res) => {
  const { sceneId, targetSceneId, ath, atv, style, title, kind, info, color } = req.body;

  if (!sceneId) return res.status(400).json({ error: 'sceneId is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (!Number.isFinite(ath) || !Number.isFinite(atv)) return res.status(400).json({ error: 'ath and atv must be valid finite numbers' });

  const resolvedKind = kind === 'info' ? 'info' : 'scene'; // default to scene-link for backward compatibility
  const resolvedInfo = (info && String(info).trim()) ? info : (title || 'INFO');

  if (resolvedKind === 'scene') {
    if (!targetSceneId) return res.status(400).json({ error: 'targetSceneId is required when kind is "scene"' });
    if (sceneId === targetSceneId) return res.status(400).json({ error: 'A hotspot cannot link a scene to itself' });
  }

  const hotspot = db.createHotspot({
    sceneId,
    targetSceneId: resolvedKind === 'scene' ? targetSceneId : null,
    ath,
    atv,
    style,
    title,
    kind: resolvedKind,
    info: resolvedKind === 'info' ? resolvedInfo : '',
    color: color || '#ffffff'
  });
  res.json({ hotspot });
});

/** GET /api/tours/:tourId/hotspots */
router.get('/tours/:tourId/hotspots', (req, res) => {
  res.json({ hotspots: db.listHotspots(req.params.tourId) });
});

/**
 * PATCH /api/hotspots/:hotspotId
 *
 * Update hotspot position (ath, atv) or edit title / kind / targetSceneId / info / color.
 *
 * Called both by:
 *  - the drag-and-drop editor after a drag finishes (ath/atv only)
 *  - the hotspot placement/edit form (title/kind/targetSceneId/info/color)
 */
router.patch('/hotspots/:hotspotId', (req, res) => {
  const { ath, atv, title, kind, targetSceneId, info, color } = req.body;
  const patch = {};

  if (ath !== undefined) patch.ath = ath;
  if (atv !== undefined) patch.atv = atv;
  if (title !== undefined) patch.title = title;
  if (color !== undefined) patch.color = color;

  if (kind !== undefined) {
    const resolvedKind = kind === 'info' ? 'info' : 'scene';
    patch.kind = resolvedKind;
    if (resolvedKind === 'scene') {
      if (!targetSceneId) return res.status(400).json({ error: 'targetSceneId is required when kind is "scene"' });
      patch.targetSceneId = targetSceneId;
      patch.info = '';
    } else {
      const resolvedInfo = (info && String(info).trim()) ? info : (title || 'INFO');
      patch.info = resolvedInfo;
      patch.targetSceneId = null;
    }
  } else {
    // kind not changing this call — allow updating targetSceneId/info independently
    if (targetSceneId !== undefined) patch.targetSceneId = targetSceneId;
    if (info !== undefined) patch.info = info;
  }

  const hotspot = db.updateHotspot(req.params.hotspotId, patch);
  if (!hotspot) return res.status(404).json({ error: 'Hotspot not found' });
  res.json({ hotspot });
});

/** DELETE /api/hotspots/:hotspotId */
router.delete('/hotspots/:hotspotId', (req, res) => {
  db.deleteHotspot(req.params.hotspotId);
  res.json({ deleted: true });
});

module.exports = router;
