/**
 * voice-assistant.js
 * "Hey 360" Master Voice Navigation Agent Orchestrator
 * Integrates Porcupine Wake Listener, Gemini Live Session, and krpano Bridge.
 */

(function() {
  // Prevent running inside editor panel or nested iframe
  if (window.location.pathname.includes('editor-panel') || (window.top !== window.self)) {
    return;
  }

  let wakeListener = null;
  let liveSession = null;
  let activeState = 'Idle';
  let cachedToken = null;

  // Build UI Widget
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

  function updateUIState(state) {
    activeState = state;
    const textEl = document.getElementById('va-status-text');
    if (textEl) {
      if (state === 'Idle') textEl.innerText = 'Say "Hey 360"';
      else if (state === 'Connecting...') textEl.innerText = 'Connecting...';
      else if (state === 'Listening...') textEl.innerText = "I'm listening...";
      else if (state === 'Speaking...') textEl.innerText = 'Guiding you...';
      else if (state === 'Navigating') textEl.innerText = 'Heading there...';
      else textEl.innerText = state;
    }
    
    btn.className = `hey-360-btn state-${state.toLowerCase().replace(/[^a-z]/g, '')}`;
  }

  async function fetchToken() {
    try {
      const res = await fetch('/api/gemini-live-token');
      if (!res.ok) throw new Error("Failed to retrieve token");
      const data = await res.json();
      cachedToken = data.token;
      return cachedToken;
    } catch (err) {
      console.error("[Hey 360] Token fetch error:", err);
      return null;
    }
  }

  async function initAgent() {
    updateUIState('Idle');

    // 1. Initialize Krpano Bridge
    if (window.KrpanoBridge) {
      window.KrpanoBridge.discoverScenes();
    }

    // 2. Initialize Gemini Live Session Manager
    if (window.GeminiLiveSession) {
      liveSession = new window.GeminiLiveSession({
        onStateChange: (st) => updateUIState(st),
        onNavigation: (target, res) => {
          console.log('[Hey 360] Navigation executed:', target, res);
          updateUIState('Navigating');
        },
        onSessionEnd: () => {
          console.log('[Hey 360] Session ended. Resuming wake-word listener.');
          updateUIState('Idle');
          if (wakeListener) wakeListener.resume();
        }
      });
    }

    // 3. Initialize Wake-Word Listener (Picovoice Porcupine with WebSpeech fallback)
    if (window.PorcupineWakeListener) {
      const config = window.VOICE_CONFIG || {};
      wakeListener = new window.PorcupineWakeListener({
        keywordModelPath: config.PORCUPINE_KEYWORD_MODEL_PATH,
        onWakeWord: () => {
          console.log('[Hey 360] Wake word triggered! Starting live session...');
          startLiveConversation();
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

    // 4. Click-to-talk handler on Orb Button
    btn.addEventListener('click', async () => {
      if (activeState === 'Idle' || activeState === 'Error') {
        if (wakeListener) wakeListener.pause();
        await startLiveConversation();
      } else {
        if (liveSession) liveSession.stop();
      }
    });
  }

  async function startLiveConversation() {
    try {
      updateUIState('Connecting...');
      const token = await fetchToken();
      if (!token) {
        alert("Unable to authenticate Hey 360.\nPlease ensure GEMINI_API_KEY is configured.");
        updateUIState('Idle');
        if (wakeListener) wakeListener.resume();
        return;
      }

      if (liveSession) {
        await liveSession.start(token);
      }
    } catch (err) {
      console.error("[Hey 360] Conversation start error:", err);
      updateUIState('Idle');
      if (wakeListener) wakeListener.resume();
    }
  }

  // Boot up agent once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAgent);
  } else {
    initAgent();
  }
})();
