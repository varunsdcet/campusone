/**
 * Heritage Community College design tokens.
 * Colours sampled from the supplied reference screenshots (deep green surfaces,
 * warm white backgrounds, coral accents, gold highlights).
 */
export const colors = {
  // brand
  green900: '#0F3D34',
  green800: '#14483D',
  green700: '#1C5A4C',
  green600: '#2A6B5B',
  green500: '#3C8A6E',
  green100: '#DCEBE3',
  green50: '#EEF5F1',
  coral600: '#D9603C',
  coral500: '#E8714D',
  coral100: '#FBE5DC',
  coral50: '#FDF2EC',
  gold600: '#B8860B',
  gold500: '#D4A017',
  gold100: '#FBF0CF',
  gold50: '#FEF8E6',
  // neutrals
  cream: '#F9F7F2',
  surface: '#FFFFFF',
  surfaceMuted: '#F3F2ED',
  surfaceSubtle: '#F7F6F2',
  border: '#E6E3DB',
  borderStrong: '#CFCBC0',
  ink: '#132A25',
  inkSecondary: '#4B5A56',
  inkMuted: '#7A8783',
  inkFaint: '#A9B2AE',
  // semantic
  success600: '#1E8A5A',
  success100: '#DDF3E7',
  warning600: '#C77A12',
  warning100: '#FCEFD6',
  danger600: '#D64545',
  danger500: '#E25B5B',
  danger100: '#FBE1E1',
  info600: '#2F6FB5',
  info100: '#DEEAF8',
  purple600: '#6D4FB8',
  purple100: '#E9E3F8',
  teal600: '#1F8A8A',
  teal100: '#D8F0F0',
  overlay: 'rgba(15, 35, 30, 0.55)',
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fonts = {
  serif: 'PlayfairDisplay-Regular',
  serifSemiBold: 'PlayfairDisplay-SemiBold',
  serifBold: 'PlayfairDisplay-Bold',
  serifItalic: 'PlayfairDisplay-Italic',
  sans: 'Inter-Regular',
  sansMedium: 'Inter-Medium',
  sansSemiBold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
  mono: 'Menlo',
} as const;

export const shadows = {
  card: {
    shadowColor: '#0F3D34',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
} as const;

export const touchTarget = 44;
