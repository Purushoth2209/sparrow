import { moderateScale } from '../utils/responsive';

/**
 * Spacing system based on 8px grid
 * All values are scaled responsively
 */
export const spacing = {
  xs: moderateScale(4),
  sm: moderateScale(8),
  md: moderateScale(16),
  lg: moderateScale(24),
  xl: moderateScale(32),
  '2xl': moderateScale(40),
  '3xl': moderateScale(48),
  '4xl': moderateScale(64),
};

export const padding = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  screen: moderateScale(16),
  card: moderateScale(16),
  button: {
    horizontal: moderateScale(24),
    vertical: moderateScale(12),
  },
};

export const margin = {
  xs: spacing.xs,
  sm: spacing.sm,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
  section: moderateScale(24),
};

export const borderRadius = {
  none: 0,
  sm: moderateScale(4),
  md: moderateScale(8),
  lg: moderateScale(12),
  xl: moderateScale(16),
  '2xl': moderateScale(24),
  full: 9999,
  button: moderateScale(8),
  card: moderateScale(12),
  input: moderateScale(8),
};

export const iconSizes = {
  xs: moderateScale(16),
  sm: moderateScale(20),
  md: moderateScale(24),
  lg: moderateScale(32),
  xl: moderateScale(40),
  '2xl': moderateScale(48),
};

export const dimensions = {
  button: {
    sm: moderateScale(36),
    md: moderateScale(44),
    lg: moderateScale(52),
  },
  input: {
    sm: moderateScale(40),
    md: moderateScale(48),
    lg: moderateScale(56),
  },
  avatar: {
    xs: moderateScale(24),
    sm: moderateScale(32),
    md: moderateScale(40),
    lg: moderateScale(56),
    xl: moderateScale(80),
  },
};
