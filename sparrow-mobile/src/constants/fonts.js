import { scaleFont } from '../utils/responsive';

/**
 * Typography System
 * Font sizes are scaled responsively
 */

export const fontSizes = {
  xs: scaleFont(12),
  sm: scaleFont(14),
  base: scaleFont(16),
  lg: scaleFont(18),
  xl: scaleFont(20),
  '2xl': scaleFont(24),
  '3xl': scaleFont(30),
  '4xl': scaleFont(36),
  '5xl': scaleFont(48),
};

export const fontWeights = {
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
};

// Font families (iOS uses San Francisco, Android uses Roboto by default)
export const fontFamilies = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
};

