import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationShell } from '../navigation/navigation-shell';
import { useTheme } from '../theme/theme';

export default function RootLayout() {
  const theme = useTheme();
  const path = usePathname();
  return <SafeAreaProvider>
    <StatusBar style="auto" />
    <SafeAreaView edges={['bottom', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.surface }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }} />
      {path === '/' || path === '/menu' ? <NavigationShell
        items={[{ id: 'today', label: 'Сегодня', icon: 'today' }, { id: 'menu', label: 'Меню', icon: 'menu' }]}
        selectedId={path === '/' ? 'today' : 'menu'}
        onSelect={(id) => router.replace(id === 'today' ? '/' : '/menu')} /> : null}
    </SafeAreaView>
  </SafeAreaProvider>;
}
