/**
 * VoiceTriggerManager Component
 * Manages proactive voice guidance interventions when visitor is IDLE or RANDOM
 * Enforces non-intrusive guards:
 * 1. Cooldown Guard: Minimum 25-second quiet period between automatic voice interventions
 * 2. Session Cap Guard: Maximum 5 proactive interventions per session
 * 3. Deduplication Guard: Never repeats the same sentence in a session
 * 4. Active Exploration Guard: Never interrupts active user gesture input
 * 5. Voice Selector & Voice Customization Engine (Selects best natural system/browser voice)
 */
(function(window) {
  'use strict';

  class VoiceTriggerManager {
    /**
     * @param {Object} detectorInstance - Instance of EngagementDetector
     * @param {Object} registryInstance - Instance of SceneRegistry
     */
    constructor(detectorInstance, registryInstance) {
      this.detector = detectorInstance || (window.engagementDetector ? window.engagementDetector : null);
      this.registry = registryInstance || (window.sceneRegistry ? window.sceneRegistry : null);

      this.lastInterventionTime = 0;
      this.interventionCount = 0;
      this.maxInterventionsPerSession = 5;
      this.cooldownDurationMs = 25000; // 25 seconds
      this.spokenScriptsHistory = new Set();
      this.userAudioUnlocked = false;

      // Voice Customization Settings
      this.selectedVoiceName = localStorage.getItem('tour_guide_voice') || '';
      this.pitch = 1.0;
      this.rate = 0.95;
      this.availableVoices = [];

      this.init();
      this.initVoiceList();
      this.initToastUI();
      console.log('[VoiceTriggerManager] Voice Trigger Manager initialized.');
    }

    /**
     * Pre-loads browser system voices list
     */
    initVoiceList() {
      if (!('speechSynthesis' in window)) return;

      const loadVoices = () => {
        this.availableVoices = window.speechSynthesis.getVoices();
        console.log(`[VoiceTriggerManager] Loaded ${this.availableVoices.length} browser voices.`);
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    /**
     * Finds the best natural voice based on user preference or high-quality defaults
     */
    getBestVoice() {
      if (!this.availableVoices || this.availableVoices.length === 0) {
        if ('speechSynthesis' in window) {
          this.availableVoices = window.speechSynthesis.getVoices();
        }
      }

      const voices = this.availableVoices || [];
      if (voices.length === 0) return null;

      // 1. User selected preference
      if (this.selectedVoiceName) {
        const userChoice = voices.find(v => v.name.toLowerCase() === this.selectedVoiceName.toLowerCase() || v.name.includes(this.selectedVoiceName));
        if (userChoice) return userChoice;
      }

      // 2. High-quality natural voice preference order (English)
      const preferredNames = [
        'Google US English',
        'Samantha',
        'Karen',
        'Google UK English Female',
        'Daniel',
        'Victoria',
        'Google UK English Male',
        'Alex',
        'Fiona',
        'Moira'
      ];

      for (const name of preferredNames) {
        const match = voices.find(v => v.name.includes(name) || v.name.toLowerCase() === name.toLowerCase());
        if (match) return match;
      }

      // 3. Any English voice
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      return englishVoice || voices[0];
    }

    /**
     * Sets preferred voice name (e.g. 'Samantha', 'Daniel', 'Karen', 'Google US English')
     * @param {string} voiceName 
     */
    setVoice(voiceName) {
      this.selectedVoiceName = voiceName;
      localStorage.setItem('tour_guide_voice', voiceName);
      console.log(`[VoiceTriggerManager] Voice set to: "${voiceName}"`);
    }

    /**
     * Subscribes to EngagementDetector state change & periodic tick events
     */
    init() {
      // Audio unlock listener for browser autoplay restrictions
      const unlockAudio = () => {
        this.userAudioUnlocked = true;
        if ('speechSynthesis' in window) {
          try { window.speechSynthesis.resume(); } catch(e) {}
        }
      };
      ['click', 'touchstart', 'keydown'].forEach(evt => {
        window.addEventListener(evt, unlockAudio, { once: false, passive: true });
      });

      if (!this.detector && window.engagementDetector) {
        this.detector = window.engagementDetector;
      }

      if (this.detector) {
        // Listen to state transition changes
        this.detector.onStateChange((newState, oldState, metrics, reason) => {
          this.evaluateIntervention(newState, metrics, reason);
        });

        // Listen to periodic 1.5s evaluation ticks
        this.detector.onTick((currentState, metrics) => {
          if (currentState === 'IDLE' || currentState === 'RANDOM') {
            this.evaluateIntervention(currentState, metrics, 'Periodic idle ticker');
          }
        });
      }
    }

    /**
     * Handles engagement state evaluations and checks proactive voice guards
     */
    evaluateIntervention(currentState, metrics, reason) {
      if (currentState !== 'IDLE' && currentState !== 'RANDOM') return;

      const now = Date.now();

      // Guard 1: Session Intervention Cap
      if (this.interventionCount >= this.maxInterventionsPerSession) {
        return;
      }

      // Guard 2: Cooldown Quiet Window (25 seconds)
      const timeSinceLastMs = now - this.lastInterventionTime;
      if (timeSinceLastMs < this.cooldownDurationMs) {
        return;
      }

      // Guard 3: Active User Interaction Exemption
      if (metrics.timeSinceLastInteraction < 5.0) {
        return;
      }

      // Get current active scene metadata
      if (!this.registry && window.sceneRegistry) {
        this.registry = window.sceneRegistry;
      }

      const currentScene = this.registry ? this.registry.getCurrentScene() : null;
      const sceneTitle = currentScene ? currentScene.title : '';

      const scripts = typeof window.getSceneScripts === 'function'
        ? window.getSceneScripts(sceneTitle)
        : { idleScripts: [], randomScripts: [] };

      const candidateList = currentState === 'IDLE' ? scripts.idleScripts : scripts.randomScripts;

      // Guard 4: Sentence Deduplication Filter
      const freshCandidates = (candidateList || []).filter(sentence => !this.spokenScriptsHistory.has(sentence));

      if (freshCandidates.length === 0) {
        return;
      }

      // Pick first fresh script sentence
      const selectedScript = freshCandidates[0];
      this.spokenScriptsHistory.add(selectedScript);
      this.lastInterventionTime = now;
      this.interventionCount++;

      console.log(`[VoiceTriggerManager] Proactive Guidance #${this.interventionCount} (${currentState}): "${selectedScript}"`);

      // Trigger Text-to-Speech execution & Toast UI
      this.speakProactiveGuidance(selectedScript, currentState);
    }

    /**
     * Injects sleek floating notification banner container to DOM
     */
    initToastUI() {
      if (document.getElementById('engagement-toast-banner')) return;

      const style = document.createElement('style');
      style.textContent = `
        #engagement-toast-banner {
          position: fixed;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%) translateY(100px);
          background: rgba(15, 23, 42, 0.92);
          border: 1px solid rgba(56, 189, 248, 0.4);
          backdrop-filter: blur(12px);
          color: #f8fafc;
          padding: 12px 22px;
          border-radius: 9999px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 15px rgba(56, 189, 248, 0.2);
          z-index: 99999;
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 90vw;
        }
        #engagement-toast-banner.show {
          transform: translateX(-50%) translateY(0);
          opacity: 1;
        }
        #engagement-toast-icon {
          font-size: 16px;
        }
        #engagement-toast-text {
          color: #e2e8f0;
          letter-spacing: 0.2px;
        }
      `;
      document.head.appendChild(style);

      const banner = document.createElement('div');
      banner.id = 'engagement-toast-banner';
      banner.innerHTML = `
        <span id="engagement-toast-icon">💡</span>
        <span id="engagement-toast-text">Tour Guide Tip</span>
      `;
      document.body.appendChild(banner);
    }

    /**
     * Executes Browser Speech Synthesis (TTS) using selected voice
     */
    speakProactiveGuidance(scriptText, triggerState) {
      // 1. Show visual toast notification on screen
      const banner = document.getElementById('engagement-toast-banner');
      const icon = document.getElementById('engagement-toast-icon');
      const text = document.getElementById('engagement-toast-text');

      if (banner && icon && text) {
        icon.textContent = triggerState === 'IDLE' ? '💡' : '🧭';
        text.textContent = scriptText;
        banner.classList.add('show');

        setTimeout(() => {
          banner.classList.remove('show');
        }, 7000);
      }

      // 2. Browser SpeechSynthesis Text-To-Speech execution
      if (!('speechSynthesis' in window)) {
        console.warn('[VoiceTriggerManager] SpeechSynthesis API not supported on this browser.');
        return;
      }

      try {
        window.speechSynthesis.cancel(); // Stop any pending audio
        window.speechSynthesis.resume(); // Unfreeze Chrome TTS engine if paused
      } catch (e) {}

      const utterance = new SpeechSynthesisUtterance(scriptText);
      utterance.rate = this.rate;
      utterance.pitch = this.pitch;
      utterance.lang = 'en-US';

      // Attach selected voice
      const targetVoice = this.getBestVoice();
      if (targetVoice) {
        utterance.voice = targetVoice;
        console.log(`[VoiceTriggerManager] Speaking using voice: "${targetVoice.name}" (${targetVoice.lang})`);
      }

      utterance.onend = () => {
        console.log('[VoiceTriggerManager] Speech output completed.');
      };

      utterance.onerror = (e) => {
        console.warn('[VoiceTriggerManager] TTS error:', e);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.error('[VoiceTriggerManager] Speech execution error:', e.message);
      }
    }
  }

  window.VoiceTriggerManager = VoiceTriggerManager;
})(window);
