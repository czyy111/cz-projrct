import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: ButtonProps) {
  const theme = useAppTheme();
  const background =
    variant === 'primary'
      ? theme.colors.brand
      : variant === 'danger'
        ? theme.colors.dangerSoft
        : variant === 'secondary'
          ? theme.colors.card
          : 'transparent';
  const color = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? theme.colors.danger : theme.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: variant === 'secondary' ? theme.colors.border : background },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : <Text style={[styles.text, { color }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
});
