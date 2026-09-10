(function() {
  let ws = null;
  let inputAudioContext = null;
  let outputAudioContext = null;
  let mediaStream = null;
  let workletNode = null;
  let scriptProcessor = null;
  let isSetupComplete = false;
  
  let playbackQueue = [];
  let nextPlayTime = 0;
  
  let state = 'Idle'; // Idle, Connecting..., Listening..., Speaking..., Error
  
  let dynamicRegistry = {};
  let dynamicScenesList = [];

  /**
   * Dynamically discovers all scenes available in the currently open tour.
   * Pulls directly from the embedded Krpano instance or falls back to the backend API.
   */
  async function loadActiveTourScenes() {
    let scenes = [];
    
    // 1. Query krpano directly if loaded
    if (window.krpano) {
      try {
        const count = parseInt(window.krpano.get("scene.count") || 0, 10);
        for (let i = 0; i < count; i++) {
          const sName = window.krpano.get(`scene[${i}].name`);
          let sTitle = window.krpano.get(`scene[${i}].title`) || sName;
          if (sTitle && typeof sTitle === 'string' && sTitle.startsWith('scene_')) {
            sTitle = sTitle.replace(/^scene_/, '').replace(/_/g, ' ');
          }
          if (sName) {
            scenes.push({
              sceneId: sName,
              name: String(sTitle || sName).trim(),
              index: i
            });
          }
        }
      } catch (e) {
        console.warn("[Hey 360] Krpano scene query error:", e);
      }
    }

    // 2. Fallback to API if krpano has no scenes yet
    if (scenes.length === 0) {
      try {
        const tourParam = new URLSearchParams(window.location.search).get('tour') || 'default';
        const res = await fetch(`/api/tours/${encodeURIComponent(tourParam)}/scenes`);
        if (res.ok) {
          const data = await res.json();
          if (data && Array.isArray(data.scenes) && data.scenes.length > 0) {
            scenes = data.scenes.map((s, idx) => {
              const baseName = s.tilesFolder ? String(s.tilesFolder).replace(/\.tiles$/i, '') : (s.title || `scene_${idx}`);
              return {
                sceneId: `scene_${baseName}`,
                name: String(s.title || baseName).trim(),
                index: idx
              };
            });
          }
        }
      } catch (e) {
        console.warn("[Hey 360] Backend scene fetch error:", e);
      }
    }

    // Build registry and clean scene list
    dynamicRegistry = {};
    dynamicScenesList = [];

    scenes.forEach((s, idx) => {
      // Clean ID for Gemini tool enum (e.g. vesu_1, living_room, etc.)
      let cleanId = s.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
      if (!cleanId) cleanId = `view_${idx + 1}`;
      
      // Prevent duplicates in ID
      if (dynamicRegistry[cleanId]) {
        cleanId = `${cleanId}_${idx + 1}`;
      }

      const item = {
        id: cleanId,
        sceneId: s.sceneId,
        name: s.name,
        index: idx
      };

      dynamicScenesList.push(item);
      dynamicRegistry[cleanId] = item;
      dynamicRegistry[s.name.toLowerCase()] = item;
      dynamicRegistry[s.sceneId.toLowerCase()] = item;
      dynamicRegistry[s.sceneId] = item;
      dynamicRegistry[`view_${idx + 1}`] = item;
      dynamicRegistry[`scene_${idx + 1}`] = item;
      dynamicRegistry[`number_${idx + 1}`] = item;
      dynamicRegistry[String(idx + 1)] = item;
    });

    console.log("[Hey 360] Dynamically loaded scenes for active tour:", dynamicScenesList);
    return dynamicScenesList;
  }

  function generateDynamicInstruction(scenesList) {
    const destinationsListText = scenesList.length > 0
      ? scenesList.map(s => `- "${s.name}" (ID: ${s.id})`).join('\n')
      : '- "Main View" (ID: main_view)';

    const sampleScene = scenesList.length > 0 ? scenesList[0].name : "the main view";
    const availableNames = scenesList.map(s => s.name).join(', ') || 'available views';

    return `You are Hey 360, a friendly voice assistant for this 360-degree virtual tour.

GREETING RULES:
- If the user says "Hey 360", respond with:
  "Hey there! How can I help you today? I can help you navigate between different views."
- If the user greets you or says anything other than "Hey 360" (for example "Hi", "Hello", "Hey", "Hey Siri", "Hey Google", etc.), gently correct them first and say:
  "Hey, it's Hey 360! Hey there! How can I help you today? I can help you navigate between different views."

PROACTIVE GUIDANCE RULES:
- When you receive a proactive scene guidance notice indicating the user is stuck or idle, verbally say the guidance tip warmly to help them explore.

Available tour destinations for this tour:
${destinationsListText}

When the user asks to go somewhere or view any scene (e.g. "take me to ${sampleScene}", "show me ${sampleScene}", "go to ${sampleScene}"), call the navigate_scene tool with the exact destination ID and verbally confirm warmly that you are taking them there (e.g. "Sure, taking you to ${sampleScene} now!").
If they ask for a location that does not exist in this tour, politely tell them it is not available in this tour and mention which of the available views they can visit (${availableNames}).
Keep responses friendly, warm, concise, and natural.`;
  }

  // UI Setup
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
    <div class="va-text" id="va-status-text">Explore with me</div>
  `;
  document.body.appendChild(btn);
  
  function updateState(newState) {
    state = newState;
    const textEl = document.getElementById('va-status-text');
    if (textEl) {
      textEl.innerText = getStateText(state);
    }
    btn.className = `hey-360-btn state-${state.toLowerCase().replace(/[^a-z]/g, '')}`;
  }
  
  function getStateText(s) {
    if (s === 'Idle') return 'Explore with me';
    if (s === 'Connecting...') return 'Getting ready...';
    if (s === 'Listening...') return "I'm listening";
    if (s === 'Speaking...') return 'Let me guide you';
    return 'Try again';
  }
  
  // Initialization
  updateState('Idle');
  
  btn.addEventListener('click', async () => {
    if (state === 'Idle' || state === 'Error') {
      await startAgent();
    } else {
      stopAgent();
    }
  });
  
  async function startAgent() {
    try {
      // Cancel any background speech synthesis immediately
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch(e) {}
      }
      isGuiding = false;
      isSpeakingTTS = false;
      const existingBubble = document.getElementById('va-hint-bubble');
      if (existingBubble) existingBubble.classList.remove('visible');

      updateState('Connecting...');
      isSetupComplete = false;
      
      // 1. Initialize Audio Outputs immediately to capture user gesture
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      outputAudioContext = new AudioCtx({ sampleRate: 24000 });
      if (outputAudioContext.state === 'suspended') {
        await outputAudioContext.resume();
      }

      inputAudioContext = new AudioCtx({ sampleRate: 16000 });
      if (inputAudioContext.state === 'suspended') {
        await inputAudioContext.resume();
      }

      // 2. Get Microphone permission
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (e) {
        alert("Microphone access is required to use Hey 360.\nPlease allow microphone access and try again.");
        updateState('Error');
        return;
      }
      
      // 3. Fetch Gemini Token
      const tokenRes = await fetch('/api/gemini-live-token');
      if (!tokenRes.ok) throw new Error("Gemini token endpoint failure");
      const { token } = await tokenRes.json();
      
      if (!token || token === 'your_gemini_api_key_here') {
        alert("Unable to connect to Hey 360.\nPlease add a valid GEMINI_API_KEY in your vr-tour-cms-backend/.env file (or your hosting environment variables) and restart the server.");
        updateState('Error');
        return;
      }

      // 4. Discover current active tour scenes dynamically
      const activeScenes = await loadActiveTourScenes();
      const dynamicInstruction = generateDynamicInstruction(activeScenes);
      const enumDestinations = activeScenes.map(s => s.id);
      
      // 5. Initialize WebSockets with Gemini Live model
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
      console.log('[Hey 360] Connecting to Gemini Live WebSocket...');
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[Hey 360] WebSocket Connected! Sending dynamic setup payload...');
        ws.send(JSON.stringify({
          setup: {
            model: "models/gemini-2.5-flash-native-audio-latest",
            systemInstruction: {
              parts: [{ text: dynamicInstruction }]
            },
            tools: [
              {
                functionDeclarations: [
                  {
                    name: "navigate_scene",
                    description: "Navigate the user to one of the available destinations in the virtual tour. Only use destination IDs from the provided list.",
                    parameters: {
                      type: "OBJECT",
                      properties: {
                        destination: {
                          type: "STRING",
                          description: "The exact ID of the destination",
                          enum: enumDestinations.length > 0 ? enumDestinations : ["main_view"]
                        }
                      },
                      required: ["destination"]
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Aoede"
                  }
                }
              }
            }
          }
        }));
      };
      
      ws.onmessage = async (evt) => {
        let msg;
        if (evt.data instanceof Blob) {
            const text = await evt.data.text();
            msg = JSON.parse(text);
        } else {
            msg = JSON.parse(evt.data);
        }
        
        handleGeminiMessage(msg);
      };
      
      ws.onerror = (e) => {
        console.error("[Hey 360] Voice connection error:", e);
      };
      
      ws.onclose = (evt) => {
        console.warn("[Hey 360] WebSocket closed. Code:", evt.code, "Reason:", evt.reason);
        stopAgent();
      };
      
      // 6. Initialize Audio Input Streaming (16kHz PCM)
      const source = inputAudioContext.createMediaStreamSource(mediaStream);
      
      const workletCode = `
        class PCMProcessor extends AudioWorkletProcessor {
          constructor() {
            super();
            this.buffer = new Int16Array(2048);
            this.bufferIndex = 0;
            this.chunkSize = 512;
          }
          process(inputs) {
            const input = inputs[0];
            if (input && input.length > 0 && input[0]) {
              const channelData = input[0];
              for (let i = 0; i < channelData.length; i++) {
                let s = Math.max(-1, Math.min(1, channelData[i]));
                this.buffer[this.bufferIndex++] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                if (this.bufferIndex >= this.chunkSize) {
                  const chunk = this.buffer.slice(0, this.chunkSize);
                  this.port.postMessage(chunk.buffer, [chunk.buffer]);
                  this.bufferIndex = 0;
                }
              }
            }
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;
      
      try {
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        await inputAudioContext.audioWorklet.addModule(blobUrl);
        URL.revokeObjectURL(blobUrl);
        
        workletNode = new AudioWorkletNode(inputAudioContext, 'pcm-processor');
        workletNode.port.onmessage = (e) => {
          if (isSetupComplete && ws && ws.readyState === WebSocket.OPEN) {
            // Mute mic streaming while assistant is speaking to prevent echo & feedback
            if (state === 'Speaking...' || isGuiding || isSpeakingTTS) return;

            const base64Audio = arrayBufferToBase64(e.data);
            ws.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio
                }]
              }
            }));
          }
        };
        source.connect(workletNode);
        workletNode.connect(inputAudioContext.destination);
      } catch (workletErr) {
        console.warn("[Hey 360] Falling back to ScriptProcessorNode:", workletErr);
        scriptProcessor = inputAudioContext.createScriptProcessor(1024, 1, 1);
        scriptProcessor.onaudioprocess = (e) => {
          if (!isSetupComplete || !ws || ws.readyState !== WebSocket.OPEN) return;
          if (state === 'Speaking...' || isGuiding || isSpeakingTTS) return;

          const inputData = e.inputBuffer.getChannelData(0);
          const pcmData = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            let s = Math.max(-1, Math.min(1, inputData[i]));
            pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          const base64Audio = arrayBufferToBase64(pcmData.buffer);
          ws.send(JSON.stringify({
            realtimeInput: {
              mediaChunks: [{
                mimeType: "audio/pcm;rate=16000",
                data: base64Audio
              }]
            }
          }));
        };
        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      }
      
    } catch (e) {
      console.error("[Hey 360 Error]:", e);
      alert("Unable to connect to Hey 360.\n" + (e.message || "Please check your network and API key."));
      updateState('Error');
    }
  }
  
  function handleGeminiMessage(msg) {
    console.log("Hey 360 WebSocket Msg:", msg);
    
    if (msg.error) {
      console.error("Gemini Error:", msg.error);
      alert("Hey 360 Error: " + (msg.error.message || JSON.stringify(msg.error)));
      return;
    }
    
    if (msg.setupComplete) {
      console.log("[Hey 360] Setup complete! Listening for voice input...");
      isSetupComplete = true;
      updateState('Listening...');
    }
    
    if (msg.serverContent) {
      if (msg.serverContent.interrupted) {
        stopPlayback();
        updateState('Listening...');
      }
      
      if (msg.serverContent.modelTurn) {
        const parts = msg.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData && part.inlineData.mimeType && part.inlineData.mimeType.startsWith('audio/pcm')) {
            updateState('Speaking...');
            playAudioChunk(part.inlineData.data);
          }
        }
      }
    }

    if (msg.toolCall) {
      const functionCalls = msg.toolCall.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const funcCall of functionCalls) {
          handleFunctionCall(funcCall);
        }
      }
    }
  }
  
  function handleFunctionCall(funcCall) {
    console.log("Hey 360 Function Call Received:", funcCall);
    
    if (funcCall.name === "navigate_scene") {
      let destinationId = funcCall.args ? funcCall.args.destination : null;
      console.log("[Hey 360] Destination requested:", destinationId);
      
      let dest = null;
      if (destinationId) {
        const dNorm = String(destinationId).toLowerCase().trim();
        const dClean = dNorm.replace(/\s+/g, '_');
        dest = dynamicRegistry[destinationId] || dynamicRegistry[dNorm] || dynamicRegistry[dClean];
        
        if (!dest) {
          // Fuzzy search across dynamicScenesList
          dest = dynamicScenesList.find(s => 
            s.name.toLowerCase() === dNorm || 
            s.id === dClean ||
            s.sceneId.toLowerCase() === dNorm ||
            dNorm.includes(s.name.toLowerCase()) ||
            s.name.toLowerCase().includes(dNorm)
          );
        }
      }
      
      let success = false;
      let errorMessage = "Destination unavailable in this tour";
      
      const targetSceneId = dest ? dest.sceneId : (destinationId && destinationId.startsWith('scene_') ? destinationId : `scene_${destinationId}`);

      if (window.krpano) {
        try {
          console.log("[Hey 360] Calling krpano loadscene:", targetSceneId);
          window.krpano.call(`loadscene('${targetSceneId}', null, MERGE, BLEND(0.5))`);
          success = true;
        } catch (e) {
          console.error("Krpano navigation error:", e);
          errorMessage = e.message;
        }
      } else {
        console.error("window.krpano is undefined");
        errorMessage = "Krpano engine not found";
      }
      
      // Send toolResponse back to Gemini so it confirms warmly
      const functionResponseMsg = {
        toolResponse: {
          functionResponses: [
            {
              id: funcCall.id,
              name: "navigate_scene",
              response: {
                success: success,
                destination: dest ? dest.name : destinationId,
                targetSceneId: targetSceneId,
                ...(success ? {} : { error: errorMessage })
              }
            }
          ]
        }
      };
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(functionResponseMsg));
      }
    }
  }

  function playAudioChunk(base64Audio) {
    if (!outputAudioContext) return;
    
    if (outputAudioContext.state === 'suspended') {
      outputAudioContext.resume();
    }
    
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    
    const buffer = outputAudioContext.createBuffer(1, float32Array.length, 24000);
    buffer.getChannelData(0).set(float32Array);
    
    const source = outputAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(outputAudioContext.destination);
    
    const currentTime = outputAudioContext.currentTime;
    if (nextPlayTime < currentTime) {
      nextPlayTime = currentTime;
    }
    
    source.start(nextPlayTime);
    nextPlayTime += buffer.duration;
    
    playbackQueue.push(source);
    
    source.onended = () => {
      const idx = playbackQueue.indexOf(source);
      if (idx > -1) playbackQueue.splice(idx, 1);
      if (playbackQueue.length === 0 && state === 'Speaking...') {
        updateState('Listening...');
      }
    };
  }
  
  function stopPlayback() {
    playbackQueue.forEach(source => {
      try { source.stop(); } catch(e) {}
    });
    playbackQueue = [];
    nextPlayTime = 0;
  }
  
  function stopAgent() {
    isSetupComplete = false;
    if (ws) {
      try { ws.close(); } catch(e) {}
      ws = null;
    }
    if (workletNode) {
      try { workletNode.disconnect(); } catch(e) {}
      workletNode = null;
    }
    if (scriptProcessor) {
      try { scriptProcessor.disconnect(); } catch(e) {}
      scriptProcessor = null;
    }
    if (inputAudioContext) {
      try { inputAudioContext.close(); } catch(e) {}
      inputAudioContext = null;
    }
    if (outputAudioContext) {
      try { outputAudioContext.close(); } catch(e) {}
      outputAudioContext = null;
    }
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    
    stopPlayback();
    
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch(e) {}
    }
    isGuiding = false;
    isSpeakingTTS = false;
    const existingBubble = document.getElementById('va-hint-bubble');
    if (existingBubble) existingBubble.classList.remove('visible');

    if (state !== 'Error') {
      updateState('Idle');
    }
  }
  
  // Helper to base64 encode ArrayBuffer safely
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // --- Dynamic Proactive Guidance for Idle Navigation ---
  const IDLE_TRIGGER_SECONDS = 30; // Triggers after 30 seconds of staying still
  const COOLDOWN_SECONDS = 60;     // 60 seconds cooldown between tips

  let isGuiding = false;
  let isSpeakingTTS = false;
  let lastHlookat = null;
  let lastVlookat = null;
  let lastViewMoveTime = Date.now();
  let lastSceneName = '';
  let lastSpokenTipTime = 0;
  let bubbleTimeout = null;

  // Unlock browser audio/speech on first user interaction anywhere
  function unlockAudioEngine() {
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.resume();
      } catch (e) {}
    }
  }
  window.addEventListener('click', unlockAudioEngine, { passive: true });
  window.addEventListener('touchstart', unlockAudioEngine, { passive: true });
  window.addEventListener('pointerdown', unlockAudioEngine, { passive: true });

  function showHintBubble(text) {
    if (state !== 'Idle' || isSpeakingTTS || isGuiding) return;
    isSpeakingTTS = true;
    isGuiding = true;

    let bubble = document.getElementById('va-hint-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'va-hint-bubble';
      bubble.className = 'va-hint-bubble';
      document.body.appendChild(bubble);
    }
    bubble.innerHTML = `<span class="va-hint-icon">💡</span> <span class="va-hint-text">${text}</span>`;
    bubble.classList.add('visible');

    const textEl = document.getElementById('va-status-text');
    const originalText = textEl ? textEl.innerText : '';
    if (state === 'Idle' && textEl) {
      textEl.innerText = 'Let me guide you';
    }
    
    // Proactively speak out loud once safely
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Jenny') || v.name.includes('Aria')));
        if (preferredVoice) utterance.voice = preferredVoice;
        
        utterance.onend = () => {
          isSpeakingTTS = false;
          setTimeout(() => { isGuiding = false; }, 1000);
          if (state === 'Idle' && textEl) {
            textEl.innerText = originalText;
          }
        };

        utterance.onerror = () => {
          isSpeakingTTS = false;
          isGuiding = false;
          if (state === 'Idle' && textEl) {
            textEl.innerText = originalText;
          }
        };

        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("[Hey 360] Speech synthesis error:", e);
        isSpeakingTTS = false;
        isGuiding = false;
      }
    } else {
      isSpeakingTTS = false;
      isGuiding = false;
    }

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      bubble.classList.remove('visible');
      if (state === 'Idle' && textEl) {
        textEl.innerText = 'Explore with me';
      }
    }, 8500);
  }

  function triggerProactiveGuidance(sceneId, reason) {
    if (state !== 'Idle' || isGuiding || isSpeakingTTS) return;

    let sceneTitle = '';
    if (window.krpano) {
      try {
        sceneTitle = window.krpano.get(`scene[${sceneId}].title`);
      } catch (e) {}
    }
    if (!sceneTitle && dynamicRegistry[sceneId]) {
      sceneTitle = dynamicRegistry[sceneId].name;
    }
    if (!sceneTitle) {
      sceneTitle = String(sceneId).replace(/^scene_/, '').replace(/_/g, ' ');
    }

    let tip = `Here at ${sceneTitle}, feel free to look around to explore, or ask me to take you to any other view!`;
    showHintBubble(tip);
  }

  // Monitor Krpano scene & view rotation for idle guidance
  setInterval(() => {
    // Never run or trigger guidance if Hey 360 agent is active/listening/speaking
    if (state !== 'Idle') return;
    if (!window.krpano) return;
    
    let currentScene;
    let hlookat;
    let vlookat;
    try {
      currentScene = window.krpano.get('xml.scene');
      hlookat = Number(window.krpano.get('view.hlookat'));
      vlookat = Number(window.krpano.get('view.vlookat'));
    } catch(e) { return; }

    if (!currentScene) return;

    const now = Date.now();

    // Scene Switch
    if (currentScene !== lastSceneName) {
      lastSceneName = currentScene;
      lastViewMoveTime = now;
      lastHlookat = hlookat;
      lastVlookat = vlookat;
      return;
    }

    // View Rotation Detection (user looking around)
    if (lastHlookat !== null && lastVlookat !== null) {
      const diffH = Math.abs(hlookat - lastHlookat);
      const diffV = Math.abs(vlookat - lastVlookat);
      if (diffH > 3 || diffV > 3) {
        lastViewMoveTime = now;
        lastHlookat = hlookat;
        lastVlookat = vlookat;
      }
    } else {
      lastHlookat = hlookat;
      lastVlookat = vlookat;
      lastViewMoveTime = now;
    }

    // Inactivity detection (30 seconds without rotating or exploring)
    if ((now - lastViewMoveTime > IDLE_TRIGGER_SECONDS * 1000) && (now - lastSpokenTipTime > COOLDOWN_SECONDS * 1000)) {
      lastSpokenTipTime = now;
      lastViewMoveTime = now;
      triggerProactiveGuidance(currentScene, "idle");
    }
  }, 2000);
  
})();
