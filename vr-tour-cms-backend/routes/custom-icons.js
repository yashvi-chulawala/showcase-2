const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { publishTour } = require('../lib/publisher');

// GET /api/custom-icons
router.get('/custom-icons', (req, res) => {
  const tourId = req.query.tourId || db.getActiveTour();
  res.json({ icons: db.getCustomIcons(tourId) });
});

// POST /api/custom-icons
router.post('/custom-icons', (req, res) => {
  const tourId = req.body.tourId || db.getActiveTour();
  const { id, name, dataUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const iconObj = {
    id: id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    name,
    dataUrl: dataUrl || '',
    createdAt: new Date().toISOString()
  };
  db.saveCustomIcon(iconObj, tourId);
  try {
    publishTour(tourId);
  } catch (e) {
    console.error('Publish after saveCustomIcon failed:', e);
  }
  res.json({ success: true, icon: iconObj });
});

// POST /api/custom-icons/sync
router.post('/custom-icons/sync', (req, res) => {
  const tourId = req.body.tourId || db.getActiveTour();
  const { icons } = req.body;
  if (Array.isArray(icons) && icons.length > 0) {
    icons.forEach(icon => {
      if (icon && icon.name) {
        db.saveCustomIcon(icon, tourId);
      }
    });
    try {
      publishTour(tourId);
    } catch (e) {
      console.error('Publish after sync custom icons failed:', e);
    }
  }
  res.json({ success: true, icons: db.getCustomIcons(tourId) });
});

// DELETE /api/custom-icons/:id
router.delete('/custom-icons/:id', (req, res) => {
  const tourId = req.query.tourId || db.getActiveTour();
  db.deleteCustomIcon(req.params.id, tourId);
  try {
    publishTour(tourId);
  } catch (e) {}
  res.json({ success: true });
});

module.exports = router;
