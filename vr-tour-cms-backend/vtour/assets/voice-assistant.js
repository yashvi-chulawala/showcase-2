/**
 * "Hey 360" Voice Assistant Engine & Lifecycle Manager
 * Handles Wake-Word Detection, Speech Synthesis, State Machine, and Command Resolution.
 */
(function(window) {
  'use strict';

  // Prevent running duplicate voice assistants inside iframes (e.g. tour.html inside editor-panel.html)
  if (window.top !== window.self) {
    console.log('[VoiceAssistant] Skipping iframe initialization to prevent duplicate mic instances.');
    return;
  }

  // Assistant States
  const STATE = {
    IDLE: 'IDLE',
    WAITING_FOR_WAKE_WORD: 'WAITING_FOR_WAKE_WORD',
    WAKE_WORD_DETECTED: 'WAKE_WORD_DETECTED',
    LISTENING: 'LISTENING',
    PROCESSING: 'PROCESSING',
    SPEAKING: 'SPEAKING',
    UNAVAILABLE: 'UNAVAILABLE'
  };

  class VoiceAssistantManager {
    constructor() {
      this.state = STATE.IDLE;
      this.recognition = null;
      this.audioCtx = null;
      this.retryCount = 0;
      this.maxRetries = 15;
      this.retryResetTimer = null;
      this.permissionGranted = localStorage.getItem('voice_perm_granted') === 'true';
      this.listeningTimer = null;
      this.isRecognizing = false;

      // Check speech API support
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.isSupported = !!SpeechRecognition;
      this.browserMode = this.isSupported ? 'SUPPORTED' : 'UNSUPPORTED';

      this.initUI();
      if (this.isSupported) {
        this.setupRecognition(SpeechRecognition);
      } else {
        this.setState(STATE.UNAVAILABLE, 'Speech Recognition not supported on this browser');
      }
    }

    /**
     * Initializes Web Speech Recognition
     */
    setupRecognition(SpeechRecognitionClass) {
      try {
        this.recognition = new SpeechRecognitionClass();
        // Use non-continuous mode for ultra-clean, per-utterance speech isolation
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
          console.log('[VoiceAssistant] Speech recognition active.');
          this.isRecognizing = true;
          this.retryCount = 0;
          if (this.state === STATE.IDLE || this.state === STATE.UNAVAILABLE) {
            this.setState(STATE.WAITING_FOR_WAKE_WORD);
          }
        };

        this.recognition.onresult = (event) => {
          this.handleSpeechResult(event);
        };

        this.recognition.onerror = (event) => {
          console.warn('[VoiceAssistant] Recognition error:', event.error);
          this.isRecognizing = false;
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            this.permissionGranted = false;
            localStorage.setItem('voice_perm_granted', 'false');
            this.setState(STATE.UNAVAILABLE, 'Microphone permission denied');
          }
        };

        this.recognition.onend = () => {
          console.log('[VoiceAssistant] Recognition session ended. Current state:', this.state);
          this.isRecognizing = false;
          // Restart listening seamlessly if in an active listening state
          if ((this.state === STATE.WAITING_FOR_WAKE_WORD || this.state === STATE.LISTENING) && this.permissionGranted) {
            this.scheduleRestart();
          }
        };

        if (this.permissionGranted) {
          this.startWakeWordListening();
        } else {
          this.setState(STATE.IDLE, 'Click microphone to enable "Hey 360"');
        }
      } catch (err) {
        console.error('[VoiceAssistant] Setup error:', err);
        this.setState(STATE.UNAVAILABLE, 'Failed to initialize speech system');
      }
    }

    /**
     * Safely starts speech recognition
     */
    safeStartRecognition() {
      if (!this.recognition || !this.permissionGranted || this.isRecognizing) return;
      try {
        this.recognition.start();
      } catch (e) {
        console.log('[VoiceAssistant] Recognition start info:', e.message);
      }
    }

    /**
     * Safely stops speech recognition
     */
    safeStopRecognition() {
      if (!this.recognition || !this.isRecognizing) return;
      try {
        this.recognition.stop();
        this.isRecognizing = false;
      } catch (e) {}
    }

    /**
     * Schedules auto-restart for single-utterance speech loop
     */
    scheduleRestart() {
      if (this.retryCount >= this.maxRetries) {
        console.warn('[VoiceAssistant] Max restart attempts reached. Falling back to manual mode.');
        this.setState(STATE.IDLE, 'Microphone paused. Click to activate.');
        return;
      }

      this.retryCount++;
      clearTimeout(this.retryResetTimer);
      this.retryResetTimer = setTimeout(() => { this.retryCount = 0; }, 10000);

      setTimeout(() => {
        if ((this.state === STATE.WAITING_FOR_WAKE_WORD || this.state === STATE.LISTENING) && this.permissionGranted) {
          this.safeStartRecognition();
        }
      }, 100);
    }

    /**
     * Starts background wake-word listening loop
     */
    startWakeWordListening() {
      clearTimeout(this.listeningTimer);
      if (!this.isSupported) return;
      if (!this.permissionGranted) {
        this.showPermissionModal();
        return;
      }

      this.setState(STATE.WAITING_FOR_WAKE_WORD);
      this.safeStartRecognition();
    }

    /**
     * Core Speech Parser — Handles Single-Stage and Two-Stage Wake-Word Utterances
     */
    handleSpeechResult(event) {
      if (this.state === STATE.SPEAKING || this.state === STATE.PROCESSING) return;

      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const currentText = (finalTranscript || interimTranscript).trim();
      if (!currentText) return;

      console.log(`[VoiceAssistant] Speech stream: "${currentText}" (State: ${this.state})`);

      // 1. STATE: WAITING_FOR_WAKE_WORD
      if (this.state === STATE.WAITING_FOR_WAKE_WORD) {
        // Ultra-flexible wake word regex matching all speech-to-text variations of "Hey 360"
        const wakeWordRegex = /(hey|hi|a|okay|hello)?\s*(360|3\s*6\s*0|three\s*[-_\s]*sixty|three\s*hundred\s*(and\s*)?sixty)/i;
        const match = currentText.match(wakeWordRegex);

        if (match) {
          const wakeWordEndIdx = match.index + match[0].length;
          const remainderCommand = currentText.substring(wakeWordEndIdx).replace(/^[\s,.:]+/, '').trim();

          console.log(`[VoiceAssistant] Wake word matched! Remainder command: "${remainderCommand}"`);
          this.playActivationChime();

          if (remainderCommand.length > 1) {
            // SINGLE-STAGE UTTERANCE: "Hey 360, take me to reception"
            this.setState(STATE.WAKE_WORD_DETECTED, 'Wake word detected!');
            setTimeout(() => {
              this.processCommand(remainderCommand);
            }, 150);
          } else {
            // TWO-STAGE UTTERANCE: "Hey 360" -> Switch to LISTENING mode
            this.safeStopRecognition();
            this.setState(STATE.WAKE_WORD_DETECTED, 'Wake word detected!');
            setTimeout(() => {
              this.setState(STATE.LISTENING, 'Listening... Say a destination');
              this.safeStartRecognition();
              this.startListeningTimeout();
            }, 200);
          }
        } else {
          // Direct navigation command fallback without requiring explicit wake phrase
          if (window.sceneRegistry) {
            const directMatch = window.sceneRegistry.resolveDestination(currentText);
            if (directMatch.status === 'matched' || directMatch.status === 'go_back') {
              console.log(`[VoiceAssistant] Direct navigation command recognized: "${currentText}"`);
              this.playActivationChime();
              this.processCommand(currentText);
            }
          }
        }
      }
      // 2. STATE: LISTENING (Waiting for destination command)
      else if (this.state === STATE.LISTENING) {
        let cleanText = currentText.replace(/hey\s*(360|three\s*sixty)|hi\s*360/gi, '').trim();
        this.updateSubtext(`"${cleanText || currentText}"`);

        if (cleanText.length > 0) {
          if (window.sceneRegistry) {
            const matchCheck = window.sceneRegistry.resolveDestination(cleanText);
            if (matchCheck.status === 'matched' || matchCheck.status === 'go_back') {
              clearTimeout(this.listeningTimer);
              this.processCommand(cleanText);
            } else if (finalTranscript.trim().length > 0) {
              clearTimeout(this.listeningTimer);
              this.processCommand(cleanText);
            }
          } else if (finalTranscript.trim().length > 0) {
            clearTimeout(this.listeningTimer);
            this.processCommand(cleanText);
          }
        }
      }
    }

    /**
     * Timeout guard for listening mode
     */
    startListeningTimeout() {
      clearTimeout(this.listeningTimer);
      this.listeningTimer = setTimeout(() => {
        if (this.state === STATE.LISTENING) {
          console.log('[VoiceAssistant] Listening timeout reached.');
          this.speakText("I didn't hear a command.", () => {
            this.startWakeWordListening();
          });
        }
      }, 9000);
    }

    /**
     * Processes command intent using application SceneRegistry
     */
    processCommand(commandText) {
      if (this.state === STATE.PROCESSING || this.state === STATE.SPEAKING) return;
      clearTimeout(this.listeningTimer);
      this.setState(STATE.PROCESSING, `Processing: "${commandText}"`);

      setTimeout(() => {
        if (!window.sceneRegistry) {
          console.warn('[VoiceAssistant] SceneRegistry not found.');
          this.speakText("Scene registry loading. Please try again.", () => {
            this.startWakeWordListening();
          });
          return;
        }

        const result = window.sceneRegistry.resolveDestination(commandText);
        console.log('[VoiceAssistant] Intent resolution result:', result);

        if (result.status === 'matched' || result.status === 'go_back') {
          const destTitle = result.scene ? (result.scene.title || 'destination') : 'destination';
          const spokenMsg = result.status === 'go_back'
            ? `Returning to ${destTitle}.`
            : `Taking you to ${destTitle}.`;

          // Execute 360 panorama navigation IMMEDIATELY so view changes instantly
          if (window.appNavigation && typeof window.appNavigation.navigateToPano === 'function') {
            window.appNavigation.navigateToPano(result.sceneId);
          }

          // Speak spoken response confirmation
          this.speakText(spokenMsg, () => {
            this.startWakeWordListening();
          });
        }
        else if (result.status === 'ambiguous') {
          const optionsStr = result.choices.slice(0, 2).join(' or ');
          const promptMsg = `Which ${result.query} do you mean? ${optionsStr}?`;
          this.speakText(promptMsg, () => {
            this.setState(STATE.LISTENING, `Which ${result.query}?`);
            this.startListeningTimeout();
          });
        }
        else if (result.status === 'no_history') {
          this.speakText("There is no previous scene in your navigation history.", () => {
            this.startWakeWordListening();
          });
        }
        else {
          const available = window.sceneRegistry.scenes.slice(0, 3).map(s => s.title).join(', ');
          const notFoundMsg = available
            ? `Sorry, I couldn't find a scene matching ${commandText}. Available scenes: ${available}.`
            : `Sorry, I couldn't find a scene matching ${commandText}.`;

          this.speakText(notFoundMsg, () => {
            this.startWakeWordListening();
          });
        }
      }, 150);
    }

    /**
     * Web Audio API Synthesizer — Plays a clean two-tone activation chime
     */
    playActivationChime() {
      try {
        if (!this.audioCtx) {
          this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.08); // A5

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      } catch (e) {
        console.warn('[VoiceAssistant] Audio chime error:', e.message);
      }
    }

    /**
     * Text-To-Speech Synthesizer with Chrome Safety Safeguard Callback
     */
    speakText(text, callback) {
      clearTimeout(this.listeningTimer);
      this.setState(STATE.SPEAKING, text);
      this.safeStopRecognition(); // Temporarily pause mic to avoid picking up TTS audio from speakers

      if (!('speechSynthesis' in window)) {
        if (callback) callback();
        return;
      }

      window.speechSynthesis.cancel(); // Stop any pending speech

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      let hasRunCallback = false;
      const safeDone = () => {
        if (!hasRunCallback) {
          hasRunCallback = true;
          clearTimeout(fallbackTimer);
          if (callback) callback();
        }
      };

      // Safeguard timeout: Ensures callback runs even if Chrome SpeechSynthesis fails to emit onend
      const estimatedMs = Math.max(1800, text.length * 90);
      const fallbackTimer = setTimeout(safeDone, estimatedMs);

      utterance.onend = safeDone;
      utterance.onerror = (e) => {
        console.warn('[VoiceAssistant] TTS error:', e);
        safeDone();
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('[VoiceAssistant] SpeechSynthesis.speak error:', e.message);
        safeDone();
      }
    }

    /**
     * Updates internal state and UI styling
     */
    setState(newState, subtext = '') {
      this.state = newState;
      console.log(`[VoiceAssistant] State ➔ ${newState} (${subtext})`);

      const badge = document.getElementById('voice-status-badge');
      const label = document.getElementById('voice-status-label');
      const sub = document.getElementById('voice-status-subtext');
      const micBtn = document.getElementById('voice-mic-toggle-btn');

      if (!badge || !label || !sub) return;

      badge.className = 'voice-status-badge';
      if (micBtn) micBtn.classList.remove('active');

      switch (newState) {
        case STATE.WAITING_FOR_WAKE_WORD:
          badge.classList.add('state-waiting');
          label.textContent = '● Voice ready';
          sub.textContent = subtext || 'Say "Hey 360"';
          break;

        case STATE.WAKE_WORD_DETECTED:
          badge.classList.add('state-listening');
          label.textContent = '⚡ Hey 360 detected!';
          sub.textContent = subtext || 'Activating...';
          break;

        case STATE.LISTENING:
          badge.classList.add('state-listening');
          if (micBtn) micBtn.classList.add('active');
          label.textContent = '🎤 Listening...';
          sub.textContent = subtext || 'Say a destination';
          break;

        case STATE.PROCESSING:
          badge.classList.add('state-processing');
          label.textContent = '⚡ Understanding...';
          sub.textContent = subtext || 'Finding scene...';
          break;

        case STATE.SPEAKING:
          badge.classList.add('state-speaking');
          label.textContent = '🔊 Speaking...';
          sub.textContent = subtext;
          break;

        case STATE.UNAVAILABLE:
          badge.classList.add('state-unavailable');
          label.textContent = 'Voice Assistant Unavailable';
          sub.textContent = subtext || 'Allow microphone access';
          break;

        case STATE.IDLE:
        default:
          label.textContent = 'Voice Assistant Paused';
          sub.textContent = subtext || 'Click microphone to start';
          break;
      }
    }

    updateSubtext(subtext) {
      const sub = document.getElementById('voice-status-subtext');
      if (sub) sub.textContent = subtext;
    }

    /**
     * Manual Microphone Button Toggle Callback
     */
    toggleManualMic() {
      if (!this.isSupported) {
        alert('Web Speech Recognition is not supported on this browser. Please use Google Chrome or Microsoft Edge.');
        return;
      }

      if (!this.permissionGranted) {
        this.showPermissionModal();
        return;
      }

      if (this.state === STATE.LISTENING) {
        this.startWakeWordListening();
      } else {
        this.safeStopRecognition();
        this.setState(STATE.LISTENING, 'Listening... Say a destination');
        setTimeout(() => {
          this.safeStartRecognition();
          this.startListeningTimeout();
        }, 100);
      }
    }

    /**
     * Permission Disclosure Modal Component
     */
    showPermissionModal() {
      if (document.getElementById('voice-perm-modal')) return;

      const modalHtml = `
        <div id="voice-perm-modal" class="voice-modal-overlay">
          <div class="voice-modal-card">
            <div class="voice-modal-title">
              <span>🎤 Enable "Hey 360" Voice Assistant</span>
            </div>
            <div class="voice-modal-body">
              This website uses a voice activation system allowing you to say <strong>"Hey 360"</strong> to navigate between panorama scenes hands-free.
            </div>
            <div class="voice-privacy-note">
              <strong>🔒 Privacy Note:</strong> Microphone audio is processed via your browser's Speech Recognition engine (e.g. Google Speech Services / Apple Web API). Speech data is used strictly for local navigation commands.
            </div>
            <div class="voice-modal-actions">
              <button class="voice-btn-secondary" id="voice-modal-deny">Manual Button Only</button>
              <button class="voice-btn-primary" id="voice-modal-allow">Allow Microphone</button>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      document.getElementById('voice-modal-allow').onclick = () => {
        this.permissionGranted = true;
        localStorage.setItem('voice_perm_granted', 'true');
        document.getElementById('voice-perm-modal').remove();
        this.startWakeWordListening();
      };

      document.getElementById('voice-modal-deny').onclick = () => {
        this.permissionGranted = false;
        localStorage.setItem('voice_perm_granted', 'false');
        document.getElementById('voice-perm-modal').remove();
        this.setState(STATE.IDLE, 'Manual mic button mode active');
      };
    }

    /**
     * Renders Floating HUD Container to DOM
     */
    initUI() {
      if (document.getElementById('voice-assistant-hud')) return;

      const hudHtml = `
        <div id="voice-assistant-hud">
          <div id="voice-status-badge" class="voice-status-badge state-waiting" title="Click mic button to toggle listening">
            <div class="voice-dot"></div>
            <div class="voice-text-container">
              <span id="voice-status-label" class="voice-label">● Voice ready</span>
              <span id="voice-status-subtext" class="voice-subtext">Say "Hey 360"</span>
            </div>
          </div>
          <button id="voice-mic-toggle-btn" class="voice-mic-btn" title="Toggle Voice Control">
            <svg viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </button>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', hudHtml);

      document.getElementById('voice-mic-toggle-btn').onclick = () => {
        this.toggleManualMic();
      };

      document.getElementById('voice-status-badge').onclick = () => {
        if (!this.permissionGranted) {
          this.showPermissionModal();
        }
      };
    }
  }

  // Instantiate Voice Assistant global singleton once DOM is ready
  window.addEventListener('DOMContentLoaded', () => {
    window.sceneRegistry = window.sceneRegistry || new window.SceneRegistry();
    window.voiceAssistant = new VoiceAssistantManager();
  });

})(window);
