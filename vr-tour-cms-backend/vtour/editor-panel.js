/**
 * Showcase 360 VR Tour CMS — 2-Bar & 3-Bar Studio with Immediate Auto-Save
 * Features:
 *  - 1st Bar: 360 EYE Logo, Showcase 360 Editor, File, Media, Hotspot, Preview (Save removed - all edits auto-save!)
 *  - 2nd Bar: Page-specific Sub-Navigation (360 Image / Hotspot tabs in Media mode; Hotspot Editor title in Editor mode)
 *  - 3rd Bar: Editor Toolbar (↗ Hotspot, T Text, 🖼 Image icon tools)
 *  - Left Sidebar: Panoramas rounded cards with blue selection border when active
 *  - Center Viewport: krpano 3D interactive VR viewport
 *  - Right Sidebar: Panorama Property Editor (Title, Thumbnail, Initial View, Tag field with immediate auto-save)
 */

let krpano = null;
let scenes = [];
let hotspots = [];
let assets = [];
let activeSceneId = null;
let draggedScene = null;
let pendingDrop = null;
let selectedHotspotId = null;
let currentTool = 'hotspot'; // default tool

const urlParams = new URLSearchParams(window.location.search);
const currentTourId = urlParams.get('tour') || 'default';

// Tell the backend which tour is currently active so it can serve the correct local files
const setActiveTourPromise = fetch('/api/system/set-active-tour', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tourId: currentTourId })
}).then(res => res.json()).then(data => {
  if (data.success && data.activeTourId && data.activeTourId !== currentTourId) {
    // The backend auto-extracted the zip or resolved a file path to its parent directory!
    // We must update the URL to point to the actual extracted folder so future API calls succeed.
    window.location.href = `?tour=${encodeURIComponent(data.activeTourId)}`;
    return new Promise(() => {}); // Block forever to prevent further execution while redirecting
  }
}).catch(console.error);

async function showWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.style.display = 'flex';
  
  try {
    const res = await fetch('/api/system/recent-projects');
    const data = await res.json();
    const grid = document.getElementById('welcome-recent-grid');
    if (grid) {
      grid.innerHTML = '';
      if (data.projects && data.projects.length > 0) {
        // Reverse array so most recent projects are first
        [...data.projects].reverse().forEach(p => {
          // Attempt to extract folder name
          const folderName = p.replace(/\\/g, '/').split('/').pop();
          const div = document.createElement('div');
          div.className = 'welcome-recent-card';
          div.onclick = () => { window.location.href = `?tour=${encodeURIComponent(p)}`; };
          div.innerHTML = `
            <div class="welcome-recent-card-info" style="height:110px; display:flex; align-items:center; justify-content:center;">
              <div class="welcome-recent-card-title" style="white-space:normal; overflow:visible; text-align:center;">${folderName}</div>
            </div>
          `;
          grid.appendChild(div);
        });
      } else {
        grid.innerHTML = '<div style="color:#94a3b8; font-size:13px; padding:10px;">No recent projects found.</div>';
      }
    }
  } catch (e) {
    console.error('Failed to load recent projects', e);
  }
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.style.display = 'none';
}

if (!urlParams.get('tour')) {
  document.addEventListener('DOMContentLoaded', showWelcomeModal);
}

let isEditorMode = true;

window.ICON_LIBRARY_ITEMS = [
  { name: 'Arrow 01', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M14 44 L32 20 L50 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Down', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M14 20 L32 44 L50 20" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Left', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M44 14 L20 32 L44 50" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Left Up', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M44 44 L20 20 M20 20 L44 20 M20 20 L20 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Right Up', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M20 44 L44 20 M44 20 L20 20 M44 20 L44 44" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01 Right', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M20 14 L44 32 L20 50" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01a', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M10 42 L32 22 L54 42" fill="none" stroke="#ffffff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01b', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M16 40 L32 26 L48 40" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Arrow 01c', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M12 42 C20 32 44 32 52 42 L32 22 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 12 L56 42 L46 50 L32 30 L18 50 L8 42 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Down', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 52 L56 22 L46 14 L32 34 L18 14 L8 22 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Left', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M12 32 L42 8 L50 18 L30 32 L50 46 L42 56 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Left Up', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M16 16 L48 16 L48 26 L28 26 L28 48 L16 48 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Right Up', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M48 16 L16 16 L16 26 L36 26 L36 48 L48 48 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 02 Right', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M52 32 L22 8 L14 18 L34 32 L14 46 L22 56 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Up', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 10 L50 32 L38 32 L38 52 L26 52 L26 32 L14 32 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Down', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 54 L50 32 L38 32 L38 12 L26 12 L26 32 L14 32 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Left', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M10 32 L32 14 L32 26 L52 26 L52 38 L32 38 L32 50 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow 03 Right', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M54 32 L32 14 L32 26 L12 26 L12 38 L32 38 L32 50 Z" fill="#ffffff"/></svg>' },
  { name: 'Arrow Circle', family: 'Arrow', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="#10b981" stroke="#ffffff" stroke-width="4"/><path d="M24 20 L38 32 L24 44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
  { name: 'Pin Red', family: 'Pin', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Blue', family: 'Pin', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#10b981" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Green', family: 'Pin', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#10b981" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Pin Yellow', family: 'Pin', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#f59e0b" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Green', family: 'Dot', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#10b981" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Blue', family: 'Dot', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#10b981" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot Red', family: 'Dot', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#ef4444" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>' },
  { name: 'Dot White', family: 'Dot', type: 'Navigation', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="24" fill="#ffffff" stroke="#333333" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#10b981"/></svg>' },
  { name: 'Info Badge', family: 'Info', type: 'Info', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48"><circle cx="32" cy="32" r="28" fill="#10b981" stroke="#ffffff" stroke-width="4"/><text x="32" y="44" text-anchor="middle" fill="#ffffff" font-family="Outfit, sans-serif" font-weight="900" font-size="34">i</text></svg>' }
];

// Custom hotspot icons stored in localStorage & synced with backend
function getCustomIcons() {
  try {
    const raw = localStorage.getItem('custom_hotspot_icons');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

async function syncCustomIconsWithBackend() {
  try {
    const localIcons = getCustomIcons();
    const res = await fetch('/api/custom-icons/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ icons: localIcons })
    });
    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.icons)) {
        const map = new Map();
        localIcons.forEach(i => map.set(i.id || i.name, i));
        data.icons.forEach(i => map.set(i.id || i.name, i));
        const merged = Array.from(map.values());
        localStorage.setItem('custom_hotspot_icons', JSON.stringify(merged));
        if (typeof renderMediaIcons === 'function') renderMediaIcons();
        if (typeof updatePopoverIconGrid === 'function') updatePopoverIconGrid();
        if (typeof updateBadges === 'function') updateBadges();
      }
    }
  } catch (err) {
    console.warn('Failed to sync custom icons with backend:', err);
  }
}

// Automatically sync custom icons on load
syncCustomIconsWithBackend();

function saveCustomIcon(iconObj) {
  const list = getCustomIcons();
  const idx = list.findIndex(x => String(x.id) === String(iconObj.id) || String(x.name).toLowerCase() === String(iconObj.name).toLowerCase());
  if (idx >= 0) {
    list[idx] = iconObj;
  } else {
    list.push(iconObj);
  }
  localStorage.setItem('custom_hotspot_icons', JSON.stringify(list));
  try {
    fetch('/api/custom-icons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(iconObj)
    }).catch(e => console.warn(e));
  } catch (e) {}
}

function removeCustomIcon(iconId) {
  let list = getCustomIcons();
  list = list.filter(x => String(x.id) !== String(iconId) && String(x.name).toLowerCase() !== String(iconId).toLowerCase());
  localStorage.setItem('custom_hotspot_icons', JSON.stringify(list));
  try {
    fetch('/api/custom-icons/' + encodeURIComponent(iconId), {
      method: 'DELETE'
    }).catch(e => console.warn(e));
  } catch (e) {}
}

// Helper: case-sensitive original basename
function getOriginalBaseName(scene) {
  if (scene && scene.tilesFolder) {
    return String(scene.tilesFolder).replace(/\.tiles$/i, '');
  }
  return scene ? String(scene.title) : '';
}

function getSceneKrpanoName(scene) {
  return 'scene_' + getOriginalBaseName(scene);
}

// Returns true if a hotspot should be treated as an image overlay or landmark pin
function isImageHotspot(hs) {
  if (!hs) return false;
  if (hs.kind === 'image') return true;
  const s = String(hs.style || '').toLowerCase();
  return s.includes('residential') || s.includes('commercial') || s === 'pole pin' || s === 'landmark pin' || s === 'pole_pin' || s === 'landmark' || s.startsWith('assets/') || s.startsWith('http') || (s.startsWith('data:image/') && !s.includes('text'));
}

// Returns true if a hotspot should be treated as a text label
function isTextHotspot(hs) {
  if (!hs) return false;
  if (isImageHotspot(hs)) return false;
  const s = String(hs.style || '').toLowerCase();
  return s === 'text' || hs.kind === 'text';
}

// Returns true if a hotspot should be treated as a navigation / icon hotspot
function isNavHotspot(hs) {
  if (!hs) return false;
  return !isImageHotspot(hs) && !isTextHotspot(hs);
}

// Generate inline Base64 data URI for SVG icons or standalone Text style
function getHotspotSvgBase64(style, labelText, color, bgColor, textStyle, badgeLetter) {
  const s = String(style || 'Arrow').toLowerCase();

  if (style && (String(style).startsWith('data:image/') || String(style).startsWith('assets/'))) {
    return style;
  }

  const isRes = s === 'residential pin' || s === 'residential' || s === 'res' || s.includes('residential');
  const isComm = s === 'commercial pin' || s === 'commercial' || s === 'comm' || s.includes('commercial');
  const isPole = isRes || isComm || s === 'pole pin' || s === 'landmark pin' || s === 'pole_pin' || s === 'landmark';

  if (isPole) {
    const defaultText = 'Add text';
    const textStr = String(labelText || defaultText).trim() || defaultText;
    const letter = (isRes ? 'R' : (isComm ? 'C' : String(badgeLetter || (labelText ? labelText.trim().charAt(0) : 'R') || 'R'))).toUpperCase().slice(0, 3);
    const fillCol = isRes ? '#3b82f6' : (isComm ? '#f59e0b' : (color || '#00a6e0'));
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
        <text x="46" y="28" fill="#0f172a" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="800" font-size="14.5" letter-spacing="0.2">${textStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
      </g>
      <g filter="url(#poleShadow)">
        <rect x="2" y="3" width="40" height="40" rx="9" fill="${fillCol}" stroke="#ffffff" stroke-width="2"/>
        <text x="22" y="30" text-anchor="middle" fill="#ffffff" font-family="'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="20">${letter.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
      </g>
    </svg>`;

    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(poleSvg)))}`;
  }

  const customList = getCustomIcons();
  const foundCustom = customList.find(x => String(x.name).toLowerCase() === s);
  if (foundCustom && foundCustom.dataUrl) {
    return foundCustom.dataUrl;
  }
  const libItems = window.ICON_LIBRARY_ITEMS || [];
  const foundLib = libItems.find(x => String(x.name).toLowerCase() === s);
  if (foundLib && foundLib.svg) {
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(foundLib.svg)))}`;
  }

  if (s === 'text') {
    const textStr = String(labelText || 'TEXT').trim() || 'TEXT';
    const textSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 80" width="300" height="80">
      <defs>
        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.9"/>
        </filter>
      </defs>
      <g filter="url(#shadow)">
        <text x="150" y="50" text-anchor="middle" fill="${fillCol}" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="28" letter-spacing="1">${textStr.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(textSvg)))}`;
  }

  let iconSvg = '';
  if (s === 'pin') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="${fillCol !== '#ffffff' && fillCol !== '#00a6e0' ? fillCol : '#ef4444'}" stroke="#ffffff" stroke-width="4"/>
      <circle cx="32" cy="24" r="10" fill="#ffffff"/>
    </svg>`;
  } else if (s === 'dot') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="24" fill="${fillCol !== '#ffffff' && fillCol !== '#00a6e0' ? fillCol : '#10b981'}" stroke="#ffffff" stroke-width="6"/>
      <circle cx="32" cy="32" r="10" fill="#ffffff"/>
    </svg>`;
  } else {
    // Arrow default
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
      <circle cx="32" cy="32" r="28" fill="${fillCol !== '#ffffff' && fillCol !== '#00a6e0' ? fillCol : '#10b981'}" stroke="#ffffff" stroke-width="4"/>
      <path d="M24 20 L38 32 L24 44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(iconSvg)))}`;
}

// Initialize on window load
window.addEventListener('DOMContentLoaded', () => {
  if (currentTourId && currentTourId !== 'default') {
    const projectName = currentTourId.split(/[\\/]/).pop();
    document.getElementById('header-project-name').textContent = projectName;
    document.getElementById('project-name-display-container').style.display = 'flex';
  }

  embedpano({
    xml: "tour.xml?v=" + Date.now(),
    target: "pano",
    html5: "only",
    webglsettings: { preserveDrawingBuffer: true },
    onready: onKrpanoReady
  });

  setupDragAndDrop();
  setupPopoverListeners();
  setupTopNavListeners();
  setupThumbUploadListener();
  setupPanoBackgroundClickListener();
  setupReturnDotDragging();

  // Ensure default view is Media page -> 360 Image tab
  switchMainPage('media');
  switchMediaSubTab('images');

  if (!sessionStorage.getItem('welcomeModalSkipped')) {
    openWelcomeModal();
  }
});

// krpano ready callback
function onKrpanoReady(krpanoInterface) {
  krpano = krpanoInterface;
  console.log("krpano interface ready:", krpano);

  const dragActionCode = `
    copy(drag_start_ath, ath);
    copy(drag_start_atv, atv);
    copy(drag_start_mx, mouse.stagex);
    copy(drag_start_my, mouse.stagey);
    
    spheretoscreen(ath, atv, hotspotcenterx, hotspotcentery);
    sub(drag_dx, mouse.stagex, hotspotcenterx);
    sub(drag_dy, mouse.stagey, hotspotcentery);
    
    set(has_actually_dragged, false);
    
    asyncloop(pressed,
      sub(moved_x, mouse.stagex, drag_start_mx);
      sub(moved_y, mouse.stagey, drag_start_my);
      set(is_moved, false);
      if(moved_x LT -6, set(is_moved, true));
      if(moved_x GT 6, set(is_moved, true));
      if(moved_y LT -6, set(is_moved, true));
      if(moved_y GT 6, set(is_moved, true));
      
      if(is_moved,
        set(has_actually_dragged, true);
        sub(dx, mouse.stagex, drag_dx);
        sub(dy, mouse.stagey, drag_dy);
        screentosphere(dx, dy, ath, atv);
      );
    ,
      if(has_actually_dragged,
        js(window.onHotspotDragEnd(get(name), get(ath), get(atv)));
      ,
        copy(ath, drag_start_ath);
        copy(atv, drag_start_atv);
        js(window.onHotspotClicked(get(name)));
      );
    );
  `;
  krpano.set("action[draghotspot].content", dragActionCode);

  krpano.set("events[cms_events].keep", true);
  krpano.set("events[cms_events].onnewscene", "js(onKrpanoNewScene())");
  krpano.set("events[cms_events].onclick", "js(window.onPanoBackgroundClicked())");
  krpano.set("events[cms_events].onxmlcomplete", "js(krpano.set('layer[skin_layer].visible', false))");

  loadTourData();
}

window.onKrpanoNewScene = function () {
  setTimeout(() => {
    renderCurrentSceneHotspots();
  }, 50);
};

// Fetch scenes and hotspots from API
async function loadTourData() {
  await setActiveTourPromise;
  try {
    const [scenesRes, hsRes, asRes] = await Promise.all([
      fetch(`/api/tours/${encodeURIComponent(currentTourId)}/scenes`),
      fetch(`/api/tours/${encodeURIComponent(currentTourId)}/hotspots`),
      fetch(`/api/tours/${encodeURIComponent(currentTourId)}/assets`)
    ]);
    const scenesData = await scenesRes.json();
    const hsData = await hsRes.json();
    const asData = await asRes.json();

    scenes = scenesData.scenes || [];
    hotspots = hsData.hotspots || [];
    assets = asData.assets || [];

    console.log("Loaded scenes:", scenes.length, "hotspots:", hotspots.length, "assets:", assets.length);

    renderMediaScenes();
    renderMediaIcons();
    renderMediaAssets();
    renderScenes();
    updateBadges();

    if (scenes.length > 0 && !activeSceneId) {
      selectScene(scenes[0]);
    } else if (activeSceneId) {
      const activeSc = scenes.find(s => String(s._id) === String(activeSceneId));
      if (activeSc) selectScene(activeSc);
    }
  } catch (err) {
    console.error("Error loading tour data:", err);
    showToast("Error loading tour data from server");
  }
}

