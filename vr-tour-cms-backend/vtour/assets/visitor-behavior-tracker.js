/**
 * VisitorBehaviorTracker Component
 * Silently observes and measures visitor interaction metrics:
 * - Explicit user gestures (mousedown, touchstart, wheel, drag)
 * - Time spent in current scene (dwell time)
 * - Time since last explicit user input
 * - Camera rotation deltas (without resetting user interaction timer)
 */
(function(window) {
  'use strict';

  class VisitorBehaviorTracker {
    constructor() {
      this.currentSceneId = null;
      this.sceneStartTime = Date.now();
      this.lastUserGestureTime = Date.now(); // Strictly explicit user inputs
      this.interactionCountInScene = 0;
      
      // Camera angle tracking
      this.lastHlookat = 0;
      this.lastVlookat = 0;
      this.lastFov = 120;
      this.cumulativeCameraDelta = 0;

      // Transition history log: [{ sceneId, timestamp, dwellTime }]
      this.transitionHistory = [];

      this.initEventListeners();
      console.log('[VisitorBehaviorTracker] Tracker initialized.');
    }

    /**
     * Binds explicit user gesture listeners (clicks, drags, touches, scrolls, keys)
     */
    initEventListeners() {
      const handleUserGesture = (evtType) => {
        this.recordUserGesture(evtType);
      };

      // Only count explicit gestures (clicks, drags, scrolls, touches, keys)
      ['mousedown', 'click', 'wheel', 'touchstart', 'touchmove'].forEach(type => {
        window.addEventListener(type, () => handleUserGesture(type), { passive: true });
      });

      window.addEventListener('keydown', () => handleUserGesture('keydown'), { passive: true });
    }

    /**
     * Records an explicit user input gesture
     * @param {string} eventType - Event name
     */
    recordUserGesture(eventType = 'user_gesture') {
      this.lastUserGestureTime = Date.now();
      this.interactionCountInScene++;
    }

    /**
     * Called whenever camera view changes in krpano WebGL viewer
     * @param {number} hlookat - Horizontal yaw angle
     * @param {number} vlookat - Vertical pitch angle
     * @param {number} fov - Field of view
     */
    onCameraViewChange(hlookat, vlookat, fov) {
      if (hlookat === undefined || vlookat === undefined) return;

      const dh = Math.abs(hlookat - this.lastHlookat);
      const dv = Math.abs(vlookat - this.lastVlookat);
      const df = Math.abs((fov || 120) - this.lastFov);

      // Accumulate camera rotation without resetting lastUserGestureTime
      if (dh > 0.2 || dv > 0.2 || df > 0.2) {
        const normDh = dh > 180 ? 360 - dh : dh;
        this.cumulativeCameraDelta += normDh + dv + df;
      }

      this.lastHlookat = hlookat;
      this.lastVlookat = vlookat;
      if (fov) this.lastFov = fov;
    }

    /**
     * Called when a scene transition occurs
     * @param {string} newSceneId - Target scene ID
     */
    onSceneChange(newSceneId) {
      if (!newSceneId) return;
      const strId = String(newSceneId);
      const now = Date.now();

      if (this.currentSceneId && this.currentSceneId !== strId) {
        const dwellTime = (now - this.sceneStartTime) / 1000;
        this.transitionHistory.push({
          sceneId: this.currentSceneId,
          timestamp: this.sceneStartTime,
          dwellTime: Number(dwellTime.toFixed(1))
        });

        if (this.transitionHistory.length > 15) {
          this.transitionHistory.shift();
        }
      }

      this.currentSceneId = strId;
      this.sceneStartTime = now;
      this.lastUserGestureTime = now;
      this.cumulativeCameraDelta = 0;
      this.interactionCountInScene = 0;

      console.log(`[VisitorBehaviorTracker] Scene changed to ${strId}`);
    }

    /**
     * Calculates real-time visitor behavior metrics
     * @returns {Object} Metric payload for Engagement Detection Engine
     */
    getMetrics() {
      const now = Date.now();
      const sceneDwellTime = (now - this.sceneStartTime) / 1000;
      const timeSinceLastInteraction = (now - this.lastUserGestureTime) / 1000;

      const recentTransitions = this.transitionHistory.filter(t => (now - t.timestamp) < 25000);

      // Ping-ponging detection: Room A -> Room B -> Room A -> Room B
      let isPingPonging = false;
      const totalHistory = [...this.transitionHistory, { sceneId: this.currentSceneId, timestamp: this.sceneStartTime }];
      if (totalHistory.length >= 4) {
        const len = totalHistory.length;
        const s1 = totalHistory[len - 1].sceneId;
        const s2 = totalHistory[len - 2].sceneId;
        const s3 = totalHistory[len - 3].sceneId;
        const s4 = totalHistory[len - 4].sceneId;
        if (s1 === s3 && s2 === s4 && s1 !== s2) {
          isPingPonging = true;
        }
      }

      return {
        currentSceneId: this.currentSceneId,
        sceneDwellTime: Number(sceneDwellTime.toFixed(1)),
        timeSinceLastInteraction: Number(timeSinceLastInteraction.toFixed(1)),
        cumulativeCameraDelta: Number(this.cumulativeCameraDelta.toFixed(1)),
        interactionCountInScene: this.interactionCountInScene,
        recentTransitionCount: recentTransitions.length,
        isPingPonging: isPingPonging,
        totalTransitions: this.transitionHistory.length
      };
    }
  }

  window.VisitorBehaviorTracker = VisitorBehaviorTracker;
})(window);
