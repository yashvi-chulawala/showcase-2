const express = require('express');
const router = express.Router();

router.get('/gemini-live-token', async (req, res) => {
  try {
    // For local development and to guarantee stability, we send the API key directly to the frontend
    res.json({ token: process.env.GEMINI_API_KEY });
  } catch (error) {
    console.error('Gemini Token Error:', error);
    res.status(500).json({ error: "Failed to generate Gemini token." });
  }
});

module.exports = router;
