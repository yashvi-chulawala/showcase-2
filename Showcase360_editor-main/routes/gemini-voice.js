const express = require('express');
const router = express.Router();

router.get('/gemini-live-token', async (req, res) => {
  try {
    const rawKeys = [
      process.env.Gemini_API_KEY,
      process.env.GEMINI_API_KEY,
      process.env.gemini_api_key,
      process.env.GEMINI_KEY,
      process.env.API_KEY
    ];

    const validKeys = rawKeys.filter(k => 
      k && typeof k === 'string' && k.trim() && 
      k.trim() !== 'your_gemini_api_key_here' && 
      !k.includes('your_gemini')
    );

    const token = validKeys.length > 0 ? validKeys[0].trim() : '';
    console.log('[Gemini Voice] Providing token (length):', token ? token.length : 0);
    res.json({ token });
  } catch (error) {
    console.error('Gemini Token Error:', error);
    res.status(500).json({ error: "Failed to generate Gemini token." });
  }
});

module.exports = router;
