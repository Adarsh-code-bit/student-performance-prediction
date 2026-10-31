/**
 * Web Audio API Synthesis for Picker Order Notifications & Siren
 * Satisfies browser autoplay rules by requiring explicit user activation.
 * Pure Web Audio API: Zero external sound asset dependencies.
 */

class AudioAlertService {
  constructor() {
    this.audioCtx = null;
    this.isPlaying = false;
    this.intervalId = null;
  }

  /**
   * Initializes or resumes the AudioContext on user gesture.
   */
  async init() {
    if (typeof window === 'undefined') return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    if (!this.audioCtx) {
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch (err) {
        console.warn('AudioContext resume error:', err);
      }
    }
  }

  /**
   * Synthesizes a clean audio chime pulse using oscillators.
   */
  playChime(frequency = 880, duration = 0.22, type = 'sine') {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    try {
      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, now);

      // Smooth attack and decay to avoid speaker pops
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + duration);
    } catch (err) {
      console.warn('Audio chime playback error:', err);
    }
  }

  /**
   * Starts a repeating dual-tone alert siren.
   * Runs continuously until stopSiren() is called.
   */
  async startSiren() {
    if (this.isPlaying) return;
    await this.init();

    if (!this.audioCtx || this.audioCtx.state !== 'running') {
      return;
    }

    this.isPlaying = true;
    let toggle = false;

    // Mobile haptic feedback for picker handheld device
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200, 100, 400]);
      } catch (e) {}
    }

    // Immediate first pulse
    this.playChime(880, 0.25, 'triangle');

    this.intervalId = setInterval(() => {
      if (!this.isPlaying) {
        clearInterval(this.intervalId);
        this.intervalId = null;
        return;
      }
      toggle = !toggle;
      this.playChime(toggle ? 987.77 : 783.99, 0.25, 'triangle'); // B5 and G5 alert notes
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(200);
        } catch (e) {}
      }
    }, 550);
  }

  /**
   * Stops the audible siren immediately.
   */
  stopSiren() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(0);
      } catch (e) {}
    }
  }
}

export const audioAlert = new AudioAlertService();
