export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  pill: 999,
} as const;

export const typography = {
  title: 28,
  heading: 20,
  body: 16,
  meta: 13,
} as const;

export const lightColors = {
  background: '#F8F7F4',
  card: '#FFFFFF',
  text: '#262421',
  secondaryText: '#6F6A64',
  border: '#E9E5E0',
  brand: '#FF8A3D',
  brandPressed: '#E96F25',
  brandSoft: '#FFF0E5',
  danger: '#B42318',
  dangerSoft: '#FEECEB',
  warning: '#9A6700',
  warningSoft: '#FFF6D8',
  success: '#287A42',
  successSoft: '#EAF7EE',
} as const;

export const darkColors = {
  background: '#161514',
  card: '#211F1D',
  text: '#F4F1ED',
  secondaryText: '#B8B1AA',
  border: '#3A3632',
  brand: '#FF9B58',
  brandPressed: '#FFB07A',
  brandSoft: '#3A261B',
  danger: '#FF8C82',
  dangerSoft: '#3B211F',
  warning: '#F4C76B',
  warningSoft: '#3A301B',
  success: '#7BD994',
  successSoft: '#1D3525',
} as const;

export type AppColors = typeof lightColors | typeof darkColors;
