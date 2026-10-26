import { TextStyle } from 'react-native';
import { colors, fonts } from './tokens';

export const typography = {
  displayLg: { fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36, color: colors.green900 },
  displayMd: { fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 30, color: colors.green900 },
  displaySm: { fontFamily: fonts.serifSemiBold, fontSize: 20, lineHeight: 26, color: colors.green900 },
  displayXs: { fontFamily: fonts.serifSemiBold, fontSize: 17, lineHeight: 22, color: colors.green900 },
  titleLg: { fontFamily: fonts.sansBold, fontSize: 20, lineHeight: 26, color: colors.ink },
  titleMd: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 22, color: colors.ink },
  titleSm: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 20, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.inkSecondary },
  bodySm: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.inkSecondary },
  bodyStrong: { fontFamily: fonts.sansSemiBold, fontSize: 15, lineHeight: 22, color: colors.ink },
  label: { fontFamily: fonts.sansSemiBold, fontSize: 13, lineHeight: 18, color: colors.ink },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.inkMuted },
  overline: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkMuted,
  },
  mono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, color: colors.inkSecondary },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
