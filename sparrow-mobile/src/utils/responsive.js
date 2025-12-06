import { Dimensions, PixelRatio, Platform } from 'react-native';

// Base design dimensions (iPhone X - commonly used in Figma)
const BASE_WIDTH = 375;
const BASE_HEIGHT = 812;

// Get current screen dimensions
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate scale factors
const widthScale = SCREEN_WIDTH / BASE_WIDTH;
const heightScale = SCREEN_HEIGHT / BASE_HEIGHT;

/**
 * Scale width based on screen width
 */
export const scaleWidth = (size) => {
  return Math.round(size * widthScale);
};

/**
 * Scale height based on screen height
 */
export const scaleHeight = (size) => {
  return Math.round(size * heightScale);
};

/**
 * Scale font size
 */
export const scaleFont = (size) => {
  const newSize = size * widthScale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

/**
 * Moderate scale (less aggressive scaling for spacing)
 */
export const moderateScale = (size, factor = 0.5) => {
  return Math.round(size + (scaleWidth(size) - size) * factor);
};

/**
 * Get responsive percentage width
 */
export const wp = (percentage) => {
  return (SCREEN_WIDTH * percentage) / 100;
};

/**
 * Get responsive percentage height
 */
export const hp = (percentage) => {
  return (SCREEN_HEIGHT * percentage) / 100;
};

/**
 * Get screen dimensions
 */
export const getScreenDimensions = () => ({
  width: SCREEN_WIDTH,
  height: SCREEN_HEIGHT,
  scale: widthScale,
});

/**
 * Check if device is tablet
 */
export const isTablet = () => {
  return (
    (SCREEN_WIDTH >= 768 && SCREEN_HEIGHT >= 1024) ||
    (SCREEN_WIDTH >= 1024 && SCREEN_HEIGHT >= 768)
  );
};

/**
 * Check if device is small screen
 */
export const isSmallDevice = () => {
  return SCREEN_WIDTH < 375;
};

export const scaleFactors = {
  width: widthScale,
  height: heightScale,
};

