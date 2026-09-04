const express = require('express');
const router = express.Router();

router.get('/gemini-live-token', async (req, res) => {
  try {
    const token = process.env.GEMINI_API_KEY || 
                  process.env.Gemini_API_KEY || 
                  process.env.gemini_api_key || 
                  process.env.GEMINI_KEY || 
                  process.env.API_KEY || 
                  '';
    res.json({ token });
  } catch (error) {
    console.error('Gemini Token Error:', error);
    res.status(500).json({ error: "Failed to generate Gemini token." });
  }
});

module.exports = router;
