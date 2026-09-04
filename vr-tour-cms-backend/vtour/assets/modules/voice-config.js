/**
 * voice-config.js
 * Centralized Configuration for Hey 360 Voice Assistant
 */

(function(global) {
  const VOICE_CONFIG = {
    // Current Gemini Developer API Live WebSocket Models
    // Primary: Low-latency native audio model
    PRIMARY_LIVE_MODEL: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    
    // Fallback: Half-cascade model for mission-critical tool-calling reliability
    FALLBACK_LIVE_MODEL: 'models/gemini-2.0-flash-live-001',
    
    // Toggle flag to switch to fallback half-cascade model if needed
    USE_MODEL_FALLBACK: false,

    // Voice Selection (Aoede, Puck, Charon, Kore, Fenrir)
    VOICE_NAME: 'Aoede',

    // Sample Rates
    INPUT_SAMPLE_RATE: 16000,
    OUTPUT_SAMPLE_RATE: 24000,

    // Silence timeout in active conversation mode before returning to passive listening
    SILENCE_TIMEOUT_MS: 6000,

    // Picovoice Porcupine Wake Word Configuration
    // Custom 'Hey 360' model path (.ppn)
    PORCUPINE_KEYWORD_MODEL_PATH: 'assets/models/hey-360.ppn',
    PORCUPINE_KEYWORD_LABEL: 'Hey 360',
    
    // Optional fallback built-in keywords if custom model file is not present:
    // 'picovoice', 'hey google', 'jarvis', 'computer', etc.
    PORCUPINE_BUILTIN_FALLBACK: 'picovoice',

    // Helper to get active model
    getActiveModel: function() {
      return this.USE_MODEL_FALLBACK ? this.FALLBACK_LIVE_MODEL : this.PRIMARY_LIVE_MODEL;
    }
  };

  global.VOICE_CONFIG = VOICE_CONFIG;
})(typeof window !== 'undefined' ? window : this);