let publishTimeout = null;
async function publishTourSilent() {
  if (publishTimeout) clearTimeout(publishTimeout);
  publishTimeout = setTimeout(async () => {
    try {
      await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/publish`, { method: 'POST' });
    } catch (err) {
      console.warn("Silent publish error:", err.message);
    }
  }, 500); // 500ms debounce
}

// ==================== 1st BAR & 2nd BAR NAVIGATION LOGIC ====================

function switchMainPage(page) {
  const pageMedia = document.getElementById('page-media');
  const pageHotspot = document.getElementById('page-hotspot-editor');
  const mediaSubBar = document.getElementById('media-sub-bar');

  const btnMedia = document.getElementById('nav-btn-media');
  const btnHotspot = document.getElementById('nav-btn-hotspot');

  if (btnMedia) btnMedia.classList.remove('active');
  if (btnHotspot) btnHotspot.classList.remove('active');

  if (page === 'media') {
    if (btnMedia) btnMedia.classList.add('active');
    if (pageMedia) pageMedia.style.display = 'flex';
    if (mediaSubBar) mediaSubBar.style.display = 'flex';
    if (pageHotspot) pageHotspot.style.display = 'none';
    const bulkBar = document.getElementById('bulk-action-bar');
    if (bulkBar) bulkBar.style.display = '';

    renderMediaScenes();
    renderMediaIcons();
    renderMediaAssets();
    updateBadges();
  } else if (page === 'hotspot') {
    if (btnHotspot) btnHotspot.classList.add('active');
    if (pageMedia) pageMedia.style.display = 'none';
    if (mediaSubBar) mediaSubBar.style.display = 'none';
    if (pageHotspot) pageHotspot.style.display = 'flex';

    // Hide bulk selection bar when entering hotspot editor
    const bulkBar = document.getElementById('bulk-action-bar');
    if (bulkBar) bulkBar.style.display = 'none';

    renderScenes();
    renderCurrentSceneHotspots();
    updateBadges();
    if (typeof closePropertyRightPanel === 'function') closePropertyRightPanel();
  }
}

function switchMediaSubTab(tab) {
  const secImages = document.getElementById('media-tab-images');
  const secHotspots = document.getElementById('media-tab-hotspots');
  const secAssets = document.getElementById('media-tab-assets');
  const btnImages = document.getElementById('sub-tab-images');
  const btnHotspots = document.getElementById('sub-tab-hotspots');
  const btnAssets = document.getElementById('sub-tab-assets');

  if (btnImages) btnImages.classList.remove('active');
  if (btnHotspots) btnHotspots.classList.remove('active');
  if (btnAssets) btnAssets.classList.remove('active');
  if (secImages) secImages.style.display = 'none';
  if (secHotspots) secHotspots.style.display = 'none';
  if (secAssets) secAssets.style.display = 'none';

  if (tab === 'images') {
    if (btnImages) btnImages.classList.add('active');
    if (secImages) {
      secImages.style.display = 'flex';
      secImages.style.flexDirection = 'column';
      secImages.style.width = '100%';
    }
    renderMediaScenes();
  } else if (tab === 'hotspots') {
    if (btnHotspots) btnHotspots.classList.add('active');
    if (secHotspots) {
      secHotspots.style.display = 'flex';
      secHotspots.style.flexDirection = 'column';
      secHotspots.style.width = '100%';
    }
    renderMediaIcons();
  } else if (tab === 'assets') {
    if (btnAssets) btnAssets.classList.add('active');
    if (secAssets) {
      secAssets.style.display = 'flex';
      secAssets.style.flexDirection = 'column';
      secAssets.style.width = '100%';
    }
    renderMediaAssets();
  }
}

function setupTopNavListeners() {
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('file-dropdown');
    const isFileBtn = e.target.closest('#nav-btn-file');
    if (dropdown && dropdown.style.display === 'flex' && !isFileBtn) {
      dropdown.style.display = 'none';
    }
  });
}

function toggleFileDropdown(e) {
  if (e) e.stopPropagation();
  const dropdown = document.getElementById('file-dropdown');
  if (!dropdown) return;
  const current = dropdown.style.display;
  dropdown.style.display = current === 'flex' ? 'none' : 'flex';
}

async function openProjectsModalAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  openWelcomeModal();
}
window.openProjectsModalAction = openProjectsModalAction;

async function openProjectAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  const input = document.getElementById('import-project-input');
  if (input) {
    input.value = ''; // Reset so selecting the same file works
    input.click();
  }
}
window.openProjectAction = openProjectAction;

async function openWorkspaceFolderAction() {
  // Cloud/web fallback
  openProjectsModalAction();
}
window.openWorkspaceFolderAction = openWorkspaceFolderAction;

async function importProjectAction(event) {
  const file = event.target.files[0];
  if (!file) return;

  const modal = document.getElementById('import-progress-modal');
  const titleEl = document.getElementById('import-progress-title');
  const fileNameEl = document.getElementById('import-file-name');
  const barEl = document.getElementById('import-progress-bar');
  const statusEl = document.getElementById('import-progress-status');
  const percentEl = document.getElementById('import-progress-percent');
  const closeBtn = document.getElementById('import-progress-close');

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
  if (fileNameEl) fileNameEl.textContent = `${file.name} (${fileSizeMB} MB)`;
  if (barEl) barEl.style.width = '0%';
  if (percentEl) percentEl.textContent = '0%';
  if (statusEl) {
    statusEl.textContent = 'Preparing upload...';
    statusEl.style.color = '#71717a';
  }
  if (titleEl) titleEl.textContent = 'Importing Project';
  if (closeBtn) closeBtn.style.display = 'none';
  if (modal) modal.style.display = 'flex';

  const formData = new FormData();
  formData.append('projectFile', file);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/project/import', true);

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      const loadedMB = (e.loaded / (1024 * 1024)).toFixed(1);
      const totalMB = (e.total / (1024 * 1024)).toFixed(1);
      if (barEl) barEl.style.width = `${pct}%`;
      if (percentEl) percentEl.textContent = `${pct}%`;
      if (statusEl) {
        if (pct < 100) {
          statusEl.textContent = `Uploading: ${loadedMB} MB / ${totalMB} MB`;
        } else {
          statusEl.textContent = `Upload complete. Extracting project on server...`;
        }
      }
    }
  };

  xhr.onload = () => {
    try {
      const data = JSON.parse(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && data.success) {
        if (barEl) barEl.style.width = '100%';
        if (percentEl) percentEl.textContent = '100%';
        if (statusEl) statusEl.textContent = 'Project imported successfully! Loading...';
        showToast("Project imported successfully!");
        sessionStorage.setItem('welcomeModalSkipped', 'true');
        setTimeout(() => {
          window.location.href = `?tour=${encodeURIComponent(data.newTourId)}`;
        }, 1000);
      } else {
        throw new Error(data.error || `Server error (${xhr.status})`);
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = 'Import failed: ' + err.message;
        statusEl.style.color = '#ef4444';
      }
      if (titleEl) titleEl.textContent = 'Import Error';
      if (closeBtn) closeBtn.style.display = 'block';
      showToast("Error importing project: " + err.message);
    }
  };

  xhr.onerror = () => {
    if (statusEl) {
      statusEl.textContent = 'Network or server connection error.';
      statusEl.style.color = '#ef4444';
    }
    if (titleEl) titleEl.textContent = 'Import Error';
    if (closeBtn) closeBtn.style.display = 'block';
    showToast("Network error importing project");
  };

  xhr.send(formData);
}
window.importProjectAction = importProjectAction;

async function exportProjectAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  
  // Trigger file download
  window.location.href = '/api/project/export';
}
window.exportProjectAction = exportProjectAction;

async function newProjectAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  const modal = document.getElementById('new-project-modal');
  const input = document.getElementById('new-project-name-input');
  if (modal && input) {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    input.value = 'Project_' + today;
    modal.style.display = 'flex';
    setTimeout(() => { input.focus(); input.select(); }, 80);
  }
}
window.newProjectAction = newProjectAction;

async function submitCreateNewProject() {
  const modal = document.getElementById('new-project-modal');
  const input = document.getElementById('new-project-name-input');
  const name = (input ? input.value : '').trim();

  if (!name) {
    showToast("Please enter a valid project name");
    return;
  }

  if (modal) modal.style.display = 'none';
  showToast("Creating project...");

  try {
    const res = await fetch('/api/project/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create project');

    showToast("Project created successfully! Loading...");
    sessionStorage.setItem('welcomeModalSkipped', 'true');
    setTimeout(() => {
      window.location.href = `?tour=${encodeURIComponent(data.newTourId)}`;
    }, 800);
  } catch (err) {
    console.error(err);
    showToast("Error creating project: " + err.message);
  }
}
window.submitCreateNewProject = submitCreateNewProject;

async function saveAsAction() {
  exportProjectAction();
}
window.saveAsAction = saveAsAction;

// ==================== PROJECT ACTIONS ====================

window.renameProjectAction = function() {
  if (!currentTourId || currentTourId === 'default') return;
  const currentName = currentTourId.split(/[\\/]/).pop();
  document.getElementById('rename-input').value = currentName;
  document.getElementById('rename-modal').style.display = 'flex';
  document.getElementById('rename-input').focus();
};

window.confirmRenameAction = async function() {
  const newName = document.getElementById('rename-input').value.trim();
  const currentName = currentTourId.split(/[\\/]/).pop();
  
  if (!newName || newName === currentName) {
    document.getElementById('rename-modal').style.display = 'none';
    return;
  }
  
  try {
    document.getElementById('rename-modal').style.display = 'none';
    const res = await fetch('/api/system/rename-tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to rename project');
    
    showToast("Project renamed successfully!");
    setTimeout(() => window.location.href = `?tour=${encodeURIComponent(data.newTourId)}`, 1000);
  } catch (err) {
    console.error(err);
    alert("Error renaming project: " + err.message);
    showToast("Error renaming project: " + err.message);
  }
};

// ==================== 3rd BAR TOOLBAR ACTIONS ====================

function activateTool(toolName) {
  currentTool = toolName;
  const btnHotspot = document.getElementById('tool-btn-hotspot');
  const btnText = document.getElementById('tool-btn-text');
  const btnImg = document.getElementById('tool-btn-image');

  if (btnHotspot) btnHotspot.classList.remove('active');
  if (btnText) btnText.classList.remove('active');
  if (btnImg) btnImg.classList.remove('active');

  if (toolName === 'hotspot') {
    if (btnHotspot) btnHotspot.classList.add('active');
    openIconLibraryModal('add');
  } else if (toolName === 'text') {
    if (btnText) btnText.classList.add('active');
    openAddTextModal();
  } else if (toolName === 'image') {
    if (btnImg) btnImg.classList.add('active');
    openImageHotspotTool();
  }
}

window._selectedImageAsset = null; // { name, url }

function openImageHotspotTool() {
  const modal = document.getElementById('modal-select-image-asset');
  if (!modal) return;
  window._selectedImageAsset = null;
  _selectedImageAsset = null;
  modal.style.display = 'flex';
  _renderImageAssetGrid();
  _updateImageSelectBtn();
}

function _renderImageAssetGrid() {
  const grid = document.getElementById('modal-select-image-asset-grid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!assets || assets.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#64748b;padding:40px;">No images found in Media. Upload some first!</div>`;
    return;
  }

  let count = 0;
  assets.forEach(asset => {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(asset.url);
    if (!isImage) return;
    count++;

    const url = asset.url;
    const isSelected = _selectedImageAsset && _selectedImageAsset.url === url;

    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.url = url;
    card.style.cssText = `cursor:pointer;outline:${isSelected ? '2px solid #10b981' : 'none'};border-radius:10px;transition:outline 0.15s;`;
    card.innerHTML = `
      <div class="image-card-thumb-wrap" style="height:120px;position:relative;">
        <img class="image-card-thumb" src="${url}" alt="${asset.name}" style="object-fit:cover;">
      </div>
      <div class="image-card-body" style="padding:8px;">
        <div style="font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${isSelected ? '#10b981' : '#fff'};font-weight:${isSelected ? '700' : '500'};" title="${asset.name}">${asset.name}</div>
      </div>
    `;
    card.onclick = () => {
      _selectedImageAsset = { name: asset.name, url };
      window._selectedImageAsset = _selectedImageAsset;
      _renderImageAssetGrid();
      _updateImageSelectBtn();
    };
    grid.appendChild(card);
  });

  if (count === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#64748b;padding:40px;">No images found in Media. Upload some first!</div>`;
  }
}

function _updateImageSelectBtn() {
  const btn = document.getElementById('modal-image-asset-select-btn');
  if (!btn) return;
  const has = !!(window._selectedImageAsset);
  btn.disabled = !has;
  btn.style.opacity = has ? '1' : '0.4';
  btn.style.cursor = has ? 'pointer' : 'not-allowed';
}

async function addImageHotspotFromAsset(assetName, assetUrl) {
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!currentScene) {
    showToast("Please add at least one panorama scene first!");
    return;
  }

  const url = assetUrl;

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: assetName,
        kind: 'info',
        info: assetName,
        style: url,
        ath: 0,
        atv: 0,
        width: 150,
        height: 150
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('Failed to create image hotspot:', errText);
      throw new Error('Failed to create image hotspot: ' + errText);
    }

    const data = await res.json();
    hotspots.push(data.hotspot);

    // Use the central addHotspotToKrpano which now handles image style properly
    addHotspotToKrpano(data.hotspot, null);

    document.getElementById('modal-select-image-asset').style.display = 'none';
    window._selectedImageAsset = null;
    _selectedImageAsset = null;

    renderHotspotList();
    publishTourSilent();
    showToast("✓ Image added to tour!");
  } catch(e) {
    console.error(e);
    showToast("Error adding image hotspot");
  }
}


function updatePopoverIconGrid() {
  const grid = document.getElementById('popover-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const defaults = [
    { name: 'Pole Pin', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 80" width="32" height="32"><g><line x1="20" y1="36" x2="20" y2="76" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round"/><circle cx="20" cy="76" r="3" fill="#ffffff"/><rect x="28" y="8" width="38" height="24" rx="5" fill="#d9f2fd" stroke="#b9e6fe" stroke-width="1.2"/><rect x="4" y="4" width="30" height="30" rx="7" fill="#00a6e0" stroke="#ffffff" stroke-width="1.8"/><text x="19" y="24" text-anchor="middle" fill="#ffffff" font-family="Outfit, sans-serif" font-weight="900" font-size="15">R</text></g></svg>` },
    { name: 'Arrow', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32"><circle cx="32" cy="32" r="28" fill="#10b981" stroke="#ffffff" stroke-width="4"/><path d="M24 20 L38 32 L24 44" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
    { name: 'Pin', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32"><path d="M32 4 C18.7 4 8 14.7 8 28 C8 45.3 32 60 32 60 C32 60 56 45.3 56 28 C56 14.7 45.3 4 32 4 Z" fill="#ef4444" stroke="#ffffff" stroke-width="4"/><circle cx="32" cy="24" r="10" fill="#ffffff"/></svg>` },
    { name: 'Dot', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32"><circle cx="32" cy="32" r="24" fill="#10b981" stroke="#ffffff" stroke-width="6"/><circle cx="32" cy="32" r="10" fill="#ffffff"/></svg>` },
    { name: 'Text', svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="32" height="32"><rect x="6" y="16" width="52" height="32" rx="6" fill="#10b981" stroke="#fff" stroke-width="3"/><text x="32" y="38" text-anchor="middle" fill="#000" font-family="Outfit, sans-serif" font-weight="900" font-size="14">TEXT</text></svg>` }
  ];

  defaults.forEach(item => {
    const el = document.createElement('div');
    el.className = 'icon-picker-item';
    el.innerHTML = `
      ${item.svg}
      <div style="font-size:11px; font-weight:700; color:#fff;">${item.name}</div>
    `;
    el.addEventListener('click', () => commitPopover(item.name));
    grid.appendChild(el);
  });

  getCustomIcons().forEach(icon => {
    const el = document.createElement('div');
    el.className = 'icon-picker-item';
    el.innerHTML = `
      <img src="${icon.dataUrl}" alt="${icon.name}" style="width:32px; height:32px; object-fit:contain;">
      <div style="font-size:11px; font-weight:700; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:70px;">${icon.name}</div>
    `;
    el.addEventListener('click', () => commitPopover(icon.name));
    grid.appendChild(el);
  });
}

// ==================== MEDIA LIBRARY RENDERERS ====================

function renderMediaScenes() {
  const grid = document.getElementById('media-scenes-grid');
  if (!grid) return;
  grid.innerHTML = '';

  scenes.forEach((scene, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.id = scene._id;
    card.draggable = true;

    card.ondragstart = (e) => {
      e.dataTransfer.setData('text/plain', scene._id);
      card.classList.add('dragging');
    };
    card.ondragend = (e) => {
      card.classList.remove('dragging');
      document.querySelectorAll('.image-card').forEach(c => c.classList.remove('drag-over'));
    };
    card.ondragover = (e) => {
      e.preventDefault();
    };
    card.ondragenter = (e) => {
      e.preventDefault();
      if (!card.classList.contains('dragging')) card.classList.add('drag-over');
    };
    card.ondragleave = (e) => {
      card.classList.remove('drag-over');
    };
    card.ondrop = (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('text/plain');
      if (draggedId && draggedId !== scene._id) {
        if (typeof reorderScene === 'function') reorderScene(draggedId, scene._id);
      }
    };

    const origBaseName = getOriginalBaseName(scene);
    const thumbUrl = `panos/${scene.tilesFolder || origBaseName + '.tiles'}/thumb.jpg?t=${scene._lastThumbUpdate || 1}`;

    card.innerHTML = `
      <div class="image-card-thumb-wrap">
        <img class="image-card-thumb" draggable="false" src="${thumbUrl}" alt="${scene.title}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231d1d26\\'/></svg>'">
        <div class="image-card-tags-overlay">
          ${scene.tags && scene.tags.length > 0
            ? scene.tags.map(t => `<span class="tag-chip" style="${getTagStyle(t)}">${t}</span>`).join('')
            : `<span class="image-card-badge" style="position:relative; top:0; left:0;">SCENE #${index + 1}</span>`
          }
        </div>
      </div>
      <div class="image-card-body">
        <div class="image-card-info">
          <div class="image-card-title" title="Double-click to edit: ${scene.title}" ondblclick="editSceneTitleFromMedia(event, '${scene._id}')">${scene.title}</div>
        </div>
        <div class="image-card-actions">
          <button class="card-action-btn edit" title="Edit Title" onclick="editSceneTitleFromMedia(event, '${scene._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-action-btn" title="Open in 3D Hotspot Editor" onclick="openSceneInHotspotEditor(event, '${scene._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path></svg>
          </button>
          <button class="card-action-btn delete" title="Delete Scene" onclick="deleteSceneFromMedia(event, '${scene._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    if (selectedMediaIds.has(scene._id)) {
      card.classList.add('selected');
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn') || e.target.closest('input')) return;
      toggleMediaSelectionOnClick(e, scene._id, 'scene');
    });

    grid.appendChild(card);
  });
}

function openSceneInHotspotEditor(e, sceneId) {
  if (e) e.stopPropagation();
  const scene = scenes.find(s => String(s._id) === String(sceneId));
  if (!scene) return;
  selectScene(scene);
  switchMainPage('hotspot');
  showToast(`Opened "${scene.title}" in 3D Hotspot Editor`);
}

async function deleteSceneFromMedia(e, sceneId) {
  if (e) e.stopPropagation();
  const sc = scenes.find(s => String(s._id) === String(sceneId));
  if (!sc) return;

  if (!confirm(`Are you sure you want to delete panorama "${sc.title}"?`)) return;

  try {
    const res = await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete scene');

    scenes = scenes.filter(s => String(s._id) !== String(sceneId));
    hotspots = hotspots.filter(h => String(h.sceneId) !== String(sceneId) && String(h.targetSceneId) !== String(sceneId));

    if (String(activeSceneId) === String(sceneId)) {
      activeSceneId = scenes.length > 0 ? scenes[0]._id : null;
      if (activeSceneId) selectScene(scenes[0]);
    }

    renderMediaScenes();
    renderScenes();
    renderCurrentSceneHotspots();
    updateBadges();
    publishTourSilent();
    showToast(`Deleted "${sc.title}"`);
  } catch (err) {
    console.error("Delete error:", err);
    showToast("Error deleting scene");
  }
}

async function editSceneTitleFromMedia(e, sceneId) {
  if (e) e.stopPropagation();
  const sc = scenes.find(s => String(s._id) === String(sceneId));
  if (!sc) return;

  const card = e ? e.currentTarget.closest('.image-card') : null;
  const titleEl = card ? card.querySelector('.image-card-title') : null;

  if (!titleEl) {
    const newTitle = prompt("Enter new title for image:", sc.title);
    if (newTitle !== null && newTitle.trim() !== "" && newTitle.trim() !== sc.title) {
      await saveSceneTitleFromMedia(sceneId, newTitle.trim());
    }
    return;
  }

  if (titleEl.querySelector('input')) return;

  const currentTitle = sc.title || '';
  const escapedTitle = String(currentTitle).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  titleEl.innerHTML = `<input type="text" class="inline-title-input" value="${escapedTitle}" style="width: 130px; background: #14141d; border: 1px solid #10b981; color: #fff; border-radius: 6px; padding: 4px 8px; font-size: 14px; font-weight: 700; outline: none; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);">`;

  const input = titleEl.querySelector('input');
  input.focus();
  input.select();

  let isSaving = false;
  const save = async () => {
    if (isSaving) return;
    isSaving = true;
    const val = input.value.trim();
    if (val && val !== currentTitle) {
      await saveSceneTitleFromMedia(sceneId, val);
    } else {
      titleEl.textContent = currentTitle;
      titleEl.title = `Double-click to edit: ${currentTitle}`;
    }
  };

  input.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      input.blur();
    } else if (evt.key === 'Escape') {
      isSaving = true;
      titleEl.textContent = currentTitle;
      titleEl.title = `Double-click to edit: ${currentTitle}`;
    }
    evt.stopPropagation();
  });

  input.addEventListener('click', (evt) => evt.stopPropagation());
  input.addEventListener('blur', () => {
    save();
  });
}

