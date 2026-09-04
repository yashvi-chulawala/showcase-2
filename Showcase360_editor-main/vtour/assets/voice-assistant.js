/**
 * voice-assistant.js
 * "Hey 360" Master Voice Navigation Agent Orchestrator
 * Full Universal Hybrid Engine:
 * 1. Native MediaRecorder + Gemini Multimodal Voice API (works 100% on Brave, Chrome, Safari, Firefox, Edge)
 * 2. On-Device WebSpeech Stream
 * 3. Interactive Quick Scene Drawer
 * 4. Krpano Dynamic Navigation Bridge
 */

(function() {
  // Prevent running inside editor panel or nested iframe
  if (window.location.pathname.includes('editor-panel') || (window.top !== window.self)) {
    return;
  }

  let wakeListener = null;
  let commandRecognizer = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let mediaStream = null;
  let activeState = 'Idle';
  let silenceTimer = null;
  let audioCtx = null;
  let isProcessingCommand = false;

  // 1. Build Floating UI Pill & Quick Drawer Widget
  const container = document.createElement('div');
  container.id = 'hey-360-container';
  container.className = 'hey-360-container';

  container.innerHTML = `
    <div class="hey-360-btn state-idle" id="hey-360-btn">
      <div class="va-logo-wrapper">
        <img src="assets/360 Eye Logo.png" class="va-logo" alt="360 Eye" onerror="this.style.display='none'">
      </div>
      <div class="va-orbital">
        <div class="va-ring"></div>
        <div class="va-center">360&deg;</div>
      </div>
      <div class="va-text" id="va-status-text">Say "Hey 360"</div>
    </div>
    <div class="va-quick-drawer" id="va-quick-drawer">
      <div class="va-drawer-title">Speak or tap a scene:</div>
      <div class="va-chips-grid" id="va-chips-grid"></div>
    </div>
  `;
  document.body.appendChild(container);

  const btn = document.getElementById('hey-360-btn');
  const drawer = document.getElementById('va-quick-drawer');
  const chipsGrid = document.getElementById('va-chips-grid');

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
      } else if (state === 'Processing') {
        textEl.innerText = 'Thinking...';
      } else if (state === 'Speaking...') {
        textEl.innerText = 'Guiding you...';
      } else if (state === 'Navigating') {
        textEl.innerText = 'Heading there...';
      } else {
        textEl.innerText = state;
      }
    }
    
    if (btn) {
      btn.className = `hey-360-btn state-${state.toLowerCase().replace(/[^a-z]/g, '')}`;
    }

    if (drawer) {
      if (state === 'Listening...' || state === 'Connecting...' || state === 'Processing') {
        renderQuickChips();
        drawer.classList.add('open');
      } else {
        drawer.classList.remove('open');
      }
    }
  }

  function renderQuickChips() {
    if (!chipsGrid) return;
    chipsGrid.innerHTML = '';
    
    let scenes = [];
    if (window.KrpanoBridge && window.KrpanoBridge.scenes && window.KrpanoBridge.scenes.length > 0) {
      scenes = window.KrpanoBridge.scenes;
    } else {
      scenes = [
        { id: "scene_vesu_5_1", title: "Vesu 5" },
        { id: "scene_vesu_16_1", title: "Vesu 16" },
        { id: "scene_vesu_1_1", title: "Vesu 1" },
        { id: "scene_vesu_7_1", title: "Vesu 7" },
        { id: "scene_vesu_2_1", title: "Vesu 2" },
        { id: "scene_DJI_20251222160517_0128_D_equi", title: "Left View" },
        { id: "scene_DJI_20251222160749_0129_D_equi", title: "Back View" }
      ];
    }

    // Deduplicate by ID
    const seen = new Set();
    scenes.filter(s => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    }).forEach(s => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'va-scene-chip';
      chip.innerText = `📍 ${s.title || s.name || s.id}`;
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        executeNavigationCommand(s);
      });
      chipsGrid.appendChild(chip);
    });
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

  // 2. Initialize Agent Engine
  async function initAgent() {
    updateUIState('Idle');

    if (window.KrpanoBridge) {
      window.KrpanoBridge.discoverScenes();
    }

    // Initialize Porcupine / WebSpeech Wake-Word Listener
    if (window.PorcupineWakeListener) {
      const config = window.VOICE_CONFIG || {};
      wakeListener = new window.PorcupineWakeListener({
        keywordModelPath: config.PORCUPINE_KEYWORD_MODEL_PATH,
        onWakeWord: () => {
          console.log('[Hey 360] Wake word detected! Activating listening session...');
          startListeningSession();
        }
      });

      await wakeListener.init();
      wakeListener.start();
    }

    // Click-to-talk handler on Orb Button
    if (btn) {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (activeState === 'Idle' || activeState === 'Error') {
          startListeningSession();
        } else if (activeState === 'Listening...') {
          // Manually finish speaking early to trigger processing
          stopRecordingAndProcess();
        } else {
          resetToIdle();
        }
      });
    }

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
      if (container && !container.contains(e.target) && (activeState === 'Listening...' || activeState === 'Processing')) {
        resetToIdle();
      }
    });
  }

  // 3. Start Active Listening Session
  async function startListeningSession() {
    if (activeState === 'Listening...' || isProcessingCommand) return;
    
    isProcessingCommand = false;
    if (wakeListener) wakeListener.pause();
    
    playWakeChime();
    updateUIState('Listening...');

    // 1. Start Universal MediaRecorder Audio Capture
    await startMediaRecorderCapture();

    // 2. Start WebSpeech API in parallel for supported browsers
    startLocalCommandRecognition();

    // Auto-process after 3.8s of speaking window
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => {
      if (activeState === 'Listening...' && !isProcessingCommand) {
        stopRecordingAndProcess();
      }
    }, 4000);
  }

  // Universal Audio Recording via MediaRecorder
  async function startMediaRecorderCapture() {
    audioChunks = [];
    try {
      if (!mediaStream) {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : (MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/webm');

      mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.start(250);
      console.log('[Hey 360] MediaRecorder active with mimeType:', mimeType);
    } catch (err) {
      console.warn('[Hey 360] Mic recording permission/error:', err);
    }
  }

  // Send Recorded Audio to Gemini Multimodal Backend
  async function stopRecordingAndProcess() {
    if (isProcessingCommand || activeState === 'Idle') return;
    updateUIState('Processing', 'Thinking...');

    if (commandRecognizer) {
      try { commandRecognizer.stop(); } catch(e) {}
    }

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      
      // Allow dataavailable to fire
      await new Promise(r => setTimeout(r, 200));

      if (audioChunks.length > 0) {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          const base64Data = reader.result.split(',')[1];
          try {
            const res = await fetch('/api/voice-command', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audio: base64Data,
                mimeType: audioBlob.type
              })
            });

            if (res.ok) {
              const data = await res.json();
              if (data && data.scene_id) {
                console.log('[Hey 360 Multimodal] Matched Scene:', data);
                executeNavigationCommand({
                  id: data.scene_id,
                  title: data.scene_title || data.scene_id
                }, data.spoken_reply);
                return;
              }
            }
          } catch (err) {
            console.error('[Hey 360 Multimodal Error]:', err);
          }
          resetToIdle();
        };

        reader.readAsDataURL(audioBlob);
        return;
      }
    }

    resetToIdle();
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

      commandRecognizer.onerror = () => {};
      commandRecognizer.start();
    } catch (err) {}
  }

  // Execute Navigation & Spoken Response
  function executeNavigationCommand(scene, customReply) {
    if (isProcessingCommand) return;
    isProcessingCommand = true;

    if (silenceTimer) clearTimeout(silenceTimer);
    playConfirmChime();

    if (commandRecognizer) {
      try { commandRecognizer.stop(); } catch(e) {}
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch(e) {}
    }

    const sceneTitle = scene.title || scene.name || 'the scene';
    updateUIState('Navigating', `Heading to ${sceneTitle}...`);

    // 1. Navigate krpano
    if (window.KrpanoBridge) {
      window.KrpanoBridge.navigateToScene(scene.id, 1.0);
    }

    // 2. Speak confirmation feedback
    const confirmationText = customReply || `Sure, taking you to ${sceneTitle} now!`;
    updateUIState('Speaking...', `Guiding you to ${sceneTitle}...`);

    speakResponse(confirmationText, () => {
      setTimeout(() => {
        resetToIdle();
      }, 1000);
    });
  }

  function resetToIdle() {
    isProcessingCommand = false;
    if (silenceTimer) clearTimeout(silenceTimer);
    if (commandRecognizer) {
      try { commandRecognizer.abort(); } catch(e) {}
    }
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch(e) {}
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
