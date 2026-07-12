const Colors = {
  primary: '#E86F25',
  primaryDark: '#D35F1A',
  primaryLight: '#FF8A4C',
  
  background: '#FFFFFF',
  backgroundSecondary: '#FFFFFF',
  backgroundTertiary: '#F5F5F5',
  
  glass: {
    light: 'rgba(255, 255, 255, 0.55)',
    medium: 'rgba(255, 255, 255, 0.7)',
    heavy: 'rgba(255, 255, 255, 0.85)',
    card: 'rgba(255, 255, 255, 0.65)',
    border: 'rgba(200, 200, 200, 0.3)',
    borderHighlight: 'rgba(200, 200, 200, 0.45)',
    orangeTint: 'rgba(200, 200, 200, 0.06)',
    warmOverlay: 'rgba(240, 240, 240, 0.4)',
  },
  
  white: '#FFFFFF',
  text: '#2D1B0E',
  textSecondary: 'rgba(45, 27, 14, 0.65)',
  textTertiary: 'rgba(45, 27, 14, 0.45)',
  textLight: 'rgba(45, 27, 14, 0.35)',
  
  accent: {
    purple: '#8B5CF6',
    blue: '#3B82F6',
    cyan: '#06B6D4',
    pink: '#EC4899',
    orange: '#F97316',
    green: '#10B981',
    yellow: '#F59E0B',
  },
  
  featureOrange: 'rgba(249, 115, 22, 0.1)',
  featureBlue: 'rgba(59, 130, 246, 0.1)',
  featureGreen: 'rgba(16, 185, 129, 0.1)',
  featureYellow: 'rgba(245, 158, 11, 0.1)',
  featurePink: 'rgba(236, 72, 153, 0.1)',
  featurePurple: 'rgba(139, 92, 246, 0.1)',
  featureCyan: 'rgba(6, 182, 212, 0.1)',
  
  iconOrange: '#F97316',
  iconBlue: '#3B82F6',
  iconGreen: '#10B981',
  iconYellow: '#F59E0B',
  iconPink: '#EC4899',
  iconPurple: '#8B5CF6',
  iconCyan: '#06B6D4',
  
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
  
  border: 'rgba(200, 200, 200, 0.2)',
  
  glow: {
    primary: 'rgba(232, 111, 37, 0.3)',
    purple: 'rgba(139, 92, 246, 0.3)',
    blue: 'rgba(59, 130, 246, 0.3)',
    cyan: 'rgba(6, 182, 212, 0.3)',
  },
  
  gradients: {
    background: ['#FFFFFF', '#F9F9F9', '#FFFFFF'] as const,
    card: ['rgba(255, 255, 255, 0.75)', 'rgba(245, 245, 245, 0.6)'] as const,
    primary: ['#E86F25', '#FF8A4C'] as const,
    purple: ['#8B5CF6', '#EC4899'] as const,
    blue: ['#3B82F6', '#06B6D4'] as const,
    sunset: ['#F97316', '#EC4899', '#8B5CF6'] as const,
    ocean: ['#06B6D4', '#3B82F6'] as const,
    warmGlass: ['rgba(255, 255, 255, 0.92)', 'rgba(245, 245, 245, 0.6)'] as const,
    orangeGlow: ['rgba(232, 111, 37, 0.08)', 'rgba(255, 138, 76, 0.04)'] as const,
  },
};

export default Colors;