async function saveSceneTitleFromMedia(sceneId, newTitle) {
  const sc = scenes.find(s => String(s._id) === String(sceneId));
  if (!sc) return;

  try {
    const res = await fetch(`/api/scenes/${sceneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle })
    });
    if (!res.ok) throw new Error('Failed to save title');

    sc.title = newTitle;
    hotspots.forEach(h => {
      if (String(h.targetSceneId) === String(sc._id) && h.kind === 'scene') {
        h.title = newTitle;
      }
    });

    if (String(activeSceneId) === String(sceneId)) {
      const titleInput = document.getElementById('prop-pano-title');
      if (titleInput) titleInput.value = newTitle;
    }

    renderMediaScenes();
    renderScenes();
    renderCurrentSceneHotspots();
    updateBadges();
    publishTourSilent();
    showToast(`Updated title to "${newTitle}"`);
  } catch (err) {
    console.error("Save title error:", err);
    showToast("Error updating scene title");
  }
}

let currentMediaIconCategory = 'All';

function filterMediaIcons(category, btnEl) {
  currentMediaIconCategory = category;
  document.querySelectorAll('.media-icon-filter-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderMediaIcons();
}

function renderMediaIcons() {
  const grid = document.getElementById('media-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const libItems = window.ICON_LIBRARY_ITEMS || [];
  const customItems = getCustomIcons();

  let combined = [
    ...libItems.map(item => ({ ...item, isCustom: false })),
    ...customItems.map(c => ({ name: c.name, family: 'Custom', type: 'Custom', svg: `<img src="${c.dataUrl || c.url}" style="width:34px; height:34px; object-fit:contain;">`, isCustom: true, dataUrl: c.dataUrl || c.url, id: c.id }))
  ];

  if (currentMediaIconCategory !== 'All') {
    combined = combined.filter(item => String(item.family).toLowerCase() === String(currentMediaIconCategory).toLowerCase() || (currentMediaIconCategory === 'Custom' && item.isCustom));
  }

  if (combined.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px; font-size: 13px;">No icons found matching your filter.</div>`;
    return;
  }

  combined.forEach(icon => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    if (icon.isCustom) {
      card.innerHTML = `
        <button class="card-action-btn delete" title="Delete Custom Icon" onclick="deleteCustomIconAction(event, '${icon.id}')" style="position:absolute; top:6px; right:6px; width:22px; height:22px;">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <div class="icon-card-svg-wrap" style="overflow:hidden;">
          ${icon.svg}
        </div>
        <div class="icon-card-label" title="${icon.name}">${icon.name}</div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-action-btn')) return;
        showToast(`Selected custom icon: "${icon.name}" • Available in Hotspot Editor`);
      });
    } else {
      card.innerHTML = `
        <div class="icon-card-svg-wrap">
          ${icon.svg}
        </div>
        <div class="icon-card-label">${icon.name}</div>
      `;
      card.addEventListener('click', () => {
        showToast(`Selected icon style: "${icon.name}" • Available in Hotspot Editor`);
      });
    }
    grid.appendChild(card);
  });
}

function deleteCustomIconAction(e, iconId) {
  if (e) e.stopPropagation();
  removeCustomIcon(iconId);
  renderMediaIcons();
  updatePopoverIconGrid();
  showToast("Custom hotspot icon deleted");
}

function updateBadges() {
  const badgeMediaScene = document.getElementById('badge-scene-count');
  const badgeMediaIcon = document.getElementById('badge-icon-count');
  const badgeEditorScene = document.getElementById('editor-scene-count-badge');
  const badgeHotspot = document.getElementById('hotspot-count-badge');

  if (badgeMediaScene) badgeMediaScene.textContent = `${scenes.length} ${scenes.length === 1 ? 'Scene' : 'Scenes'}`;
  if (badgeEditorScene) badgeEditorScene.textContent = `${scenes.length}`;

  const customCount = getCustomIcons().length;
  if (badgeMediaIcon) badgeMediaIcon.textContent = `${4 + customCount} ${4 + customCount === 1 ? 'Icon' : 'Icons'}`;

  const currentHs = hotspots.filter(h => String(h.sceneId) === String(activeSceneId));
  if (badgeHotspot) {
    badgeHotspot.textContent = `${currentHs.length} ${currentHs.length === 1 ? 'HOTSPOT' : 'HOTSPOTS'}`;
  }
}

// ==================== UPLOAD MODALS LOGIC ====================

let selectedSceneUploadFiles = [];
let selectedIconUploadFile = null;

function openUploadSceneModal() {
  selectedSceneUploadFiles = [];
  const modal = document.getElementById('modal-upload-scene');
  const inputTitle = document.getElementById('upload-scene-title');
  const label = document.getElementById('scene-file-label');
  if (inputTitle) {
    inputTitle.value = '';
    inputTitle.parentElement.style.display = 'block';
  }
  if (label) label.textContent = 'Supports equirectangular JPEG, PNG, or TIFF';
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => inputTitle && inputTitle.focus(), 50);
  }
}

function closeUploadSceneModal() {
  const modal = document.getElementById('modal-upload-scene');
  if (modal) modal.style.display = 'none';
  selectedSceneUploadFiles = [];
}

function onSceneFileSelected(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;
  selectedSceneUploadFiles = Array.from(files);
  const label = document.getElementById('scene-file-label');
  const inputTitle = document.getElementById('upload-scene-title');

  if (selectedSceneUploadFiles.length === 1) {
    const file = selectedSceneUploadFiles[0];
    if (label) label.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024 / 1024 * 10) / 10} MB)`;
    if (inputTitle) {
      inputTitle.parentElement.style.display = 'block';
      if (!inputTitle.value.trim()) {
        const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        inputTitle.value = base.charAt(0).toUpperCase() + base.slice(1);
      }
    }
  } else {
    if (label) label.textContent = `Selected: ${selectedSceneUploadFiles.length} files`;
    if (inputTitle) {
      inputTitle.parentElement.style.display = 'none';
    }
  }
}

async function submitSceneUpload() {
  if (selectedSceneUploadFiles.length === 0) {
    showToast('Please select at least one 360 panoramic image file');
    return;
  }

  const titleInput = document.getElementById('upload-scene-title');
  const btn = document.getElementById('btn-submit-scene-upload');
  const origText = btn ? btn.textContent : '';
  if (btn) {
    btn.textContent = 'Uploading & Processing...';
    btn.disabled = true;
  }

  try {
    for (let i = 0; i < selectedSceneUploadFiles.length; i++) {
      const file = selectedSceneUploadFiles[i];
      let title = '';
      if (selectedSceneUploadFiles.length === 1) {
        title = titleInput ? titleInput.value.trim() : '';
        if (!title) title = file.name.replace(/\.[^/.]+$/, '');
      } else {
        const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        title = base.charAt(0).toUpperCase() + base.slice(1);
      }

      if (btn) {
        btn.textContent = `Processing ${i + 1} of ${selectedSceneUploadFiles.length}...`;
      }
      showToast(`Uploading ${i + 1} of ${selectedSceneUploadFiles.length}: ${title}...`);

      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);

      const res = await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/scenes/upload`, {
        method: 'POST',
        body: fd
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      scenes.push(data.scene);
    }

    closeUploadSceneModal();
    renderMediaScenes();
    renderScenes();
    updateBadges();
    publishTourSilent();

    showToast(`✓ Added ${selectedSceneUploadFiles.length} Panorama(s) successfully! Refreshing...`);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } catch (err) {
    console.error('Scene upload error:', err);
    showToast(`Error uploading scene: ${err.message}`);
  } finally {
    if (btn) {
      btn.textContent = origText;
      btn.disabled = false;
    }
  }
}

function openUploadIconModal() {
  selectedIconUploadFile = null;
  const modal = document.getElementById('modal-upload-icon');
  const nameInput = document.getElementById('upload-icon-name');
  const label = document.getElementById('icon-file-label');
  if (nameInput) nameInput.value = '';
  if (label) label.textContent = 'Recommended size: 64x64 or transparent SVG/PNG';
  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => nameInput && nameInput.focus(), 50);
  }
}

function closeUploadIconModal() {
  const modal = document.getElementById('modal-upload-icon');
  if (modal) modal.style.display = 'none';
  selectedIconUploadFile = null;
}

function onIconFileSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  selectedIconUploadFile = file;
  const label = document.getElementById('icon-file-label');
  const nameInput = document.getElementById('upload-icon-name');
  if (label) label.textContent = `Selected: ${file.name}`;

  if (nameInput && !nameInput.value.trim()) {
    const base = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    nameInput.value = base.charAt(0).toUpperCase() + base.slice(1);
  }
}

function submitIconUpload() {
  const nameInput = document.getElementById('upload-icon-name');
  const name = nameInput ? nameInput.value.trim() : '';

  if (!name) {
    showToast('Please enter an Icon Name');
    return;
  }
  if (!selectedIconUploadFile) {
    showToast('Please select an icon image file');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const iconObj = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name,
      dataUrl: dataUrl,
      createdAt: new Date().toISOString()
    };

    saveCustomIcon(iconObj);
    closeUploadIconModal();

    renderMediaIcons();
    updatePopoverIconGrid();
    updateBadges();

    showToast(`✓ Saved custom icon "${name}"! Available in Hotspot Editor`);
  };
  reader.readAsDataURL(selectedIconUploadFile);
}

// ==================== HOTSPOT EDITOR LOGIC (LEFT SIDEBAR PANORAMAS) ====================

function updatePanoTagFilterOptions() {
  const select = document.getElementById('pano-tag-filter');
  if (!select) return;
  const currentVal = select.value;
  
  const allTags = new Set();
  scenes.forEach(s => {
    if (Array.isArray(s.tags)) {
      s.tags.forEach(t => allTags.add(t));
    }
  });
  
  select.innerHTML = '<option value="">All Tags</option>';
  Array.from(allTags).sort().forEach(tag => {
    const opt = document.createElement('option');
    opt.value = tag;
    opt.textContent = tag;
    if (tag === currentVal) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderScenes() {
  const grid = document.getElementById('scenes-grid-editor');
  if (!grid) return;
  grid.innerHTML = '';
  
  updatePanoTagFilterOptions();
  const select = document.getElementById('pano-tag-filter');
  const filterVal = select ? select.value : '';

  scenes.forEach(scene => {
    if (filterVal && (!scene.tags || !scene.tags.includes(filterVal))) return;

    const card = document.createElement('div');
    card.className = `editor-scene-card ${String(scene._id) === String(activeSceneId) ? 'active' : ''}`;
    card.setAttribute('draggable', 'true');
    card.dataset.sceneId = scene._id;

    const origBaseName = getOriginalBaseName(scene);
    const thumbUrl = `panos/${scene.tilesFolder || origBaseName + '.tiles'}/thumb.jpg?t=${scene._lastThumbUpdate || 1}`;

    card.innerHTML = `
      <div class="editor-scene-thumb-wrap">
        <img class="editor-scene-thumb" src="${thumbUrl}" alt="thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\\'84\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%2327272a\\'/></svg>'">
      </div>
      <div class="editor-scene-name" title="${scene.title}">${scene.title}</div>
    `;

    card.addEventListener('click', () => {
      selectScene(scene);
    });

    card.addEventListener('dragstart', (e) => {
      draggedScene = scene;
      e.dataTransfer.setData('text/plain', JSON.stringify(scene));
      console.log("Started dragging scene for hotspot creation:", scene.title);
    });

    grid.appendChild(card);
  });
}

function selectScene(scene) {
  activeSceneId = scene._id;
  const krName = getSceneKrpanoName(scene);
  console.log("Selecting scene:", scene.title, "krpano name:", krName);

  if (krpano && typeof krpano.call === 'function') {
    krpano.call(`loadscene('${krName}', null, MERGE, BLEND(0.5))`);
    if (scene.hlookat !== undefined) {
      setTimeout(() => {
        krpano.set('view.hlookat', scene.hlookat || 0);
        krpano.set('view.vlookat', scene.vlookat || 0);
        krpano.set('view.fov', scene.fov || 120);
      }, 150);
    }
  }

  // Update Right Sidebar Property Editor for Panorama Image (keep panel hidden initially)
  selectedHotspotId = null;
  populatePanoPropertyEditor(scene);
  if (typeof closePropertyRightPanel === 'function') closePropertyRightPanel();

  renderScenes();
  renderCurrentSceneHotspots();
  updateBadges();

  setTimeout(() => renderCurrentSceneHotspots(), 150);
  setTimeout(() => renderCurrentSceneHotspots(), 600);
}

// ==================== RIGHT SIDEBAR: PANORAMA PROPERTY EDITOR & IMMEDIATE AUTO-SAVE ====================

function populatePanoPropertyEditor(scene) {
  const titleInput = document.getElementById('prop-pano-title');
  if (titleInput) {
    titleInput.value = scene.title || '';
  }
  const gpsInput = document.getElementById('prop-pano-gps');
  if (gpsInput) {
    if (scene.lat !== undefined && scene.lat !== null && scene.lng !== undefined && scene.lng !== null) {
      gpsInput.value = formatGPS(scene.lat, scene.lng);
    } else {
      gpsInput.value = '';
    }
  }

  const fovInput = document.getElementById('prop-pano-fov');
  if (fovInput) {
    fovInput.value = scene.fov !== undefined ? scene.fov : 114;
  }
  const minfovInput = document.getElementById('prop-pano-minfov');
  if (minfovInput) {
    minfovInput.value = scene.minfov !== undefined ? scene.minfov : 30;
  }
  const fovspeedInput = document.getElementById('prop-pano-fovspeed');
  if (fovspeedInput) {
    fovspeedInput.value = scene.fovspeed !== undefined ? scene.fovspeed : 50;
  }

  const openModeInput = document.getElementById('prop-pano-open-mode');
  const customPanel = document.getElementById('prop-pano-custom-view-panel');
  if (openModeInput) {
    openModeInput.value = scene.openPanoMode || 'start_point';
    if (customPanel) {
      customPanel.style.display = openModeInput.value === 'custom' ? 'block' : 'none';
    }
  }

  const customAthInput = document.getElementById('prop-pano-custom-ath');
  if (customAthInput) {
    customAthInput.value = scene.customAth !== undefined && scene.customAth !== null ? scene.customAth : 0;
  }
  const customAtvInput = document.getElementById('prop-pano-custom-atv');
  if (customAtvInput) {
    customAtvInput.value = scene.customAtv !== undefined && scene.customAtv !== null ? scene.customAtv : 0;
  }

  renderPanoTags(scene);
}

// 1. Auto-save Panorama Title
let _titleDebounceTimer = null;
function onPanoTitleInputDebounced() {
  if (_titleDebounceTimer) clearTimeout(_titleDebounceTimer);
  _titleDebounceTimer = setTimeout(async () => {
    if (!activeSceneId) return;
    const titleInput = document.getElementById('prop-pano-title');
    const newTitle = titleInput ? titleInput.value.trim() : '';
    if (!newTitle) return;

    const sc = scenes.find(s => String(s._id) === String(activeSceneId));
    if (!sc) return;

    try {
      const res = await fetch('/api/scenes/' + activeSceneId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (!res.ok) throw new Error('Failed to save title');

      sc.title = newTitle;
      hotspots.forEach(h => {
        if (String(h.targetSceneId) === String(sc._id) && h.kind === 'scene') {
          h.title = newTitle;
        }
      });

      renderScenes();
      renderMediaScenes();
      renderCurrentSceneHotspots();
      publishTourSilent();
      showToast(`✓ Auto-saved title: "${newTitle}"`);
    } catch (err) {
      console.error('Error saving panorama title:', err);
      showToast('Error saving title');
    }
  }, 350);
}

// 1.5 Auto-save Panorama Number Fields (FOV, FOVSPEED)
let _panoPropDebounceTimer = null;
function onPanoNumberInputDebounced(field, elementId) {
  if (_panoPropDebounceTimer) clearTimeout(_panoPropDebounceTimer);
  _panoPropDebounceTimer = setTimeout(async () => {
    if (!activeSceneId) return;
    const el = document.getElementById(elementId);
    if (!el) return;
    const val = Number(el.value);
    
    const sc = scenes.find(s => String(s._id) === String(activeSceneId));
    if (!sc) return;

    try {
      const res = await fetch('/api/scenes/' + activeSceneId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: val })
      });
      if (!res.ok) throw new Error('Failed to save ' + field);
      
      sc[field] = val;
      
      // Update krpano live view
      if (window.krpano) {
        if (field === 'fov') krpano.set('view.fov', val);
        if (field === 'minfov') krpano.set('view.minfov', val);
        if (field === 'fovspeed') krpano.set('view.fovspeed', val);
      }
      
      publishTourSilent();
      showToast(`✓ Auto-saved ${field}: ${val}`);
    } catch (err) {
      console.error(err);
      showToast(`Error saving ${field}`);
    }
  }, 500);
}

// 2. Auto-save Custom Thumbnail Image
let uploadingThumbSceneId = null;

function triggerThumbUpload(e, sceneId) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  uploadingThumbSceneId = sceneId || activeSceneId;
  const input = document.getElementById('thumb-upload-input');
  if (input) {
    input.value = '';
    input.click();
  }
}

function setupThumbUploadListener() {
  const input = document.getElementById('thumb-upload-input');
  if (input) {
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file || !uploadingThumbSceneId) return;

      const reader = new FileReader();
      reader.onload = async () => {
        const thumbBase64 = reader.result;
        try {
          const res = await fetch(`/api/scenes/${uploadingThumbSceneId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbBase64 })
          });
          if (!res.ok) throw new Error('Failed to save thumbnail image');
          const sc = scenes.find(s => String(s._id) === String(uploadingThumbSceneId));
          if (sc) sc._lastThumbUpdate = Date.now();
          renderScenes();
          renderMediaScenes();
          publishTourSilent();
          showToast('✓ Auto-saved custom thumbnail!');
        } catch (err) {
          console.error('Thumbnail upload error:', err);
          showToast('Error uploading thumbnail image');
        }
      };
      reader.readAsDataURL(file);
    });
  }
}

// ==================== OPEN PANO MODE ====================
async function onPanoModeChange() {
  if (!activeSceneId) return;
  const modeInput = document.getElementById('prop-pano-open-mode');
  const customPanel = document.getElementById('prop-pano-custom-view-panel');
  if (!modeInput || !customPanel) return;
  
  const newMode = modeInput.value;
  customPanel.style.display = newMode === 'custom' ? 'block' : 'none';

  const sc = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!sc) return;

  try {
    const res = await fetch('/api/scenes/' + activeSceneId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openPanoMode: newMode })
    });
    if (!res.ok) throw new Error('Failed to save pano mode');
    sc.openPanoMode = newMode;
    publishTourSilent();
  } catch (err) {
    console.error(err);
    showToast('Error saving Open Pano setting');
  }
}

let _panoCustomDebounceTimer = null;
function onPanoCustomPositionChange() {
  if (_panoCustomDebounceTimer) clearTimeout(_panoCustomDebounceTimer);
  _panoCustomDebounceTimer = setTimeout(async () => {
    if (!activeSceneId) return;
    const athInput = document.getElementById('prop-pano-custom-ath');
    const atvInput = document.getElementById('prop-pano-custom-atv');
    if (!athInput || !atvInput) return;

    const customAth = athInput.value === '' ? null : Number(athInput.value);
    const customAtv = atvInput.value === '' ? null : Number(atvInput.value);

    const sc = scenes.find(s => String(s._id) === String(activeSceneId));
    if (!sc) return;

    try {
      const res = await fetch('/api/scenes/' + activeSceneId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customAth, customAtv })
      });
      if (!res.ok) throw new Error('Failed to save custom position');
      sc.customAth = customAth;
      sc.customAtv = customAtv;
      publishTourSilent();
    } catch (err) {
      console.error(err);
      showToast('Error saving Custom Position');
    }
  }, 1000);
}

function capturePanoCustomPosition() {
  if (!activeSceneId) return;
  const krpano = document.getElementById("krpanoSWFObject");
  if (!krpano || !krpano.get) return;
  
  const hlookat = Number(krpano.get("view.hlookat")).toFixed(2);
  const vlookat = Number(krpano.get("view.vlookat")).toFixed(2);

  const athInput = document.getElementById('prop-pano-custom-ath');
  const atvInput = document.getElementById('prop-pano-custom-atv');
  if (athInput) athInput.value = hlookat;
  if (atvInput) atvInput.value = vlookat;
  
  onPanoCustomPositionChange(); // triggers auto-save immediately via debounce
  showToast('✓ Custom view position captured!');
}

// ==================== GPS UTILS ====================
function formatGPS(lat, lng) {
  function toDMS(val, isLat) {
    const dir = val >= 0 ? (isLat ? 'N' : 'E') : (isLat ? 'S' : 'W');
    const absVal = Math.abs(val);
    const deg = Math.floor(absVal);
    const minFloat = (absVal - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(2);
    return `${deg} deg ${min}' ${sec}" ${dir}`;
  }
  return `${toDMS(lat, true)}, ${toDMS(lng, false)}`;
}

function parseGPS(gpsStr) {
  const str = gpsStr.trim();
  
  // Try DMS format
  const dmsRegex = /(\d+)\s*(?:deg|°)\s*(\d+)'\s*([\d.]+)"\s*([NSEW])/gi;
  const matches = [...str.matchAll(dmsRegex)];
  if (matches.length === 2) {
    const fromDMS = (m) => {
      let val = parseInt(m[1], 10) + (parseInt(m[2], 10) / 60) + (parseFloat(m[3]) / 3600);
      let dir = m[4].toUpperCase();
      if (dir === 'S' || dir === 'W') val = -val;
      return { val, dir };
    };
    const p1 = fromDMS(matches[0]);
    const p2 = fromDMS(matches[1]);
    
    let lat = null, lng = null;
    if (p1.dir === 'N' || p1.dir === 'S') { lat = p1.val; lng = p2.val; }
    else { lng = p1.val; lat = p2.val; }
    return { lat, lng };
  }

  // Fallback to basic decimal
  const parts = str.split(/[, ]+/).filter(Boolean);
  if (parts.length >= 2) {
    const lat = Number(parts[0]);
    const lng = Number(parts[1]);
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  
  return null;
}

async function savePanoGPS() {
  if (!activeSceneId) return;
  const gpsInput = document.getElementById('prop-pano-gps');
  if (!gpsInput) return;

  const gpsVal = gpsInput.value.trim();
  let lat = null, lng = null;

  if (gpsVal !== '') {
    const parsed = parseGPS(gpsVal);
    if (parsed) {
      lat = parsed.lat;
      lng = parsed.lng;
    } else {
      showToast("Invalid GPS format. Use '21 deg 8\\' 51.80\" N, 72 deg 46\\' 20.20\" E' or decimal.");
      return;
    }
  }

  const sc = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!sc) return;

  try {
    const res = await fetch('/api/scenes/' + activeSceneId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat: lat === null ? '' : lat, lng: lng === null ? '' : lng })
    });
    if (!res.ok) throw new Error('Failed to save GPS data');

    sc.lat = lat;
    sc.lng = lng;
    if (gpsVal !== '') {
      gpsInput.value = formatGPS(lat, lng);
    }
    showToast("GPS coordinates saved!");
  } catch (err) {
    console.error("Error saving GPS data:", err);
    showToast("Error saving GPS coordinates");
  }
}

// 3. Auto-save Initial View Angle & Thumbnail
async function setInitialViewAngle(e) {
  if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
  if (!activeSceneId || !krpano) return;
  const scene = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!scene) return;

  const hlookat = Number(krpano.get('view.hlookat') || 0).toFixed(2);
  const vlookat = Number(krpano.get('view.vlookat') || 0).toFixed(2);
  const fov = Number(krpano.get('view.fov') || 120).toFixed(2);

  let thumbBase64 = null;
  try {
    const canvas = document.querySelector('#pano canvas') || document.querySelector('canvas');
    if (canvas) {
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 300;
      thumbCanvas.height = 150;
      const ctx = thumbCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, 0, 300, 150);
      thumbBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85);
    }
  } catch (err) {
    console.log("Canvas thumbnail capture skipped:", err);
  }

  try {
    const res = await fetch(`/api/scenes/${activeSceneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hlookat, vlookat, fov, thumbBase64 })
    });
    if (!res.ok) throw new Error('Failed to update scene view');

    scene.hlookat = Number(hlookat);
    scene.vlookat = Number(vlookat);
    scene.fov = Number(fov);
    scene._lastThumbUpdate = Date.now();

    renderScenes();
    renderMediaScenes();
    publishTourSilent();
    showToast(`✓ Auto-saved initial view (H: ${hlookat}°, V: ${vlookat}°)`);
  } catch (err) {
    console.error('Error saving initial view:', err);
    showToast('Error saving initial view angle');
  }
}

// 4. Auto-save Tags Field
function focusTagInput() {
  const input = document.getElementById('prop-pano-tag-input');
  if (input) input.focus();
}

function renderPanoTags(scene) {
  const listEl = document.getElementById('pano-tags-list');
  const inputEl = document.getElementById('prop-pano-tag-input');
  if (!listEl) return;
  listEl.innerHTML = '';

  const tags = Array.isArray(scene.tags) ? scene.tags : [];
  
  if (tags.length > 0) {
    listEl.style.width = '100%';
  } else {
    listEl.style.width = 'auto';
  }

  tags.forEach((tag, idx) => {
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.style.width = '100%';
    chip.style.justifyContent = 'space-between';
    chip.style.padding = '8px 12px';
    chip.style.background = 'transparent';
    chip.style.border = 'none';
    
    const delSvg = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
    
    chip.innerHTML = `
      <span style="font-size: 14px;">${tag}</span>
      <span class="tag-chip-remove" onclick="removePanoTag(event, ${idx})" title="Remove tag" style="display:flex; align-items:center;">${delSvg}</span>
    `;
    listEl.appendChild(chip);
  });

  if (inputEl) {
    if (tags.length > 0) {
      inputEl.style.display = 'none';
    } else {
      inputEl.style.display = '';
    }
  }
}

async function onTagInputKeyDown(event) {
  if (event.key === 'Enter' || event.key === ',') {
    event.preventDefault();
    if (!activeSceneId) return;
    const scene = scenes.find(s => String(s._id) === String(activeSceneId));
    if (!scene) return;

    const input = document.getElementById('prop-pano-tag-input');
    const val = input ? input.value.trim().replace(/^#/, '') : '';
    if (!val) return;

    if (!Array.isArray(scene.tags)) scene.tags = [];
    if (!scene.tags.includes(val)) {
      scene.tags.push(val);
    }
    input.value = '';
    renderPanoTags(scene);

    try {
      const res = await fetch(`/api/scenes/${activeSceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: scene.tags })
      });
      if (!res.ok) throw new Error('Failed to save tag');
      publishTourSilent();
      showToast(`✓ Auto-saved tag "#${val}"`);
    } catch (err) {
      console.error('Error saving tag:', err);
      showToast('Error saving tag');
    }
  }
}

