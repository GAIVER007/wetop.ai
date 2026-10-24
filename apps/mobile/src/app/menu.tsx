import { Text, View } from 'react-native';
import { useAccess } from '../auth/provider';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';
export default function ProfileScreen() {
  const { state, session } = useAccess();
  const theme = useTheme();
  if (state.kind !== 'ready') return null;
  return (
    <Screen title="Профиль" subtitle={state.user.name ?? state.user.email}>
      <View style={{ padding: 20, borderRadius: 20, gap: 16, backgroundColor: theme.surface }}>
        <Text style={{ color: theme.text, fontSize: 16 }}>{state.user.email}</Text>
        <Text style={{ color: theme.secondary, fontSize: 16 }}>{state.branch.name}</Text>
        <Text style={{ color: theme.secondary, fontSize: 16, lineHeight: 24 }}>
          Доступы учётной записи настраиваются в веб-версии.
        </Text>
      </View>
      {state.branches.length > 1 ? (
        <ActionButton
          secondary
          label="Сменить филиал"
          onPress={() => {
            void session.changeBranch();
          }}
        />
      ) : null}
      {state.organizations
        .filter((o) => !o.current)
        .map((o) => (
          <ActionButton
            key={o.id}
            secondary
            label={`Перейти: ${o.name}`}
            onPress={() => {
              void session.switchOrganization(o.id);
            }}
          />
        ))}
      <ActionButton
        label="Выйти из аккаунта"
        onPress={() => {
          void session.logout();
        }}
      />
    </Screen>
  );
}
