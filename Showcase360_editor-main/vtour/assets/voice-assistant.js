/**
 * voice-assistant.js
 * "Hey 360" Master Voice Navigation Agent Orchestrator
 * High-performance hybrid engine with Gemini Live API + Native Speech Recognition + krpano Bridge.
 */

(function() {
  // Prevent running inside editor panel or nested iframe
  if (window.location.pathname.includes('editor-panel') || (window.top !== window.self)) {
    return;
  }

  let wakeListener = null;
  let liveSession = null;
  let commandRecognizer = null;
  let activeState = 'Idle';
  let cachedToken = null;
  let silenceTimer = null;
  let audioCtx = null;
  let isProcessingCommand = false;

  // 1. Build Floating UI Pill Widget
  const btn = document.createElement('div');
  btn.id = 'hey-360-btn';
  btn.className = 'hey-360-btn state-idle';
  
  btn.innerHTML = `
    <div class="va-logo-wrapper">
      <img src="assets/360 Eye Logo.png" class="va-logo" alt="360 Eye" onerror="this.style.display='none'">
    </div>
    <div class="va-orbital">
      <div class="va-ring"></div>
      <div class="va-center">360&deg;</div>
    </div>
    <div class="va-text" id="va-status-text">Say "Hey 360"</div>
  `;
  document.body.appendChild(btn);

  // Audio Chime Feedback Helper
  function playTone(freq1, freq2, duration = 0.08) {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      const now = audioCtx.currentTime;
      osc.frequency.setValueAtTime(freq1, now);
      osc.frequency.setValueAtTime(freq2, now + duration);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration * 2);
      
      osc.start(now);
      osc.stop(now + duration * 2);
    } catch (e) {}
  }

  function playWakeChime() {
    playTone(523.25, 659.25, 0.08); // C5 -> E5
  }

  function playConfirmChime() {
    playTone(659.25, 783.99, 0.08); // E5 -> G5
  }

  function updateUIState(state, customText) {
    activeState = state;
    const textEl = document.getElementById('va-status-text');
    if (textEl) {
      if (customText) {
        textEl.innerText = customText;
      } else if (state === 'Idle') {
        textEl.innerText = 'Say "Hey 360"';
      } else if (state === 'Connecting...') {
        textEl.innerText = 'Connecting...';
      } else if (state === 'Listening...') {
        textEl.innerText = "I'm listening...";
      } else if (state === 'Speaking...') {
        textEl.innerText = 'Guiding you...';
      } else if (state === 'Navigating') {
        textEl.innerText = 'Heading there...';
      } else {
        textEl.innerText = state;
      }
    }
    
    btn.className = `hey-360-btn state-${state.toLowerCase().replace(/[^a-z]/g, '')}`;
  }

  // Spoken TTS Confirmation Helper
  function speakResponse(text, onComplete) {
    if (!('speechSynthesis' in window)) {
      if (onComplete) onComplete();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(v => (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Zira') || v.name.includes('Samantha')))) || voices.find(v => v.lang.startsWith('en'));
      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onend = () => {
        if (onComplete) onComplete();
      };
      utterance.onerror = () => {
        if (onComplete) onComplete();
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (onComplete) onComplete();
    }
  }

  async function fetchToken() {
    try {
      const res = await fetch('/api/gemini-live-token');
      if (!res.ok) return null;
      const data = await res.json();
      cachedToken = data.token;
      return cachedToken;
    } catch (err) {
      return null;
    }
  }

  // 2. Initialize Agent Engine
  async function initAgent() {
    updateUIState('Idle');

    // Discover scenes in krpano
    if (window.KrpanoBridge) {
      window.KrpanoBridge.discoverScenes();
    }

    // Initialize Gemini Live Session Manager
    if (window.GeminiLiveSession) {
      liveSession = new window.GeminiLiveSession({
        onStateChange: (st) => updateUIState(st),
        onNavigation: (target, res) => {
          console.log('[Hey 360] Gemini Live Navigation executed:', target, res);
          handleSuccessfulNavigation(res.scene || { name: target });
        },
        onSessionEnd: () => {
          console.log('[Hey 360] Gemini Live stream closed; local speech recognizer active.');
        }
      });
    }

    // Initialize Porcupine / WebSpeech Wake-Word Listener
    if (window.PorcupineWakeListener) {
      const config = window.VOICE_CONFIG || {};
      wakeListener = new window.PorcupineWakeListener({
        keywordModelPath: config.PORCUPINE_KEYWORD_MODEL_PATH,
        onWakeWord: () => {
          console.log('[Hey 360] Wake word detected! Activating listening session...');
          startListeningSession();
        },
        onStatusChange: (status) => {
          if (activeState === 'Idle') {
            console.log('[Hey 360 Wake Status]:', status);
          }
        }
      });

      await wakeListener.init();
      wakeListener.start();
    }

    // Click-to-talk handler on Orb Button
    btn.addEventListener('click', async () => {
      if (activeState === 'Idle' || activeState === 'Error') {
        startListeningSession();
      } else {
        stopListeningSession();
      }
    });
  }

  // 3. Start Active Listening Session (Hybrid Local + Gemini)
  async function startListeningSession() {
    if (activeState === 'Listening...' || activeState === 'Connecting...') return;
    
    isProcessingCommand = false;
    if (wakeListener) wakeListener.pause();
    
    playWakeChime();
    updateUIState('Listening...');

    // Start Local Fast Speech Recognition
    startLocalCommandRecognition();

    // Reset silence timer (auto-close after 7 seconds if no command)
    resetSessionTimeout(7000);

    // Concurrently try Gemini Live Session if configured
    try {
      const token = await fetchToken();
      if (token && token.trim().length > 10 && liveSession) {
        liveSession.start(token).catch(err => {
          console.warn('[Hey 360] Gemini Live session unavailable, using local voice engine:', err.message);
        });
      }
    } catch (e) {
      console.warn('[Hey 360] Remote session bypass:', e);
    }
  }

  // Local Fast Command Recognition via Web Speech API
  function startLocalCommandRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (commandRecognizer) {
        try { commandRecognizer.abort(); } catch(e) {}
      }

      commandRecognizer = new SpeechRecognition();
      commandRecognizer.continuous = true;
      commandRecognizer.interimResults = true;
      commandRecognizer.lang = 'en-US';

      commandRecognizer.onresult = (event) => {
        if (isProcessingCommand || activeState === 'Idle') return;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.toLowerCase().trim();
          console.log('[Hey 360 Spoken Command]:', transcript);

          // Strip wake words if repeated
          const cleanText = transcript
            .replace(/^hey 360\s*/i, '')
            .replace(/^360\s*/i, '')
            .replace(/^(please\s+)?(take me to|go to|navigate to|switch to|show me|open|look at|view)\s*/i, '')
            .trim();

          if (window.KrpanoBridge) {
            const matchedScene = window.KrpanoBridge.resolveScene(cleanText || transcript);
            if (matchedScene) {
              console.log('[Hey 360] Recognized target scene:', matchedScene);
              executeNavigationCommand(matchedScene);
              break;
            }
          }
        }
      };

      commandRecognizer.onerror = (e) => {
        if (e.error !== 'no-speech') {
          console.warn('[Hey 360 Command Recognizer]:', e.error);
        }
      };

      commandRecognizer.onend = () => {
        if (activeState === 'Listening...' && !isProcessingCommand) {
          try { commandRecognizer.start(); } catch(e) {}
        }
      };

      commandRecognizer.start();
    } catch (err) {
      console.warn('[Hey 360] Local command recognition init error:', err);
    }
  }

  // Execute Navigation & Spoken Response
  function executeNavigationCommand(scene) {
    if (isProcessingCommand) return;
    isProcessingCommand = true;

    clearTimeout(silenceTimer);
    playConfirmChime();

    // Stop command recognizer
    if (commandRecognizer) {
      try { commandRecognizer.stop(); } catch(e) {}
    }
    if (liveSession) {
      try { liveSession.stop(); } catch(e) {}
    }

    const sceneTitle = scene.title || scene.name || 'the scene';
    updateUIState('Navigating', `Heading to ${sceneTitle}...`);

    // 1. Navigate krpano
    if (window.KrpanoBridge) {
      window.KrpanoBridge.navigateToScene(scene.id, 1.0);
    }

    // 2. Speak confirmation feedback
    const confirmationText = `Sure, taking you to ${sceneTitle} now!`;
    updateUIState('Speaking...', `Guiding you to ${sceneTitle}...`);

    speakResponse(confirmationText, () => {
      setTimeout(() => {
        resetToIdle();
      }, 1000);
    });
  }

  function handleSuccessfulNavigation(scene) {
    const sceneTitle = scene.title || scene.name || 'destination';
    updateUIState('Navigating', `Heading to ${sceneTitle}...`);
    setTimeout(() => {
      resetToIdle();
    }, 1500);
  }

  function resetSessionTimeout(ms = 7000) {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (activeState === 'Listening...') {
        console.log('[Hey 360] Silence timeout reached, returning to idle.');
        resetToIdle();
      }
    }, ms);
  }

  function stopListeningSession() {
    clearTimeout(silenceTimer);
    if (commandRecognizer) {
      try { commandRecognizer.stop(); } catch(e) {}
    }
    if (liveSession) {
      try { liveSession.stop(); } catch(e) {}
    }
    resetToIdle();
  }

  function resetToIdle() {
    isProcessingCommand = false;
    clearTimeout(silenceTimer);
    if (commandRecognizer) {
      try { commandRecognizer.abort(); } catch(e) {}
    }
    updateUIState('Idle');
    if (wakeListener) {
      wakeListener.resume();
    }
  }

  // Boot up agent once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgent);
  } else {
    initAgent();
  }
})();
