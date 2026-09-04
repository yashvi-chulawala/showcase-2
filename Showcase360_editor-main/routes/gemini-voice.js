const express = require('express');
const router = express.Router();
const db = require('../lib/db');

/** GET /api/gemini-live-token */
router.get('/gemini-live-token', async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY || '';
    if (!key) {
      console.warn('[Gemini Voice] Warning: GEMINI_API_KEY environment variable is empty.');
    }
    res.json({ token: key });
  } catch (error) {
    console.error('[Gemini Voice] Token Error:', error);
    res.status(500).json({ error: "Failed to generate Gemini token." });
  }
});

/** GET /api/voice-config */
router.get('/voice-config', (req, res) => {
  res.json({
    primaryModel: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    fallbackModel: 'models/gemini-2.0-flash-live-001',
    voiceName: 'Aoede',
    silenceTimeoutMs: 6000
  });
});

/** GET /api/voice-scenes */
router.get('/voice-scenes', (req, res) => {
  try {
    const activeTourId = req.query.tour || db.getActiveTour();
    const scenes = db.listScenes(activeTourId);
    res.json({
      scenes: scenes.map(s => ({
        id: s.tilesFolder ? `scene_${s.tilesFolder.replace(/\.tiles$/, '')}` : (s.slug ? `scene_${s.slug}` : s._id),
        title: s.title,
        slug: s.slug
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
