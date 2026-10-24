import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { useAccess } from '../auth/provider';
import { AccessScreen } from '../auth/access-screen';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
const verticals: Record<string, string> = {
  FOOD_SERVICE: 'Ресторан',
  BEAUTY: 'Салон красоты',
  HOSPITALITY: 'Отель или хостел',
};
export default function HomeScreen() {
  const { state, session } = useAccess();
  const theme = useTheme();
  if (state.kind !== 'ready') return <AccessScreen />;
  return (
    <Screen title="Рабочее место" subtitle={state.user.name ?? state.user.email}>
      <View style={{ padding: 20, borderRadius: 20, gap: 14, backgroundColor: theme.surface }}>
        <Text style={{ color: theme.secondary, fontSize: 14 }}>
          {verticals[state.branch.vertical] ?? state.branch.vertical}
        </Text>
        <Text
          accessibilityRole="header"
          style={{ color: theme.text, fontSize: 24, fontWeight: '700' }}
        >
          {state.branch.name}
        </Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>
          {state.organizations.find((o) => o.current)?.name ?? 'Рабочая организация'}
        </Text>
        <Text style={{ color: theme.secondary, fontSize: 16, lineHeight: 24 }}>
          Вход и доступ к филиалу подтверждены. Выберите рабочий раздел ниже. Остальные операции
          пока доступны в веб-версии.
        </Text>
      </View>
      {state.branch.vertical === 'FOOD_SERVICE' ? (
        <ActionButton label="Столы и заказы" onPress={() => router.push('/restaurant')} />
      ) : null}
      {state.branches.length > 1 ? (
        <ActionButton
          secondary
          label="Сменить филиал"
          onPress={() => {
            void session.changeBranch();
          }}
        />
      ) : null}
      <ActionButton
        secondary
        label="Обновить доступ"
        onPress={() => {
          void session.retry();
        }}
      />
    </Screen>
  );
}