async function removePanoTag(e, idx) {
  if (e) e.stopPropagation();
  if (!activeSceneId) return;
  const scene = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!scene || !Array.isArray(scene.tags)) return;

  const removed = scene.tags[idx];
  scene.tags.splice(idx, 1);
  renderPanoTags(scene);

  try {
    const res = await fetch(`/api/scenes/${activeSceneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: scene.tags })
    });
    if (!res.ok) throw new Error('Failed to remove tag');
    publishTourSilent();
    showToast(`✓ Removed tag "#${removed}"`);
  } catch (err) {
    console.error('Error removing tag:', err);
    showToast('Error removing tag');
  }
}



// Remove all CMS hotspots (names starting with hs_) currently in krpano
function clearAllKrpanoHotspots() {
  if (!krpano) return;
  try {
    const count = Number(krpano.get("hotspot.count") || 0);
    const toRemove = [];
    for (let i = 0; i < count; i++) {
      const name = krpano.get(`hotspot[${i}].name`);
      if (name && String(name).startsWith("hs_")) {
        toRemove.push(name);
      }
    }
    toRemove.forEach(name => {
      if (typeof krpano.removehotspot === "function") {
        krpano.removehotspot(name);
      } else {
        krpano.call(`removehotspot('${name}')`);
      }
    });
  } catch (e) {
    console.warn("Error clearing krpano hotspots:", e);
  }
}

// Render hotspots in Right HOTSPOTS Sidebar and inject into krpano
function renderCurrentSceneHotspots() {
  clearAllKrpanoHotspots();

  const currentHs = hotspots.filter(h => String(h.sceneId) === String(activeSceneId));
  updateBadges();

  currentHs.forEach(h => {
    const targetScene = scenes.find(s => String(s._id) === String(h.targetSceneId));
    addHotspotToKrpano(h, targetScene);
  });
  
  if (typeof renderHotspotList === 'function') {
    renderHotspotList();
  }
}

// Drag & drop onto pano
function setupDragAndDrop() {
  const container = document.getElementById('pano-container');
  const ghost = document.getElementById('drag-ghost');
  const ghostText = document.getElementById('ghost-text');
  if (!container || !ghost) return;

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';

    if (draggedScene) {
      ghostText.textContent = `Add Hotspot: ${draggedScene.title}`;
      ghost.style.display = 'flex';
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      ghost.style.left = `${x}px`;
      ghost.style.top = `${y - 30}px`;
    }
  });

  container.addEventListener('dragleave', () => {
    ghost.style.display = 'none';
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    ghost.style.display = 'none';

    if (!draggedScene || !krpano || !activeSceneId) return;

    if (String(draggedScene._id) === String(activeSceneId)) {
      showToast("Cannot add a hotspot to the same scene!");
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const sp = krpano.screentosphere(x, y);
    const ath = Number(Number(sp ? sp.x : 0).toFixed(2));
    const atv = Number(Number(sp ? sp.y : 0).toFixed(2));

    console.log("screentosphere drop coordinates:", { x, y, ath, atv });
    pendingDrop = { x, y, ath, atv, targetScene: draggedScene };
    openIconLibraryModal('drop');
  });
}

function openPopover(x, y, ath, atv, targetScene) {
  pendingDrop = { x, y, ath, atv, targetScene };

  const popover = document.getElementById('hotspot-popover');
  const titleEl = popover.querySelector('.popover-title');
  if (titleEl) titleEl.textContent = `Add Hotspot to "${targetScene.title}"`;

  const containerRect = document.getElementById('pano-container').getBoundingClientRect();
  let left = x;
  let top = y + 10;
  if (left + 280 > containerRect.width) left = Math.max(10, containerRect.width - 290);
  if (top + 220 > containerRect.height) top = Math.max(10, y - 230);

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.display = 'flex';
}

function setupPopoverListeners() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopover();
      closeAddTextModal();
      closeUploadSceneModal();
      closeUploadIconModal();
      closeIconLibraryModal();
      closeReturnHotspotModal();
    }
  });

  document.addEventListener('click', (e) => {
    const popover = document.getElementById('hotspot-popover');
    const isPopover = e.target.closest('#hotspot-popover');
    const isSceneCard = e.target.closest('.editor-scene-card');
    const isImgBtn = e.target.closest('#tool-btn-image');
    if (popover && popover.style.display === 'flex' && !isPopover && !isSceneCard && !isImgBtn) {
      closePopover();
    }
  });

  const addTextInput = document.getElementById('add-text-input');
  if (addTextInput) {
    addTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitAddText();
    });
  }
}

function closePopover() {
  const popover = document.getElementById('hotspot-popover');
  if (popover) popover.style.display = 'none';
  pendingDrop = null;
}

// Open modal for [ T ] toolbar button
function openAddTextModal() {
  const modal = document.getElementById('text-hotspot-modal');
  const input = document.getElementById('add-text-input');
  if (!modal) return;
  modal.style.display = 'flex';
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
}

function closeAddTextModal() {
  const modal = document.getElementById('text-hotspot-modal');
  if (modal) modal.style.display = 'none';
}

// Commit standalone text hotspot
async function commitAddText() {
  const input = document.getElementById('add-text-input');
  const textStr = (input && input.value ? input.value.trim() : '') || 'NEW TEXT';
  closeAddTextModal();

  if (!activeSceneId || !krpano) return;

  const ath = Number(Number(krpano.get('view.hlookat') || 0).toFixed(2));
  const atv = Number(Number(krpano.get('view.vlookat') || 0).toFixed(2));

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: textStr,
        kind: 'info',
        info: textStr,
        targetSceneId: activeSceneId,
        ath,
        atv,
        style: 'Text',
        textProps: { sticker: true }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create text hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    console.log("Text hotspot created successfully:", newHotspot);

    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    window._lastHotspotClickTime = Date.now();
    selectHotspot(newHotspot._id);
    publishTourSilent();
    showToast(`✓ Auto-saved text label "${textStr}"`);
  } catch (err) {
    console.error("Error creating text hotspot:", err);
    showToast(`Error: ${err.message}`);
  }
}

// On commit (selecting icon style from popover)
async function commitPopover(chosenStyle) {
  if (!pendingDrop) return;

  const { ath, atv, targetScene } = pendingDrop;
  const isPole = String(chosenStyle).toLowerCase() === 'pole pin' || String(chosenStyle).toLowerCase() === 'landmark pin' || String(chosenStyle).toLowerCase() === 'pole_pin' || String(chosenStyle).toLowerCase() === 'landmark';
  const returnCb = document.getElementById('popover-return-cb');
  const returnChecked = !isPole && (returnCb ? returnCb.checked : true);
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));

  closePopover();

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: isPole ? 'Prince Palace' : (targetScene ? targetScene.title : 'Hotspot'),
        kind: isPole ? 'image' : 'scene',
        targetSceneId: isPole ? null : (targetScene ? targetScene._id : null),
        ath,
        atv,
        style: chosenStyle,
        badgeLetter: isPole ? 'R' : '',
        color: isPole ? '#00a6e0' : '#ffffff'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);

    addHotspotToKrpano(newHotspot, targetScene);
    renderCurrentSceneHotspots();
    window._lastHotspotClickTime = Date.now();
    if (isPole) {
      selectImageHotspot(newHotspot._id);
    } else {
      selectHotspot(newHotspot._id);
    }
    publishTourSilent();

    if (returnChecked && currentScene && !isPole && targetScene) {
      openReturnHotspotModal(targetScene, currentScene, chosenStyle);
    } else {
      showToast(isPole ? "✓ Pole Pin added to scene!" : "✓ Hotspot created successfully!");
    }
  } catch (err) {
    console.error("Error creating hotspot:", err);
    showToast(`Error: ${err.message}`);
  }
}

// Add hotspot to krpano immediately and visibly
function addHotspotToKrpano(hotspot, targetScene) {
  if (!krpano) return;
  if (!targetScene) {
    targetScene = scenes.find(s => String(s._id) === String(hotspot.targetSceneId));
  }
  const name = "hs_" + hotspot._id;
  const styleName = hotspot.style || "Arrow";
  const svgBase64 = getHotspotSvgBase64(styleName, hotspot.title, hotspot.color, hotspot.bgColor, hotspot.textStyle, hotspot.badgeLetter);

  krpano.call(`addhotspot(${name})`);
  krpano.set(`hotspot[${name}].url`, svgBase64);
  krpano.set(`hotspot[${name}].ath`, Number(hotspot.ath));
  krpano.set(`hotspot[${name}].atv`, Number(hotspot.atv));
  if (hotspot.width) krpano.set(`hotspot[${name}].width`, String(hotspot.width));
  if (hotspot.height) krpano.set(`hotspot[${name}].height`, String(hotspot.height));
  krpano.set(`hotspot[${name}].scale`, hotspot.scale !== undefined ? Number(hotspot.scale) : 0.85);
  krpano.set(`hotspot[${name}].alpha`, 1.0);
  krpano.set(`hotspot[${name}].visible`, true);
  krpano.set(`hotspot[${name}].zorder`, 100);
  krpano.set(`hotspot[${name}].enabled`, true);
  krpano.set(`hotspot[${name}].capture`, true);
  krpano.set(`hotspot[${name}].onclick`, `js(onHotspotClicked(${name}))`);

  const isPole = String(styleName).toLowerCase().includes('residential') || String(styleName).toLowerCase().includes('commercial') || String(styleName).toLowerCase() === 'pole pin' || String(styleName).toLowerCase() === 'landmark pin' || String(styleName).toLowerCase() === 'pole_pin' || String(styleName).toLowerCase() === 'landmark';
  if (isPole) {
    krpano.set(`hotspot[${name}].edge`, 'bottomleft');
    krpano.set(`hotspot[${name}].ox`, -22);
    krpano.set(`hotspot[${name}].oy`, 0);
  } else {
    krpano.set(`hotspot[${name}].edge`, 'center');
    krpano.set(`hotspot[${name}].ox`, 0);
    krpano.set(`hotspot[${name}].oy`, 0);
  }

  const isGif = String(styleName).toLowerCase().includes('.gif') || String(styleName).toLowerCase().includes('gif') || String(svgBase64).startsWith('data:image/gif') || String(svgBase64).toLowerCase().includes('.gif') || (hotspot.style && String(hotspot.style).toLowerCase().includes('.gif'));

  if (isGif) {
    const gifSrc = svgBase64;
    krpano.set(`hotspot[${name}].type`, 'text');
    krpano.set(`hotspot[${name}].html`, `<img src="${gifSrc}" style="width:100%; height:100%; object-fit:contain; pointer-events:none; display:block;" />`);
    krpano.set(`hotspot[${name}].bg`, false);
    krpano.set(`hotspot[${name}].bgalpha`, 0.0);
    krpano.set(`hotspot[${name}].bgborder`, '0 0x000000 0');
    krpano.set(`hotspot[${name}].padding`, 0);
    krpano.set(`hotspot[${name}].renderer`, 'css3d');
    krpano.set(`hotspot[${name}].distorted`, false);
    krpano.set(`hotspot[${name}].width`, hotspot.width || 130);
    krpano.set(`hotspot[${name}].height`, hotspot.height || 130);
    krpano.set(`hotspot[${name}].zoom`, false);
    krpano.set(`hotspot[${name}].ondown`, hotspot.locked ? '' : 'draghotspot()');
    return;
  }

  const isRasterImg = hotspot.style && (String(hotspot.style).startsWith('assets/') || String(hotspot.style).startsWith('http') || (String(hotspot.style).startsWith('data:image/') && !isPole));

  if (isRasterImg) {
    // Render as an actual raster image overlay in the panorama
    krpano.set(`hotspot[${name}].type`, 'image');
    krpano.set(`hotspot[${name}].url`, hotspot.style);
    krpano.set(`hotspot[${name}].width`, hotspot.width || 150);
    krpano.set(`hotspot[${name}].height`, hotspot.height || 150);
    krpano.set(`hotspot[${name}].zoom`, false);
    krpano.set(`hotspot[${name}].ondown`, hotspot.locked ? '' : 'draghotspot()');
    return;
  }

  if (isTextHotspot(hotspot)) {
    krpano.set(`hotspot[${name}].type`, 'text');
    krpano.set(`hotspot[${name}].html`, hotspot.title || 'TEXT');
    
    const tp = hotspot.textProps || {};
    const isSticker = tp.sticker !== undefined ? tp.sticker : false;
    const isRollover = tp.rollover !== undefined ? tp.rollover : false;
    
    krpano.set(`hotspot[${name}].distorted`, isSticker);
    krpano.set(`hotspot[${name}].alpha`, isRollover ? 0 : (tp.opacity !== undefined ? tp.opacity : 1));
    if (isRollover) {
      krpano.set(`hotspot[${name}].onover`, `tween(alpha, ${tp.opacity !== undefined ? tp.opacity : 1})`);
      krpano.set(`hotspot[${name}].onout`, 'tween(alpha, 0)');
    } else {
      krpano.set(`hotspot[${name}].onover`, '');
      krpano.set(`hotspot[${name}].onout`, '');
    }

    const bgAlpha = tp.bgOpacity !== undefined ? tp.bgOpacity : 0.27;
    krpano.set(`hotspot[${name}].bgcolor`, tp.bgColor ? tp.bgColor.replace('#', '0x') : '0x000000');
    krpano.set(`hotspot[${name}].bgalpha`, bgAlpha);

    const borderSize = tp.borderSize !== undefined ? tp.borderSize : 0;
    const borderColor = tp.borderColor ? tp.borderColor.replace('#', '0x') : '0x000000';
    const borderAlpha = tp.borderOpacity !== undefined ? tp.borderOpacity : 0.00;
    krpano.set(`hotspot[${name}].bgborder`, `${borderSize} ${borderColor} ${borderAlpha}`);
    
    krpano.set(`hotspot[${name}].bgroundedge`, tp.borderRadius !== undefined ? tp.borderRadius : 0);

    const shadowColor = tp.shadowColor ? tp.shadowColor.replace('#', '0x') : '0xFF0000';
    const shadowAlpha = tp.shadowOpacity !== undefined ? tp.shadowOpacity : 0.00;
    
    if (bgAlpha > 0) {
      krpano.set(`hotspot[${name}].bgshadow`, `2 2 4 ${shadowColor} ${shadowAlpha}`);
      krpano.set(`hotspot[${name}].txtshadow`, '');
    } else {
      krpano.set(`hotspot[${name}].txtshadow`, `2 2 4 ${shadowColor} ${shadowAlpha}`);
      krpano.set(`hotspot[${name}].bgshadow`, '');
    }

    const font = tp.font || 'Arial';
    const fontSize = tp.fontSize || 13;
    const color = tp.color || '#FFFFFF';
    const fw = tp.bold ? 'bold' : 'normal';
    const fs = tp.italic ? 'italic' : 'normal';
    const td = tp.underline ? 'underline' : 'none';
    
    krpano.set(`hotspot[${name}].css`, `font-family:${font}; font-size:${fontSize}px; color:${color}; font-weight:${fw}; font-style:${fs}; text-decoration:${td}; text-align:center;`);
    
    krpano.set(`hotspot[${name}].padding`, '4 8');
  } else {
    krpano.set(`hotspot[${name}].url`, svgBase64);
  }

  krpano.set(`hotspot[${name}].ondown`, hotspot.locked ? '' : 'draghotspot()');
}

// Hotspot single-click & double-click handler
let _lastClickTime = 0;
let _lastClickedId = null;
let _isRepositioning = false;

window.onHotspotClicked = function (hotspotId) {
  const cleanId = String(hotspotId || '').replace(/^hs_/, '');
  const now = Date.now();
  window._lastHotspotClickTime = now;

  if (_isRepositioning) return;

  // Check for Double Click within 380ms
  if (_lastClickedId === cleanId && (now - _lastClickTime < 380)) {
    _lastClickedId = null;
    _lastClickTime = 0;
    startHotspotReposition(cleanId);
    return;
  }

  _lastClickedId = cleanId;
  _lastClickTime = now;

  // Execute single-click selection immediately without moving pin
  executeHotspotSelection(cleanId);
};

function executeHotspotSelection(hotspotId) {
  const cleanId = String(hotspotId || '').replace(/^hs_/, '');
  console.log("Hotspot selected:", cleanId);
  const hs = hotspots.find(h => String(h._id) === cleanId || String(h._id) === String(hotspotId));
  if (hs) {
    showToast(`Selected: "${hs.title || 'Hotspot'}"`);
    if (isImageHotspot(hs)) {
      showTabOnly('image');
      currentHotspotFilter = 'image';
      selectImageHotspot(hs._id);
    } else if (isTextHotspot(hs)) {
      showTabOnly('text');
      currentHotspotFilter = 'text';
      selectTextHotspot(hs._id);
    } else {
      showTabOnly('hotspot');
      currentHotspotFilter = 'hotspot';
      selectHotspot(hs._id);
    }
    renderHotspotList();
  }
}

// Reposition pin on double-click
function startHotspotReposition(hotspotId) {
  const cleanId = String(hotspotId || '').replace(/^hs_/, '');
  const hs = hotspots.find(h => String(h._id) === cleanId || String(h._id) === String(hotspotId));
  if (!hs || hs.locked) return;

  _isRepositioning = true;
  executeHotspotSelection(cleanId);

  const name = "hs_" + cleanId;
  showToast("📌 Move cursor to new location and click to place pin");

  const panoContainer = document.getElementById('pano-container');
  if (panoContainer) panoContainer.style.cursor = 'crosshair';

  if (krpano) {
    krpano.set('reposition_active', true);
    krpano.set('active_drag_hs', name);
    krpano.call(`
      asyncloop(reposition_active,
        screentosphere(mouse.stagex, mouse.stagey, cur_ath, cur_atv);
        set(hotspot[get(active_drag_hs)].ath, get(cur_ath));
        set(hotspot[get(active_drag_hs)].atv, get(cur_atv));
      );
    `);
  }

  const onPlaceDrop = function (e) {
    e.stopPropagation();
    e.preventDefault();
    if (panoContainer) {
      panoContainer.removeEventListener('click', onPlaceDrop, true);
      panoContainer.style.cursor = '';
    }
    
    if (krpano) {
      krpano.set('reposition_active', false);
      const newAth = Number(krpano.get(`hotspot[${name}].ath`)).toFixed(2);
      const newAtv = Number(krpano.get(`hotspot[${name}].atv`)).toFixed(2);
      window.onHotspotDragEnd(name, newAth, newAtv);
    }
    
    setTimeout(() => {
      _isRepositioning = false;
    }, 200);
  };

  setTimeout(() => {
    if (panoContainer) {
      panoContainer.addEventListener('click', onPlaceDrop, { capture: true, once: true });
    }
  }, 250);
}

function setupPanoBackgroundClickListener() {
  const panoContainer = document.getElementById('pano-container');
  if (panoContainer) {
    panoContainer.addEventListener('click', (e) => {
      window.onPanoBackgroundClicked();
    });
  }
}

window.onPanoBackgroundClicked = function () {
  setTimeout(() => {
    // If a hotspot was clicked within the last 250ms, do not close the right panel!
    if (window._lastHotspotClickTime && (Date.now() - window._lastHotspotClickTime < 250)) {
      return;
    }
    // Otherwise, this click was on the krpano panorama background -> close right panel
    closePropertyRightPanel();
  }, 50);
};

window.openPropertyRightPanel = function (tab = null) {
  const rightPanel = document.getElementById('editor-sidebar-right');
  if (rightPanel) {
    rightPanel.style.display = 'flex';
  }
  if (tab) {
    switchPropertyPanel(tab);
  }
};

window.closePropertyRightPanel = function () {
  const rightPanel = document.getElementById('editor-sidebar-right');
  if (rightPanel) {
    rightPanel.style.display = 'flex';
  }
  const textPanel = document.getElementById('panel-text-properties');
  const isTextPanelVisible = textPanel && textPanel.style.display !== 'none';

  selectedHotspotId = null;
  selectedTextHotspotId = null;
  if (isTextPanelVisible) {
    renderEmptyTextPanel();
  } else {
    renderEmptyHotspotPanel();
  }
  renderCurrentSceneHotspots();
};

// Helper to switch property tab UI without recursion
function showTabOnly(panel) {
  const rightPanel = document.getElementById('editor-sidebar-right');
  if (rightPanel && rightPanel.style.display === 'none') {
    rightPanel.style.display = 'flex';
  }
  const btnPano = document.getElementById('prop-tab-pano');
  const btnHotspot = document.getElementById('prop-tab-hotspot');
  const btnText = document.getElementById('prop-tab-text');
  const btnImg = document.getElementById('prop-tab-image');

  const panelPano = document.getElementById('panel-pano-properties');
  const panelHotspot = document.getElementById('panel-hotspot-properties');
  const panelText = document.getElementById('panel-text-properties');
  const hsListGroup = document.getElementById('prop-hs-list-group');

  if (btnPano) btnPano.classList.remove('active');
  if (btnHotspot) btnHotspot.classList.remove('active');
  if (btnText) btnText.classList.remove('active');
  if (btnImg) btnImg.classList.remove('active');

  if (panelPano) panelPano.style.display = 'none';
  if (panelHotspot) panelHotspot.style.display = 'none';
  if (panelText) panelText.style.display = 'none';
  if (hsListGroup) hsListGroup.style.display = 'none';

  if (panel === 'pano') {
    if (btnPano) btnPano.classList.add('active');
    if (panelPano) panelPano.style.display = 'flex';
  } else if (panel === 'hotspot') {
    if (btnHotspot) btnHotspot.classList.add('active');
    if (panelHotspot) panelHotspot.style.display = 'flex';
    if (hsListGroup) hsListGroup.style.display = 'flex';
  } else if (panel === 'text') {
    if (btnText) btnText.classList.add('active');
    if (panelText) panelText.style.display = 'flex';
    if (hsListGroup) hsListGroup.style.display = 'flex';
  } else if (panel === 'image') {
    if (btnImg) btnImg.classList.add('active');
    if (panelHotspot) panelHotspot.style.display = 'flex';
    if (hsListGroup) hsListGroup.style.display = 'flex';
  }
}

let currentHotspotFilter = 'hotspot'; // 'hotspot' | 'text' | 'image'

window.setHotspotFilter = function(type) {
  currentHotspotFilter = type;
  showTabOnly(type);

  const sceneHs = hotspots.filter(h => String(h.sceneId) === String(activeSceneId));
  let filtered = [];
  if (type === 'text') {
    filtered = sceneHs.filter(h => isTextHotspot(h));
  } else if (type === 'image') {
    filtered = sceneHs.filter(h => isImageHotspot(h));
  } else {
    filtered = sceneHs.filter(h => isNavHotspot(h));
  }

  const matchingSelected = selectedHotspotId && filtered.find(h => String(h._id) === String(selectedHotspotId));
  if (matchingSelected) {
    if (type === 'image') selectImageHotspot(matchingSelected._id);
    else if (type === 'text') selectTextHotspot(matchingSelected._id);
    else selectHotspot(matchingSelected._id);
  } else if (filtered.length > 0) {
    const first = filtered[0];
    if (type === 'image') selectImageHotspot(first._id);
    else if (type === 'text') selectTextHotspot(first._id);
    else selectHotspot(first._id);
  } else {
    selectedHotspotId = null;
    if (type === 'text') {
      renderEmptyTextPanel();
    } else {
      renderEmptyHotspotPanel();
    }
  }

  renderHotspotList();
};

// Switch Property Editor between Panorama, Hotspot, Text, Image tabs
function switchPropertyPanel(panel) {
  if (panel === 'pano') {
    showTabOnly('pano');
  } else {
    setHotspotFilter(panel);
  }
}

// Toggle hotspot list visibility
function toggleHotspotList() {
  const container = document.getElementById('prop-hs-list-container');
  const icon = document.getElementById('hs-list-toggle-icon');
  if (!container) return;
  if (container.style.display === 'none') {
    container.style.display = 'flex';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    container.style.display = 'none';
    if (icon) icon.style.transform = 'rotate(-90deg)';
  }
}

// Toggle lock state of a hotspot
async function toggleHotspotLock(hotspotId) {
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;
  
  const isCurrentlyLocked = (hs.locked === true || hs.locked === 'true');
  const newLockedState = !isCurrentlyLocked;
  
  try {
    const res = await fetch(`/api/hotspots/${hotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: newLockedState })
    });
    
    if (res.ok) {
      hs.locked = newLockedState;
      if (typeof renderHotspotList === 'function') renderHotspotList();
      if (String(selectedHotspotId) === String(hotspotId)) {
        const hs2 = hotspots.find(h => String(h._id) === String(hotspotId));
        if (isImageHotspot(hs2)) selectImageHotspot(hotspotId);
        else if (isTextHotspot(hs2)) selectTextHotspot(hotspotId);
        else selectHotspot(hotspotId);
      }
      if (krpano && typeof krpano.set === 'function') {
        const name = `hs_${hotspotId}`;
        krpano.set(`hotspot[${name}].ondown`, newLockedState ? '' : 'draghotspot()');
      }
      showToast(newLockedState ? "Hotspot Locked" : "Hotspot Unlocked");
    }
  } catch(e) {
    console.error("Error toggling lock:", e);
  }
}

