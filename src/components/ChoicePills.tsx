import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../theme/useAppTheme';

type Choice<T extends string> = { value: T; label: string };

export function ChoicePills<T extends string>({ value, choices, onChange }: { value: T; choices: Choice<T>[]; onChange: (value: T) => void }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row}>
      {choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            style={[styles.pill, { backgroundColor: selected ? theme.colors.brandSoft : theme.colors.card, borderColor: selected ? theme.colors.brand : theme.colors.border }]}
          >
            <Text style={{ color: selected ? theme.colors.brandPressed : theme.colors.text, fontWeight: selected ? '600' : '400' }}>{choice.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, pill: { minHeight: 40, borderRadius: 999, borderWidth: 1, paddingHorizontal: 15, alignItems: 'center', justifyContent: 'center' } });
