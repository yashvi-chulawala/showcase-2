/**
 * porcupine-listener.js
 * On-Device Wake-Word Detection using Picovoice Porcupine Web SDK with fallback
 */

(function(global) {
  class PorcupineWakeListener {
    constructor(options = {}) {
      this.accessKey = options.accessKey || '';
      this.keywordModelPath = options.keywordModelPath || 'assets/models/hey-360.ppn';
      this.onWakeWord = options.onWakeWord || (() => {});
      this.onStatusChange = options.onStatusChange || (() => {});
      
      this.porcupineWorker = null;
      this.webVoiceListener = null;
      this.isListening = false;
      this.isPaused = false;
      this.useFallback = false;
    }

    async init() {
      // 1. Try initializing Porcupine Web Worker if AccessKey is provided
      if (this.accessKey && typeof PorcupineWeb !== 'undefined') {
        try {
          console.log('[Hey 360 Porcupine] Initializing Porcupine Web Worker...');
          this.porcupineWorker = await PorcupineWeb.PorcupineWorker.create(
            this.accessKey,
            [{ publicPath: this.keywordModelPath, label: "Hey 360" }],
            (keywordIndex) => {
              if (this.isListening && !this.isPaused) {
                console.log('[Hey 360 Porcupine] Wake-word "Hey 360" detected (Index: ' + keywordIndex + ')');
                this.handleWakeDetected();
              }
            }
          );
          console.log('[Hey 360 Porcupine] Porcupine Worker initialized successfully.');
          return true;
        } catch (err) {
          console.warn('[Hey 360 Porcupine] Porcupine initialization failed, switching to continuous wake fallback:', err.message);
        }
      }

      // 2. Setup Lightweight On-Device WebSpeech / Audio Wake Word Listener Fallback
      this.setupFallbackWakeListener();
      return true;
    }

    setupFallbackWakeListener() {
      this.useFallback = true;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event) => {
            if (!this.isListening || this.isPaused) return;
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const transcript = event.results[i][0].transcript.toLowerCase().trim();
              if (transcript.includes('hey 360') || transcript.includes('hey three sixty') || transcript.includes('360')) {
                console.log('[Hey 360 Wake] Wake word detected in transcript:', transcript);
                this.handleWakeDetected();
                break;
              }
            }
          };

          rec.onend = () => {
            if (this.isListening && !this.isPaused) {
              try { rec.start(); } catch(e) {}
            }
          };

          rec.onerror = (e) => {
            if (e.error !== 'no-speech') {
              console.warn('[Hey 360 Wake] Speech recognition notice:', e.error);
            }
          };

          this.webVoiceListener = rec;
          console.log('[Hey 360 Wake] Wake listener ready.');
        } catch (e) {
          console.warn('[Hey 360 Wake] SpeechRecognition unavailable:', e);
        }
      }
    }

    handleWakeDetected() {
      this.pause();
      this.onWakeWord();
    }

    start() {
      this.isListening = true;
      this.isPaused = false;
      this.onStatusChange('Listening for "Hey 360"...');

      if (this.porcupineWorker) {
        try {
          // Resume Porcupine audio capture
          this.porcupineWorker.postMessage({ command: "resume" });
        } catch(e) {}
      } else if (this.webVoiceListener) {
        try {
          this.webVoiceListener.start();
        } catch(e) {}
      }
    }

    pause() {
      this.isPaused = true;
      if (this.porcupineWorker) {
        try {
          this.porcupineWorker.postMessage({ command: "pause" });
        } catch(e) {}
      }
      if (this.webVoiceListener) {
        try {
          this.webVoiceListener.stop();
        } catch(e) {}
      }
    }

    resume() {
      if (this.isListening) {
        this.isPaused = false;
        this.onStatusChange('Listening for "Hey 360"...');
        if (this.porcupineWorker) {
          try {
            this.porcupineWorker.postMessage({ command: "resume" });
          } catch(e) {}
        } else if (this.webVoiceListener) {
          try {
            this.webVoiceListener.start();
          } catch(e) {}
        }
      }
    }

    stop() {
      this.isListening = false;
      this.isPaused = false;
      this.onStatusChange('Idle');

      if (this.porcupineWorker) {
        try {
          this.porcupineWorker.postMessage({ command: "pause" });
        } catch(e) {}
      }
      if (this.webVoiceListener) {
        try {
          this.webVoiceListener.stop();
        } catch(e) {}
      }
    }
  }

  global.PorcupineWakeListener = PorcupineWakeListener;
})(typeof window !== 'undefined' ? window : this);