// Render the hotspot list panel filtered by category (Hotspot, Text, Image)
function renderHotspotList() {
  const container = document.getElementById('prop-hs-list-container');
  const countEl = document.getElementById('hs-list-count');
  if (!container || !countEl) return;
  
  if (!activeSceneId) {
    container.innerHTML = '';
    countEl.textContent = '0';
    return;
  }
  
  const sceneHs = hotspots.filter(h => String(h.sceneId) === String(activeSceneId));
  let currentHs = [];
  if (currentHotspotFilter === 'text') {
    currentHs = sceneHs.filter(h => isTextHotspot(h));
  } else if (currentHotspotFilter === 'image') {
    currentHs = sceneHs.filter(h => isImageHotspot(h));
  } else {
    currentHs = sceneHs.filter(h => isNavHotspot(h));
  }

  countEl.textContent = currentHs.length;
  container.style.display = 'flex';
  container.innerHTML = '';
  
  if (currentHs.length === 0) {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.cssText = 'padding: 12px 10px; font-size: 12px; color: #64748b; text-align: center; font-style: italic;';
    const typeName = currentHotspotFilter === 'text' ? 'text' : currentHotspotFilter === 'image' ? 'image' : 'navigation';
    emptyMsg.textContent = `No ${typeName} hotspots in this scene`;
    container.appendChild(emptyMsg);
    return;
  }

  currentHs.forEach(h => {
    const item = document.createElement('div');
    item.className = 'hs-layer-item' + (String(h._id) === String(selectedHotspotId) ? ' active' : '');
    item.onclick = () => {
      if (isImageHotspot(h)) selectImageHotspot(h._id);
      else if (isTextHotspot(h)) selectTextHotspot(h._id);
      else selectHotspot(h._id);
    };
    
    const visIcon = `<svg onclick="event.stopPropagation(); lookAtHotspot('${h._id}')" title="Look at Hotspot" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hs-layer-icon-action" style="cursor: pointer; transition: color 0.2s;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    
    const isLocked = h.locked;
    const lockColor = isLocked ? '#ef4444' : 'currentColor';
    const lockOpacity = isLocked ? '1' : '0.5';
    const lockPath = isLocked 
      ? '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>'
      : '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>';
      
    const lockIcon = `<svg onclick="event.stopPropagation(); toggleHotspotLock('${h._id}')" title="${isLocked ? 'Unlock' : 'Lock'}" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${lockColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hs-layer-icon-action" style="opacity: ${lockOpacity}; cursor: pointer; transition: all 0.2s;">${lockPath}</svg>`;
    
    let typeIcon = '';
    if (isImageHotspot(h)) {
      typeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hs-layer-icon-type"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
    } else if (isTextHotspot(h)) {
      typeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hs-layer-icon-type"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>';
    } else {
      typeIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="hs-layer-icon-type"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>';
    }
    
    const name = h.title || h.name || 'Untitled';
    
    item.innerHTML = `
      ${visIcon}
      ${lockIcon}
      ${typeIcon}
      <span class="hs-layer-name">${name}</span>
    `;
    
    container.appendChild(item);
  });
}

// Render empty state for Hotspot Property Editor when no hotspot is selected
function renderEmptyHotspotPanel() {
  const emptyEl = document.getElementById('prop-hs-empty-state');
  const contentEl = document.getElementById('prop-hs-content-state');
  const detailsEl = document.getElementById('prop-hs-details-section');
  if (emptyEl) {
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = '';
  }
  if (contentEl) contentEl.style.display = 'none';
  if (detailsEl) detailsEl.style.display = 'none';
  
  if (typeof renderHotspotList === 'function') {
    renderHotspotList();
  }
}

// Center view on hotspot
window.lookAtHotspot = function(hotspotId) {
  if (!krpano) return;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (hs && hs.ath !== undefined && hs.atv !== undefined) {
    krpano.call(`lookto(${hs.ath}, ${hs.atv}, get(view.fov), smooth(100, 100, 200))`);
  }
};

// Select an Image / Landmark Hotspot and populate Property Editor
function selectImageHotspot(hotspotId) {
  selectedHotspotId = hotspotId;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;

  showTabOnly('image');
  currentHotspotFilter = 'image';

  const emptyEl = document.getElementById('prop-hs-empty-state');
  const contentEl = document.getElementById('prop-hs-content-state');
  const detailsEl = document.getElementById('prop-hs-details-section');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  if (detailsEl) detailsEl.style.display = 'none'; // hide regular navigation properties
  const iconSec = document.getElementById('prop-hs-icon-section');
  if (iconSec) iconSec.style.display = 'none';
  const copyStyleBtns = document.querySelector('.prop-hs-style-btns');
  if (copyStyleBtns) copyStyleBtns.style.display = 'none';

  let imgPanel = document.getElementById('prop-image-hotspot-panel');
  if (!imgPanel) {
    imgPanel = document.createElement('div');
    imgPanel.id = 'prop-image-hotspot-panel';
    imgPanel.style.cssText = 'padding: 16px; display: flex; flex-direction: column; gap: 14px;';
    contentEl.appendChild(imgPanel);
  }
  imgPanel.style.display = 'block';

  const s = String(hs.style || '').toLowerCase();
  const isRes = s.includes('residential') || s === 'res';
  const isComm = s.includes('commercial') || s === 'comm';
  const isPole = isRes || isComm || s === 'pole pin' || s === 'landmark pin' || s === 'pole_pin' || s === 'landmark';

  const titleEl = document.getElementById('prop-hs-active-title');
  if (titleEl) {
    const defaultName = isRes ? 'Residential Pin' : (isComm ? 'Commercial Pin' : (isPole ? 'Landmark Pin' : 'Image Hotspot'));
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">${isPole ? 'LANDMARK PIN:' : 'IMAGE:'}</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || defaultName}"</span>`;
  }

  const isLocked = !!(hs.locked === true || hs.locked === 'true');

  if (isPole) {
    const badgeLetter = isRes ? 'R' : 'C';
    const badgeColor = isRes ? '#3b82f6' : '#f59e0b';
    const badgeLabel = isRes ? 'Residential Pin' : 'Commercial Pin';
    const defaultPlaceholder = 'Add text';

    imgPanel.innerHTML = `
      <!-- Fixed Pin Type Badge Info -->
      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 12px 14px; display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 7px; background: ${badgeColor}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 16px; color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
            ${badgeLetter}
          </div>
          <div>
            <div style="font-size: 13px; font-weight: 700; color: #fff;">${badgeLabel}</div>
          </div>
        </div>
        <span style="font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.08); color: #cbd5e1; padding: 3px 8px; border-radius: 12px;">PRESET</span>
      </div>

      <!-- Editable Pin Text ONLY -->
      <div class="property-group" style="margin-top: 4px;">
        <label class="property-label" style="font-size: 12px; font-weight: 700; color: #cbd5e1;">Pin Text</label>
        <input id="img-hs-title" type="text" class="property-input" style="width: 100%; font-weight: 600; font-size: 14px;" value="${hs.title || defaultPlaceholder}" placeholder="${defaultPlaceholder}" ${isLocked ? 'disabled' : ''} oninput="onHotspotTitleInput(this.value)">
      </div>

      <!-- Size Settings -->
      <div class="property-group">
        <label class="property-label">Icon Size</label>
        <div style="display:flex; gap:10px;">
          <div style="flex:1;">
            <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">Width (px)</label>
            <input id="img-hs-width" type="number" class="property-input" value="${hs.width || ''}" placeholder="Auto" ${isLocked ? 'disabled' : ''} style="${isLocked ? 'opacity:0.5;' : ''}" oninput="onImageHotspotSizeChange()">
          </div>
          <div style="flex:1;">
            <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">Height (px)</label>
            <input id="img-hs-height" type="number" class="property-input" value="${hs.height || ''}" placeholder="Auto" ${isLocked ? 'disabled' : ''} style="${isLocked ? 'opacity:0.5;' : ''}" oninput="onImageHotspotSizeChange()">
          </div>
        </div>
      </div>

      <button onclick="deleteSelectedHotspotAction()" class="property-btn-outline" style="color:#ef4444;border-color:#ef4444;width:100%;padding:10px; margin-top: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        Delete This Pin
      </button>
    `;
  } else {
    imgPanel.innerHTML = `
      <div style="text-align:center; padding: 10px 0;">
        <img src="${hs.style}" style="max-width:100%; max-height:160px; border-radius:8px; object-fit:contain; border:1px solid #282c35;">
      </div>
      <div style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">Width (px)</label>
          <input id="img-hs-width" type="number" class="property-input" value="${hs.width || 150}" ${isLocked ? 'disabled' : ''} style="${isLocked ? 'opacity:0.5;' : ''}" oninput="onImageHotspotSizeChange()">
        </div>
        <div style="flex:1;">
          <label style="font-size:11px;color:#64748b;display:block;margin-bottom:4px;">Height (px)</label>
          <input id="img-hs-height" type="number" class="property-input" value="${hs.height || 150}" ${isLocked ? 'disabled' : ''} style="${isLocked ? 'opacity:0.5;' : ''}" oninput="onImageHotspotSizeChange()">
        </div>
      </div>
      <button onclick="deleteSelectedHotspotAction()" class="property-btn-outline" style="color:#ef4444;border-color:#ef4444;width:100%;padding:8px; margin-top: 10px;">
        Delete Image
      </button>
    `;
  }

  if (typeof renderHotspotList === 'function') renderHotspotList();
}

// Active state for preset pins in modal
let _selectedPresetPinType = 'residential';
let _currentImageModalTab = 'pins';

// Modal tab switcher for Add Pin / Image Modal
window.switchImageModalTab = function(tab) {
  _currentImageModalTab = tab;
  const tabPins = document.getElementById('image-modal-tab-pins');
  const tabMedia = document.getElementById('image-modal-tab-media');
  const btnPins = document.getElementById('tab-btn-pins');
  const btnMedia = document.getElementById('tab-btn-media');
  const selectBtn = document.getElementById('modal-image-asset-select-btn');
  const statusText = document.getElementById('modal-image-status-text');

  if (tab === 'pins') {
    if (tabPins) tabPins.style.display = 'flex';
    if (tabMedia) tabMedia.style.display = 'none';
    if (btnPins) {
      btnPins.style.background = '#10b981';
      btnPins.style.color = '#fff';
    }
    if (btnMedia) {
      btnMedia.style.background = 'transparent';
      btnMedia.style.color = '#94a3b8';
    }
    if (statusText) statusText.textContent = 'Select a pin to place in the current panorama view';
    if (selectBtn) {
      selectBtn.style.opacity = '1';
      selectBtn.style.cursor = 'pointer';
    }
    selectPresetPinCard(_selectedPresetPinType || 'residential');
  } else {
    if (tabPins) tabPins.style.display = 'none';
    if (tabMedia) tabMedia.style.display = 'flex';
    if (btnPins) {
      btnPins.style.background = 'transparent';
      btnPins.style.color = '#94a3b8';
    }
    if (btnMedia) {
      btnMedia.style.background = '#10b981';
      btnMedia.style.color = '#fff';
    }
    if (statusText) statusText.textContent = 'Choose an uploaded image asset to add to the tour';
    renderModalImageAssetGrid();
  }
};

// Select preset pin card in modal
window.selectPresetPinCard = function(type) {
  _selectedPresetPinType = type;
  const cardRes = document.getElementById('pin-card-residential');
  const cardComm = document.getElementById('pin-card-commercial');
  const selectBtn = document.getElementById('modal-image-asset-select-btn');

  if (cardRes) {
    if (type === 'residential') {
      cardRes.style.borderColor = '#10b981';
      cardRes.classList.add('selected');
    } else {
      cardRes.style.borderColor = 'transparent';
      cardRes.classList.remove('selected');
    }
  }

  if (cardComm) {
    if (type === 'commercial') {
      cardComm.style.borderColor = '#10b981';
      cardComm.classList.add('selected');
    } else {
      cardComm.style.borderColor = 'transparent';
      cardComm.classList.remove('selected');
    }
  }

  if (selectBtn) {
    selectBtn.style.opacity = '1';
    selectBtn.style.cursor = 'pointer';
  }
};

// Double click or Select button confirmation
window.confirmPresetPinSelection = function() {
  addPresetPinHotspot(_selectedPresetPinType || 'residential');
};

// Unified modal select action
window.confirmImageModalSelection = function() {
  if (_currentImageModalTab === 'pins') {
    addPresetPinHotspot(_selectedPresetPinType || 'residential');
  } else {
    if (window._selectedImageAsset) {
      addImageHotspotFromAsset(window._selectedImageAsset.name, window._selectedImageAsset.url);
    } else {
      showToast('Please select an image asset first');
    }
  }
};

// Open the Add Pin / Image tool
window.openImageHotspotTool = function() {
  const modal = document.getElementById('modal-select-image-asset');
  if (modal) {
    modal.style.display = 'flex';
    switchImageModalTab('pins');
  }
};

// Add preset landmark pin (Residential / Commercial)
window.addPresetPinHotspot = async function(type) {
  const modal = document.getElementById('modal-select-image-asset');
  if (modal) modal.style.display = 'none';

  if (!activeSceneId || !krpano) {
    showToast('Please open a panorama scene first');
    return;
  }

  let styleName = 'Residential Pin';
  let defaultTitle = 'Add text';
  let badgeLetter = 'R';
  let color = '#3b82f6';

  if (type === 'commercial') {
    styleName = 'Commercial Pin';
    defaultTitle = 'Add text';
    badgeLetter = 'C';
    color = '#f59e0b';
  }

  const ath = Number(Number(krpano.get('view.hlookat') || 0).toFixed(2));
  const atv = Number(Number(krpano.get('view.vlookat') || 0).toFixed(2));

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: defaultTitle,
        kind: 'image',
        ath,
        atv,
        style: styleName,
        badgeLetter: badgeLetter,
        color: color
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create landmark pin');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    window._lastHotspotClickTime = Date.now();
    selectImageHotspot(newHotspot._id);
    publishTourSilent();
    showToast(`✓ Added ${styleName} to scene!`);
  } catch (err) {
    console.error('Error creating preset pin:', err);
    showToast(`Error: ${err.message}`);
  }
};

// Selected media image asset
window._selectedImageAsset = null;

// Render media images grid inside the modal
function renderModalImageAssetGrid() {
  const grid = document.getElementById('modal-select-image-asset-grid');
  const selectBtn = document.getElementById('modal-image-asset-select-btn');
  if (!grid) return;
  grid.innerHTML = '';
  window._selectedImageAsset = null;
  if (selectBtn) {
    selectBtn.style.opacity = '0.4';
    selectBtn.style.cursor = 'not-allowed';
  }

  const mediaList = Array.isArray(window.mediaAssets) ? window.mediaAssets : [];
  if (mediaList.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 40px 0; font-size: 13px;">No media assets uploaded yet. Upload images in the Assets section.</div>`;
    return;
  }

  mediaList.forEach(asset => {
    const card = document.createElement('div');
    card.style.cssText = 'background: #16181d; border: 2px solid #282c35; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s;';
    card.innerHTML = `
      <div style="width: 100%; height: 100px; display: flex; align-items: center; justify-content: center; background: #000; border-radius: 4px; overflow: hidden;">
        <img src="${asset.url}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
      </div>
      <div style="font-size: 12px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px; text-align: center;">${asset.name}</div>
    `;
    card.onclick = () => {
      grid.querySelectorAll('div').forEach(c => c.style.borderColor = '#282c35');
      card.style.borderColor = '#10b981';
      window._selectedImageAsset = asset;
      if (selectBtn) {
        selectBtn.style.opacity = '1';
        selectBtn.style.cursor = 'pointer';
      }
    };
    grid.appendChild(card);
  });
}

// Add Image Hotspot from uploaded asset
window.addImageHotspotFromAsset = async function(name, url) {
  const modal = document.getElementById('modal-select-image-asset');
  if (modal) modal.style.display = 'none';

  if (!activeSceneId || !krpano) {
    showToast('Please open a panorama scene first');
    return;
  }

  const ath = Number(Number(krpano.get('view.hlookat') || 0).toFixed(2));
  const atv = Number(Number(krpano.get('view.vlookat') || 0).toFixed(2));

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: name || 'Image',
        kind: 'image',
        ath,
        atv,
        style: url,
        width: 150,
        height: 150
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create image hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    window._lastHotspotClickTime = Date.now();
    selectImageHotspot(newHotspot._id);
    publishTourSilent();
    showToast('✓ Added image hotspot to scene!');
  } catch (err) {
    console.error('Error adding image hotspot:', err);
    showToast(`Error: ${err.message}`);
  }
};

