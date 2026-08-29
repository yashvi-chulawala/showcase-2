(function() {
  // Prevent running in editor or inside iframes
  if (window.location.pathname.includes('editor-panel') || (window.top !== window.self)) {
    return;
  }
  let ws = null;
  let inputAudioContext = null;
  let outputAudioContext = null;
  let mediaStream = null;
  let workletNode = null;
  
  let playbackQueue = [];
  let nextPlayTime = 0;
  
  let state = 'Idle'; // Idle, Connecting..., Listening..., Speaking..., Error
  
  const DESTINATION_REGISTRY = {
    left_view: { sceneId: "scene_DJI_20251222160517_0128_D_equi", name: "Left View" },
    back_view: { sceneId: "scene_DJI_20251222160749_0129_D_equi", name: "Back View" },
    right_view: { sceneId: "scene_DJI_20251222162034_0135_D_equi", name: "Right View" },
    kitchen: { sceneId: "scene_kitchen_360_vr_copy", name: "Kitchen" },
    living_room_1: { sceneId: "scene_living_room_360_vr_1_copy", name: "Living Room 1" },
    living_room_2: { sceneId: "scene_living_room_360_vr_2_copy", name: "Living Room 2" },
    bedroom: { sceneId: "scene_bedroom_3_360_vr_copy", name: "Bedroom 3" }
  };

  const INSTRUCTION = `You are Hey 360, a friendly voice assistant for a 360-degree virtual tour website.
When the user activates you and says "Hey 360", acknowledge them naturally and ask how you can help.
You can navigate the user to different areas of the tour. The available destinations are:
- "Left View" (ID: left_view)
- "Back View" (ID: back_view)
- "Right View" (ID: right_view)
- "Kitchen" (ID: kitchen)
- "Living Room 1" (ID: living_room_1)
- "Living Room 2" (ID: living_room_2)
- "Bedroom 3" (ID: bedroom)

When the user asks to go somewhere, USE THE navigate_scene TOOL to transport them there, and verbally confirm that you are taking them there.
If they ask for a room generically (e.g. "living room" but there are two), ask them which one they mean.
If they ask for a location that does not exist, tell them it isn't available and list some options.
Keep responses concise and natural because the interaction is voice-based.`;

  // UI Setup
  const btn = document.createElement('div');
  btn.id = 'hey-360-btn';
  btn.className = 'hey-360-btn state-idle';
  
  btn.innerHTML = `
    <div class="va-logo-wrapper">
      <img src="assets/360 Eye Logo.png" class="va-logo" alt="360 Eye">
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
      
      // 1. Get Microphone permission
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        alert("Microphone access is required to use Hey 360.\nPlease allow microphone access and try again.");
        updateState('Error');
        return;
      }
      
      // 2. Fetch Ephemeral Token
      const tokenRes = await fetch('/api/gemini-live-token');
      if (!tokenRes.ok) throw new Error("Gemini token failure");
      const { token } = await tokenRes.json();
      
      if (!token) throw new Error("Missing token");
      
      // 3. Initialize WebSockets
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${token}`;
      ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        // Send initial setup
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
                          enum: ["left_view", "back_view", "right_view", "kitchen", "living_room_1", "living_room_2", "bedroom"]
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
        console.error("Voice connection lost", e);
        alert("Voice connection lost.\nPlease try again.");
        stopAgent();
      };
      
      ws.onclose = () => {
        stopAgent();
      };
      
      // 4. Initialize Audio Input (16kHz)
      inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      await inputAudioContext.audioWorklet.addModule('assets/pcm-processor.js');
      
      const source = inputAudioContext.createMediaStreamSource(mediaStream);
      workletNode = new AudioWorkletNode(inputAudioContext, 'pcm-processor');
      
      workletNode.port.onmessage = (e) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const pcmData = new Int16Array(e.data);
          const base64Audio = arrayBufferToBase64(pcmData.buffer);
          
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
      
      // 5. Initialize Audio Output (24kHz Native Playback)
      outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      
    } catch (e) {
      console.error(e);
      alert("Unable to connect to Hey 360.\nPlease try again.");
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
          if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
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
      
      // Fuzzy matching to handle potential model errors
      if (destinationId && !DESTINATION_REGISTRY[destinationId]) {
        destinationId = destinationId.toLowerCase().replace(/\s+/g, '_');
      }
      
      let success = false;
      let errorMessage = "Destination unavailable";
      
      const dest = DESTINATION_REGISTRY[destinationId];
      if (dest) {
        if (window.krpano) {
          try {
            console.log("Calling krpano loadscene:", dest.sceneId);
            window.krpano.call(`loadscene('${dest.sceneId}', null, MERGE, BLEND(0.5))`);
            success = true;
          } catch (e) {
            console.error("Krpano navigation error:", e);
            errorMessage = e.message;
          }
        } else {
          console.error("window.krpano is undefined");
          errorMessage = "Krpano engine not found";
        }
      } else {
        console.error("Destination ID not found in registry:", destinationId);
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
    if (ws) {
      ws.close();
      ws = null;
    }
    if (workletNode) {
      workletNode.disconnect();
      workletNode = null;
    }
    if (inputAudioContext) {
      inputAudioContext.close();
      inputAudioContext = null;
    }
    if (outputAudioContext) {
      outputAudioContext.close();
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
  
})();
