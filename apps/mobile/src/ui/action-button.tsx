import { Pressable, StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/theme';

type Props = { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean };

export function ActionButton({ label, onPress, disabled = false, secondary = false }: Props) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
      onPress={onPress} style={({ pressed }) => [styles.button, {
        backgroundColor: secondary ? theme.primarySoft : theme.primary,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      }]}>
      <Text style={[styles.label, { color: secondary ? theme.primary : theme.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