// Debounced save for image hotspot size
let _imgSizeDebounce = null;
window.onImageHotspotSizeChange = async function() {
  const w = parseInt(document.getElementById('img-hs-width')?.value) || 150;
  const h = parseInt(document.getElementById('img-hs-height')?.value) || 150;
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h2 => String(h2._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.width = w;
  hs.height = h;
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].width`, w);
    krpano.set(`hotspot[hs_${selectedHotspotId}].height`, h);
  }
  clearTimeout(_imgSizeDebounce = setTimeout(async () => {
    await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ width: w, height: h })
    });
    publishTourSilent();
  }, 600));
};

function selectHotspot(hotspotId) {
  selectedHotspotId = hotspotId;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;

  if (isImageHotspot(hs)) {
    selectImageHotspot(hotspotId);
    return;
  }

  if (isTextHotspot(hs)) {
    selectTextHotspot(hotspotId);
    return;
  }

  showTabOnly('hotspot');
  currentHotspotFilter = 'hotspot';

  const emptyEl = document.getElementById('prop-hs-empty-state');
  const contentEl = document.getElementById('prop-hs-content-state');
  const detailsEl = document.getElementById('prop-hs-details-section');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  if (detailsEl) detailsEl.style.display = 'block';
  const imgPanelA = document.getElementById('prop-image-hotspot-panel');
  if (imgPanelA) imgPanelA.style.display = 'none';
  const iconSecA = document.getElementById('prop-hs-icon-section');
  if (iconSecA) iconSecA.style.display = '';
  const copyStyleBtnsA = document.querySelector('.prop-hs-style-btns');
  if (copyStyleBtnsA) copyStyleBtnsA.style.display = '';

  const titleEl = document.getElementById('prop-hs-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">ACTIVE:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }

  const isLocked = !!hs.locked;
  const panel = document.getElementById('panel-hotspot-properties');
  if (panel) {
    const inputs = panel.querySelectorAll('input, select, button');
    inputs.forEach(el => {
      el.disabled = isLocked;
      if (isLocked) {
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
      } else {
        el.style.opacity = '';
        el.style.cursor = '';
      }
    });
  }

  // Render grid but it will be visually disabled if locked
  renderHotspotIconPickerGrid(hs.style || 'Arrow');

  const isPole = String(hs.style || '').toLowerCase() === 'pole pin' || String(hs.style || '').toLowerCase() === 'landmark pin' || String(hs.style || '').toLowerCase() === 'pole_pin' || String(hs.style || '').toLowerCase() === 'landmark';
  
  const titleInput = document.getElementById('prop-hs-title');
  if (titleInput) titleInput.value = hs.title || '';

  const badgeContainer = document.getElementById('prop-hs-badge-letter-container');
  const badgeInput = document.getElementById('prop-hs-badge-letter');
  if (badgeContainer) badgeContainer.style.display = isPole ? 'block' : 'none';
  if (badgeInput) {
    badgeInput.value = hs.badgeLetter || '';
    badgeInput.placeholder = hs.title ? hs.title.trim().charAt(0).toUpperCase() : 'R';
  }

  const colorInput = document.getElementById('prop-hs-color');
  if (colorInput) colorInput.value = hs.color || '#00a6e0';

  const actionEl = document.getElementById('prop-hs-action');
  if (actionEl) actionEl.value = hs.action || 'scene';

  const widthEl = document.getElementById('prop-hs-width');
  const heightEl = document.getElementById('prop-hs-height');
  if (widthEl) widthEl.value = hs.width || 60;
  if (heightEl) heightEl.value = hs.height || 60;

  const targetInput = document.getElementById('prop-hs-target-scene');
  const targetDisplay = document.getElementById('prop-hs-target-scene-display');
  const targetImg = document.getElementById('prop-hs-target-scene-img');
  const viewModeGroup = document.getElementById('prop-hs-target-view-mode-group');
  const viewModeSelect = document.getElementById('prop-hs-target-view-mode');
  const customViewBtn = document.getElementById('prop-hs-custom-view-btn-container');
  const customViewStatus = document.getElementById('prop-hs-custom-view-status');

  if (targetInput && targetDisplay) {
    targetInput.value = hs.targetSceneId || '';
    const targetScene = scenes.find(s => String(s._id) === String(hs.targetSceneId));
    targetDisplay.textContent = targetScene ? targetScene.title : 'Select Panorama';
    if (targetScene && targetImg) {
      const origBaseName = getOriginalBaseName(targetScene);
      const thumbUrl = `panos/${targetScene.tilesFolder || origBaseName + '.tiles'}/thumb.jpg?t=${targetScene._lastThumbUpdate || 1}`;
      targetImg.src = thumbUrl;
      targetImg.style.display = 'block';
    } else {
      if (targetImg) targetImg.style.display = 'none';
    }
  }

  const transSelect = document.getElementById('prop-hs-transition');
  if (transSelect) {
    transSelect.value = hs.transition || 'BLEND(0.5)';
  }
  
  if (typeof renderHotspotList === 'function') {
    renderHotspotList();
  }
}

// Select a Text Hotspot and populate Text Property Editor
function selectTextHotspot(hotspotId) {
  selectedHotspotId = hotspotId;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;

  showTabOnly('text');
  currentHotspotFilter = 'text';

  const emptyEl = document.getElementById('prop-text-empty-state');
  const contentEl = document.getElementById('prop-text-content-state');
  const detailsEl = document.getElementById('prop-text-details-section');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  if (detailsEl) detailsEl.style.display = 'block';
  const imgPanelB = document.getElementById('prop-image-hotspot-panel');
  if (imgPanelB) imgPanelB.style.display = 'none';

  const titleEl = document.getElementById('prop-text-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:800; letter-spacing:1px;">ACTIVE LABEL:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }

  const contentInput = document.getElementById('prop-text-content');
  if (contentInput) {
    contentInput.value = hs.title || hs.info || '';
  }

  const isLocked = !!hs.locked;
  const panel = document.getElementById('panel-text-properties');
  if (panel) {
    const inputs = panel.querySelectorAll('input, select, button');
    inputs.forEach(el => {
      el.disabled = isLocked;
      if (isLocked) {
        el.style.opacity = '0.5';
        el.style.cursor = 'not-allowed';
      } else {
        el.style.opacity = '';
        el.style.cursor = '';
      }
    });
  }

  const tp = hs.textProps || {};
  document.getElementById('prop-text-sticker').checked = tp.sticker !== undefined ? tp.sticker : false;
  document.getElementById('prop-text-rollover').checked = tp.rollover !== undefined ? tp.rollover : false;
  
  const op = tp.opacity !== undefined ? tp.opacity : 1;
  document.getElementById('prop-text-opacity').value = op;
  document.getElementById('prop-text-opacity-slider').value = op;

  document.getElementById('prop-text-bg-color').value = tp.bgColor || '#000000';
  
  const bgOp = tp.bgOpacity !== undefined ? tp.bgOpacity : 0.27;
  document.getElementById('prop-text-bg-opacity').value = bgOp;
  document.getElementById('prop-text-bg-opacity-slider').value = bgOp;

  document.getElementById('prop-text-border-color').value = tp.borderColor || '#000000';
  
  const bOp = tp.borderOpacity !== undefined ? tp.borderOpacity : 0.00;
  document.getElementById('prop-text-border-opacity').value = bOp;
  document.getElementById('prop-text-border-opacity-slider').value = bOp;

  document.getElementById('prop-text-border-size').value = tp.borderSize !== undefined ? tp.borderSize : 0;
  document.getElementById('prop-text-border-radius').value = tp.borderRadius !== undefined ? tp.borderRadius : 0;

  document.getElementById('prop-text-font').value = tp.font || 'Arial';
  document.getElementById('prop-text-font-size').value = tp.fontSize || 13;
  document.getElementById('prop-text-color').value = tp.color || '#FFFFFF';

  document.getElementById('prop-text-shadow-color').value = tp.shadowColor || '#FF0000';
  const shOp = tp.shadowOpacity !== undefined ? tp.shadowOpacity : 0.00;
  document.getElementById('prop-text-shadow-opacity').value = shOp;
  document.getElementById('prop-text-shadow-opacity-slider').value = shOp;

  ['bold', 'italic', 'underline'].forEach(style => {
    const btn = document.getElementById(`prop-text-${style}`);
    if (btn) {
      if (tp[style]) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  if (typeof renderHotspotList === 'function') {
    renderHotspotList();
  }
}

function renderEmptyTextPanel() {
  const emptyEl = document.getElementById('prop-text-empty-state');
  const contentEl = document.getElementById('prop-text-content-state');
  const detailsEl = document.getElementById('prop-text-details-section');
  if (emptyEl) {
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = '';
  }
  if (contentEl) contentEl.style.display = 'none';
  if (detailsEl) detailsEl.style.display = 'none';
  
  if (typeof renderHotspotList === 'function') {
    renderHotspotList();
  }
}

let textPropDebounceTimer = null;
function onTextContentChangeDebounced() {
  if (textPropDebounceTimer) clearTimeout(textPropDebounceTimer);
  textPropDebounceTimer = setTimeout(() => {
    saveTextHotspotProperties();
  }, 300);
}

function onTextScaleChange(val) {
  saveTextHotspotProperties();
}

window.copiedTextProps = null;

window.copyTextStyle = function() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs || !hs.textProps) return;
  
  // Clone the properties so it's a separate copy
  window.copiedTextProps = JSON.parse(JSON.stringify(hs.textProps));
  
  const pasteBtn = document.getElementById('btn-paste-text-style');
  if (pasteBtn) {
    pasteBtn.style.opacity = '1';
    pasteBtn.style.pointerEvents = 'auto';
  }
  
  showToast("Text style copied!");
};

window.pasteTextStyle = function() {
  if (!selectedHotspotId || !window.copiedTextProps) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  
  // Copy over all copied text properties
  hs.textProps = Object.assign({}, hs.textProps, window.copiedTextProps);
  
  // Update the UI
  selectTextHotspot(selectedHotspotId);
  
  // Trigger save
  saveTextHotspotProperties();
  showToast("Text style pasted!");
};

window.copiedHotspotStyle = null;

window.copyHotspotStyle = function() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  
  // Clone only visual properties (excluding icon style itself)
  window.copiedHotspotStyle = {
    color: hs.color,
    width: hs.width,
    height: hs.height,
    scale: hs.scale,
    rx: hs.rx,
    ry: hs.ry,
    rz: hs.rz
  };
  
  const pasteBtn = document.getElementById('btn-paste-hotspot-style');
  if (pasteBtn) {
    pasteBtn.style.opacity = '1';
    pasteBtn.style.pointerEvents = 'auto';
  }
  
  showToast("Hotspot style copied!");
};

window.pasteHotspotStyle = function() {
  if (!selectedHotspotId || !window.copiedHotspotStyle) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  
  // Apply visual properties
  if (window.copiedHotspotStyle.color !== undefined) hs.color = window.copiedHotspotStyle.color;
  if (window.copiedHotspotStyle.width !== undefined) hs.width = window.copiedHotspotStyle.width;
  if (window.copiedHotspotStyle.height !== undefined) hs.height = window.copiedHotspotStyle.height;
  if (window.copiedHotspotStyle.scale !== undefined) hs.scale = window.copiedHotspotStyle.scale;
  if (window.copiedHotspotStyle.rx !== undefined) hs.rx = window.copiedHotspotStyle.rx;
  if (window.copiedHotspotStyle.ry !== undefined) hs.ry = window.copiedHotspotStyle.ry;
  if (window.copiedHotspotStyle.rz !== undefined) hs.rz = window.copiedHotspotStyle.rz;
  
  // Update UI and Krpano
  selectHotspot(selectedHotspotId);
  if (window.onHotspotIconStyleChange) onHotspotIconStyleChange(hs.style);
  if (window.onHotspotSizeChange) onHotspotSizeChange();
  
  // Save changes
  if (window.publishTourSilent) publishTourSilent();
  
  showToast("Hotspot style pasted!");
};

function onTextStyleChange(val) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.textStyle = val;
  saveTextHotspotProperties();
}

function onTextRxChange(val) {
  const rxValEl = document.getElementById('prop-text-rx-val');
  if (rxValEl) rxValEl.textContent = val + '°';
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.rx = Number(val);
  saveTextHotspotProperties();
}

function onTextColorChange(col) {
  const colorInput = document.getElementById('prop-text-color');
  if (colorInput) colorInput.value = col;
  saveTextHotspotProperties();
}

let isDraggingResizeBox = false;
let dragResizeStartX = 0;
let dragResizeStartScale = 1.0;

window.startDragResizeBox = function (e) {
  e.preventDefault();
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  isDraggingResizeBox = true;
  dragResizeStartX = e.clientX;
  dragResizeStartScale = hs.scale !== undefined ? Number(hs.scale) : 1.0;

  const box = document.getElementById('drag-resize-box');
  if (box) {
    box.style.background = 'rgba(16, 185, 129,0.18)';
    box.style.borderColor = '#ffffff';
  }

  window.addEventListener('mousemove', onDragResizeBoxMove);
  window.addEventListener('mouseup', onDragResizeBoxUp);
};

function onDragResizeBoxMove(e) {
  if (!isDraggingResizeBox || !selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  const dx = e.clientX - dragResizeStartX;
  let newScale = dragResizeStartScale + (dx / 100);
  if (newScale < 0.2) newScale = 0.2;
  if (newScale > 8.0) newScale = 8.0;

  hs.scale = Number(newScale.toFixed(2));

  const scaleValEl = document.getElementById('prop-text-scale-val');
  if (scaleValEl) {
    scaleValEl.textContent = hs.scale + 'x';
  }

  if (krpano) {
    const name = "hs_" + hs._id;
    krpano.set(`hotspot[${name}].scale`, hs.scale);
  }
}

function onDragResizeBoxUp(e) {
  if (!isDraggingResizeBox) return;
  isDraggingResizeBox = false;

  const box = document.getElementById('drag-resize-box');
  if (box) {
    box.style.background = 'rgba(16, 185, 129,0.06)';
    box.style.borderColor = 'var(--accent-green)';
  }

  window.removeEventListener('mousemove', onDragResizeBoxMove);
  window.removeEventListener('mouseup', onDragResizeBoxUp);

  saveTextHotspotProperties();
}

async function saveTextHotspotProperties() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  const contentInput = document.getElementById('prop-text-content');
  if (contentInput) {
    hs.title = contentInput.value.trim() || 'TEXT';
    hs.info = hs.title;
  }

  const titleEl = document.getElementById('prop-text-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:800; letter-spacing:1px;">ACTIVE LABEL:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title}"</span>`;
  }

  if (krpano) {
    addHotspotToKrpano(hs, null);
  }

  try {
    const res = await fetch(`/api/hotspots/${hs._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: hs.title,
        info: hs.info,
        textProps: hs.textProps || {}
      })
    });
    if (!res.ok) throw new Error('Failed to update text hotspot');
    publishTourSilent();
  } catch (err) {
    console.error("Error updating text hotspot:", err);
  }
}

function toggleTextStyle(style) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  
  if (!hs.textProps) hs.textProps = {};
  hs.textProps[style] = !hs.textProps[style];
  
  const btn = document.getElementById(`prop-text-${style}`);
  if (btn) {
    if (hs.textProps[style]) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  }
  
  onTextPropChange();
}

function onTextPropChange() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  if (!hs.textProps) hs.textProps = {};
  const tp = hs.textProps;

  tp.sticker = document.getElementById('prop-text-sticker').checked;
  tp.rollover = document.getElementById('prop-text-rollover').checked;
  tp.opacity = parseFloat(document.getElementById('prop-text-opacity').value);
  tp.bgColor = document.getElementById('prop-text-bg-color').value;
  tp.bgOpacity = parseFloat(document.getElementById('prop-text-bg-opacity').value);
  tp.borderColor = document.getElementById('prop-text-border-color').value;
  tp.borderOpacity = parseFloat(document.getElementById('prop-text-border-opacity').value);
  tp.borderSize = parseInt(document.getElementById('prop-text-border-size').value);
  tp.borderRadius = parseInt(document.getElementById('prop-text-border-radius').value);
  tp.font = document.getElementById('prop-text-font').value;
  tp.fontSize = parseInt(document.getElementById('prop-text-font-size').value);
  tp.color = document.getElementById('prop-text-color').value;
  tp.shadowColor = document.getElementById('prop-text-shadow-color').value;
  tp.shadowOpacity = parseFloat(document.getElementById('prop-text-shadow-opacity').value);

  saveTextHotspotProperties();
}

// Render icon mini-grid in Hotspot Property Editor
function renderHotspotIconPickerGrid(currentStyle) {
  const grid = document.getElementById('prop-hs-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  let isLocked = false;
  if (selectedHotspotId) {
    const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
    if (hs && (hs.locked === true || hs.locked === 'true')) {
      isLocked = true;
    }
  }

  const builtInStyles = [
    { name: 'Arrow', label: 'Arrow', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
    { name: 'Arrow 01', label: 'Chevron', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 15 12 9 18 15"></polyline></svg>' },
    { name: 'Arrow 02', label: 'Bold', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 4 22 18 18 20 12 11 6 20 2 18"></polygon></svg>' },
    { name: 'Pin', label: 'Pin', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' },
    { name: 'Dot', label: 'Dot', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8"></circle></svg>' }
  ];

  const lockedStyle = isLocked ? 'opacity: 0.4; cursor: not-allowed; pointer-events: none;' : '';

  builtInStyles.forEach(item => {
    const card = document.createElement('div');
    card.className = 'icon-mini-card' + (currentStyle === item.name ? ' active' : '');
    card.style.cssText = lockedStyle;
    card.innerHTML = `${item.svg}<span style="font-size:11px; font-weight:700;">${item.label}</span>`;
    if (!isLocked) card.onclick = () => onHotspotIconStyleChange(item.name);
    grid.appendChild(card);
  });

  const custom = getCustomIcons();
  custom.forEach(item => {
    const card = document.createElement('div');
    card.className = 'icon-mini-card' + (currentStyle === item.name ? ' active' : '');
    card.style.cssText = lockedStyle;
    card.innerHTML = `<img src="${item.url}" style="width:20px; height:20px; object-fit:contain;"><span style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:50px;">${item.name}</span>`;
    if (!isLocked) card.onclick = () => onHotspotIconStyleChange(item.name);
    grid.appendChild(card);
  });

  const allBtn = document.createElement('div');
  allBtn.className = 'icon-mini-card';
  allBtn.style.cssText = `border: 1px dashed #10b981; ${lockedStyle}`;
  allBtn.innerHTML = `<span style="font-size:16px; color:#10b981; font-weight:900; line-height:1;">+</span><span style="font-size:10px; font-weight:700; color:#10b981;">All Icons</span>`;
  if (!isLocked) allBtn.onclick = () => openIconLibraryModal('change');
  grid.appendChild(allBtn);
}

// Auto-save Icon Style change
async function onHotspotIconStyleChange(newStyle) {
  if (!selectedHotspotId) {
    renderHotspotIconPickerGrid(newStyle);
    showToast(`Selected icon style: ${newStyle} • (Create a hotspot to apply)`);
    return;
  }
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  hs.style = newStyle;
  renderHotspotIconPickerGrid(newStyle);

  const isPole = String(newStyle).toLowerCase() === 'pole pin' || String(newStyle).toLowerCase() === 'landmark pin' || String(newStyle).toLowerCase() === 'pole_pin' || String(newStyle).toLowerCase() === 'landmark';
  const badgeContainer = document.getElementById('prop-hs-badge-letter-container');
  if (badgeContainer) badgeContainer.style.display = isPole ? 'block' : 'none';

  if (krpano) {
    if (isPole) {
      krpano.set(`hotspot[hs_${selectedHotspotId}].edge`, 'bottomleft');
      krpano.set(`hotspot[hs_${selectedHotspotId}].ox`, -22);
      krpano.set(`hotspot[hs_${selectedHotspotId}].oy`, 0);
    } else {
      krpano.set(`hotspot[hs_${selectedHotspotId}].edge`, 'center');
      krpano.set(`hotspot[hs_${selectedHotspotId}].ox`, 0);
      krpano.set(`hotspot[hs_${selectedHotspotId}].oy`, 0);
    }
  }

  const svgBase64 = getHotspotSvgBase64(newStyle, hs.title, hs.color, hs.bgColor, hs.textStyle, hs.badgeLetter);
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].url`, svgBase64);
  }

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ style: newStyle })
    });
    if (!res.ok) throw new Error('Failed to update icon style');

    publishTourSilent();
    showToast(`✓ Auto-saved icon style: ${newStyle}`);
  } catch (err) {
    console.error("Error auto-saving icon style:", err);
    showToast("Error auto-saving icon style");
  }
}

// Live-update and auto-save Hotspot Title / Text
let _hsTitleDebounce = null;
window.onHotspotTitleInput = function(val) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.title = val;
  
  const titleEl = document.getElementById('prop-hs-active-title');
  const isPole = String(hs.style || '').toLowerCase() === 'pole pin' || String(hs.style || '').toLowerCase() === 'landmark pin' || String(hs.style || '').toLowerCase() === 'pole_pin' || String(hs.style || '').toLowerCase() === 'landmark';
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">${isPole ? 'LANDMARK PIN:' : 'ACTIVE:'}</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }
  
  const badgeInput = document.getElementById('prop-hs-badge-letter') || document.getElementById('img-hs-badge');
  if (badgeInput && !hs.badgeLetter) {
    badgeInput.placeholder = val ? val.trim().charAt(0).toUpperCase() : 'R';
  }

  const svgBase64 = getHotspotSvgBase64(hs.style || 'Arrow', hs.title, hs.color, hs.bgColor, hs.textStyle, hs.badgeLetter);
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].url`, svgBase64);
  }

  clearTimeout(_hsTitleDebounce);
  _hsTitleDebounce = setTimeout(async () => {
    try {
      await fetch(`/api/hotspots/${selectedHotspotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: hs.title })
      });
      publishTourSilent();
    } catch(e) {
      console.error("Error updating hotspot title:", e);
    }
  }, 400);
};

// Live-update and auto-save Badge Letter (for Pole Pin)
let _hsBadgeDebounce = null;
window.onHotspotBadgeLetterInput = function(val) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.badgeLetter = val.trim().toUpperCase();

  const svgBase64 = getHotspotSvgBase64(hs.style || 'Arrow', hs.title, hs.color, hs.bgColor, hs.textStyle, hs.badgeLetter);
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].url`, svgBase64);
  }

  clearTimeout(_hsBadgeDebounce);
  _hsBadgeDebounce = setTimeout(async () => {
    try {
      await fetch(`/api/hotspots/${selectedHotspotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badgeLetter: hs.badgeLetter })
      });
      publishTourSilent();
    } catch(e) {
      console.error("Error updating hotspot badge letter:", e);
    }
  }, 400);
};

// Live-update and auto-save Hotspot Color
window.onHotspotColorChange = async function(color) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;
  hs.color = color;
  
  const colorInputA = document.getElementById('prop-hs-color');
  if (colorInputA) colorInputA.value = color;
  const colorInputB = document.getElementById('img-hs-color');
  if (colorInputB) colorInputB.value = color;

  const svgBase64 = getHotspotSvgBase64(hs.style || 'Arrow', hs.title, hs.color, hs.bgColor, hs.textStyle, hs.badgeLetter);
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].url`, svgBase64);
  }

  try {
    await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: hs.color })
    });
    publishTourSilent();
  } catch(e) {
    console.error("Error updating hotspot color:", e);
  }
};

