const express = require('express');
const { publishTour } = require('../lib/publisher');

const router = express.Router();

/** POST /api/tours/:tourId/publish */
router.post('/tours/:tourId/publish', (req, res) => {
  try {
    const result = publishTour(req.params.tourId);
    res.json({ published: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
