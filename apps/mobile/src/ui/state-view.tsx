import { useEffect } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { ActionButton } from './action-button';

export type ScreenState = 'loading' | 'empty' | 'offline' | 'forbidden' | 'error';
const titles: Record<ScreenState, string> = {
  loading: 'Загрузка', empty: 'Пока ничего нет', offline: 'Нет соединения',
  forbidden: 'Нет доступа', error: 'Не удалось загрузить',
};

type Props = { state: ScreenState; message: string; action?: { label: string; onPress: () => void } };

export function StateView({ state, message, action }: Props) {
  const theme = useTheme();
  useEffect(() => {
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(`${titles[state]}. ${message}`);
  }, [state, message]);
  return (
    <View accessibilityLiveRegion="polite" accessibilityState={{ busy: state === 'loading' }} style={[styles.container, { backgroundColor: theme.surface }]}>
      <Text accessibilityRole="header"
        style={[styles.title, { color: theme.text }]}>{titles[state]}</Text>
      <Text style={[styles.message, { color: theme.secondary }]}>{message}</Text>
      {action && state !== 'loading' ? <ActionButton label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, borderRadius: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: '600' },
  message: { fontSize: 16, lineHeight: 24 },
});
