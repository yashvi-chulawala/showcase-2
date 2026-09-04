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
  
  const DESTINATION_REGISTRY = {
    vesu_1: { sceneId: "scene_vesu_1_1", name: "Vesu 1" },
    vesu_16: { sceneId: "scene_vesu_16_1", name: "Vesu 16" },
    vesu_5: { sceneId: "scene_vesu_5_1", name: "Vesu 5" },
    vesu_7: { sceneId: "scene_vesu_7_1", name: "Vesu 7" },
    vesu_2: { sceneId: "scene_vesu_2_1", name: "Vesu 2" },
    left_view: { sceneId: "scene_DJI_20251222160517_0128_D_equi", name: "Left View" },
    back_view: { sceneId: "scene_DJI_20251222160749_0129_D_equi", name: "Back View" },
    right_view: { sceneId: "scene_DJI_20251222162034_0135_D_equi", name: "Right View" }
  };

  const INSTRUCTION = `You are Hey 360, a friendly voice assistant for a 360-degree virtual tour website.

GREETING RULES:
- If the user says "Hey 360", respond with:
  "Hey there! How can I help you today? I can help you navigate between different views."
- If the user greets you or says anything other than "Hey 360" (for example "Hi", "Hello", "Hey", "Hey Siri", "Hey Google", etc.), gently correct them first and say:
  "Hey, it's Hey 360! Hey there! How can I help you today? I can help you navigate between different views."

Available tour destinations:
- "Vesu 1" (ID: vesu_1)
- "Vesu 16" (ID: vesu_16)
- "Vesu 5" (ID: vesu_5)
- "Vesu 7" (ID: vesu_7)
- "Vesu 2" (ID: vesu_2)
- "Left View" (ID: left_view)
- "Back View" (ID: back_view)
- "Right View" (ID: right_view)

When the user asks to go somewhere or view any scene (e.g. "take me to Vesu 5", "show me left view", "go to Vesu 16", "navigate to back view"), call the navigate_scene tool with the exact destination ID and verbally confirm warmly that you are taking them there (e.g. "Sure, taking you to Vesu 5 now!").
If they ask for a location that does not exist, politely tell them it isn't available and mention available options.
Keep responses friendly, warm, concise, and natural.`;

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
        alert("Unable to connect to Hey 360.\nPlease ensure a valid GEMINI_API_KEY is configured in your Render environment.");
        updateState('Error');
        return;
      }
      
      // 4. Initialize WebSockets with Gemini Live model
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
      console.log('[Hey 360] Connecting to Gemini Live WebSocket...');
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('[Hey 360] WebSocket Connected! Sending setup payload...');
        ws.send(JSON.stringify({
          setup: {
            model: "models/gemini-2.5-flash-native-audio-latest",
            systemInstruction: {
              parts: [{ text: INSTRUCTION }]
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
                          enum: ["vesu_1", "vesu_16", "vesu_5", "vesu_7", "vesu_2", "left_view", "back_view", "right_view"]
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
      
      // 5. Initialize Audio Input Streaming (16kHz PCM)
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
      console.log("Destination requested:", destinationId);
      
      // Fuzzy matching to handle potential model variations
      if (destinationId && !DESTINATION_REGISTRY[destinationId]) {
        destinationId = destinationId.toLowerCase().replace(/\s+/g, '_');
      }
      
      let success = false;
      let errorMessage = "Destination unavailable";
      
      const dest = DESTINATION_REGISTRY[destinationId];
      const targetSceneId = dest ? dest.sceneId : (destinationId && destinationId.startsWith('scene_') ? destinationId : `scene_${destinationId}`);

      if (window.krpano) {
        try {
          console.log("Calling krpano loadscene:", targetSceneId);
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
      
      // Send response back
      const functionResponseMsg = {
        toolResponse: {
          functionResponses: [
            {
              id: funcCall.id,
              name: "navigate_scene",
              response: {
                success: success,
                destination: destinationId,
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

  // --- Proactive Guidance for Idle / Stuck / Random Navigation ---
  const SCENE_ATTRACTIONS = {
    scene_DJI_20251222160517_0128_D_equi: {
      name: "Left View",
      tip: "Look at your left, it's a beautiful lake view you can explore! You can also check out the connected central viewpoints."
    },
    scene_DJI_20251222160749_0129_D_equi: {
      name: "Back View",
      tip: "Take a look around to your right to see the main property layout and connected vistas."
    },
    scene_DJI_20251222162034_0135_D_equi: {
      name: "Right View",
      tip: "Look ahead and to your left to explore the scenic surroundings, or click the navigation markers to move ahead!"
    },
    scene_vesu_1_1: {
      name: "Vesu 1",
      tip: "Here at Vesu 1, glance over to your left to see the scenic landscape, or follow the path ahead!"
    },
    scene_vesu_16_1: {
      name: "Vesu 16",
      tip: "At Vesu 16, look around at the open courtyard area and connected pathways."
    },
    scene_vesu_5_1: {
      name: "Vesu 5",
      tip: "Look to your left at the beautiful surrounding views, or tap on the navigation markers to proceed."
    },
    scene_vesu_7_1: {
      name: "Vesu 7",
      tip: "Here at Vesu 7, take in the wide open perspective, or move towards the adjacent views."
    },
    scene_vesu_2_1: {
      name: "Vesu 2",
      tip: "At Vesu 2, look to your side to explore the lush landscape and panoramic views."
    }
  };

  let lastActivityTime = Date.now();
  let lastSpokenTipTime = 0;
  let lastSceneName = '';
  let sceneSwitchTimes = [];
  let bubbleTimeout = null;

  function recordActivity() {
    lastActivityTime = Date.now();
  }

  ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel'].forEach(evt => {
    window.addEventListener(evt, recordActivity, { passive: true });
  });

  function showHintBubble(text) {
    let bubble = document.getElementById('va-hint-bubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.id = 'va-hint-bubble';
      bubble.className = 'va-hint-bubble';
      document.body.appendChild(bubble);
    }
    bubble.innerHTML = `<span class="va-hint-icon">💡</span> <span class="va-hint-text">${text}</span>`;
    bubble.classList.add('visible');
    
    // Proactively speak out loud
    if (window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.05;
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira')));
        if (preferredVoice) utterance.voice = preferredVoice;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("[Hey 360] Speech synthesis error:", e);
      }
    }

    clearTimeout(bubbleTimeout);
    bubbleTimeout = setTimeout(() => {
      bubble.classList.remove('visible');
    }, 8500);
  }

  function triggerProactiveGuidance(sceneId, reason) {
    let attraction = SCENE_ATTRACTIONS[sceneId];
    if (!attraction && sceneId) {
      const lower = sceneId.toLowerCase();
      for (const [k, v] of Object.entries(SCENE_ATTRACTIONS)) {
        if (lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower)) {
          attraction = v;
          break;
        }
      }
    }

    let tip = attraction ? attraction.tip : "Look at your left and right to explore the beautiful scenic views, or click on navigation markers to explore!";
    if (reason === "random") {
      tip = "You're exploring fast! " + tip;
    }
    showHintBubble(tip);
  }

  // Monitor idle state and rapid disconnected navigation
  setInterval(() => {
    if (!window.krpano) return;
    
    let currentScene;
    try {
      currentScene = window.krpano.get('xml.scene');
    } catch(e) { return; }

    if (!currentScene) return;

    const now = Date.now();

    // Scene transition detection
    if (currentScene !== lastSceneName) {
      lastSceneName = currentScene;
      lastActivityTime = now;
      sceneSwitchTimes.push(now);
      if (sceneSwitchTimes.length > 4) sceneSwitchTimes.shift();

      // Check for rapid random navigation (3+ switches within 10s)
      if (sceneSwitchTimes.length >= 3 && (now - sceneSwitchTimes[0]) < 10000) {
        if (now - lastSpokenTipTime > 45000) {
          lastSpokenTipTime = now;
          triggerProactiveGuidance(currentScene, "random");
        }
      }
      return;
    }

    // Inactivity / Stuck on scene detection (stuck for 45s without interaction)
    if ((now - lastActivityTime > 45000) && (now - lastSpokenTipTime > 60000)) {
      lastSpokenTipTime = now;
      lastActivityTime = now;
      triggerProactiveGuidance(currentScene, "idle");
    }
  }, 3000);
  
})();
