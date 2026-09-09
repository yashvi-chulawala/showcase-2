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
function getHotspotSvgBase64(style, labelText, color, badgeLetter, customIcons = []) {
  const s = String(style || 'Arrow').toLowerCase();

  if (style && (String(style).startsWith('data:image/') || String(style).startsWith('http'))) {
    return style;
  }
  if (style && String(style).startsWith('assets/')) {
    return '../' + style;
  }

  if (Array.isArray(customIcons)) {
    const foundCustom = customIcons.find(x => String(x.name).toLowerCase() === s || String(x.id) === s);
    if (foundCustom && foundCustom.dataUrl) {
      return foundCustom.dataUrl;
    }
  }

  const isRes = s === 'residential pin' || s === 'residential' || s === 'res' || s.includes('residential');
  const isComm = s === 'commercial pin' || s === 'commercial' || s === 'comm' || s.includes('commercial');
  const isPole = isRes || isComm || s === 'pole pin' || s === 'landmark pin' || s === 'pole_pin' || s === 'landmark';

  if (isPole) {
    const textStr = esc(String(labelText || (isRes ? 'Happy Residency' : (isComm ? 'Surana Supremus' : 'Prince Palace'))).trim());
    const letter = esc(String(isRes ? 'R' : (isComm ? 'C' : (badgeLetter || (labelText ? labelText.trim().charAt(0) : 'R') || 'R'))).toUpperCase().slice(0, 3));
    const fillCol = isRes ? '#3b82f6' : (isComm ? (color && color !== '#00a6e0' ? color : '#f59e0b') : (color || '#00a6e0'));
    const textLen = textStr.length;
    const bannerWidth = Math.max(84, Math.round(textLen * 8.8 + 26));
    const totalW = Math.round(44 + bannerWidth + 14);

    const poleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} 115" width="${totalW}" height="115">
      <defs>
        <filter id="poleShadow" x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>
      <g filter="url(#poleShadow)">
        <line x1="22" y1="42" x2="22" y2="108" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="22" cy="108" r="3.5" fill="#ffffff"/>
      </g>
      <g filter="url(#poleShadow)">
        <rect x="36" y="6" width="${bannerWidth}" height="34" rx="7" fill="#d9f2fd" stroke="#b9e6fe" stroke-width="1.5"/>
        <text x="46" y="28" fill="#0f172a" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14.5" letter-spacing="0.2">${textStr}</text>
      </g>
      <g filter="url(#poleShadow)">
        <rect x="2" y="3" width="40" height="40" rx="9" fill="${fillCol}" stroke="#ffffff" stroke-width="2"/>
        <text x="22" y="30" text-anchor="middle" fill="#ffffff" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="20">${letter}</text>
      </g>
    </svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(poleSvg).toString('base64')}`;
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
 * @param {Array} customIcons [{ id, name, dataUrl }]
 */
function generateScenesXML(scenes, hotspots, customIcons = []) {
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
    const isGif = sLow.includes('gif') || (Array.isArray(customIcons) && customIcons.some(c => (c.name.toLowerCase() === sLow || c.id === s) && c.dataUrl && (c.dataUrl.startsWith('data:image/gif') || c.dataUrl.toLowerCase().includes('.gif'))));
    if (isText || isGif) {
      return `\t<style name="${esc(s)}" scale="1.0" alpha="1.0" visible="true" zorder="100" enabled="true" capture="false" />`;
    }
    const svgUrl = getHotspotSvgBase64(s, '', '', '', customIcons);
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
`;

  let sceneBlocks = sorted.map(scene => {
    const name = sceneName(scene);
    const baseName = getOriginalBaseName(scene);
    const tiles = String(scene.tilesFolder || `${baseName}.tiles`).endsWith('.tiles')
      ? scene.tilesFolder
      : `${scene.tilesFolder || baseName}.tiles`;

    const sceneHotspots = hotspots.filter(h => String(h.sceneId) === String(scene._id));
    const hotspotXML = sceneHotspots.map(h => {
      const hsName = h._id ? `hs_${h._id}` : `hs_${slugify(scene.title)}_${Math.random().toString(36).substring(2, 7)}`;
      const style = h.style || 'Arrow';
      const isPole = String(style).toLowerCase() === 'pole pin' || String(style).toLowerCase() === 'landmark pin' || String(style).toLowerCase() === 'pole_pin' || String(style).toLowerCase() === 'landmark';
      
      const customIcon = Array.isArray(customIcons) ? customIcons.find(x => String(x.name).toLowerCase() === String(style).toLowerCase() || String(x.id) === String(style)) : null;
      const customDataUrl = customIcon ? customIcon.dataUrl : (style && (String(style).startsWith('data:image/') || String(style).startsWith('http') || String(style).startsWith('assets/')) ? style : null);

      const isGif = (customDataUrl && (String(customDataUrl).startsWith('data:image/gif') || String(customDataUrl).toLowerCase().includes('.gif'))) ||
                    String(style).toLowerCase().includes('gif') ||
                    String(style).toLowerCase().endsWith('.gif');

      let widthAttr = h.width ? `width="${h.width}"` : '';
      let heightAttr = h.height ? `height="${h.height}"` : '';
      // If explicit px dimensions are set, normalize scale to 1 so they fully control the size.
      let scaleAttr = `scale="${(h.width || h.height || isGif) ? 1.0 : (h.scale !== undefined ? h.scale : 0.85)}"`;
      
      let baseAttrs = `ath="${h.ath}" atv="${h.atv}" ${widthAttr} ${heightAttr} ${scaleAttr} visible="true" zorder="100" enabled="true" capture="false"`;
      
      if (style === 'Text') {
        const tp = h.textProps || {};
        const isSticker = tp.sticker !== undefined ? tp.sticker : false;
        const isRollover = tp.rollover !== undefined ? tp.rollover : false;
        
        baseAttrs += ` type="text" html="${esc(h.title || 'TEXT')}"`;
        baseAttrs += ` distorted="${isSticker}"`;
        baseAttrs += ` alpha="${isRollover ? 0 : (tp.opacity !== undefined ? tp.opacity : 1)}"`;
        if (isRollover) {
          baseAttrs += ` onover="tween(alpha, ${tp.opacity !== undefined ? tp.opacity : 1})" onout="tween(alpha, 0)"`;
        }

        const bgAlpha = tp.bgOpacity !== undefined ? tp.bgOpacity : 0.27;
        const bgColor = tp.bgColor ? tp.bgColor.replace('#', '0x') : '0x000000';
        baseAttrs += ` bgcolor="${bgColor}" bgalpha="${bgAlpha}"`;

        const borderSize = tp.borderSize !== undefined ? tp.borderSize : 0;
        const borderColor = tp.borderColor ? tp.borderColor.replace('#', '0x') : '0x000000';
        const borderAlpha = tp.borderOpacity !== undefined ? tp.borderOpacity : 0.00;
        baseAttrs += ` bgborder="${borderSize} ${borderColor} ${borderAlpha}" bgroundedge="${tp.borderRadius !== undefined ? tp.borderRadius : 0}"`;

        const shadowColor = tp.shadowColor ? tp.shadowColor.replace('#', '0x') : '0xFF0000';
        const shadowAlpha = tp.shadowOpacity !== undefined ? tp.shadowOpacity : 0.00;
        
        if (bgAlpha > 0) {
          baseAttrs += ` bgshadow="2 2 4 ${shadowColor} ${shadowAlpha}"`;
        } else {
          baseAttrs += ` txtshadow="2 2 4 ${shadowColor} ${shadowAlpha}"`;
        }

        const font = tp.font || 'Arial';
        const fontSize = tp.fontSize || 13;
        const color = tp.color || '#FFFFFF';
        const fw = tp.bold ? 'bold' : 'normal';
        const fs = tp.italic ? 'italic' : 'normal';
        const td = tp.underline ? 'underline' : 'none';
        
        const cssStr = `font-family:${font}; font-size:${fontSize}px; color:${color}; font-weight:${fw}; font-style:${fs}; text-decoration:${td}; text-align:center;`;
        baseAttrs += ` css="${esc(cssStr)}" padding="4 8"`;
      } else if (isGif) {
        let gifSrc = customDataUrl || (style.startsWith('http') || style.startsWith('data:') ? style : (style.startsWith('assets/') ? `../${style}` : style));
        const w = h.width || 130;
        const hgt = h.height || 130;
        baseAttrs += ` type="text" renderer="css3d" distorted="false" bg="false" bgalpha="0.0" bgborder="0 0x000000 0" padding="0" width="${w}" height="${hgt}" html="${esc(`<img src="${gifSrc}" style="width:100%; height:100%; object-fit:contain; pointer-events:none; display:block;" />`)}" alpha="1.0"`;
      } else {
        if (customIcon && customIcon.dataUrl) {
          baseAttrs += ` url="${esc(customIcon.dataUrl)}" alpha="1.0"`;
        } else {
          if (isPole) {
            baseAttrs += ` edge="bottomleft" ox="-22" oy="0"`;
          }
          const svgUrl = getHotspotSvgBase64(style, h.title, h.color, h.badgeLetter, customIcons);
          baseAttrs += ` url="${esc(svgUrl)}" alpha="1.0"`;
        }
      }

      if (h.kind === 'image' || isPole) {
        if (h.info) {
          const jsSafeText = String(h.info).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
          return `\t\t<hotspot name="${esc(hsName)}" ${baseAttrs}\n` +
            `\t\t         onclick="js(alert('${jsSafeText}'));" />`;
        }
        return `\t\t<hotspot name="${esc(hsName)}" ${baseAttrs} />`;
      } else if (h.kind === 'info') {
        const rawText = String(h.info || h.title || '');
        const jsSafeText = rawText.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
        return `\t\t<hotspot name="${esc(hsName)}" ${baseAttrs}\n` +
          `\t\t         onclick="js(alert('${jsSafeText}'));" />`;
      } else {
        // Navigation hotspot
        const target = byId[String(h.targetSceneId)];
        if (!target) return '';
        const targetName = sceneName(target);
        const transition = h.transition || 'BLEND(0.5)';
        
        const mode = h.targetViewMode || target.openPanoMode || 'start_point';
        let vars = 'null';
        let onclickCode = ``;

        if (mode === 'custom') {
          // Pass custom coordinates directly into the loadscene call as temporary variables
          // We also pass hs_entry_custom=true so the onstart hook knows for sure that a custom view is requested
          const hAth = h.targetAth !== undefined && h.targetAth !== null ? h.targetAth : 0;
          const hAtv = h.targetAtv !== undefined && h.targetAtv !== null ? h.targetAtv : 0;
          const hFov = h.targetFov !== undefined && h.targetFov !== null ? h.targetFov : 90;
          onclickCode = `loadscene('${targetName}', 'hs_entry_custom=true&amp;hs_entry_hlookat=${hAth}&amp;hs_entry_vlookat=${hAtv}&amp;hs_entry_fov=${hFov}', MERGE, ${transition});`;
        } else if (mode === 'same_spot') {
          onclickCode = `loadscene('${targetName}', null, MERGE|KEEPVIEW, ${transition});`;
        } else if (mode === 'smart') {
          const returnHs = hotspots.find(hs => String(hs.sceneId) === String(target._id) && String(hs.targetSceneId) === String(scene._id));
          if (returnHs) {
            let smartAth = (Number(returnHs.ath) + 180) % 360;
            if (smartAth > 180) smartAth -= 360;
            vars = `'view.hlookat=${smartAth}'`;
            // 3DVista-style walkthrough: tween to face the door, then trigger loadscene as a callback
            onclickCode = `tween(view.hlookat, ${h.ath}, 0.5, easeInOutQuad); tween(view.vlookat, ${h.atv}, 0.5, easeInOutQuad, loadscene('${targetName}', ${vars}, MERGE, ZOOMBLEND(2.0, 1.2, easeInOutSine)));`;
          } else {
            vars = 'null';
            onclickCode = `loadscene('${targetName}', ${vars}, MERGE, ${transition});`;
          }
        } else {
          // start_point or fallback
          onclickCode = `loadscene('${targetName}', ${vars}, MERGE, ${transition});`;
        }

        return `\t\t<hotspot name="${esc(hsName)}" ${baseAttrs}\n` +
          `\t\t         onclick="${onclickCode}" />`;
      }
    }).filter(Boolean).join('\n');

    const hlookat = scene.hlookat !== undefined ? scene.hlookat : 0.0;
    const vlookat = scene.vlookat !== undefined ? scene.vlookat : 0.0;
    const fov = scene.fov !== undefined ? scene.fov : 114;
    const fovspeed = scene.fovspeed !== undefined ? scene.fovspeed : 50;
    const minfov = scene.minfov !== undefined ? scene.minfov : 30;



    const fs = require('fs');
    const path = require('path');
    const db = require('./db');
    const tourDir = db.resolveTourPath(scene.tourId) || path.resolve(__dirname, '../vtour');
    const PANOS_DIR = path.join(tourDir, 'panos');

    // Check if cube faces exist in active tour, vtour, or anywhere in data/
    let hasCubeFaces = fs.existsSync(path.join(PANOS_DIR, tiles, 'f')) || fs.existsSync(path.join(__dirname, '../vtour/panos', tiles, 'f'));
    if (!hasCubeFaces) {
      const dataDir = path.join(__dirname, '../data');
      if (fs.existsSync(dataDir)) {
        try {
          const projs = fs.readdirSync(dataDir, { withFileTypes: true });
          for (const p of projs) {
            if (p.isDirectory() && fs.existsSync(path.join(dataDir, p.name, 'panos', tiles, 'f'))) {
              hasCubeFaces = true;
              break;
            }
          }
        } catch(e) {}
      }
    }

    // Standard krpano generated multires folders are cube panoramas
    if (!hasCubeFaces && tiles && tiles.endsWith('.tiles')) {
      hasCubeFaces = true;
    }

    let imageXML = '';
    if (!hasCubeFaces) {
      imageXML = `\t\t<image>\n\t\t\t<sphere url="../panos/${tiles}/preview.jpg" />\n\t\t</image>`;
    } else {
      let multiresStr = "512,1024,2048,3840";
      try {
        const tourXmlPath = path.join(PANOS_DIR, tiles, 'tour.xml');
        
        // Use an in-memory cache for multires
        if (!global.multiresCache) global.multiresCache = new Map();
        
        if (global.multiresCache.has(tourXmlPath)) {
          multiresStr = global.multiresCache.get(tourXmlPath);
        } else if (fs.existsSync(tourXmlPath)) {
          const tourXmlContent = fs.readFileSync(tourXmlPath, 'utf8');
          const multiresMatch = tourXmlContent.match(/multires="([^"]+)"/);
          if (multiresMatch) {
            multiresStr = multiresMatch[1];
            global.multiresCache.set(tourXmlPath, multiresStr);
          }
        }
      } catch (err) {
        console.warn('Failed to parse multires from tour.xml, using default:', err.message);
      }

      imageXML = `\t\t<preview url="../panos/${tiles}/preview.jpg" />\n\n\t\t<image>\n\t\t\t<cube url="../panos/${tiles}/%s/l%l/%v/l%l_%s_%v_%h.jpg" multires="${multiresStr}" />\n\t\t</image>`;
    }

    return (
      `	<scene name="${name}" title="${esc(scene.title)}" onstart="js(console.log('SCENE START pending custom view:', get(hs_entry_custom), get(hs_entry_hlookat), get(hs_entry_vlookat), get(hs_entry_fov))); if(hs_entry_custom == true, lookat(get(hs_entry_hlookat), get(hs_entry_vlookat), get(hs_entry_fov)); js(console.log('VIEW APPLIED:', get(view.hlookat), get(view.vlookat), get(view.fov))); delete(hs_entry_custom, hs_entry_hlookat, hs_entry_vlookat, hs_entry_fov););" thumburl="../panos/${tiles}/thumb.jpg" lat="${scene.lat !== null && scene.lat !== undefined ? scene.lat : ''}" lng="${scene.lng !== null && scene.lng !== undefined ? scene.lng : ''}" heading="">
		
		<control bouncinglimits="calc:image.cube ? true : false" fovspeed="${fovspeed}" />

		<view hlookat="${hlookat}" vlookat="${vlookat}" fovtype="MFOV" fov="${fov}" maxpixelzoom="2.0" fovmin="${minfov}" fovmax="140" limitview="auto" />

${imageXML}
${sceneHotspots.length ? '\n' + hotspotXML + '\n' : ''}

\t</scene>`);
  }).join('\n\n');

  if (scenes.length === 0) {
    sceneBlocks = `\t<scene name="scene_empty" title="Empty Project">\n\t\t<view hlookat="0" vlookat="0" fov="90" />\n\t</scene>`;
  }

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
