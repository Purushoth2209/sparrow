// Audio Generator for Notification Sounds
// Creates simple notification sounds programmatically using Web Audio API

class AudioGenerator {
  constructor() {
    this.audioContext = null;
    this.initAudioContext();
  }

  initAudioContext() {
    try {
      // Create audio context
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (error) {
      // Silent error handling for production
    }
  }

  // Ensure audio context is running (required for some browsers)
  async ensureAudioContext() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Generate a simple beep sound
  generateBeep(frequency = 800, duration = 200, volume = 0.3) {
    if (!this.audioContext) return null;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration / 1000);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration / 1000);

    return oscillator;
  }

  // Generate a notification sound for messages
  generateMessageSound() {
    this.ensureAudioContext();
    // Double beep for messages
    this.generateBeep(800, 150, 0.3);
    setTimeout(() => {
      this.generateBeep(1000, 150, 0.3);
    }, 200);
  }

  // Generate a notification sound for friend requests
  generateFriendRequestSound() {
    this.ensureAudioContext();
    // Rising tone for friend requests
    this.generateBeep(600, 200, 0.3);
    setTimeout(() => {
      this.generateBeep(800, 200, 0.3);
    }, 150);
    setTimeout(() => {
      this.generateBeep(1000, 200, 0.3);
    }, 300);
  }

  // Generate a notification sound for friend accepted
  generateFriendAcceptedSound() {
    this.ensureAudioContext();
    // Happy ascending tones
    this.generateBeep(523, 200, 0.3); // C5
    setTimeout(() => {
      this.generateBeep(659, 200, 0.3); // E5
    }, 100);
    setTimeout(() => {
      this.generateBeep(784, 300, 0.3); // G5
    }, 200);
  }

  // Generate a notification sound for friend rejected
  generateFriendRejectedSound() {
    this.ensureAudioContext();
    // Descending tone for rejection
    this.generateBeep(800, 300, 0.3);
    setTimeout(() => {
      this.generateBeep(600, 300, 0.3);
    }, 200);
  }

  // Generate a notification sound for friend removed
  generateFriendRemovedSound() {
    this.ensureAudioContext();
    // Single low tone
    this.generateBeep(400, 400, 0.3);
  }

  // Generate a generic notification sound
  generateGenericSound() {
    this.ensureAudioContext();
    this.generateBeep(800, 200, 0.3);
  }
}

// Create a singleton instance
const audioGenerator = new AudioGenerator();

export default audioGenerator;
