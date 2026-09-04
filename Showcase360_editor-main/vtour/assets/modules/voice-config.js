/**
 * voice-config.js
 * Centralized Configuration for Hey 360 Voice Assistant
 */

(function(global) {
  const VOICE_CONFIG = {
    // Current Gemini Developer API Live WebSocket Models
    // Primary: Low-latency native live model
    PRIMARY_LIVE_MODEL: 'models/gemini-2.0-flash-exp',
    
    // Fallback model
    FALLBACK_LIVE_MODEL: 'models/gemini-2.0-flash-realtime-exp',
    
    // Toggle flag
    USE_MODEL_FALLBACK: false,

    // Voice Selection (Aoede, Puck, Charon, Kore, Fenrir)
    VOICE_NAME: 'Aoede',

    // Sample Rates
    INPUT_SAMPLE_RATE: 16000,
    OUTPUT_SAMPLE_RATE: 24000,

    // Silence timeout in active conversation mode
    SILENCE_TIMEOUT_MS: 7000,

    // Picovoice Porcupine Wake Word Configuration
    PORCUPINE_KEYWORD_MODEL_PATH: 'assets/models/hey-360.ppn',
    PORCUPINE_KEYWORD_LABEL: 'Hey 360',
    PORCUPINE_BUILTIN_FALLBACK: 'picovoice',

    // Helper to get active model
    getActiveModel: function() {
      return this.USE_MODEL_FALLBACK ? this.FALLBACK_LIVE_MODEL : this.PRIMARY_LIVE_MODEL;
    }
  };

  global.VOICE_CONFIG = VOICE_CONFIG;
})(typeof window !== 'undefined' ? window : this);
