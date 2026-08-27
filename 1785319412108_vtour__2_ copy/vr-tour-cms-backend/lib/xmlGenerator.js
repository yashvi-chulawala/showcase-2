/**
 * xmlGenerator.js
 * Generates src/scenes.xml from CMS data (scenes + hotspots), matching
 * the exact tag format krpano 1.20 produced for this project, with inline SVG styles.
 */

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getOriginalBaseName(scene) {
  if (scene && scene.tilesFolder) {
    return String(scene.tilesFolder).replace(/\.tiles$/i, '');
  }
  if (scene && scene.title) {
    return String(scene.title);
  }
  return '';
}

/**
 * Returns case-sensitive scene name prefix + original case filename, never lowercased slug.
 */
function sceneName(scene) {
  return `scene_${getOriginalBaseName(scene)}`;
}

const ICON_LIBRARY_ITEMS = [
  { name: 'Arrow 01', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M14 44 L32 20 L50 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Down', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M14 20 L32 44 L50 20" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Left', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M44 14 L20 32 L44 50" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Left Up', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M44 44 L20 20 M20 20 L44 20 M20 20 L20 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Right Up', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M20 44 L44 20 M44 20 L20 20 M44 20 L44 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Right', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M20 14 L44 32 L20 50" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01a', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M10 42 L32 22 L54 42" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01b', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M16 40 L32 26 L48 40" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01c', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M12 42 C20 32 44 32 52 42 L32 22 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 12 L56 42 L46 50 L32 30 L18 50 L8 42 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Down', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 52 L56 22 L46 14 L32 34 L18 14 L8 22 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Left', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M12 32 L42 8 L50 18 L30 32 L50 46 L42 56 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Left Up', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M16 16 L48 16 L48 26 L28 26 L28 48 L16 48 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Right Up', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M48 16 L16 16 L16 26 L36 26 L36 48 L48 48 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Right', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M52 32 L22 8 L14 18 L34 32 L14 46 L22 56 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Up', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 10 L50 32 L38 32 L38 52 L26 52 L26 32 L14 32 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Down', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 54 L50 32 L38 32 L38 12 L26 12 L26 32 L14 32 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Left', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M10 32 L32 14 L32 26 L52 26 L52 38 L32 38 L32 50 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Right', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M54 32 L32 14 L32 26 L12 26 L12 38 L32 38 L32 50 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow Circle', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/><path d="M24 20 L38 32 L24 44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Pin Red', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Blue', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Green', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#10b981" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Yellow', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#f59e0b" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Green', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#10b981" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Blue', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#3b82f6" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Red', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#ef4444" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot White', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#ffffff" stroke="#333333" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#3b82f6"/></svg>' },

  { name: 'Info Badge', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/><text x="32" y="44" text-anchor="middle" fill="#ffffff" font-family="Outfit, sans-serif" font-weight="900" font-size="34">i</text></svg>' }
];

/**
 * Generates Base64 data URI for SVG icon styles or standalone Text style.
 */
function getHotspotSvgBase64(style, labelText, color) {
  const s = String(style || 'Arrow').toLowerCase();
  const fillCol = color || '#ffffff';

  if (style && String(style).startsWith('data:image/')) {
    return style;
  }
  const foundLib = ICON_LIBRARY_ITEMS.find(x => String(x.name).toLowerCase() === s);
  if (foundLib && foundLib.svg) {
    return `data:image/svg+xml;base64,${Buffer.from(foundLib.svg).toString('base64')}`;
  }

  if (s === 'text') {
    const textStr = esc(String(labelText || 'TEXT').trim() || 'TEXT');
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="300" height="80">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <text x="150" y="48" text-anchor="middle" fill="${fillCol}" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="28" letter-spacing="1">${textStr}</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(textSvg).toString('base64')}`;
  }

  let iconSvg = '';
  if (s === 'pin') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/>
      <circle cx="32" cy="24" r="10" fill="#ffffff"/>
    </svg>`;
  } else if (s === 'dot') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="24" fill="#10b981" stroke="#ffffff" stroke-width="6"/>
      <circle cx="32" cy="32" r="10" fill="#ffffff"/>
    </svg>`;
  } else {
    // Arrow default
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="28" fill="#3b82f6" stroke="#ffffff" stroke-width="4"/>
      <path d="M24 20 L38 32 L24 44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  return `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;
}

/**
 * @param {Array} scenes   [{ _id, title, slug, tilesFolder, order }]
 * @param {Array} hotspots [{ _id, sceneId, targetSceneId, ath, atv, style, kind, info }]
 */
function generateScenesXML(scenes, hotspots) {
  const sorted = [...scenes].sort((a, b) => {
    if (a.isStartScene && !b.isStartScene) return -1;
    if (!a.isStartScene && b.isStartScene) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });
  const byId = Object.fromEntries(sorted.map(s => [String(s._id), s]));

  const knownStyles = new Set([
    'Arrow', 'arrow', 'Pin', 'pin', 'Dot', 'dot', 'nav_hotspot_style', 'Text', 'text',
    'Arrow 01', 'Arrow 01 Down', 'Arrow 01 Left', 'Arrow 01 Left Up', 'Arrow 01 Right Up',
    'Arrow 01 Right', 'Arrow 01a', 'Arrow 01b', 'Arrow 01c', 'Arrow 02', 'Arrow 02 Down',
    'Arrow 02 Left', 'Arrow 02 Left Up', 'Arrow 02 Right Up', 'Arrow 02 Right',
    'Arrow 03 Up', 'Arrow 03 Down', 'Arrow 03 Left', 'Arrow 03 Right', 'Arrow Circle',
    'Pin Red', 'Pin Blue', 'Pin Green', 'Pin Yellow', 'Dot Green', 'Dot Blue',
    'Dot Red', 'Dot White', 'Portal', 'Info Badge'
  ]);
  if (Array.isArray(hotspots)) {
    hotspots.forEach(h => {
      if (h && h.style) {
        knownStyles.add(String(h.style));
      }
    });
  }

  const dynamicStylesXml = Array.from(knownStyles).map(s => {
    const sLow = String(s).toLowerCase();
    const isText = sLow === 'text';
    const svgUrl = getHotspotSvgBase64(s);
    if (isText) {
      return `\t<style name="${esc(s)}" scale="1.0" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false" />`;
    }
    return `\t<style name="${esc(s)}" url="${esc(svgUrl)}" scale="0.85" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false" />`;
  }).join('\n');

  const styleDefinitions = `
	<!-- Inline SVG Hotspot Styles -->
${dynamicStylesXml}

	<!-- Action for dragging hotspots and standalone text labels in editor mode -->
	<action name="draghotspot">
		asyncloop(pressed,
			screentosphere(mouse.stagex, mouse.stagey, ath, atv);
		  ,
			js(onHotspotDragEnd(get(name), get(ath), get(atv)));
		  );
	</action>

	<!-- Original Hotspot Transition -->
	<action name="shapespark_transition">
		loadscene(%1, null, MERGE, BLEND(0.5, easeInCubic));
	</action>
`;

  const sceneBlocks = sorted.map(scene => {
    const name = sceneName(scene);
    const baseName = getOriginalBaseName(scene);
    const tiles = String(scene.tilesFolder || `${baseName}.tiles`).endsWith('.tiles')
      ? scene.tilesFolder
      : `${scene.tilesFolder || baseName}.tiles`;

    const sceneHotspots = hotspots.filter(h => String(h.sceneId) === String(scene._id));
    const hotspotXML = sceneHotspots.map(h => {
      const hsName = h._id ? `hs_${h._id}` : `hs_${slugify(scene.title)}_${Math.random().toString(36).substring(2, 7)}`;
      const style = h.style || 'Arrow';
      const svgUrl = getHotspotSvgBase64(style, h.title, h.color);

      if (h.kind === 'info') {
        const rawText = String(h.info || h.title || '');
        const jsSafeText = rawText.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        return `\t\t<hotspot name="${esc(hsName)}" style="${esc(style)}" url="${esc(svgUrl)}"\n` +
          `\t\t         ath="${h.ath}" atv="${h.atv}" scale="0.85" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false"\n` +
          `\t\t         onclick="js(alert('${jsSafeText}'));" />`;
      } else {
        // Navigation hotspot
        const target = byId[String(h.targetSceneId)];
        if (!target) return '';
        const targetName = sceneName(target);
        return `\t\t<hotspot name="${esc(hsName)}" style="${esc(style)}" url="${esc(svgUrl)}"\n` +
          `\t\t         ath="${h.ath}" atv="${h.atv}" scale="0.85" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false"\n` +
          `\t\t         onclick="shapespark_transition('${targetName}');" />`;
      }
    }).filter(Boolean).join('\n');

    const hlookat = scene.hlookat !== undefined ? scene.hlookat : 0.0;
    const vlookat = scene.vlookat !== undefined ? scene.vlookat : 0.0;
    const fov = scene.fov !== undefined ? scene.fov : 120;



    const fs = require('fs');
    const path = require('path');
    const tourDir = (scene.tourId && path.isAbsolute(scene.tourId)) ? scene.tourId : path.resolve(__dirname, '../../vtour');
    const PANOS_DIR = path.join(tourDir, 'panos');
    const isSimulated = !fs.existsSync(path.join(PANOS_DIR, tiles, 'f'));

    let imageXML = '';
    if (isSimulated) {
      imageXML = `\t\t<image>\n\t\t\t<sphere url="../panos/${tiles}/preview.jpg" />\n\t\t</image>`;
    } else {
      let multiresStr = "512,1024,2048,3840";
      try {
        const tourXmlPath = path.join(PANOS_DIR, tiles, 'tour.xml');
        if (fs.existsSync(tourXmlPath)) {
          const tourXmlContent = fs.readFileSync(tourXmlPath, 'utf8');
          const multiresMatch = tourXmlContent.match(/multires="([^"]+)"/);
          if (multiresMatch) {
            multiresStr = multiresMatch[1];
          }
        }
      } catch (err) {
        console.warn('Failed to parse multires from tour.xml, using default:', err.message);
      }

      imageXML = `\t\t<preview url="../panos/${tiles}/preview.jpg" />\n\n\t\t<image>\n\t\t\t<cube url="../panos/${tiles}/%s/l%l/%v/l%l_%s_%v_%h.jpg" multires="${multiresStr}" />\n\t\t</image>`;
    }

    return (
      `	<scene name="${name}" title="${esc(scene.title)}" onstart="" thumburl="../panos/${tiles}/thumb.jpg" lat="${scene.lat !== null && scene.lat !== undefined ? scene.lat : ''}" lng="${scene.lng !== null && scene.lng !== undefined ? scene.lng : ''}" heading="">
		
		<control bouncinglimits="calc:image.cube ? true : false" />

		<view hlookat="${hlookat}" vlookat="${vlookat}" fovtype="MFOV" fov="${fov}" maxpixelzoom="2.0" fovmin="70" fovmax="140" limitview="auto" />

${imageXML}
${sceneHotspots.length ? '\n' + hotspotXML + '\n' : ''}

\t</scene>`);
  }).join('\n\n');

  return (
    `\ufeff<krpano>

\t<!-- ============================================================
\t     SCENES
\t     Auto-generated by xmlGenerator.js — do not hand-edit.
\t     Edit via the CMS panel instead; regenerate on publish.
\t     ============================================================ -->
${styleDefinitions}
${sceneBlocks}

</krpano>
`);
}

module.exports = { generateScenesXML, sceneName, slugify, getOriginalBaseName, getHotspotSvgBase64 };
