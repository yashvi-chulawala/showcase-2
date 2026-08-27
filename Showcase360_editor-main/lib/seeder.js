const db = require('./db');

function seedInitialScenesIfEmpty() {
  const existing = db.listScenes('default');
  if (existing.length === 0) {
    console.log('Seeding initial drone scenes into db...');
    const initialScenes = [
      {
        title: 'DJI_20251222160517_0128_D_equi',
        slug: 'dji_20251222160517_0128_d_equi',
        tilesFolder: 'DJI_20251222160517_0128_D_equi.tiles'
      },
      {
        title: 'DJI_20251222160749_0129_D_equi',
        slug: 'dji_20251222160749_0129_d_equi',
        tilesFolder: 'DJI_20251222160749_0129_D_equi.tiles'
      },
      {
        title: 'DJI_20251222162034_0135_D_equi',
        slug: 'dji_20251222162034_0135_d_equi',
        tilesFolder: 'DJI_20251222162034_0135_D_equi.tiles'
      }
    ];
    initialScenes.forEach(s => {
      db.createScene({
        tourId: 'default',
        title: s.title,
        slug: s.slug,
        tilesFolder: s.tilesFolder
      });
    });
    console.log('Seeded 3 initial drone scenes.');
  }
}

module.exports = { seedInitialScenesIfEmpty };
