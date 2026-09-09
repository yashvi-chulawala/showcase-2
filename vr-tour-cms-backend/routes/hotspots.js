const express = require('express');
const db = require('../lib/db');

const router = express.Router();

/**
 * POST /api/hotspots
 * body: { tourId, sceneId, title, kind, targetSceneId?, info?, ath, atv, style?, color?, transition? }
 *
 * kind: "scene" (jump to another scene) or "info" (show a popup)
 *   - kind "scene" requires targetSceneId (and it can't equal sceneId)
 *   - kind "info" requires info (non-empty text)
 */
router.post('/hotspots', (req, res) => {
  const { sceneId, targetSceneId, ath, atv, style, badgeLetter, title, kind, info, color, transition, textProps, action, width, height } = req.body;

  if (!sceneId) return res.status(400).json({ error: 'sceneId is required' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (!Number.isFinite(ath) || !Number.isFinite(atv)) return res.status(400).json({ error: 'ath and atv must be valid finite numbers' });

  const isPole = style && (String(style).toLowerCase().includes('residential') || String(style).toLowerCase().includes('commercial') || String(style).toLowerCase() === 'pole pin' || String(style).toLowerCase() === 'landmark pin' || String(style).toLowerCase() === 'pole_pin' || String(style).toLowerCase() === 'landmark');
  const resolvedKind = ['info', 'image'].includes(kind) || isPole ? (kind || 'image') : 'scene'; // default to scene-link for backward compatibility
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
    badgeLetter: badgeLetter || '',
    title,
    kind: resolvedKind,
    info: ['info', 'image'].includes(resolvedKind) ? resolvedInfo : '',
    color: color || '#00a6e0',
    transition,
    action: action || 'scene',
    textProps: textProps || {},
    width: width !== undefined ? width : null,
    height: height !== undefined ? height : null
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
 * Update hotspot position (ath, atv) or edit title / kind / targetSceneId / info / color / transition.
 *
 * Called both by:
 *  - the hotspot placement/edit form (title/kind/targetSceneId/info/color)
 */
router.patch('/hotspots/:hotspotId', (req, res) => {
  const { ath, atv, style, badgeLetter, title, kind, targetSceneId, info, color, locked, transition, textProps, action, width, height, targetAth, targetAtv, targetFov, targetViewMode } = req.body;
  const hotspotId = req.params.hotspotId;

  const patch = {};
  if (ath !== undefined) patch.ath = ath;
  if (atv !== undefined) patch.atv = atv;
  if (style !== undefined) patch.style = style;
  if (badgeLetter !== undefined) patch.badgeLetter = badgeLetter;
  if (title !== undefined) patch.title = title;
  if (kind !== undefined) patch.kind = kind;
  if (targetSceneId !== undefined) patch.targetSceneId = targetSceneId;
  if (info !== undefined) patch.info = info;
  if (color !== undefined) patch.color = color;
  if (locked !== undefined) patch.locked = locked;
  if (transition !== undefined) patch.transition = transition;
  if (action !== undefined) patch.action = action;
  if (textProps !== undefined) patch.textProps = textProps;
  if (width !== undefined) patch.width = width;
  if (height !== undefined) patch.height = height;
  if (targetAth !== undefined) patch.targetAth = targetAth;
  if (targetAtv !== undefined) patch.targetAtv = targetAtv;
  if (targetFov !== undefined) patch.targetFov = targetFov;
  if (targetViewMode !== undefined) patch.targetViewMode = targetViewMode;

  if (kind !== undefined) {
    const resolvedKind = ['info', 'image'].includes(kind) ? kind : 'scene';
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
