import { Stack, router, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { NavigationShell } from '../navigation/navigation-shell';
import { useTheme } from '../theme/theme';
import { AccessProvider, useAccess } from '../auth/provider';
function Routes() {
  const theme = useTheme();
  const path = usePathname();
  const { state } = useAccess();
  const ready = state.kind === 'ready';
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.surface }}
    >
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={ready}>
          <Stack.Screen name="menu" />
          <Stack.Screen name="restaurant" />
          <Stack.Screen name="restaurant-menu" />
          <Stack.Screen name="restaurant-cash" />
          <Stack.Screen name="restaurant-overview" />
          <Stack.Screen name="restaurant-team" />
          <Stack.Screen name="design-system" />
        </Stack.Protected>
      </Stack>
      {ready && (path === '/' || path === '/menu') ? (
        <NavigationShell
          items={[
            { id: 'today', label: 'Кабинет', icon: 'today' },
            { id: 'menu', label: 'Профиль', icon: 'menu' },
          ]}
          selectedId={path === '/' ? 'today' : 'menu'}
          onSelect={(id) => router.replace(id === 'today' ? '/' : '/menu')}
        />
      ) : null}
    </SafeAreaView>
  );
}
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <AccessProvider>
        <Routes />
      </AccessProvider>
    </SafeAreaProvider>
  );
}
