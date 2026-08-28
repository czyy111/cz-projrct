import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

type FormFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

export function FormField({ label, hint, error, multiline, style, ...props }: FormFieldProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: theme.colors.text }]}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor={theme.colors.secondaryText}
        style={[
          styles.input,
          multiline && styles.multiline,
          { color: theme.colors.text, backgroundColor: theme.colors.card, borderColor: error ? theme.colors.danger : theme.colors.border },
          style,
        ]}
      />
      {error || hint ? <Text style={[styles.hint, { color: error ? theme.colors.danger : theme.colors.secondaryText }]}>{error ?? hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { fontSize: 15, fontWeight: '600' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, fontSize: 16 },
  multiline: { minHeight: 112, paddingTop: 12, textAlignVertical: 'top' },
  hint: { fontSize: 13, lineHeight: 18 },
});
