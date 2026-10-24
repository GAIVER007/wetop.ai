import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/theme';

type Props = { title: string; subtitle?: string; children: ReactNode };

export function Screen({ title, subtitle, children }: Props) {
  const theme = useTheme();
  return <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: theme.background }]}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.brand, { color: theme.primary }]}>WETOP</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.secondary }]}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { flexGrow: 1, padding: 16, gap: 24, width: '100%', maxWidth: 680, alignSelf: 'center' },
  heading: { gap: 8, paddingTop: 12 }, brand: { fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 32, fontWeight: '700' }, subtitle: { fontSize: 16, lineHeight: 24 },
});
