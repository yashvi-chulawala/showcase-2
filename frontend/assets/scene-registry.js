/**
 * SceneRegistry & Context Manager
 * Manages scene metadata, title/alias resolution, navigation history, and ambiguity handling.
 */
(function(window) {
  'use strict';

  class SceneRegistry {
    constructor() {
      this.scenes = [];
      this.currentSceneId = null;
      this.navigationHistory = [];
      this.autoFetchScenes();
    }

    /**
     * Automatically fetches scenes from backend API if not yet registered by application
     */
    autoFetchScenes() {
      if (this.scenes.length > 0) return;
      const tourId = new URLSearchParams(window.location.search).get('tour') || 'default';
      fetch(`/api/tours/${encodeURIComponent(tourId)}/scenes`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.scenes) && this.scenes.length === 0) {
            this.registerScenes(data.scenes);
          }
        })
        .catch(err => console.log('[SceneRegistry] Auto-fetch info:', err.message));
    }

    /**
     * Registers an array of scene objects from the application state.
     * @param {Array} scenesArray - List of scene objects from DB/krpano
     */
    registerScenes(scenesArray) {
      if (!Array.isArray(scenesArray) || scenesArray.length === 0) return;

      this.scenes = scenesArray.map((s, index) => {
        const id = String(s._id || s.id || `scene_${index}`);
        const title = String(s.title || '').trim();
        const slug = String(s.slug || title).toLowerCase().trim();

        // Build list of intelligent aliases
        const aliases = new Set();
        aliases.add(title.toLowerCase());
        aliases.add(slug);

        // Add word tokens from title (e.g., "Left View" -> "left", "view", "left view")
        const cleanTitle = title.replace(/[^a-zA-Z0-9\s]/g, ' ').toLowerCase();
        const words = cleanTitle.split(/\s+/).filter(w => w.length > 0);
        words.forEach(w => aliases.add(w));

        // Alias directional combinations
        if (cleanTitle.includes('left')) aliases.add('left'), aliases.add('left view'), aliases.add('left side');
        if (cleanTitle.includes('right')) aliases.add('right'), aliases.add('right view'), aliases.add('right side');
        if (cleanTitle.includes('back')) aliases.add('back'), aliases.add('back view'), aliases.add('rear'), aliases.add('behind');
        if (cleanTitle.includes('front')) aliases.add('front'), aliases.add('front view'), aliases.add('entrance');

        // Add index based aliases
        aliases.add(`scene ${index + 1}`);
        aliases.add(`drone ${index + 1}`);
        aliases.add(`number ${index + 1}`);
        aliases.add(`${index + 1}`);

        if (index === 0) {
          aliases.add('first');
          aliases.add('first scene');
          aliases.add('start');
          aliases.add('home');
        } else if (index === 1) {
          aliases.add('second');
          aliases.add('second scene');
        } else if (index === 2) {
          aliases.add('third');
          aliases.add('third scene');
        }

        // Domain-specific room aliases
        if (cleanTitle.includes('reception')) aliases.add('front desk'), aliases.add('entrance'), aliases.add('lobby');
        if (cleanTitle.includes('lobby')) aliases.add('foyer'), aliases.add('main hall');
        if (cleanTitle.includes('office')) aliases.add('workspace'), aliases.add('desk');
        if (cleanTitle.includes('kitchen') || cleanTitle.includes('canteen')) aliases.add('cafeteria'), aliases.add('dining');

        const scripts = typeof window.getSceneScripts === 'function'
          ? window.getSceneScripts(title)
          : { highlights: [], idleScripts: [], randomScripts: [] };

        return {
          id: id,
          raw: s,
          title: title,
          slug: slug,
          aliases: Array.from(aliases),
          highlights: scripts.highlights || [],
          idleScripts: scripts.idleScripts || [],
          randomScripts: scripts.randomScripts || []
        };
      });


      console.log(`[SceneRegistry] Registered ${this.scenes.length} scenes:`, this.scenes.map(s => s.title));
      if (!this.currentSceneId && this.scenes.length > 0) {
        this.currentSceneId = this.scenes[0].id;
      }
    }

    /**
     * Updates active scene ID and pushes to history stack.
     */
    setCurrentScene(sceneId) {
      if (!sceneId) return;
      const strId = String(sceneId);
      if (this.currentSceneId === strId) return;

      if (this.currentSceneId) {
        this.navigationHistory.push(this.currentSceneId);
        if (this.navigationHistory.length > 20) {
          this.navigationHistory.shift();
        }
      }
      this.currentSceneId = strId;
      console.log(`[SceneRegistry] Active scene set to: ${strId}`);
    }

    /**
     * Returns current scene object
     */
    getCurrentScene() {
      return this.scenes.find(s => s.id === this.currentSceneId) || null;
    }

    /**
     * Pops and returns the previous scene ID from history for "go back" commands.
     */
    getPreviousSceneId() {
      if (this.navigationHistory.length === 0) return null;
      return this.navigationHistory.pop();
    }

    /**
     * Resolves a spoken query string into a scene destination result.
     * @param {string} rawQuery - Spoken query text
     * @returns {Object} { status: 'matched'|'ambiguous'|'go_back'|'not_found', sceneId, scene, choices, query }
     */
    resolveDestination(rawQuery) {
      if (!rawQuery || typeof rawQuery !== 'string') {
        return { status: 'not_found', query: '' };
      }

      // Clean query
      let query = rawQuery.toLowerCase().trim();

      // Strip common speech command prefixes
      const prefixes = [
        /^take\s+me\s+to\s+the\s+/,
        /^take\s+me\s+to\s+/,
        /^go\s+to\s+the\s+/,
        /^go\s+to\s+/,
        /^navigate\s+to\s+the\s+/,
        /^navigate\s+to\s+/,
        /^show\s+me\s+the\s+/,
        /^show\s+me\s+/,
        /^switch\s+to\s+the\s+/,
        /^switch\s+to\s+/,
        /^open\s+the\s+/,
        /^open\s+/,
        /^change\s+to\s+/
      ];

      for (const p of prefixes) {
        if (p.test(query)) {
          query = query.replace(p, '').trim();
          break;
        }
      }

      // Check for "go back" / "previous" intent
      if (/^(go\s+back|back|previous|previous\s+room|previous\s+scene|last\s+room|return)$/i.test(query)) {
        const prevId = this.getPreviousSceneId();
        if (prevId) {
          const prevScene = this.scenes.find(s => s.id === prevId);
          return { status: 'go_back', sceneId: prevId, scene: prevScene, query };
        } else {
          return { status: 'no_history', query };
        }
      }

      if (!query) {
        return { status: 'not_found', query: rawQuery };
      }

      // 1. Direct ID / exact title match
      const exactMatch = this.scenes.find(s => s.id === query || s.title.toLowerCase() === query || s.slug === query);
      if (exactMatch) {
        return { status: 'matched', sceneId: exactMatch.id, scene: exactMatch, query };
      }

      // 2. Exact Alias Match
      const aliasMatches = this.scenes.filter(s => s.aliases.includes(query));
      if (aliasMatches.length === 1) {
        return { status: 'matched', sceneId: aliasMatches[0].id, scene: aliasMatches[0], query };
      } else if (aliasMatches.length > 1) {
        return {
          status: 'ambiguous',
          choices: aliasMatches.map(s => s.title),
          scenes: aliasMatches,
          query
        };
      }

      // 3. Partial Substring Matching
      const substringMatches = this.scenes.filter(s => {
        return s.title.toLowerCase().includes(query) ||
               s.slug.includes(query) ||
               s.aliases.some(a => a.includes(query) || query.includes(a));
      });

      if (substringMatches.length === 1) {
        return { status: 'matched', sceneId: substringMatches[0].id, scene: substringMatches[0], query };
      } else if (substringMatches.length > 1) {
        return {
          status: 'ambiguous',
          choices: substringMatches.map(s => s.title),
          scenes: substringMatches,
          query
        };
      }

      return { status: 'not_found', query };
    }
  }

  window.SceneRegistry = SceneRegistry;
})(window);
