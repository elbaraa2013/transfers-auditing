import React from 'react';
import { View, ViewProps } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type ThemedViewProps = ViewProps & {
  variant?: 'default' | 'card' | 'secondary';
};

export function ThemedView({ style, variant = 'default', ...rest }: ThemedViewProps) {
  const colors = useColors();

  let backgroundColor = colors.background;
  if (variant === 'card') backgroundColor = colors.card;
  if (variant === 'secondary') backgroundColor = colors.secondary;

  return <View style={[{ backgroundColor }, style]} {...rest} />;
}