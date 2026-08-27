const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:5050/tour.html', {waitUntil: 'networkidle2'});
  
  // Wait for krpano to initialize
  await page.waitForFunction(() => window.krpano !== undefined);
  
  const krpanoType = await page.evaluate(() => {
    return typeof window.krpano.call;
  });
  console.log("krpano.call type:", krpanoType);
  
  const scenes = await page.evaluate(() => {
    return window.krpano.get("scene.count");
  });
  console.log("Scene count:", scenes);
  
  const res = await page.evaluate(() => {
    try {
      window.krpano.call("loadscene('scene_DJI_20251222160749_0129_D_equi', null, MERGE, BLEND(0.5))");
      return "SUCCESS";
    } catch (e) {
      return e.toString();
    }
  });
  
  console.log("Navigation Result:", res);
  
  await browser.close();
})();
