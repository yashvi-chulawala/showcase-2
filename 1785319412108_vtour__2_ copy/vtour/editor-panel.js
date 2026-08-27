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

// Global application navigation interface for Voice Assistant
window.appNavigation = {
  navigateToPano: function(targetSceneId) {
    if (!targetSceneId || !scenes || scenes.length === 0) return;
    const targetScene = scenes.find(s => String(s._id) === String(targetSceneId) || String(s.slug) === String(targetSceneId));
    if (targetScene) {
      console.log("[appNavigation] Voice navigating to scene:", targetScene.title);
      selectScene(targetScene);
    } else {
      console.warn("[appNavigation] Scene target not found:", targetSceneId);
    }
  }
};

// Tell the backend which tour is currently active so it can serve the correct local files
fetch('/api/system/set-active-tour', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tourId: currentTourId })
}).catch(console.error);

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

// Custom hotspot icons stored in localStorage
function getCustomIcons() {
  try {
    const raw = localStorage.getItem('custom_hotspot_icons');
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    return [];
  }
}

function saveCustomIcon(iconObj) {
  const list = getCustomIcons();
  list.push(iconObj);
  localStorage.setItem('custom_hotspot_icons', JSON.stringify(list));
}

function removeCustomIcon(iconId) {
  let list = getCustomIcons();
  list = list.filter(x => String(x.id) !== String(iconId));
  localStorage.setItem('custom_hotspot_icons', JSON.stringify(list));
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

// Generate inline Base64 data URI for SVG icons or standalone Text style
function getHotspotSvgBase64(style, labelText, color, bgColor, textStyle) {
  const s = String(style || 'Arrow').toLowerCase();
  const fillCol = color || '#ffffff';

  if (style && String(style).startsWith('data:image/')) {
    return style;
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
        <text x="150" y="50" text-anchor="middle" fill="${fillCol}" font-family="'Outfit', -apple-system, sans-serif" font-weight="800" font-size="28" letter-spacing="1">${textStr}</text>
      </g>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(textSvg)))}`;
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
      <circle cx="32" cy="32" r="28" fill="#10b981" stroke="#ffffff" stroke-width="4"/>
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
    xml: "tour.xml",
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
    spheretoscreen(ath, atv, hotspotcenterx, hotspotcentery);
    sub(drag_dx, mouse.stagex, hotspotcenterx);
    sub(drag_dy, mouse.stagey, hotspotcentery);
    asyncloop(pressed,
      sub(dx, mouse.stagex, drag_dx);
      sub(dy, mouse.stagey, drag_dy);
      screentosphere(dx, dy, ath, atv);
    ,
      js(onHotspotDragEnd(get(name), get(ath), get(atv)));
    );
  `;
  krpano.set("action[draghotspot].content", dragActionCode);

  krpano.set("events[cms_events].keep", true);
  krpano.set("events[cms_events].onnewscene", "js(onKrpanoNewScene())");
  krpano.set("events[cms_events].onclick", "js(window.onPanoBackgroundClicked())");

  loadTourData();
}

window.onKrpanoNewScene = function () {
  setTimeout(() => {
    renderCurrentSceneHotspots();
  }, 50);
};