// Auto-save Target Scene change
async function onHotspotTargetSceneChange(newTargetSceneId) {
  if (!selectedHotspotId) {
    showToast("Please select or create a hotspot first to set target panorama");
    return;
  }
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  const targetScene = scenes.find(s => String(s._id) === String(newTargetSceneId));
  if (!targetScene) return;

  hs.targetSceneId = newTargetSceneId;
  hs.title = targetScene.title;

  const titleEl = document.getElementById('prop-hs-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">ACTIVE:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }

  const svgBase64 = getHotspotSvgBase64(hs.style || "Arrow", hs.title, hs.color);
  if (krpano) {
    krpano.set(`hotspot[hs_${selectedHotspotId}].url`, svgBase64);
  }

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetSceneId: newTargetSceneId, title: hs.title })
    });
    if (!res.ok) throw new Error('Failed to update target scene');

    publishTourSilent();
    showToast(`✓ Auto-saved target panorama: "${hs.title}"`);
  } catch (err) {
    console.error("Error updating hotspot target scene:", err);
    showToast("Error auto-saving target panorama");
  }
}

// Auto-save Target View Mode change
async function onHotspotTargetViewModeChange(newMode) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  hs.targetViewMode = newMode;
  
  const customViewBtn = document.getElementById('prop-hs-custom-view-btn-container');
  if (customViewBtn) {
    customViewBtn.style.display = newMode === 'custom' ? 'block' : 'none';
  }

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetViewMode: newMode })
    });
    if (!res.ok) throw new Error('Failed to update target view mode');

    publishTourSilent();
    showToast(`✓ Auto-saved Initial View: ${newMode}`);
  } catch (err) {
    console.error("Error updating hotspot target view mode:", err);
    showToast("Error auto-saving target view mode");
  }
}

// Custom View Modal Logic
let customViewKrpano = null;

function openCustomViewModal() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  
  // Use the pending selection if available, otherwise fallback to the saved state
  const targetId = window._tempSelectedTargetSceneId || (hs ? hs.targetSceneId : null);
  
  if (!targetId) {
    showToast("Please select a target panorama first");
    return;
  }
  
  const targetScene = scenes.find(s => String(s._id) === String(targetId));
  if (!targetScene) return;

  const hlookat = hs.targetAth !== undefined ? hs.targetAth : (targetScene.hlookat || 0);
  const vlookat = hs.targetAtv !== undefined ? hs.targetAtv : (targetScene.vlookat || 0);
  const fov = hs.targetFov !== undefined ? hs.targetFov : (targetScene.fov || 114);
  const krpanoSceneName = getSceneKrpanoName(targetScene);

  if (customViewKrpano) {
    customViewKrpano.call(`loadscene('${krpanoSceneName}', 'hs_entry_custom=true&hs_entry_hlookat=${hlookat}&hs_entry_vlookat=${vlookat}&hs_entry_fov=${fov}', MERGE, BLEND(0.5));`);
    setTimeout(() => {
      if (customViewKrpano) {
        customViewKrpano.set("layer[skin_layer].visible", false);
      }
    }, 100);
  } else {
    embedpano({
      xml: "tour.xml",
      target: "custom-view-pano",
      html5: "only",
      webglsettings: { preserveDrawingBuffer: true },
      initvars: { 
        startscene: krpanoSceneName,
        hs_entry_custom: "true",
        hs_entry_hlookat: hlookat,
        hs_entry_vlookat: vlookat,
        hs_entry_fov: fov
      },
      onready: function (krpanoInterface) {
        customViewKrpano = krpanoInterface;
        
        // Wait for the XML to finish loading and the skin to be created, then hide it and set the view.
        const hideSkinInterval = setInterval(() => {
          if (!customViewKrpano) {
            clearInterval(hideSkinInterval);
            return;
          }
          const layer = customViewKrpano.get("layer[skin_layer]");
          if (layer || customViewKrpano.get("xml.scene")) {
            if (layer) customViewKrpano.set("layer[skin_layer].visible", false);
            clearInterval(hideSkinInterval);
          }
        }, 50);
      }
    });
  }
}



// saveCustomView removed (now auto-saves inside confirmTargetSceneAndViewMode)

// Auto-save Transition change
async function onHotspotActionChange(newAction) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  hs.action = newAction;

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: newAction })
    });
    if (!res.ok) throw new Error('Failed to update action');

    publishTourSilent();
  } catch (err) {
    console.error(err);
    alert('Error updating action: ' + err.message);
  }
}

let hotspotSizeDebounceTimer = null;

async function onHotspotSizeChange() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  const widthEl = document.getElementById('prop-hs-width');
  const heightEl = document.getElementById('prop-hs-height');

  const newWidth = widthEl.value ? Number(widthEl.value) : null;
  const newHeight = heightEl.value ? Number(heightEl.value) : null;

  hs.width = newWidth;
  hs.height = newHeight;

  // krpano SVG hotspots respect both width/height and scale.
  // To use px dimensions directly, we set width/height and normalize scale to 1.
  if (window.krpano && (newWidth || newHeight)) {
    const name = `hs_${selectedHotspotId}`;
    const targetW = newWidth || newHeight;
    const targetH = newHeight || newWidth;
    window.krpano.set(`hotspot[${name}].width`, String(targetW));
    window.krpano.set(`hotspot[${name}].height`, String(targetH));
    window.krpano.set(`hotspot[${name}].scale`, 1.0);
  }

  // Debounce the backend save to avoid spamming the API on every keystroke
  clearTimeout(hotspotSizeDebounceTimer);
  hotspotSizeDebounceTimer = setTimeout(async () => {
    const latestWidth = widthEl.value ? Number(widthEl.value) : null;
    const latestHeight = heightEl.value ? Number(heightEl.value) : null;
    hs.width = latestWidth;
    hs.height = latestHeight;
    try {
      const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: latestWidth, height: latestHeight })
      });
      if (!res.ok) throw new Error('Failed to update size');

      publishTourSilent();
    } catch (err) {
      console.error(err);
    }
  }, 600);
}

async function onHotspotTransitionChange(newTransition) {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  hs.transition = newTransition;

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transition: newTransition })
    });
    if (!res.ok) throw new Error('Failed to update transition');

    publishTourSilent();
    showToast("✓ Auto-saved transition effect");
  } catch (err) {
    console.error("Error updating hotspot transition:", err);
    showToast("Error auto-saving transition");
  }
}

// Delete selected hotspot
async function deleteSelectedHotspotAction() {
  if (!selectedHotspotId) return;
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  if (!hs) return;

  if (!confirm(`Are you sure you want to delete hotspot "${hs.title || 'Untitled'}"?`)) return;

  try {
    const res = await fetch(`/api/hotspots/${selectedHotspotId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete hotspot');

    if (krpano && typeof krpano.call === 'function') {
      krpano.call(`removehotspot(hs_${selectedHotspotId});`);
    }

    hotspots = hotspots.filter(h => String(h._id) !== String(selectedHotspotId));
    selectedHotspotId = null;

    switchPropertyPanel('pano');
    publishTourSilent();
    showToast("✓ Hotspot deleted");
  } catch (err) {
    console.error("Error deleting hotspot:", err);
    showToast("Error deleting hotspot");
  }
}

// Hotspot drag ended handler
window.onHotspotDragEnd = function (hsName, newAth, newAtv) {
  const id = String(hsName).replace(/^hs_/, '');
  const ath = Number(Number(newAth).toFixed(2));
  const atv = Number(Number(newAtv).toFixed(2));

  fetch('/api/hotspots/' + id, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ath, atv })
  })
    .then(r => r.json())
    .then(() => {
      const hs = hotspots.find(h => String(h._id) === String(id));
      if (hs) {
        hs.ath = ath;
        hs.atv = atv;
      }
      publishTourSilent();
      showToast("✓ Auto-saved hotspot position!");
    })
    .catch(err => {
      console.error("Error autosaving hotspot position:", err);
      showToast("Failed to auto-save hotspot position");
    });
};

// ==================== NAV ICON LIBRARY MODAL ====================

let currentLibCategory = 'All';
let currentLibSearch = '';
let selectedLibraryIcon = null;
let iconLibraryMode = 'add';

function openIconLibraryModal(mode = 'add') {
  iconLibraryMode = mode;
  const modal = document.getElementById('modal-icon-library');
  if (!modal) return;
  modal.style.display = 'flex';

  const returnContainer = document.getElementById('lib-return-hotspot-container');
  if (returnContainer) {
    returnContainer.style.display = (mode === 'drop' || mode === 'add') ? 'flex' : 'none';
  }

  currentLibCategory = 'All';
  currentLibSearch = '';
  const searchInput = document.getElementById('lib-search-input');
  if (searchInput) searchInput.value = '';

  document.querySelectorAll('.lib-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-filter') === 'All');
  });

  renderIconLibraryGrid();
}

function closeIconLibraryModal() {
  const modal = document.getElementById('modal-icon-library');
  if (modal) modal.style.display = 'none';
}

function filterIconLibrary(category, btnEl) {
  currentLibCategory = category;
  document.querySelectorAll('.lib-filter-btn').forEach(btn => btn.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
  renderIconLibraryGrid();
}

function onIconLibrarySearch(val) {
  currentLibSearch = String(val || '').toLowerCase().trim();
  renderIconLibraryGrid();
}

function renderIconLibraryGrid() {
  const grid = document.getElementById('icon-library-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const libItems = window.ICON_LIBRARY_ITEMS || [];
  const customItems = getCustomIcons();

  let combined = [
    ...libItems.map(item => ({ ...item, isCustom: false })),
    ...customItems.map(c => ({ name: c.name, family: 'Custom', type: 'Custom', svg: `<img src="${c.dataUrl || c.url}" style="width:48px; height:48px; object-fit:contain;">`, isCustom: true, dataUrl: c.dataUrl || c.url }))
  ];

  if (currentLibCategory !== 'All') {
    combined = combined.filter(item => String(item.family).toLowerCase() === String(currentLibCategory).toLowerCase() || (currentLibCategory === 'Custom' && item.isCustom));
  }
  if (currentLibSearch) {
    combined = combined.filter(item => String(item.name).toLowerCase().includes(currentLibSearch));
  }

  if (combined.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 40px; font-size: 13px;">No icons found matching your filter.</div>`;
    return;
  }

  if (!selectedLibraryIcon && combined.length > 0) {
    selectedLibraryIcon = combined[0];
  }

  combined.forEach(item => {
    const card = document.createElement('div');
    const isSel = selectedLibraryIcon && String(selectedLibraryIcon.name) === String(item.name);
    card.className = 'lib-icon-card' + (isSel ? ' selected' : '');
    card.innerHTML = `
      <div class="lib-icon-svg-wrap">
        ${item.svg}
      </div>
      <div class="lib-icon-label" title="${item.name}">${item.name}</div>
    `;
    card.onclick = () => {
      selectedLibraryIcon = item;
      renderIconLibraryGrid();
    };
    card.ondblclick = () => {
      selectedLibraryIcon = item;
      confirmIconLibrarySelection();
    };
    grid.appendChild(card);
  });
}

function confirmIconLibrarySelection() {
  if (!selectedLibraryIcon) {
    showToast("Please select an icon first");
    return;
  }
  closeIconLibraryModal();

  if (iconLibraryMode === 'drop' && pendingDrop) {
    commitPopoverFromLibrary(selectedLibraryIcon.name);
  } else if (iconLibraryMode === 'change' && selectedHotspotId) {
    onHotspotIconStyleChange(selectedLibraryIcon.name);
  } else {
    addHotspotFromLibrary(selectedLibraryIcon.name);
  }
}

async function addHotspotFromLibrary(iconStyle) {
  const isPole = String(iconStyle).toLowerCase() === 'pole pin' || String(iconStyle).toLowerCase() === 'landmark pin' || String(iconStyle).toLowerCase() === 'pole_pin' || String(iconStyle).toLowerCase() === 'landmark';
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));
  const targetScene = scenes.find(s => String(s._id) !== String(activeSceneId)) || scenes[0];
  if (!isPole && !targetScene) {
    showToast("Please add at least one more panorama scene first!");
    return;
  }

  const returnCb = document.getElementById('lib-return-hotspot-cb');
  const returnChecked = !isPole && (returnCb ? returnCb.checked : true);

  let ath = 0;
  let atv = 0;
  if (krpano && typeof krpano.get === 'function') {
    ath = Number(Number(krpano.get('view.hlookat') || 0).toFixed(2));
    atv = Number(Number(krpano.get('view.vlookat') || 0).toFixed(2));
  }

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: isPole ? 'Prince Palace' : (targetScene ? targetScene.title : 'Hotspot'),
        kind: isPole ? 'image' : 'scene',
        targetSceneId: isPole ? null : (targetScene ? targetScene._id : null),
        ath,
        atv,
        style: iconStyle,
        badgeLetter: isPole ? 'R' : '',
        color: isPole ? '#00a6e0' : '#ffffff'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    console.log("Hotspot created successfully from library:", newHotspot);

    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    if (isPole) {
      selectImageHotspot(newHotspot._id);
    } else {
      selectHotspot(newHotspot._id);
    }
    publishTourSilent();
    
    if (returnChecked && currentScene && !isPole && targetScene) {
      openReturnHotspotModal(targetScene, currentScene, iconStyle);
    } else {
      showToast(isPole ? `✓ Added Pole Pin landmark to scene` : `✓ Added "${iconStyle}" hotspot linking to ${targetScene.title}`);
    }
  } catch (err) {
    console.error("Error creating hotspot from library:", err);
    showToast(`Error: ${err.message}`);
  }
}

// Toast notification display
function showToast(message) {
  return; // Notifications disabled per user request
}
// =========================================================
// Drag & Drop Hotspot Creation from Library + Return Hotspot
// =========================================================
async function commitPopoverFromLibrary(chosenStyle) {
  if (!pendingDrop) return;
  const { ath, atv, targetScene } = pendingDrop;
  const isPole = String(chosenStyle).toLowerCase() === 'pole pin' || String(chosenStyle).toLowerCase() === 'landmark pin' || String(chosenStyle).toLowerCase() === 'pole_pin' || String(chosenStyle).toLowerCase() === 'landmark';
  const returnCb = document.getElementById('lib-return-hotspot-cb');
  const returnChecked = !isPole && (returnCb ? returnCb.checked : true);
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: isPole ? 'Prince Palace' : (targetScene ? targetScene.title : 'Hotspot'),
        kind: isPole ? 'image' : 'scene',
        targetSceneId: isPole ? null : (targetScene ? targetScene._id : null),
        ath,
        atv,
        style: chosenStyle,
        badgeLetter: isPole ? 'R' : '',
        color: isPole ? '#00a6e0' : '#ffffff'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    if (isPole) {
      selectImageHotspot(newHotspot._id);
    } else {
      selectHotspot(newHotspot._id);
    }
    publishTourSilent();

    if (returnChecked && currentScene && !isPole && targetScene) {
      openReturnHotspotModal(targetScene, currentScene, chosenStyle);
    } else {
      showToast(isPole ? "✓ Pole Pin added to scene!" : "✓ Hotspot created successfully!");
    }
  } catch (err) {
    console.error("Error creating hotspot from drop:", err);
    showToast("Error creating hotspot: " + err.message);
  }
}

// ==================== TARGET VIEW (START POINT) MODAL ====================
let pendingTargetView = null;

window.openTargetViewModal = function (targetScene, currentScene, chosenStyle, returnChecked, hotspotId) {
  pendingTargetView = { targetScene, currentScene, chosenStyle, returnChecked, hotspotId };

  const modal = document.getElementById('modal-target-view');
  if (!modal) return;

  const titleTag = document.getElementById('target-view-scene-title-tag');
  if (titleTag) titleTag.textContent = targetScene.title || "Target Scene";

  modal.style.display = 'flex';

  if (!window.targetViewKrpano) {
    embedpano({
      xml: "tour.xml",
      target: "target-view-pano-viewer",
      html5: "only",
      webglsettings: { preserveDrawingBuffer: true },
      onready: (kp) => {
        window.targetViewKrpano = kp;
        initTargetViewSceneViewer(targetScene);
      }
    });
  } else {
    initTargetViewSceneViewer(targetScene);
  }
};

window.closeTargetViewModal = function () {
  const modal = document.getElementById('modal-target-view');
  if (modal) modal.style.display = 'none';
  pendingTargetView = null;
};

function initTargetViewSceneViewer(targetScene) {
  if (!window.targetViewKrpano) return;
  try {
    const sceneName = getSceneKrpanoName(targetScene);
    window.targetViewKrpano.call(`loadscene('${sceneName}', null, MERGE, BLEND(0.5))`);
  } catch (e) {
    console.error("Error loading scene in target view viewer", e);
  }
}

window.confirmTargetViewPosition = async function () {
  if (!pendingTargetView || !window.targetViewKrpano) {
    closeTargetViewModal();
    return;
  }
  const { targetScene, currentScene, chosenStyle, returnChecked, hotspotId } = pendingTargetView;

  let targetAth = Number(Number(window.targetViewKrpano.get('view.hlookat') || 0).toFixed(2));
  let targetAtv = Number(Number(window.targetViewKrpano.get('view.vlookat') || 0).toFixed(2));
  let targetFov = Number(Number(window.targetViewKrpano.get('view.fov') || 114).toFixed(2));

  try {
    const res = await fetch('/api/hotspots/' + hotspotId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetAth, targetAtv, targetFov })
    });
    if (!res.ok) throw new Error('Failed to update target view');

    const hs = hotspots.find(h => String(h._id) === String(hotspotId));
    if (hs) {
      hs.targetAth = targetAth;
      hs.targetAtv = targetAtv;
      hs.targetFov = targetFov;
    }
    publishTourSilent();
    closeTargetViewModal();

    if (returnChecked && currentScene) {
      openReturnHotspotModal(targetScene, currentScene, chosenStyle);
    } else {
      showToast("✓ Hotspot created successfully with Target View!");
    }
  } catch (err) {
    console.error(err);
    showToast("Error updating target view: " + err.message);
  }
};

let pendingReturnHotspot = null;

window.openReturnHotspotModal = function (targetScene, currentScene, chosenStyle) {
  pendingReturnHotspot = { targetScene, currentScene, chosenStyle };

  const modal = document.getElementById('modal-return-hotspot');
  if (!modal) return;

  const titleTag = document.getElementById('return-scene-title-tag');
  if (titleTag) titleTag.textContent = targetScene.title || "Target Scene";

  modal.style.display = 'flex';

  const dotEl = document.getElementById('return-target-dot');
  const guidelineEl = document.getElementById('return-guideline-h');
  if (dotEl) {
    dotEl.style.left = '50%';
    dotEl.style.top = '50%';
  }
  if (guidelineEl) {
    guidelineEl.style.top = '50%';
  }

  const initialAth = (pendingDrop && pendingDrop.ath !== undefined) ? ((pendingDrop.ath + 180) % 360 - 180) : 0;
  const initialAtv = 0;

  if (!window.returnKrpano) {
    embedpano({
      xml: "tour.xml",
      target: "return-pano-viewer",
      html5: "only",
      webglsettings: { preserveDrawingBuffer: true },
      onready: (kp) => {
        window.returnKrpano = kp;
        initReturnSceneViewer(targetScene, initialAth, initialAtv);
      }
    });
  } else {
    initReturnSceneViewer(targetScene, initialAth, initialAtv);
  }
};

window.closeReturnHotspotModal = function () {
  const modal = document.getElementById('modal-return-hotspot');
  if (modal) modal.style.display = 'none';
  pendingReturnHotspot = null;
};

function initReturnSceneViewer(targetScene, ath, atv) {
  if (!window.returnKrpano) return;
  try {
    const sceneName = getSceneKrpanoName(targetScene);
    window.returnKrpano.call(`loadscene('${sceneName}', null, MERGE, BLEND(0.5))`);
    setTimeout(() => {
      if (window.returnKrpano) {
        window.returnKrpano.set("view.hlookat", ath);
        window.returnKrpano.set("view.vlookat", atv);
        window.returnKrpano.set("view.fov", 100);
      }
    }, 100);
  } catch (err) {
    console.error("Error loading scene in return pano viewer:", err);
  }
}

