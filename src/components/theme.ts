export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#1F1D1A',
  muted: '#7A746B',
  border: '#ECE6DC',
  champagne: '#B8975E',
  champagneDark: '#8F7140',
  champagneSoft: '#F8F3EA',
  danger: '#A8463A',
  dangerSoft: '#FBEDEA',
  success: '#4B7559',
  successSoft: '#EDF4EF',
  info: '#6B6256',
};

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const type = {
  title: { fontSize: 24, fontWeight: '600' as const, color: colors.text, letterSpacing: 0.2 },
  heading: { fontSize: 19, fontWeight: '600' as const, color: colors.text },
  body: { fontSize: 16, color: colors.text },
  label: { fontSize: 14, color: colors.muted },
  small: { fontSize: 13, color: colors.muted },
};
