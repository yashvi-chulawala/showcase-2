/**
 * EngagementDetector Component
 * Evaluates real-time metrics from VisitorBehaviorTracker every 1.5s
 * Classifies visitor behavior into 3 distinct states:
 * - EXPLORING: Visitor is actively rotating camera or making steady progress
 * - IDLE: Visitor is sitting still in a scene without input for > 8-10s
 * - RANDOM: Visitor is navigating erratically, ping-ponging, or rapidly jumping scenes
 */
(function(window) {
  'use strict';

  const VISITOR_STATE = {
    EXPLORING: 'EXPLORING',
    IDLE: 'IDLE',
    RANDOM: 'RANDOM'
  };

  class EngagementDetector {
    /**
     * @param {Object} trackerInstance - Instance of VisitorBehaviorTracker
     */
    constructor(trackerInstance) {
      this.tracker = trackerInstance || (window.visitorTracker ? window.visitorTracker : null);
      this.currentState = VISITOR_STATE.EXPLORING;
      this.checkInterval = null;
      this.listeners = [];
      this.tickListeners = [];
      this.lastEvaluationTime = Date.now();

      // Configurable threshold rules (Fast & responsive for real-world testing)
      this.rules = {
        idleDwellThreshold: 9.0,             // Seconds in scene before eligible for idle
        idleInactivityThreshold: 7.5,        // Seconds without mouse click/drag/touch before idle
        idleMaxCameraDelta: 30.0,            // Max degrees rotated allowed during idle period

        randomTransitionCountThreshold: 3,   // Scene transitions within 25 seconds
        randomMaxDwellTime: 5.0              // Max average dwell time per room in rapid mode
      };

      console.log('[EngagementDetector] Detection Engine initialized.');
    }

    /**
     * Registers a callback listener for state transitions
     * @param {Function} callback - fn(newState, previousState, metrics, reason)
     */
    onStateChange(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    }

    /**
     * Registers a periodic ticker callback listener (runs every 1.5s tick)
     * @param {Function} callback - fn(currentState, metrics)
     */
    onTick(callback) {
      if (typeof callback === 'function') {
        this.tickListeners.push(callback);
      }
    }

    /**
     * Starts periodic 1.5s evaluation ticker
     */
    start() {
      if (this.checkInterval) return;
      this.checkInterval = setInterval(() => {
        this.evaluateState();
      }, 1500);
      console.log('[EngagementDetector] Evaluation loop started (1.5s ticker).');
    }

    /**
     * Stops evaluation ticker
     */
    stop() {
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }
    }

    /**
     * Core Classification Engine — Evaluates metrics against engagement rules
     */
    evaluateState() {
      if (!this.tracker && window.visitorTracker) {
        this.tracker = window.visitorTracker;
      }
      if (!this.tracker) return;

      const metrics = this.tracker.getMetrics();
      let evaluatedState = VISITOR_STATE.EXPLORING;
      let reason = 'Active navigation or gesture input detected';

      // RULE 1: Detect Random / Disoriented Navigation
      if (metrics.isPingPonging) {
        evaluatedState = VISITOR_STATE.RANDOM;
        reason = 'Ping-ponging navigation detected between repeated rooms';
      } else if (metrics.recentTransitionCount >= this.rules.randomTransitionCountThreshold && metrics.sceneDwellTime < this.rules.randomMaxDwellTime) {
        evaluatedState = VISITOR_STATE.RANDOM;
        reason = `Rapid scene switching detected (${metrics.recentTransitionCount} transitions in < 25s)`;
      }
      // RULE 2: Detect Idle / Stuck Behavior
      else if (
        metrics.sceneDwellTime >= this.rules.idleDwellThreshold &&
        metrics.timeSinceLastInteraction >= this.rules.idleInactivityThreshold
      ) {
        evaluatedState = VISITOR_STATE.IDLE;
        reason = `Idle state detected (${metrics.timeSinceLastInteraction.toFixed(1)}s inactivity)`;
      }

      // 1. Notify periodic tick listeners (runs every 1.5s tick)
      this.tickListeners.forEach(fn => {
        try {
          fn(evaluatedState, metrics);
        } catch (e) {}
      });

      // 2. Handle State Change Transition
      if (evaluatedState !== this.currentState) {
        const prevState = this.currentState;
        this.currentState = evaluatedState;

        console.log(`[EngagementDetector] State ➔ ${evaluatedState} (${reason})`, metrics);

        this.listeners.forEach(fn => {
          try {
            fn(evaluatedState, prevState, metrics, reason);
          } catch (e) {
            console.error('[EngagementDetector] Callback error:', e);
          }
        });
      }
    }
  }

  window.VISITOR_STATE = VISITOR_STATE;
  window.EngagementDetector = EngagementDetector;
})(window);