function setupReturnDotDragging() {
  const dotEl = document.getElementById('return-target-dot');
  const guidelineEl = document.getElementById('return-guideline-h');
  const viewerEl = document.getElementById('return-pano-viewer');
  if (!dotEl || !viewerEl) return;

  let isDragging = false;

  const startDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDragging = true;
    dotEl.style.cursor = 'grabbing';
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    const rect = viewerEl.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let x = clientX - rect.left;
    let y = clientY - rect.top;

    x = Math.max(12, Math.min(rect.width - 12, x));
    y = Math.max(12, Math.min(rect.height - 12, y));

    dotEl.style.left = `${x}px`;
    dotEl.style.top = `${y}px`;
    if (guidelineEl) {
      guidelineEl.style.top = `${y}px`;
    }
  };

  const endDrag = () => {
    if (isDragging) {
      isDragging = false;
      dotEl.style.cursor = 'grab';
    }
  };

  dotEl.addEventListener('mousedown', startDrag);
  dotEl.addEventListener('touchstart', startDrag, { passive: false });

  window.addEventListener('mousemove', onDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });

  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);
}

window.confirmReturnHotspotPosition = async function () {
  if (!pendingReturnHotspot) {
    closeReturnHotspotModal();
    return;
  }
  const { targetScene, currentScene, chosenStyle } = pendingReturnHotspot;

  let returnAth = 0;
  let returnAtv = 0;
  if (window.returnKrpano) {
    const viewerEl = document.getElementById('return-pano-viewer');
    const dotEl = document.getElementById('return-target-dot');
    let usedScreenToSphere = false;
    if (viewerEl && dotEl && typeof window.returnKrpano.screentosphere === 'function') {
      const viewerRect = viewerEl.getBoundingClientRect();
      const dotRect = dotEl.getBoundingClientRect();
      const dotX = (dotRect.left + dotRect.width / 2) - viewerRect.left;
      const dotY = (dotRect.top + dotRect.height / 2) - viewerRect.top;
      const sp = window.returnKrpano.screentosphere(dotX, dotY);
      if (sp && sp.x !== undefined && sp.y !== undefined) {
        returnAth = Number(Number(sp.x || 0).toFixed(2));
        returnAtv = Number(Number(sp.y || 0).toFixed(2));
        usedScreenToSphere = true;
      }
    }
    if (!usedScreenToSphere && typeof window.returnKrpano.get === 'function') {
      returnAth = Number(Number(window.returnKrpano.get('view.hlookat') || 0).toFixed(2));
      returnAtv = Number(Number(window.returnKrpano.get('view.vlookat') || 0).toFixed(2));
    }
  }

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: targetScene._id,
        title: `GO TO ${currentScene.title.toUpperCase()}`,
        kind: 'scene',
        targetSceneId: currentScene._id,
        ath: returnAth,
        atv: returnAtv,
        style: chosenStyle
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create return hotspot');

    const newReturnHotspot = data.hotspot;
    hotspots.push(newReturnHotspot);

    if (String(activeSceneId) === String(targetScene._id)) {
      addHotspotToKrpano(newReturnHotspot);
      renderCurrentSceneHotspots();
    }
    publishTourSilent();

    closeReturnHotspotModal();
    showToast("✓ Hotspot and Return Hotspot created successfully!");
  } catch (err) {
    console.error("Error creating return hotspot:", err);
    showToast("Error creating return hotspot: " + err.message);
  }
};

window.openSelectTargetSceneModal = function () {
  const modal = document.getElementById('modal-select-panorama');
  const grid = document.getElementById('select-panorama-grid');
  if (!modal || !grid) return;
  
  // Reset modal state to step 1
  document.getElementById('modal-select-panorama-step1').style.display = 'block';
  document.getElementById('modal-select-panorama-step2').style.display = 'none';
  document.getElementById('modal-select-panorama-back-btn').style.display = 'none';
  document.getElementById('modal-select-panorama-title').textContent = 'Select Target Panorama';
  document.getElementById('modal-select-panorama-box').style.height = '560px';

  grid.innerHTML = '';
  scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'editor-scene-card';
    card.style.cursor = 'pointer';
    card.onclick = () => window.selectTargetPanoramaFromModal(scene._id, scene.title);

    const targetInput = document.getElementById('prop-hs-target-scene');
    if (targetInput && String(scene._id) === String(targetInput.value)) {
      card.classList.add('active');
    }

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'editor-scene-thumb-wrap';
    const img = document.createElement('img');
    img.className = 'editor-scene-thumb';
    const t = new Date().getTime();
    const origBaseName = getOriginalBaseName(scene);
    const tilesFolder = scene.tilesFolder || (origBaseName + '.tiles');
    img.src = `panos/${tilesFolder}/thumb.jpg?t=${t}`;
    img.onerror = () => { img.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzc3NyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBUaHVtYjwvdGV4dD48L3N2Zz4='; };
    thumbWrap.appendChild(img);

    const titleDiv = document.createElement('div');
    titleDiv.className = 'editor-scene-name';
    titleDiv.textContent = scene.title;

    card.appendChild(thumbWrap);
    card.appendChild(titleDiv);
    grid.appendChild(card);
  });

  modal.style.display = 'flex';
};

window.closeSelectTargetSceneModal = function () {
  const modal = document.getElementById('modal-select-panorama');
  if (modal) modal.style.display = 'none';
  window._tempSelectedTargetSceneId = null;
  window._tempSelectedTargetSceneTitle = null;
};

window.selectTargetPanoramaFromModal = function (sceneId, sceneTitle) {
  // Store the temporarily selected scene
  window._tempSelectedTargetSceneId = sceneId;
  window._tempSelectedTargetSceneTitle = sceneTitle;

  // Transition to Step 2
  document.getElementById('modal-select-panorama-step1').style.display = 'none';
  document.getElementById('modal-select-panorama-step2').style.display = 'flex';
  document.getElementById('modal-select-panorama-back-btn').style.display = 'block';
  document.getElementById('modal-select-panorama-title').textContent = 'Initial View Options';
  document.getElementById('modal-select-panorama-box').style.height = '660px';
  document.getElementById('modal-select-panorama-target-name').textContent = sceneTitle;

  // Initialize the radio buttons from the current hotspot state
  const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
  const currentMode = (hs && hs.targetViewMode) ? hs.targetViewMode : 'start_point';
  const radios = document.getElementsByName('targetViewModeRadio');
  for (const radio of radios) {
    if (radio.value === currentMode) {
      radio.checked = true;
    }
  }

  updateCustomViewBtnVisibility();
};

window.showSelectPanoramaGrid = function () {
  document.getElementById('modal-select-panorama-step1').style.display = 'block';
  document.getElementById('modal-select-panorama-step2').style.display = 'none';
  document.getElementById('modal-select-panorama-back-btn').style.display = 'none';
  document.getElementById('modal-select-panorama-title').textContent = 'Select Target Panorama';
  document.getElementById('modal-select-panorama-box').style.height = '560px';
};

window.updateCustomViewBtnVisibility = function () {
  const customControls = document.getElementById('modal-select-panorama-custom-controls');
  const customPlaceholder = document.getElementById('custom-view-placeholder');
  const customStatus = document.getElementById('modal-select-panorama-custom-status');
  const checkedRadio = document.querySelector('input[name="targetViewModeRadio"]:checked');

  if (checkedRadio && checkedRadio.value === 'custom') {
    if (customControls) customControls.style.display = 'flex';
    if (customPlaceholder) customPlaceholder.style.display = 'none';
    openCustomViewModal();
    const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
    if (hs && hs.targetAth !== undefined && hs.targetAtv !== undefined) {
      if (customStatus) {
        customStatus.style.display = 'block';
        customStatus.textContent = `Custom view saved: H=${Number(hs.targetAth).toFixed(1)}, V=${Number(hs.targetAtv).toFixed(1)}`;
      }
    } else {
      if (customStatus) customStatus.style.display = 'none';
    }
  } else {
    if (customControls) customControls.style.display = 'none';
    if (customPlaceholder) customPlaceholder.style.display = 'flex';
  }
};

window.confirmTargetSceneAndViewMode = async function () {
  if (!selectedHotspotId || !window._tempSelectedTargetSceneId) return;

  const sceneId = window._tempSelectedTargetSceneId;
  const sceneTitle = window._tempSelectedTargetSceneTitle;
  const checkedRadio = document.querySelector('input[name="targetViewModeRadio"]:checked');
  const viewMode = checkedRadio ? checkedRadio.value : 'start_point';

  const targetInput = document.getElementById('prop-hs-target-scene');
  const targetDisplay = document.getElementById('prop-hs-target-scene-display');
  const targetImg = document.getElementById('prop-hs-target-scene-img');

  if (targetInput && targetDisplay) {
    targetInput.value = sceneId;
    targetDisplay.textContent = sceneTitle;
    
    const targetScene = scenes.find(s => String(s._id) === String(sceneId));
    if (targetScene && targetImg) {
      const origBaseName = getOriginalBaseName(targetScene);
      const thumbUrl = `panos/${targetScene.tilesFolder || origBaseName + '.tiles'}/thumb.jpg?t=${targetScene._lastThumbUpdate || 1}`;
      targetImg.src = thumbUrl;
      targetImg.style.display = 'block';
    } else {
      if (targetImg) targetImg.style.display = 'none';
    }

    // If custom view is active, automatically lock in the view coordinates before saving the mode
    if (viewMode === 'custom' && customViewKrpano) {
      const hs = hotspots.find(h => String(h._id) === String(selectedHotspotId));
      if (hs) {
        const cath = Number(customViewKrpano.get('view.hlookat')).toFixed(2);
        const catv = Number(customViewKrpano.get('view.vlookat')).toFixed(2);
        const cfov = Number(customViewKrpano.get('view.fov')).toFixed(2);
        hs.targetAth = Number(cath);
        hs.targetAtv = Number(catv);
        hs.targetFov = Number(cfov);
        
        try {
          await fetch(`/api/hotspots/${selectedHotspotId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetAth: Number(cath), targetAtv: Number(catv), targetFov: Number(cfov) })
          });
        } catch (err) {
          console.error("Auto-save custom view error:", err);
        }
      }
    }

    // 1. Save Target Scene
    await window.onHotspotTargetSceneChange(sceneId);
    
    // 2. Save Target View Mode
    await window.onHotspotTargetViewModeChange(viewMode);
  }
  
  window.closeSelectTargetSceneModal();
};

// ==================== WELCOME MODAL ====================

async function openWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.style.display = 'flex';

  try {
    const res = await fetch('/api/tours');
    const data = await res.json();
    renderWelcomeRecentProjects(data.tours || []);
  } catch (err) {
    console.error("Failed to load recent projects for welcome modal", err);
  }
}

function closeWelcomeModal() {
  const modal = document.getElementById('welcome-modal');
  if (modal) modal.style.display = 'none';
  sessionStorage.setItem('welcomeModalSkipped', 'true');
}

function renderWelcomeRecentProjects(tours) {
  const grid = document.getElementById('welcome-recent-grid');
  if (!grid) return;

  grid.innerHTML = '';

  tours.forEach(tour => {
    const card = document.createElement('div');
    card.className = 'welcome-recent-card';
    card.onclick = () => {
      sessionStorage.setItem('welcomeModalSkipped', 'true');
      window.location.href = `?tour=${encodeURIComponent(tour.id)}`;
    };

    const fallbackThumb = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzc3NyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBUaHVtYjwvdGV4dD48L3N2Zz4=';
    const thumbUrl = tour.thumbnail 
      ? `/api/tours/${encodeURIComponent(tour.id)}/thumbnail?t=` + Date.now() 
      : fallbackThumb;

    const dateStr = tour.date ? new Date(tour.date).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="welcome-recent-card-img-wrap">
        <img src="${thumbUrl}" alt="${tour.title}" onerror="this.onerror=null; this.src='${fallbackThumb}';">
      </div>
      <div class="welcome-recent-card-info">
        <div class="welcome-recent-card-date">${dateStr}</div>
        <div class="welcome-recent-card-title">${tour.title}</div>
      </div>
    `;
    grid.appendChild(card);
  });
}

// ==================== TAG COLOR LOGIC ====================
function getTagStyle(tagName) {
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `background: hsl(${hue}, 70%, 40%); color: #fff; border: 1px solid hsl(${hue}, 70%, 60%);`;
}

// ==================== MEDIA PANEL LOGIC ====================

function renderMediaAssets() {
  const grid = document.getElementById('media-assets-grid');
  if (!grid) return;
  grid.innerHTML = '';

  assets.forEach((asset, index) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.id = asset._id;

    const t = new Date().getTime();
    const imgUrl = `${asset.url}?t=${t}`;
    const fallbackSvg = "data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'200\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231d1d26\\'/></svg>";

    card.innerHTML = `
      <div class="image-card-thumb-wrap">
        <img class="image-card-thumb" src="${imgUrl}" alt="${asset.name}" onerror="this.src='${fallbackSvg}'">
        <div class="image-card-tags-overlay">
          ${asset.tags && asset.tags.length > 0
            ? asset.tags.map(t => `<span class="tag-chip" style="${getTagStyle(t)}">${t}</span>`).join('')
            : `<span class="image-card-badge" style="position:relative; top:0; left:0;">IMAGE #${index + 1}</span>`
          }
        </div>
      </div>
      <div class="image-card-body">
        <div class="image-card-info">
          <div class="image-card-title" title="Double-click to edit: ${asset.name}" ondblclick="editAssetTitle(event, '${asset._id}')">${asset.name}</div>
        </div>
        <div class="image-card-actions">
          <button class="card-action-btn edit" title="Edit Asset Title" onclick="editAssetTitle(event, '${asset._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button class="card-action-btn" title="View Asset" onclick="viewAsset(event, '${asset.url}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"></path></svg>
          </button>
          <button class="card-action-btn delete" title="Delete Asset" onclick="deleteAssetEvent(event, '${asset._id}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>
    `;

    if (selectedMediaIds.has(asset._id)) {
      card.classList.add('selected');
    }

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn') || e.target.closest('input')) return;
      toggleMediaSelectionOnClick(e, asset._id, 'asset');
    });

    grid.appendChild(card);
  });
}

async function editAssetTitle(e, assetId) {
  if (e) e.stopPropagation();
  const asset = assets.find(a => String(a._id) === String(assetId));
  if (!asset) return;

  const card = e ? e.currentTarget.closest('.image-card') : null;
  const titleEl = card ? card.querySelector('.image-card-title') : null;

  const saveTitle = async (newTitle) => {
    try {
      const res = await fetch(`/api/assets/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTitle })
      });
      if (!res.ok) throw new Error('Failed to update asset');
      asset.name = newTitle;
      renderMediaAssets();
      showToast('Asset name updated');
    } catch (err) {
      console.error('Error updating asset name:', err);
      showToast('Error updating asset name');
      if (titleEl) titleEl.innerText = asset.name;
    }
  };

  if (!titleEl) {
    const newName = prompt('Enter new name for this asset:', asset.name);
    if (newName !== null && newName.trim() !== '' && newName.trim() !== asset.name) {
      await saveTitle(newName.trim());
    }
    return;
  }

  if (titleEl.querySelector('input')) return;

  const currentTitle = asset.name || '';
  const escapedTitle = String(currentTitle).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  titleEl.innerHTML = `<input type="text" class="inline-title-input" value="${escapedTitle}" style="width: 130px; background: #14141d; border: 1px solid #10b981; color: #fff; border-radius: 6px; padding: 4px 8px; font-size: 14px; font-weight: 700; outline: none; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.2);">`;

  const input = titleEl.querySelector('input');
  input.focus();
  input.select();

  let isSaving = false;
  const save = async () => {
    if (isSaving) return;
    isSaving = true;
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== asset.name) {
      await saveTitle(newTitle);
    } else {
      titleEl.innerText = asset.name;
    }
  };

  input.addEventListener('blur', save);
  input.addEventListener('keydown', (e2) => {
    if (e2.key === 'Enter') {
      save();
    } else if (e2.key === 'Escape') {
      isSaving = true;
      titleEl.innerText = asset.name;
    }
  });
}

function viewAsset(e, assetUrl) {
  if (e) e.stopPropagation();
  const t = new Date().getTime();
  window.open(`${assetUrl}?t=${t}`, '_blank');
}

function deleteAssetEvent(e, assetId) {
  if (e) e.stopPropagation();
  deleteAsset(assetId);
}

async function uploadAsset(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const btn = document.querySelector('#media-tab-assets .btn-upload-center');
  if (btn) btn.innerHTML = '<span>Uploading...</span>';

  let uploadedCount = 0;
  try {
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      const res = await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/assets/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload asset');
      assets.push(data.asset);
      uploadedCount++;
    }
    renderMediaAssets();
    showToast(`${uploadedCount} asset(s) uploaded successfully`);
  } catch (err) {
    console.error("Asset upload error:", err);
    showToast("Upload failed: " + err.message);
  } finally {
    if (btn) {
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="17 8 12 3 7 8"></polyline>
        <line x1="12" y1="3" x2="12" y2="15"></line>
      </svg><span>upload</span>`;
    }
    e.target.value = ''; // reset input
  }
}

async function deleteAsset(assetId) {
  if (!confirm('Are you sure you want to delete this asset?')) return;
  try {
    const res = await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete asset');
    assets = assets.filter(a => String(a._id) !== String(assetId));
    selectedMediaIds.delete(assetId);
    updateBulkActionBar();
    renderMediaAssets();
  } catch (err) {
    console.error("Delete asset error:", err);
    showToast("Failed to delete asset");
  }
}

// ==================== BULK TAGGING LOGIC ====================

let selectedMediaIds = new Set();
let selectedMediaType = null; // 'scene' or 'asset'
let lastSelectedMediaId = null;

function toggleMediaSelectionOnClick(e, id, type) {
  if (e) e.preventDefault(); // Prevent default text selection if shift clicking
  
  const itemsArray = type === 'scene' ? scenes : assets;
  const currentIndex = itemsArray.findIndex(i => String(i._id) === String(id));
  
  // If shift is held and we have a previous selection
  if (e && e.shiftKey && lastSelectedMediaId) {
    const lastIndex = itemsArray.findIndex(i => String(i._id) === String(lastSelectedMediaId));
    if (lastIndex !== -1 && currentIndex !== -1) {
      const start = Math.min(lastIndex, currentIndex);
      const end = Math.max(lastIndex, currentIndex);
      for (let i = start; i <= end; i++) {
        selectedMediaIds.add(itemsArray[i]._id);
      }
    }
  } else {
    // Standard click toggles selection
    if (selectedMediaIds.has(id)) {
      selectedMediaIds.delete(id);
      if (lastSelectedMediaId === id) {
        lastSelectedMediaId = null;
      }
    } else {
      selectedMediaIds.add(id);
      lastSelectedMediaId = id;
    }
  }
  
  selectedMediaType = type;
  
  // Re-render to show updated selected states
  if (type === 'scene') {
    renderMediaScenes();
  } else {
    renderMediaAssets();
  }
  
  updateBulkActionBar();
}

function clearSelection() {
  selectedMediaIds.clear();
  lastSelectedMediaId = null;
  updateBulkActionBar();
  // re-render to uncheck boxes
  renderMediaScenes();
  renderMediaAssets();
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulk-action-bar');
  const text = document.getElementById('bulk-action-text');
  const openEditorBtn = document.getElementById('bulk-open-editor-btn');
  if (!bar || !text) return;
  
  if (selectedMediaIds.size > 0) {
    text.textContent = `${selectedMediaIds.size} Selected`;
    bar.classList.add('visible');
    
    if (openEditorBtn) {
      if (selectedMediaIds.size === 1 && selectedMediaType === 'scene') {
        openEditorBtn.style.display = 'flex';
      } else {
        openEditorBtn.style.display = 'none';
      }
    }
  } else {
    bar.classList.remove('visible');
  }
}

function openSelectedSceneInEditor() {
  if (selectedMediaIds.size === 1 && selectedMediaType === 'scene') {
    const sceneId = Array.from(selectedMediaIds)[0];
    openSceneInHotspotEditor(null, sceneId);
    clearSelection();
  }
}

function openBulkTagModal() {
  document.getElementById('modal-bulk-tag').style.display = 'flex';
  document.getElementById('bulk-tag-input').value = '';
  document.getElementById('bulk-tag-input').focus();
}

function closeBulkTagModal() {
  document.getElementById('modal-bulk-tag').style.display = 'none';
}

async function applyBulkTag() {
  const tagInput = document.getElementById('bulk-tag-input').value.trim();
  if (!tagInput) {
    showToast("Tag cannot be empty");
    return;
  }
  
  closeBulkTagModal();
  showToast(`Applying tag to ${selectedMediaIds.size} items...`);
  
  let successCount = 0;
  let itemsArray = selectedMediaType === 'scene' ? scenes : assets;
  const endpointBase = selectedMediaType === 'scene' ? '/api/scenes' : '/api/assets';
  
  for (const id of selectedMediaIds) {
    const item = itemsArray.find(i => String(i._id) === String(id));
    if (!item) continue;
    
    let currentTags = item.tags || [];
    if (!currentTags.includes(tagInput)) {
      currentTags.push(tagInput);
    }
    
    try {
      const res = await fetch(`${endpointBase}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: currentTags })
      });
      if (res.ok) {
        item.tags = currentTags;
        successCount++;
      }
    } catch (err) {
      console.error(`Failed to tag item ${id}`, err);
    }
  }
  
  showToast(`Successfully tagged ${successCount} items.`);
  clearSelection();
  publishTourSilent();
}

async function reorderScene(draggedId, targetId) {
  const draggedIndex = scenes.findIndex(s => s._id === draggedId);
  const targetIndex = scenes.findIndex(s => s._id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) return;

  const [draggedScene] = scenes.splice(draggedIndex, 1);
  scenes.splice(targetIndex, 0, draggedScene);

  renderMediaScenes();
  renderScenes();

  try {
    const res = await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/scenes/reorder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedSceneIds: scenes.map(s => s._id) })
    });
    if (!res.ok) throw new Error('Failed to save order');
    publishTourSilent();
  } catch (err) {
    console.error(err);
    showToast('Failed to save scene order');
  }
}

