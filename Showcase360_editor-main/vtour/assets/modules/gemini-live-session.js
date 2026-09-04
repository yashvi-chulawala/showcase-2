/**
 * gemini-live-session.js
 * Real-Time Bidirectional Gemini Live API WebSocket Session Manager
 * Includes WebSocket Code 1008 / Tool-calling error handling & fallback
 */

(function(global) {
  class GeminiLiveSession {
    constructor(options = {}) {
      this.onStateChange = options.onStateChange || (() => {});
      this.onNavigation = options.onNavigation || (() => {});
      this.onSessionEnd = options.onSessionEnd || (() => {});
      
      this.ws = null;
      this.inputAudioContext = null;
      this.outputAudioContext = null;
      this.mediaStream = null;
      this.workletNode = null;
      
      this.playbackQueue = [];
      this.nextPlayTime = 0;
      this.silenceTimer = null;
      this.lastToolCallTime = 0;
      this.isConnected = false;
      this.isSpeaking = false;
      this.lastToolCalled = null;
    }

    async start(token) {
      if (!token) throw new Error("Gemini API token is required");
      this.onStateChange('Connecting...');

      try {
        // 1. Get microphone stream (16kHz mono)
        this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
          audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true } 
        });

        // 2. Setup Audio contexts
        this.inputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        this.outputAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

        await this.inputAudioContext.audioWorklet.addModule('assets/pcm-processor.js');

        // 3. Connect WebSocket to Gemini Live API
        const activeModel = global.VOICE_CONFIG ? global.VOICE_CONFIG.getActiveModel() : 'models/gemini-2.5-flash-native-audio-preview-12-2025';
        const voiceName = global.VOICE_CONFIG ? global.VOICE_CONFIG.VOICE_NAME : 'Aoede';

        console.log(`[Hey 360 Gemini Live] Opening session with model: ${activeModel}, voice: ${voiceName}`);
        
        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${token}`;
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.sendInitialSetup(activeModel, voiceName);
        };

        this.ws.onmessage = async (evt) => {
          let msg;
          if (evt.data instanceof Blob) {
            const text = await evt.data.text();
            msg = JSON.parse(text);
          } else {
            msg = JSON.parse(evt.data);
          }
          this.handleServerMessage(msg);
        };

        this.ws.onerror = (err) => {
          console.error('[Hey 360 Gemini Live] WebSocket Error:', err);
        };

        this.ws.onclose = (evt) => {
          this.handleSocketClose(evt);
        };

        // 4. Connect Audio Pipeline
        const source = this.inputAudioContext.createMediaStreamSource(this.mediaStream);
        this.workletNode = new AudioWorkletNode(this.inputAudioContext, 'pcm-processor');

        this.workletNode.port.onmessage = (e) => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const pcmData = new Int16Array(e.data);
            const base64Audio = this.arrayBufferToBase64(pcmData.buffer);

            this.ws.send(JSON.stringify({
              realtimeInput: {
                mediaChunks: [{
                  mimeType: "audio/pcm;rate=16000",
                  data: base64Audio
                }]
              }
            }));
          }
        };

        source.connect(this.workletNode);
        this.workletNode.connect(this.inputAudioContext.destination);

        this.resetSilenceTimer();

      } catch (err) {
        console.error('[Hey 360 Gemini Live] Start error:', err);
        this.cleanup();
        this.onStateChange('Error');
        throw err;
      }
    }

    sendInitialSetup(model, voiceName) {
      const sceneListText = global.KrpanoBridge ? global.KrpanoBridge.getSceneListForPrompt() : '';
      const sceneIds = global.KrpanoBridge ? global.KrpanoBridge.getSceneIdsForSchema() : [];

      const systemPrompt = `You are Hey 360, a warm, polite, and helpful voice guide inside a 360 virtual tour.
Your job is understanding spoken navigation requests and confirming them warmly and concisely.
Available scenes in this virtual tour:
${sceneListText}

Instructions:
1. When the user asks to go or look anywhere, call the navigate_to_scene tool with the closest matching scene ID, and give a warm, brief spoken confirmation in the same turn (e.g. "Sure, taking you to Vesu 5 now!").
2. If the user asks for a scene that doesn't exist, politely ask for clarification and mention 2 available options.
3. Keep spoken replies short, natural, and friendly.`;

      const setupPayload = {
        setup: {
          model: model,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          tools: [
            {
              functionDeclarations: [
                {
                  name: "navigate_to_scene",
                  description: "Navigates the 360 virtual tour to the requested scene destination.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      scene_id: {
                        type: "STRING",
                        description: "The scene ID or name of the destination in the virtual tour",
                        ...(sceneIds.length > 0 ? { enum: sceneIds } : {})
                      }
                    },
                    required: ["scene_id"]
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
                  voiceName: voiceName
                }
              }
            }
          }
        }
      };

      console.log('[Hey 360 Gemini Live] Sending setup configuration');
      this.ws.send(JSON.stringify(setupPayload));
    }

    handleServerMessage(msg) {
      this.resetSilenceTimer();

      if (msg.setupComplete) {
        console.log('[Hey 360 Gemini Live] Session ready and listening');
        this.onStateChange('Listening...');
      }

      if (msg.serverContent) {
        if (msg.serverContent.interrupted) {
          this.stopPlayback();
          this.onStateChange('Listening...');
        }

        if (msg.serverContent.modelTurn) {
          const parts = msg.serverContent.modelTurn.parts;
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType.startsWith('audio/pcm')) {
              this.isSpeaking = true;
              this.onStateChange('Speaking...');
              this.playAudioChunk(part.inlineData.data);
            }
          }
        }
      }

      // Handle function calling / tool execution
      if (msg.toolCall && msg.toolCall.functionCalls) {
        this.lastToolCallTime = Date.now();
        for (const call of msg.toolCall.functionCalls) {
          this.handleFunctionCall(call);
        }
      }
    }

    handleFunctionCall(call) {
      console.log('[Hey 360 Gemini Live] Tool Call Received:', call);
      const funcName = call.name;
      const args = call.args || {};
      this.lastToolCalled = { name: funcName, args, time: Date.now() };

      if (funcName === "navigate_to_scene") {
        const rawTarget = args.scene_id || args.destination || '';
        let navResult = { success: false };

        if (global.KrpanoBridge) {
          navResult = global.KrpanoBridge.navigateToScene(rawTarget, 1.0);
        }

        this.onNavigation(rawTarget, navResult);

        // Send toolResponse back to Gemini
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const toolResponsePayload = {
            toolResponse: {
              functionResponses: [
                {
                  id: call.id,
                  name: funcName,
                  response: {
                    success: navResult.success,
                    scene_id: rawTarget,
                    message: navResult.success ? `Successfully transitioned to ${rawTarget}` : `Scene ${rawTarget} not found`
                  }
                }
              ]
            }
          };
          this.ws.send(JSON.stringify(toolResponsePayload));
        }
      }
    }

    handleSocketClose(evt) {
      this.isConnected = false;
      const timeSinceTool = Date.now() - this.lastToolCallTime;

      if (evt.code === 1008 || (timeSinceTool < 2000 && this.lastToolCalled)) {
        console.warn(`[Hey 360 Gemini Live] Abnormal closure (Code: ${evt.code}, Reason: "${evt.reason}") during/after function call.`, 
          'Triggering resilient fallback navigation.');
        
        // If navigation didn't execute, execute fallback resolution immediately
        if (this.lastToolCalled && global.KrpanoBridge) {
          global.KrpanoBridge.navigateToScene(this.lastToolCalled.args.scene_id || this.lastToolCalled.args.destination);
        }
      } else {
        console.log(`[Hey 360 Gemini Live] WebSocket session ended cleanly (Code: ${evt.code})`);
      }

      this.cleanup();
      this.onSessionEnd();
    }

    playAudioChunk(base64Audio) {
      if (!this.outputAudioContext) return;

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

      const buffer = this.outputAudioContext.createBuffer(1, float32Array.length, 24000);
      buffer.getChannelData(0).set(float32Array);

      const source = this.outputAudioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.outputAudioContext.destination);

      const currentTime = this.outputAudioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      source.start(this.nextPlayTime);
      this.nextPlayTime += buffer.duration;

      this.playbackQueue.push(source);

      source.onended = () => {
        const idx = this.playbackQueue.indexOf(source);
        if (idx > -1) this.playbackQueue.splice(idx, 1);
        if (this.playbackQueue.length === 0) {
          this.isSpeaking = false;
          this.onStateChange('Listening...');
          this.resetSilenceTimer();
        }
      };
    }

    stopPlayback() {
      this.playbackQueue.forEach(s => {
        try { s.stop(); } catch(e) {}
      });
      this.playbackQueue = [];
      this.nextPlayTime = 0;
      this.isSpeaking = false;
    }

    resetSilenceTimer() {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      const timeoutMs = global.VOICE_CONFIG ? global.VOICE_CONFIG.SILENCE_TIMEOUT_MS : 6000;
      
      this.silenceTimer = setTimeout(() => {
        if (!this.isSpeaking && this.isConnected) {
          console.log('[Hey 360 Gemini Live] Silence timeout reached, closing live session');
          this.stop();
        }
      }, timeoutMs);
    }

    stop() {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (this.ws) {
        try { this.ws.close(1000, "Session complete"); } catch(e) {}
        this.ws = null;
      }
      this.cleanup();
      this.onSessionEnd();
    }

    cleanup() {
      if (this.silenceTimer) clearTimeout(this.silenceTimer);
      if (this.workletNode) {
        try { this.workletNode.disconnect(); } catch(e) {}
        this.workletNode = null;
      }
      if (this.inputAudioContext) {
        try { this.inputAudioContext.close(); } catch(e) {}
        this.inputAudioContext = null;
      }
      if (this.outputAudioContext) {
        try { this.outputAudioContext.close(); } catch(e) {}
        this.outputAudioContext = null;
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
        this.mediaStream = null;
      }
      this.stopPlayback();
      this.isConnected = false;
    }

    arrayBufferToBase64(buffer) {
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    }
  }

  global.GeminiLiveSession = GeminiLiveSession;
})(typeof window !== 'undefined' ? window : this);
