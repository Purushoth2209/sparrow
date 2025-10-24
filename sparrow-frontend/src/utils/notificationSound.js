// Notification Sound Utility
// Handles playing notification sounds for both app and browser notifications

import audioGenerator from './audioGenerator';

class NotificationSoundManager {
  constructor() {
    this.isEnabled = true;
    this.volume = 0.7; // Default volume (0.0 to 1.0)
    this.loadSettings();
  }

  // Load settings from localStorage
  loadSettings() {
    try {
      const savedSettings = localStorage.getItem('notificationSoundSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        this.isEnabled = settings.enabled !== false; // Default to true
        this.volume = settings.volume !== undefined ? settings.volume : 0.7;
        this.updateVolume();
      }
    } catch (error) {
      // Silent error handling for production
    }
  }

  // Save settings to localStorage
  saveSettings() {
    try {
      const settings = {
        enabled: this.isEnabled,
        volume: this.volume
      };
      localStorage.setItem('notificationSoundSettings', JSON.stringify(settings));
    } catch (error) {
      // Silent error handling for production
    }
  }

  // Update volume for audio generator
  updateVolume() {
    // Volume is handled by the audio generator
  }

  // Play sound for specific notification type
  playSound(notificationType) {
    if (!this.isEnabled) {
      return;
    }

    try {
      switch (notificationType) {
        case 'message_received':
          audioGenerator.generateMessageSound();
          break;
        case 'friend_request_received':
          audioGenerator.generateFriendRequestSound();
          break;
        case 'friend_request_accepted':
          audioGenerator.generateFriendAcceptedSound();
          break;
        case 'friend_request_rejected':
          audioGenerator.generateFriendRejectedSound();
          break;
        case 'friend_unfriended':
          audioGenerator.generateFriendRemovedSound();
          break;
        default:
          audioGenerator.generateGenericSound();
      }
    } catch (error) {
      // Silent error handling for production
    }
  }

  // Handle autoplay block by requesting user interaction
  handleAutoplayBlock() {
    // The sound will automatically play on the next user interaction
    // due to the browser's autoplay policy
  }

  // Enable/disable sounds
  setEnabled(enabled) {
    this.isEnabled = enabled;
    this.saveSettings();
  }

  // Set volume (0.0 to 1.0)
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume)); // Clamp between 0 and 1
    this.updateVolume();
    this.saveSettings();
  }

  // Test sound (for settings)
  testSound(notificationType = 'message_received') {
    this.playSound(notificationType);
  }

  // Get current settings
  getSettings() {
    return {
      enabled: this.isEnabled,
      volume: this.volume
    };
  }
}

// Create a singleton instance
const notificationSoundManager = new NotificationSoundManager();

// Export the manager instance
export default notificationSoundManager;

// Export utility functions for easy use
export const playNotificationSound = (notificationType) => {
  notificationSoundManager.playSound(notificationType);
};

export const setNotificationSoundEnabled = (enabled) => {
  notificationSoundManager.setEnabled(enabled);
};

export const setNotificationSoundVolume = (volume) => {
  notificationSoundManager.setVolume(volume);
};

export const testNotificationSound = (notificationType) => {
  notificationSoundManager.testSound(notificationType);
};

export const getNotificationSoundSettings = () => {
  return notificationSoundManager.getSettings();
};
