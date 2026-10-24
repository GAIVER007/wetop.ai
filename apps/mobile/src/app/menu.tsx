import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';

export default function MenuScreen() {
  const theme = useTheme();
  return <Screen title="Меню" subtitle="WETOP Mobile · предварительная версия">
    <View style={{ padding: 24, gap: 16, borderRadius: 16, backgroundColor: theme.surface }}>
      <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 22, fontWeight: '600' }}>Удобно на вашем телефоне</Text>
      <Text style={{ color: theme.secondary, fontSize: 16, lineHeight: 24 }}>Цветовая тема и размер текста следуют настройкам устройства.</Text>
      <ActionButton secondary label="Состояния экрана" onPress={() => router.push('/design-system')} />
    </View>
    <Text style={{ color: theme.secondary, fontSize: 14, lineHeight: 21 }}>Это демонстрационная версия. Учётная запись и рабочие данные ещё не подключены.</Text>
  </Screen>;
}