// Fetch scenes and hotspots from API
async function loadTourData() {
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

    if (window.sceneRegistry) {
      window.sceneRegistry.registerScenes(scenes);
    }

    renderMediaScenes();
    renderMediaIcons();
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

// Silent background publish so tour.html is always up-to-date with auto-saved changes
async function publishTourSilent() {
  try {
    await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/publish`, { method: 'POST' });
  } catch (err) {
    console.warn("Silent publish error:", err.message);
  }
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

    renderMediaScenes();
    renderMediaIcons();
    updateBadges();
  } else if (page === 'hotspot') {
    if (btnHotspot) btnHotspot.classList.add('active');
    if (pageMedia) pageMedia.style.display = 'none';
    if (mediaSubBar) mediaSubBar.style.display = 'none';
    if (pageHotspot) pageHotspot.style.display = 'flex';

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

async function openProjectAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  try {
    const res = await fetch('/api/system/pick-folder');
    const data = await res.json();
    if (data.path) {
      window.location.href = `?tour=${encodeURIComponent(data.path)}`;
    }
  } catch (err) {
    showToast("Error picking folder: " + err.message);
  }
}

async function newProjectAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  try {
    const res = await fetch('/api/system/pick-save?title=' + encodeURIComponent('Save New Project'));
    const data = await res.json();
    if (!data.path) return;

    const finalName = data.path;
    if (confirm(`Are you sure you want to start/reset project in "${finalName}"? This will clear its database entries.`)) {
      const resetRes = await fetch(`/api/tours/${encodeURIComponent(finalName)}/reset`, { method: 'POST' });
      if (!resetRes.ok) throw new Error('Failed to reset project');
      await fetch(`/api/tours/${encodeURIComponent(finalName)}/publish`, { method: 'POST' });
      showToast("Project created successfully! Reloading...");
      sessionStorage.setItem('welcomeModalSkipped', 'true');
      setTimeout(() => window.location.href = `?tour=${encodeURIComponent(finalName)}`, 1000);
    }
  } catch (err) {
    console.error(err);
    showToast("Error starting new project: " + err.message);
  }
}

async function saveAsAction() {
  const dropdown = document.getElementById('file-dropdown');
  if (dropdown) dropdown.style.display = 'none';

  try {
    const res = await fetch('/api/system/pick-save?title=' + encodeURIComponent('Save Project As'));
    const data = await res.json();
    if (!data.path) return;

    const newProjectName = data.path;
    const cloneRes = await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTourId: newProjectName })
    });
    if (!cloneRes.ok) throw new Error('Failed to clone project');
    showToast("Project exported! Redirecting...");
    setTimeout(() => window.location.href = `?tour=${encodeURIComponent(newProjectName)}`, 1000);
  } catch (err) {
    console.error(err);
    showToast("Error saving project: " + err.message);
  }
}

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

function openImageHotspotTool() {
  const popover = document.getElementById('hotspot-popover');
  if (!popover) return;

  const containerRect = document.getElementById('pano-container').getBoundingClientRect();
  popover.style.left = `${Math.max(20, containerRect.width / 2 - 140)}px`;
  popover.style.top = `${Math.max(20, containerRect.height / 2 - 150)}px`;
  popover.style.display = 'flex';
  updatePopoverIconGrid();
  showToast("Select an icon style to place Image Hotspot");
}

function updatePopoverIconGrid() {
  const grid = document.getElementById('popover-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const defaults = [
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

    const origBaseName = getOriginalBaseName(scene);
    const thumbUrl = `panos/${scene.tilesFolder || origBaseName + '.tiles'}/thumb.jpg?t=${scene._lastThumbUpdate || 1}`;

    card.innerHTML = `
      <div class="image-card-thumb-wrap">
        <img class="image-card-thumb" src="${thumbUrl}" alt="${scene.title}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\'200\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231d1d26\\'//></svg>'">
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

function renderMediaIcons() {
  const grid = document.getElementById('media-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const defaultIcons = window.ICON_LIBRARY_ITEMS || [];

  const customIcons = getCustomIcons();

  defaultIcons.forEach(icon => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    card.innerHTML = `
      <div class="icon-card-svg-wrap">
        ${icon.svg}
      </div>
      <div class="icon-card-label">${icon.name}</div>
    `;
    card.addEventListener('click', () => {
      showToast(`Selected icon style: "${icon.name}" • Available in Hotspot Editor`);
    });
    grid.appendChild(card);
  });

  customIcons.forEach(icon => {
    const card = document.createElement('div');
    card.className = 'icon-card';
    card.innerHTML = `
      <button class="card-action-btn delete" title="Delete Custom Icon" onclick="deleteCustomIconAction(event, '${icon.id}')" style="position:absolute; top:6px; right:6px; width:22px; height:22px;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
      <div class="icon-card-svg-wrap" style="overflow:hidden;">
        <img src="${icon.dataUrl}" alt="${icon.name}" style="width:34px; height:34px; object-fit:contain;">
      </div>
      <div class="icon-card-label" title="${icon.name}">${icon.name}</div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-action-btn')) return;
      showToast(`Selected custom icon: "${icon.name}" • Available in Hotspot Editor`);
    });
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
        <img class="editor-scene-thumb" src="${thumbUrl}" alt="thumb" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'200\\' height=\'84\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%2327272a\\'//></svg>'">
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
  if (window.sceneRegistry) {
    window.sceneRegistry.setCurrentScene(scene._id);
  }
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
  const latInput = document.getElementById('prop-pano-lat');
  const lngInput = document.getElementById('prop-pano-lng');
  if (latInput) latInput.value = scene.lat !== undefined && scene.lat !== null ? scene.lat : '';
  if (lngInput) lngInput.value = scene.lng !== undefined && scene.lng !== null ? scene.lng : '';

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

async function savePanoGPS() {
  if (!activeSceneId) return;
  const latInput = document.getElementById('prop-pano-lat');
  const lngInput = document.getElementById('prop-pano-lng');
  if (!latInput || !lngInput) return;

  const lat = latInput.value.trim();
  const lng = lngInput.value.trim();

  const sc = scenes.find(s => String(s._id) === String(activeSceneId));
  if (!sc) return;

  try {
    const res = await fetch('/api/scenes/' + activeSceneId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng })
    });
    if (!res.ok) throw new Error('Failed to save GPS data');

    sc.lat = lat === '' ? null : Number(lat);
    sc.lng = lng === '' ? null : Number(lng);
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
        style: 'Text'
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
  const returnCb = document.getElementById('popover-return-cb');
  const returnChecked = returnCb ? returnCb.checked : true;
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));

  closePopover();

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: targetScene.title,
        kind: 'scene',
        targetSceneId: targetScene._id,
        ath,
        atv,
        style: chosenStyle
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);

    if (returnChecked && currentScene) {
      const returnRes = await fetch('/api/hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId: targetScene._id,
          title: `GO TO ${currentScene.title.toUpperCase()}`,
          kind: 'scene',
          targetSceneId: activeSceneId,
          ath: 0,
          atv: 0,
          style: chosenStyle
        })
      });
      const returnData = await returnRes.json();
      if (returnRes.ok) {
        hotspots.push(returnData.hotspot);
      }
    }

    addHotspotToKrpano(newHotspot, targetScene);
    renderCurrentSceneHotspots();
    window._lastHotspotClickTime = Date.now();
    selectHotspot(newHotspot._id);
    publishTourSilent();
    showToast(`✓ Auto-saved hotspot to "${targetScene.title}"`);
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
  const svgBase64 = getHotspotSvgBase64(styleName, hotspot.title, hotspot.color, hotspot.bgColor, hotspot.textStyle);

  krpano.call(`addhotspot(${name})`);
  krpano.set(`hotspot[${name}].url`, svgBase64);
  krpano.set(`hotspot[${name}].ath`, Number(hotspot.ath));
  krpano.set(`hotspot[${name}].atv`, Number(hotspot.atv));
  krpano.set(`hotspot[${name}].scale`, hotspot.scale !== undefined ? Number(hotspot.scale) : 0.85);
  krpano.set(`hotspot[${name}].alpha`, 1.0);
  krpano.set(`hotspot[${name}].visible`, true);
  krpano.set(`hotspot[${name}].zorder`, 100);
  krpano.set(`hotspot[${name}].enabled`, true);
  krpano.set(`hotspot[${name}].capture`, true);

  if (styleName === 'Text' || hotspot.kind === 'info') {
    const isArea = (hotspot.textStyle === 'area' || hotspot.textStyle === 'box');
    if (isArea) {
      krpano.set(`hotspot[${name}].distorted`, true);
      krpano.set(`hotspot[${name}].rx`, hotspot.rx !== undefined ? Number(hotspot.rx) : -70);
      krpano.set(`hotspot[${name}].ry`, 0);
      krpano.set(`hotspot[${name}].rz`, 0);
    } else {
      krpano.set(`hotspot[${name}].distorted`, false);
      krpano.set(`hotspot[${name}].rx`, 0);
    }
  }

  krpano.set(`hotspot[${name}].onclick`, `js(onHotspotClicked('${hotspot._id}'))`);
  krpano.set(`hotspot[${name}].ondown`, "draghotspot();");
}

// Hotspot clicked handler
window.onHotspotClicked = function (hotspotId) {
  window._lastHotspotClickTime = Date.now();
  console.log("Hotspot clicked:", hotspotId);
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (hs) {
    showToast(`Selected hotspot: "${hs.title}"`);
    openPropertyRightPanel('hotspot');
    selectHotspot(hotspotId);
  }
};

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
  const panelPano = document.getElementById('panel-pano-properties');
  const panelHotspot = document.getElementById('panel-hotspot-properties');
  const panelText = document.getElementById('panel-text-properties');

  if (btnPano) btnPano.classList.remove('active');
  if (btnHotspot) btnHotspot.classList.remove('active');

  if (panelPano) panelPano.style.display = 'none';
  if (panelHotspot) panelHotspot.style.display = 'none';
  if (panelText) panelText.style.display = 'none';

  if (panel === 'pano') {
    if (btnPano) btnPano.classList.add('active');
    if (panelPano) panelPano.style.display = 'block';
  } else if (panel === 'hotspot') {
    if (btnHotspot) btnHotspot.classList.add('active');
    if (panelHotspot) panelHotspot.style.display = 'block';
  } else if (panel === 'text') {
    if (btnHotspot) btnHotspot.classList.add('active');
    if (panelText) panelText.style.display = 'block';
  }
}

// Switch Property Editor between Panorama, Hotspot, and Text tabs
function switchPropertyPanel(panel) {
  showTabOnly(panel);

  if (panel === 'hotspot') {
    if (selectedHotspotId && hotspots.some(h => String(h._id) === String(selectedHotspotId) && (h.style === 'Text' || h.kind === 'info'))) {
      showTabOnly('text');
      selectTextHotspot(selectedHotspotId);
      return;
    }
    const currentSceneHotspots = hotspots.filter(h => String(h.sceneId) === String(activeSceneId) && h.style !== 'Text' && h.kind !== 'info');
    if (selectedHotspotId && hotspots.some(h => String(h._id) === String(selectedHotspotId) && h.style !== 'Text' && h.kind !== 'info')) {
      selectHotspot(selectedHotspotId);
    } else {
      renderEmptyHotspotPanel();
    }
  } else if (panel === 'text') {
    if (selectedHotspotId && hotspots.some(h => String(h._id) === String(selectedHotspotId) && (h.style === 'Text' || h.kind === 'info'))) {
      selectTextHotspot(selectedHotspotId);
    } else {
      renderEmptyTextPanel();
    }
  }
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
}

// Select a Hotspot and populate Hotspot Property Editor
function selectHotspot(hotspotId) {
  selectedHotspotId = hotspotId;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;

  if (hs.style === 'Text' || hs.kind === 'info') {
    selectTextHotspot(hotspotId);
    return;
  }

  console.log("Selecting hotspot for property editing:", hs);

  showTabOnly('hotspot');

  const emptyEl = document.getElementById('prop-hs-empty-state');
  const contentEl = document.getElementById('prop-hs-content-state');
  const detailsEl = document.getElementById('prop-hs-details-section');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  if (detailsEl) detailsEl.style.display = 'block';

  const titleEl = document.getElementById('prop-hs-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">ACTIVE:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }

  renderHotspotIconPickerGrid(hs.style || 'Arrow');

  const actionEl = document.getElementById('prop-hs-action');
  if (actionEl) actionEl.value = 'scene';

  const targetInput = document.getElementById('prop-hs-target-scene');
  const targetDisplay = document.getElementById('prop-hs-target-scene-display');
  if (targetInput && targetDisplay) {
    targetInput.value = hs.targetSceneId || '';
    const targetScene = scenes.find(s => String(s._id) === String(hs.targetSceneId));
    targetDisplay.textContent = targetScene ? targetScene.title : 'Select Panorama';
  }

  const transSelect = document.getElementById('prop-hs-transition');
  if (transSelect) {
    transSelect.value = hs.transition || 'BLEND(0.5)';
  }
}

// Select a Text Hotspot and populate Text Property Editor
function selectTextHotspot(hotspotId) {
  selectedHotspotId = hotspotId;
  const hs = hotspots.find(h => String(h._id) === String(hotspotId));
  if (!hs) return;

  console.log("Selecting text hotspot for property editing:", hs);
  showTabOnly('text');

  const emptyEl = document.getElementById('prop-text-empty-state');
  const contentEl = document.getElementById('prop-text-content-state');
  const detailsEl = document.getElementById('prop-text-details-section');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
  if (detailsEl) detailsEl.style.display = 'block';

  const titleEl = document.getElementById('prop-text-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">ACTIVE LABEL:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title || 'Untitled'}"</span>`;
  }

  const contentInput = document.getElementById('prop-text-content');
  if (contentInput) {
    contentInput.value = hs.title || hs.info || '';
  }

  const scaleValEl = document.getElementById('prop-text-scale-val');
  if (scaleValEl) {
    const sc = hs.scale !== undefined ? Number(hs.scale) : 1.0;
    scaleValEl.textContent = Number(sc).toFixed(1) + 'x';
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
  const scaleInput = document.getElementById('prop-text-scale');
  const colorInput = document.getElementById('prop-text-color');

  if (contentInput) {
    hs.title = contentInput.value.trim() || 'TEXT';
    hs.info = hs.title;
  }
  if (scaleInput) {
    hs.scale = Number(scaleInput.value);
  }
  if (colorInput && colorInput.value) {
    hs.color = colorInput.value;
  }

  const titleEl = document.getElementById('prop-text-active-title');
  if (titleEl) {
    titleEl.innerHTML = `<span style="color:#94a3b8; font-weight:700;">ACTIVE LABEL:</span> <span style="color:#fff; font-weight:800; margin-left:4px;">"${hs.title}"</span>`;
  }

  if (krpano) {
    const name = "hs_" + hs._id;
    const svgBase64 = getHotspotSvgBase64('Text', hs.title, hs.color, hs.bgColor, hs.textStyle);
    krpano.set(`hotspot[${name}].url`, svgBase64);
    if (hs.scale !== undefined) {
      krpano.set(`hotspot[${name}].scale`, Number(hs.scale));
    }
    const isArea = (hs.textStyle === 'area' || hs.textStyle === 'box');
    if (isArea) {
      krpano.set(`hotspot[${name}].distorted`, true);
      krpano.set(`hotspot[${name}].rx`, hs.rx !== undefined ? Number(hs.rx) : -70);
      krpano.set(`hotspot[${name}].ry`, 0);
      krpano.set(`hotspot[${name}].rz`, 0);
    } else {
      krpano.set(`hotspot[${name}].distorted`, false);
      krpano.set(`hotspot[${name}].rx`, 0);
    }
  }

  try {
    const res = await fetch(`/api/hotspots/${hs._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: hs.title,
        info: hs.info,
        color: hs.color,
        bgColor: hs.bgColor,
        scale: hs.scale,
        textStyle: hs.textStyle || 'area',
        rx: hs.rx !== undefined ? hs.rx : -70
      })
    });
    if (!res.ok) throw new Error('Failed to update text hotspot');
    publishTourSilent();
  } catch (err) {
    console.error("Error updating text hotspot:", err);
  }
}

// Render icon mini-grid in Hotspot Property Editor
function renderHotspotIconPickerGrid(currentStyle) {
  const grid = document.getElementById('prop-hs-icons-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const builtInStyles = [
    { name: 'Arrow', label: 'Arrow', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>' },
    { name: 'Arrow 01', label: 'Chevron', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 15 12 9 18 15"></polyline></svg>' },
    { name: 'Arrow 02', label: 'Bold', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 4 22 18 18 20 12 11 6 20 2 18"></polygon></svg>' },
    { name: 'Pin', label: 'Pin', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>' },
    { name: 'Dot', label: 'Dot', svg: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="8"></circle></svg>' }
  ];

  builtInStyles.forEach(item => {
    const card = document.createElement('div');
    card.className = 'icon-mini-card' + (currentStyle === item.name ? ' active' : '');
    card.innerHTML = `${item.svg}<span style="font-size:11px; font-weight:700;">${item.label}</span>`;
    card.onclick = () => onHotspotIconStyleChange(item.name);
    grid.appendChild(card);
  });

  const custom = getCustomIcons();
  custom.forEach(item => {
    const card = document.createElement('div');
    card.className = 'icon-mini-card' + (currentStyle === item.name ? ' active' : '');
    card.innerHTML = `<img src="${item.url}" style="width:20px; height:20px; object-fit:contain;"><span style="font-size:11px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:50px;">${item.name}</span>`;
    card.onclick = () => onHotspotIconStyleChange(item.name);
    grid.appendChild(card);
  });

  const allBtn = document.createElement('div');
  allBtn.className = 'icon-mini-card';
  allBtn.style.border = '1px dashed #10b981';
  allBtn.innerHTML = `<span style="font-size:16px; color:#10b981; font-weight:900; line-height:1;">+</span><span style="font-size:10px; font-weight:700; color:#10b981;">All Icons</span>`;
  allBtn.onclick = () => openIconLibraryModal('change');
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

  const svgBase64 = getHotspotSvgBase64(newStyle, hs.title, hs.color);
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

// Auto-save Transition change
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
    returnContainer.style.display = (mode === 'drop') ? 'flex' : 'none';
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
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));
  const targetScene = scenes.find(s => String(s._id) !== String(activeSceneId)) || scenes[0];
  if (!targetScene) {
    showToast("Please add at least one more panorama scene first!");
    return;
  }

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
        title: targetScene.title,
        kind: 'scene',
        targetSceneId: targetScene._id,
        ath,
        atv,
        style: iconStyle
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    console.log("Nav icon created successfully from library:", newHotspot);

    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    selectHotspot(newHotspot._id);
    publishTourSilent();
    showToast(`✓ Added "${iconStyle}" hotspot linking to ${targetScene.title}`);
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
  const returnCb = document.getElementById('lib-return-hotspot-cb');
  const returnChecked = returnCb ? returnCb.checked : true;
  const currentScene = scenes.find(s => String(s._id) === String(activeSceneId));

  try {
    const res = await fetch('/api/hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sceneId: activeSceneId,
        title: targetScene.title,
        kind: 'scene',
        targetSceneId: targetScene._id,
        ath,
        atv,
        style: chosenStyle
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create hotspot');

    const newHotspot = data.hotspot;
    hotspots.push(newHotspot);
    addHotspotToKrpano(newHotspot);
    renderCurrentSceneHotspots();
    selectHotspot(newHotspot._id);
    publishTourSilent();

    if (returnChecked && currentScene) {
      openReturnHotspotModal(targetScene, currentScene, chosenStyle);
    } else {
      showToast("✓ Hotspot created successfully!");
    }
  } catch (err) {
    console.error("Error creating hotspot from drop:", err);
    showToast("Error creating hotspot: " + err.message);
  }
}

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
};

window.selectTargetPanoramaFromModal = function (sceneId, sceneTitle) {
  const targetInput = document.getElementById('prop-hs-target-scene');
  const targetDisplay = document.getElementById('prop-hs-target-scene-display');

  if (targetInput && targetDisplay) {
    targetInput.value = sceneId;
    targetDisplay.textContent = sceneTitle;
    window.onHotspotTargetSceneChange(sceneId);
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

    const thumbUrl = tour.thumbnail 
      ? `/api/tours/${encodeURIComponent(tour.id)}/thumbnail?t=` + Date.now() 
      : 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMzMiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMyMjIiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZmlsbD0iIzc3NyIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBUaHVtYjwvdGV4dD48L3N2Zz4=';

    const dateStr = tour.date ? new Date(tour.date).toLocaleDateString() : '';

    card.innerHTML = `
      <div class="welcome-recent-card-img-wrap">
        <img src="${thumbUrl}" alt="${tour.title}">
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

  const newName = prompt('Enter new name for this asset:', asset.name);
  if (!newName || newName.trim() === '' || newName.trim() === asset.name) return;

  try {
    const res = await fetch(`/api/assets/${assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() })
    });
    if (!res.ok) throw new Error('Failed to update asset');
    asset.name = newName.trim();
    renderMediaAssets();
    showToast('Asset name updated');
  } catch (err) {
    console.error('Error updating asset name:', err);
    showToast('Error updating asset name');
  }
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
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  const btn = document.querySelector('#media-tab-assets .btn-upload-center');
  if (btn) btn.innerHTML = '<span>Uploading...</span>';

  try {
    const res = await fetch(`/api/tours/${encodeURIComponent(currentTourId)}/assets/upload`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload asset');

    assets.push(data.asset);
    renderMediaAssets();
    showToast("Asset uploaded successfully");
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

