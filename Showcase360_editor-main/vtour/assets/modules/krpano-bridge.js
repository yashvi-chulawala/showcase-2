/**
 * krpano-bridge.js
 * Dynamic Scene Discovery, Fuzzy Alias Matching, and Navigation Bridge for krpano
 */

(function(global) {
  class KrpanoBridge {
    constructor() {
      this.scenes = []; // Array of { id: string, name: string, title: string, aliases: string[] }
      this.isReady = false;
      this.init();
    }

    init() {
      if (typeof window !== 'undefined') {
        this.discoverScenes();
        // If krpano loads later, refresh scene registry
        window.addEventListener('load', () => this.discoverScenes());
      }
    }

    /**
     * Inspects window.krpano or falls back to known scene structure
     */
    discoverScenes() {
      const discovered = [];
      const kr = window.krpano;

      if (kr && typeof kr.get === 'function') {
        const count = parseInt(kr.get("scene.count") || 0, 10);
        for (let i = 0; i < count; i++) {
          const sceneName = kr.get(`scene[${i}].name`);
          const sceneTitle = kr.get(`scene[${i}].title`) || sceneName;
          
          if (sceneName) {
            discovered.push(this.buildSceneEntry(sceneName, sceneTitle));
          }
        }
      }

      // If krpano is not yet ready or scenes count is 0, parse from fallback or DOM
      if (discovered.length === 0) {
        // Fallback default scenes from project structure
        const defaultScenes = [
          { id: "scene_vesu_1_1", title: "Vesu 1" },
          { id: "scene_vesu_16_1", title: "Vesu 16" },
          { id: "scene_vesu_5_1", title: "Vesu 5" },
          { id: "scene_vesu_7_1", title: "Vesu 7" },
          { id: "scene_vesu_2_1", title: "Vesu 2" },
          { id: "scene_DJI_20251222160517_0128_D_equi", title: "Left View" },
          { id: "scene_DJI_20251222160749_0129_D_equi", title: "Back View" },
          { id: "scene_DJI_20251222162034_0135_D_equi", title: "Right View" }
        ];

        defaultScenes.forEach(s => discovered.push(this.buildSceneEntry(s.id, s.title)));
      }

      this.scenes = discovered;
      this.isReady = this.scenes.length > 0;
      console.log(`[Hey 360 KrpanoBridge] Discovered ${this.scenes.length} tour scenes:`, this.scenes);
      return this.scenes;
    }

    /**
     * Creates normalized aliases and keywords for a scene
     */
    buildSceneEntry(id, title) {
      const cleanTitle = String(title || id).trim();
      const lowerTitle = cleanTitle.toLowerCase();
      const rawId = String(id).toLowerCase();
      
      const aliases = new Set();
      aliases.add(lowerTitle);
      aliases.add(lowerTitle.replace(/[^a-z0-9 ]/g, ' '));
      aliases.add(rawId.replace(/^scene_/, '').replace(/_/g, ' '));

      // Number word mapping (e.g. "vesu 1" <-> "vesu one")
      const numWords = { '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '16': 'sixteen' };
      for (const [num, word] of Object.entries(numWords)) {
        if (lowerTitle.includes(num)) {
          aliases.add(lowerTitle.replace(num, word));
        }
      }

      return {
        id: id,
        name: cleanTitle,
        title: cleanTitle,
        aliases: Array.from(aliases).map(a => a.trim().replace(/\s+/g, ' '))
      };
    }

    /**
     * Fuzzy resolves spoken text or destination IDs to real krpano scene id
     */
    resolveScene(query) {
      if (!query) return null;
      this.discoverScenes();

      const q = String(query).toLowerCase().trim().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ');

      // 1. Direct ID match
      const directIdMatch = this.scenes.find(s => s.id.toLowerCase() === q || s.id.toLowerCase() === `scene_${q}`);
      if (directIdMatch) return directIdMatch;

      // 2. Exact Title / Alias match
      const exactAliasMatch = this.scenes.find(s => s.aliases.some(a => a === q));
      if (exactAliasMatch) return exactAliasMatch;

      // 3. Substring / Token match
      const tokenMatch = this.scenes.find(s => s.aliases.some(a => q.includes(a) || a.includes(q)));
      if (tokenMatch) return tokenMatch;

      // 4. Fuzzy word overlap
      const qTokens = q.split(' ');
      let bestMatch = null;
      let highestOverlap = 0;

      this.scenes.forEach(scene => {
        scene.aliases.forEach(alias => {
          const aTokens = alias.split(' ');
          const overlap = qTokens.filter(t => aTokens.includes(t) && t.length > 1).length;
          if (overlap > highestOverlap) {
            highestOverlap = overlap;
            bestMatch = scene;
          }
        });
      });

      if (highestOverlap > 0) return bestMatch;

      return null;
    }

    /**
     * Executes navigation to target scene in krpano
     */
    navigateToScene(sceneId, blendTime = 1.0) {
      const target = this.resolveScene(sceneId);
      const targetId = target ? target.id : sceneId;

      if (window.krpano && typeof window.krpano.call === 'function') {
        console.log(`[Hey 360 KrpanoBridge] Navigating krpano to '${targetId}' with BLEND(${blendTime})`);
        try {
          window.krpano.call(`loadscene('${targetId}', null, MERGE, BLEND(${blendTime}))`);
          return { success: true, scene: target || { id: targetId, name: targetId } };
        } catch (err) {
          console.error('[Hey 360 KrpanoBridge] Navigation error:', err);
          return { success: false, error: err.message };
        }
      } else {
        console.warn('[Hey 360 KrpanoBridge] window.krpano object not yet available');
        return { success: false, error: 'krpano player not initialized' };
      }
    }

    /**
     * Formats scene list for Gemini system instructions
     */
    getSceneListForPrompt() {
      this.discoverScenes();
      return this.scenes.map(s => `- "${s.name}" (ID: ${s.id})`).join('\n');
    }

    /**
     * Formats available scene IDs for JSON function schema enum
     */
    getSceneIdsForSchema() {
      this.discoverScenes();
      return this.scenes.map(s => s.id);
    }
  }

  global.KrpanoBridge = new KrpanoBridge();
})(typeof window !== 'undefined' ? window : this);
