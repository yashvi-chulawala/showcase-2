const assert = require('assert');
const db = require('./lib/db');
const { seedInitialScenesIfEmpty } = require('./lib/seeder');
const { publishTour } = require('./lib/publisher');
const fs = require('fs');

console.log("=== STARTING BACKEND VERIFICATION ===");

// 1. Seed scenes
seedInitialScenesIfEmpty();
const scenes = db.listScenes('default');
console.log(`1. Checked scenes in DB: ${scenes.length} scenes found.`);
assert.strictEqual(scenes.length, 3, "Should have 3 drone scenes");
assert.ok(scenes[0].title);
assert.strictEqual(scenes[0].tilesFolder, 'DJI_20251222160517_0128_D_equi.tiles');

// 2. Create forward hotspot (simulating drop on canvas)
const hs1 = db.createHotspot({
  sceneId: scenes[0]._id,
  targetSceneId: scenes[1]._id,
  ath: 12.34,
  atv: -5.67,
  style: 'Pin'
});
console.log("2. Created forward hotspot:", hs1);
assert.strictEqual(hs1.style, 'Pin');
assert.strictEqual(hs1.ath, 12.34);
assert.strictEqual(hs1.atv, -5.67);

// 3. Create return hotspot
const hs2 = db.createHotspot({
  sceneId: scenes[1]._id,
  targetSceneId: scenes[0]._id,
  ath: 0,
  atv: 0,
  style: 'Pin'
});
console.log("3. Created return hotspot:", hs2);
assert.strictEqual(hs2.ath, 0);
assert.strictEqual(hs2.atv, 0);

// 4. Test PATCH repositioning (simulating draghotspot release)
const updatedHs1 = db.updateHotspot(hs1._id, { ath: 45.0, atv: 10.5 });
console.log("4. Updated hotspot position via PATCH/update:", updatedHs1);
assert.strictEqual(updatedHs1.ath, 45.0);
assert.strictEqual(updatedHs1.atv, 10.5);

// 5. Publish Tour
const pubResult = publishTour('default');
console.log("5. Published tour successfully:", pubResult);
assert.strictEqual(pubResult.sceneCount, 3);
assert(pubResult.hotspotCount >= 2, "Should publish at least 2 hotspots");

// 6. Inspect generated scenes.xml content
const xmlContent = fs.readFileSync(pubResult.scenesFile, 'utf8');
console.log("6. Verified scenes.xml content length:", xmlContent.length);

assert(xmlContent.includes('scene_DJI_20251222160517_0128_D_equi'), "Must contain case-sensitive scene name");
assert(xmlContent.includes('style="Pin"'), "Must contain Pin style attribute");
assert(xmlContent.includes('data:image/svg+xml;base64,'), "Must contain inline Base64 SVG data URI");
assert(xmlContent.includes('scale="0.85" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false"'), "Must contain non-zero visual attributes above other layers");
assert(xmlContent.includes("onclick=\"loadscene('scene_DJI_20251222160749_0129_D_equi', null, MERGE, BLEND(0.5));\""), "Must contain exact onclick loadscene with BLEND(0.5)");

console.log("=== ALL BACKEND & XML VERIFICATION CHECKS PASSED SUCCESSFULLY! ===");
