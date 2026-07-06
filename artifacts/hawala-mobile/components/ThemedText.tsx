import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'subtitle' | 'link' | 'error';
};

export function ThemedText({ style, type = 'default', ...rest }: ThemedTextProps) {
  const colors = useColors();

  return (
    <Text
      style={[
        { color: colors.text, fontFamily: 'Cairo_400Regular', textAlign: 'right', writingDirection: 'rtl' },
        type === 'title' && styles.title,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && { color: colors.primary },
        type === 'error' && { color: colors.destructive },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontFamily: 'Cairo_700Bold',
  },
  subtitle: {
    fontSize: 18,
    fontFamily: 'Cairo_600SemiBold',
  },
});