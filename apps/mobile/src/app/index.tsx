import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';

export default function HomeScreen() {
  const theme = useTheme();
  return <Screen title="Сегодня" subtitle="Ваш рабочий день, всё важное рядом.">
    <View style={[styles.notice, { backgroundColor: theme.primarySoft }]}>
      <Text style={[styles.noticeText, { color: theme.primary }]}>Демонстрация · без рабочих данных</Text>
    </View>
    <View style={[styles.panel, { backgroundColor: theme.surface }]}>
      <Text style={[styles.eyebrow, { color: theme.secondary }]}>РАБОЧЕЕ ПРОСТРАНСТВО</Text>
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>Спокойный старт каждого дня</Text>
      <Text style={[styles.body, { color: theme.secondary }]}>Здесь появится сводка вашего бизнеса. Подключение учётной записи будет доступно на следующем этапе.</Text>
      <View style={[styles.separator, { backgroundColor: theme.border }]} />
      <Text style={[styles.body, { color: theme.text }]}>Сейчас можно посмотреть интерфейс и его поведение в разных состояниях.</Text>
      <ActionButton label="Посмотреть состояния" onPress={() => router.push('/design-system')} />
    </View>
    <Text style={[styles.footnote, { color: theme.secondary }]}>Гостиница, салон или ресторан. Одно приложение для ежедневной работы.</Text>
  </Screen>;
}
const styles = StyleSheet.create({
  notice: { borderRadius: 10, padding: 12 }, noticeText: { fontSize: 14, fontWeight: '600' },
  panel: { padding: 24, borderRadius: 20, gap: 20 }, eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 28, fontWeight: '600' }, body: { fontSize: 16, lineHeight: 24 },
  separator: { height: StyleSheet.hairlineWidth }, footnote: { fontSize: 14, lineHeight: 21, paddingHorizontal: 8 },
});
