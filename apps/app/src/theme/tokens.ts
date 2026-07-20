import type { EnergyBand } from '@akeso/domain'

/** Akeso's editorial palette: warm paper, crisp ink, living greens. */
export const palette = {
  cream: '#F6F5E8',
  paper: '#FFFDF4',
  ink: '#1F211D',
  green: '#55AE61',
  greenDark: '#2E6F43',
  greenSoft: '#DDEED7',
  lime: '#C9F227',
  blue: '#B7DDF4',
  blueDark: '#397698',
  yellow: '#F4E784',
  coral: '#F6A58C',
  red: '#C74D43',
  white: '#FFFFFF',
} as const

export const colors = {
  bg: palette.cream,
  surface: palette.paper,
  surfaceMuted: '#EDEBDD',
  surfaceInk: palette.ink,

  primary: palette.green,
  primaryDark: palette.greenDark,
  primarySoft: palette.greenSoft,

  cta: palette.ink,
  ctaSoft: palette.lime,

  text: palette.ink,
  textSecondary: '#4E5149',
  textMuted: '#777A70',
  textOnColor: palette.paper,

  border: '#D7D5C7',
  borderStrong: palette.ink,

  danger: palette.red,
  warning: '#A66A18',

  lime: palette.lime,
  blue: palette.blue,
  yellow: palette.yellow,
  coral: palette.coral,
} as const

export const energyColors: Record<EnergyBand, string> = {
  high: palette.green,
  moderate: '#D6A72D',
  low: palette.coral,
}

export const energySoftColors: Record<EnergyBand, string> = {
  high: palette.greenSoft,
  moderate: '#F6EDB9',
  low: '#F8D6CB',
}

export const energyLabels: Record<EnergyBand, string> = {
  high: 'High energy',
  moderate: 'Steady energy',
  low: 'Low energy',
}

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  xl: 32,
  organic: 38,
  pill: 999,
} as const

/** 4pt spacing scale: sp(4) = 16 */
export const sp = (n: number) => n * 4

export const shadows = {
  card: {
    shadowColor: palette.ink,
    shadowOpacity: 0.08,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  raised: {
    shadowColor: palette.ink,
    shadowOpacity: 0.16,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
} as const

export const motion = {
  quick: 180,
  standard: 320,
  reveal: 420,
} as const

export const type = {
  display: {
    fontSize: 42,
    fontWeight: '900' as const,
    color: colors.text,
    letterSpacing: -1.8,
    lineHeight: 43,
  },
  h1: {
    fontSize: 31,
    fontWeight: '800' as const,
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 34,
  },
  h2: {
    fontSize: 23,
    fontWeight: '800' as const,
    color: colors.text,
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  small: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.textMuted,
    lineHeight: 18,
  },
  label: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const
