import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { useTheme } from '../theme/theme';

type Props = Pick<TextInputProps, 'value' | 'onChangeText' | 'keyboardType' | 'autoComplete' | 'secureTextEntry' | 'editable'> & { label: string; error?: string };

export function FormField({ label, error, editable = true, ...input }: Props) {
  const theme = useTheme();
  useEffect(() => {
    if (error && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${label}. ${error}`);
  }, [error, label]);
  return <View style={styles.field}>
    <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    <TextInput {...input} editable={editable} accessibilityLabel={label}
      accessibilityHint={error} aria-invalid={Boolean(error)} accessibilityState={{ disabled: !editable }}
      style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border }]} />
    {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 8 }, label: { fontSize: 16, fontWeight: '600' },
  input: { minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, fontSize: 16 },
  error: { fontSize: 14, lineHeight: 21 },
});
