/**
 * Scene Engagement Scripts Catalog & Dynamic Generator
 * Provides predefined scripts for standard scenes and dynamically generates
 * contextual voice scripts for ANY custom room/scene title or tags.
 */
(function(window) {
  'use strict';

  const SCENE_ENGAGEMENT_SCRIPTS = {
    // Default fallback templates
    'default': {
      highlights: ['Panorama view', 'Interactive hotspots', 'Surrounding architecture'],
      idleScripts: [
        "Take a moment to look around the space. You can drag to rotate the camera.",
        "Notice the details in this area as you explore.",
        "Have a look around the room to see the full layout."
      ],
      randomScripts: [
        "There's quite a bit to see in this tour. You might want to take a look at another room next.",
        "Feel free to explore each space at your own pace.",
        "Why don't you explore this view before heading to another area?"
      ]
    },

    // Preset scene definitions
    'left view': {
      highlights: ['City skyline', 'Solar rooftop layout', 'Neighborhood architecture'],
      idleScripts: [
        "Take a look toward the horizon. You can see the cityscape from this angle.",
        "Notice the solar rooftop layout across the neighborhood.",
        "Have a look at the open view on this side of the building."
      ],
      randomScripts: [
        "There's quite a bit to explore here. You might want to check the back view next.",
        "Why don't you examine this panorama before moving to another area?"
      ]
    },

    'back view': {
      highlights: ['Rear courtyard', 'Open street view', 'Lower rooftops'],
      idleScripts: [
        "Have a look down toward the street view below.",
        "Observe the open courtyard area on this side.",
        "Notice the quiet surrounding neighborhood layout."
      ],
      randomScripts: [
        "Why don't you explore the right view before heading back?",
        "There's plenty to see here. Take a look at the street view below."
      ]
    },

    'right view': {
      highlights: ['East skyline', 'Main entrance approach', 'Landscaping'],
      idleScripts: [
        "Notice the landscaping near the front approach.",
        "Have a look toward the eastern skyline.",
        "Observe the open terrace area on this side."
      ],
      randomScripts: [
        "You could check out the left view to see the full panorama.",
        "Why don't you take a look at the other sides of the project?"
      ]
    }
  };

  /**
   * Dynamically generates contextual voice scripts for ANY room title or tags
   * @param {string} sceneTitle - Raw title of scene (e.g., "Executive Suite", "Garden Patio", "Scene 1")
   * @param {Array} tags - Optional array of tags
   * @returns {Object} { highlights, idleScripts, randomScripts }
   */
  function generateDynamicScripts(sceneTitle, tags = []) {
    const rawTitle = String(sceneTitle || 'this room').trim();
    const cleanTitle = rawTitle.toLowerCase();

    // Check preset dictionary direct or substring match
    if (SCENE_ENGAGEMENT_SCRIPTS[cleanTitle]) {
      return SCENE_ENGAGEMENT_SCRIPTS[cleanTitle];
    }
    for (const [k, v] of Object.entries(SCENE_ENGAGEMENT_SCRIPTS)) {
      if (k !== 'default' && cleanTitle.includes(k)) {
        return v;
      }
    }

    // Dynamic generation based on room keywords
    let highlights = [];
    let idleScripts = [];
    let randomScripts = [];

    if (cleanTitle.includes('terrace') || cleanTitle.includes('balcony') || cleanTitle.includes('patio')) {
      highlights = ['Outdoor view', 'Balcony seating', 'Fresh air perspective'];
      idleScripts = [
        `Take a look at the outdoor view from ${rawTitle}.`,
        `Notice the open perspective and seating area around ${rawTitle}.`,
        `Have a look toward the surrounding scenery from this side.`
      ];
      randomScripts = [
        `There's a great view from ${rawTitle}. Take your time, or explore the indoor space next.`,
        `Why don't you enjoy the perspective from ${rawTitle} before moving to another area?`
      ];
    }
    else if (cleanTitle.includes('pool') || cleanTitle.includes('garden') || cleanTitle.includes('courtyard')) {
      highlights = ['Landscaping', 'Water feature', 'Relaxation area'];
      idleScripts = [
        `Observe the landscape details around ${rawTitle}.`,
        `Take a look at the surrounding greenery and outdoor layout.`,
        `Notice the relaxing atmosphere in ${rawTitle}.`
      ];
      randomScripts = [
        `Feel free to explore ${rawTitle} further or check out the adjacent rooms next.`,
        `Why don't you look around ${rawTitle} before continuing your tour?`
      ];
    }
    else if (cleanTitle.includes('office') || cleanTitle.includes('conference') || cleanTitle.includes('desk')) {
      highlights = ['Workstations', 'Meeting space', 'Lighting fixtures'];
      idleScripts = [
        `Take a look at the workspace arrangement in ${rawTitle}.`,
        `Notice the layout and lighting around the office area.`,
        `Observe the desk setup and room proportion from this angle.`
      ];
      randomScripts = [
        `There's plenty to examine in ${rawTitle}. You can step into the adjacent hallway next.`,
        `Why don't you explore the details of ${rawTitle} before heading to another section?`
      ];
    }
    else {
      // Generic smart dynamic template using scene title
      highlights = [`${rawTitle} perspective`, 'Room layout', 'Surrounding detail'];
      idleScripts = [
        `Take a moment to examine the details around ${rawTitle}.`,
        `Notice the layout and space as you explore ${rawTitle}.`,
        `Have a look around ${rawTitle} to take in the full view.`
      ];
      randomScripts = [
        `You're currently exploring ${rawTitle}. Feel free to check out another area whenever you're ready.`,
        `There's quite a bit to see in ${rawTitle}. You might want to take a look at another room next.`
      ];
    }

    return { highlights, idleScripts, randomScripts };
  }

  /**
   * Main lookup function called by SceneRegistry
   */
  function getSceneScripts(sceneTitle, tags) {
    if (!sceneTitle) return SCENE_ENGAGEMENT_SCRIPTS['default'];
    return generateDynamicScripts(sceneTitle, tags);
  }

  window.SCENE_ENGAGEMENT_SCRIPTS = SCENE_ENGAGEMENT_SCRIPTS;
  window.getSceneScripts = getSceneScripts;
})(window);
