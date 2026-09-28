/**
 * Mobile Haptic Vibration Helper
 */
export const triggerHaptic = (pattern: number | number[] = 50) => {
  if (typeof window !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Haptics not supported or blocked by user gesture settings
    }
  }
};
