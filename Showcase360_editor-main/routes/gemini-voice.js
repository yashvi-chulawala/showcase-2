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
    primaryModel: 'models/gemini-2.0-flash-exp',
    fallbackModel: 'models/gemini-2.0-flash-realtime-exp',
    voiceName: 'Aoede',
    silenceTimeoutMs: 7000
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

/** POST /api/voice-command (Multimodal Audio/Text Navigation Endpoint) */
router.post('/voice-command', express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY || '';
    const { audio, mimeType = 'audio/webm', text } = req.body;

    const defaultScenes = [
      { id: "scene_vesu_1_1", title: "Vesu 1" },
      { id: "scene_vesu_16_1", title: "Vesu 16" },
      { id: "scene_vesu_5_1", title: "Vesu 5" },
      { id: "scene_vesu_7_1", title: "Vesu 7" },
      { id: "scene_vesu_2_1", title: "Vesu 2" },
      { id: "scene_DJI_20251222160517_0128_D_equi", title: "Left View" },
      { id: "scene_DJI_20251222160749_0129_D_equi", title: "Back View" },
      { id: "scene_DJI_20251222162034_0135_D_equi", title: "Right View" }
    ];

    let sceneList = defaultScenes;
    try {
      const activeTourId = db.getActiveTour();
      const dbScenes = db.listScenes(activeTourId);
      if (dbScenes && dbScenes.length > 0) {
        sceneList = dbScenes.map(s => ({
          id: s.tilesFolder ? `scene_${s.tilesFolder.replace(/\.tiles$/, '')}` : (s.slug ? `scene_${s.slug}` : s._id),
          title: s.title || s.name || s._id
        }));
      }
    } catch (e) {}

    const scenesPrompt = sceneList.map(s => `- "${s.title}" (ID: ${s.id})`).join('\n');

    // If API Key is available, use Gemini 2.0 Multimodal REST
    if (key && (audio || text)) {
      const parts = [
        {
          text: `You are Hey 360, a voice navigator in a 360 tour. Available scenes:\n${scenesPrompt}\nIdentify the requested scene destination from the user's voice audio or text. Return JSON ONLY with schema: {"scene_id": "<exact scene id or null>", "scene_title": "<scene title>", "spoken_reply": "<warm brief confirmation e.g. Sure, taking you to Vesu 5 now!>"}`
        }
      ];

      if (audio) {
        parts.push({
          inline_data: {
            mime_type: mimeType.split(';')[0],
            data: audio
          }
        });
      } else if (text) {
        parts.push({ text: `User request: "${text}"` });
      }

      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            response_mime_type: "application/json"
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (jsonText) {
          const parsed = JSON.parse(jsonText);
          return res.json({ success: true, ...parsed });
        }
      }
    }

    // Local pattern fallback if no Gemini key or fallback needed
    const query = String(text || '').toLowerCase();
    const matched = sceneList.find(s => query.includes(s.title.toLowerCase()) || query.includes(s.id.toLowerCase())) || sceneList[0];
    
    return res.json({
      success: true,
      scene_id: matched.id,
      scene_title: matched.title,
      spoken_reply: `Taking you to ${matched.title} now!`
    });

  } catch (error) {
    console.error('[Gemini Voice Command Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
