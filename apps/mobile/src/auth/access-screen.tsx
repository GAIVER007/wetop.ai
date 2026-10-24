import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Screen } from '../ui/screen';
import { ActionButton } from '../ui/action-button';
import { FormField } from '../ui/form-field';
import { useTheme } from '../theme/theme';
import { useAccess } from './provider';
import { accessMessage } from './session';
export function AccessScreen() {
  const { state, session, reset } = useAccess();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const lock = useRef(false);
  const text = { color: theme.secondary, fontSize: 16, lineHeight: 24 };
  if (state.kind === 'loading')
    return (
      <Screen title="Проверяем вход" subtitle="Подключаем ваше рабочее место">
        <ActivityIndicator accessibilityLabel="Загрузка" color={theme.primary} />
        <ActionButton
          secondary
          label="Отменить вход"
          onPress={() => {
            void session.logout();
          }}
        />
      </Screen>
    );
  if (state.kind === 'error')
    return (
      <Screen title="Не удалось продолжить">
        <Text accessibilityRole="alert" style={text}>
          {state.message}
        </Text>
        <ActionButton
          label="Повторить"
          onPress={() => {
            void session.retry();
          }}
        />
        <ActionButton
          secondary
          label="Вернуться ко входу"
          onPress={() => {
            void session.logout();
          }}
        />
      </Screen>
    );
  if (state.kind === 'choose' || state.kind === 'empty')
    return (
      <Screen
        title={state.kind === 'empty' ? 'Нет доступного филиала' : 'Выберите филиал'}
        subtitle={
          state.kind === 'empty'
            ? 'Обратитесь к администратору вашего бизнеса, чтобы проверить назначение.'
            : 'Откроем рабочее место с вашими правами.'
        }
      >
        {state.message ? (
          <Text accessibilityRole="alert" style={text}>
            {state.message}
          </Text>
        ) : null}
        {state.branches.map((branch) => (
          <ActionButton
            key={branch.locationId}
            label={branch.name}
            onPress={() => {
              void session.choose(branch.locationId);
            }}
          />
        ))}
        {state.organizations.length > 1 ? (
          <View style={{ gap: 12 }}>
            <Text style={text}>Другие организации</Text>
            {state.organizations
              .filter((o) => !o.current)
              .map((o) => (
                <ActionButton
                  key={o.id}
                  secondary
                  label={o.name}
                  onPress={() => {
                    void session.switchOrganization(o.id);
                  }}
                />
              ))}
          </View>
        ) : null}
        <ActionButton
          secondary
          label="Выйти"
          onPress={() => {
            void session.logout();
          }}
        />
      </Screen>
    );
  if (state.kind === 'ready') return null;
  async function submit() {
    if (lock.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setMessage('Введите корректную почту.');
      return;
    }
    if (!recovery && !password) {
      setMessage('Введите пароль.');
      return;
    }
    lock.current = true;
    setSending(true);
    setMessage('');
    try {
      if (recovery) {
        await reset(email.trim());
        setMessage(
          'Если эта почта зарегистрирована, на неё придёт письмо для восстановления доступа.',
        );
      } else {
        const value = password;
        setPassword('');
        await session.login(email, value);
      }
    } catch (e) {
      setMessage(accessMessage(e));
    } finally {
      lock.current = false;
      setSending(false);
    }
  }
  return (
    <Screen
      title={recovery ? 'Восстановить доступ' : 'Войти в WETOP'}
      subtitle={
        recovery
          ? 'Укажите почту вашей учётной записи.'
          : 'Используйте доступ, который вы получили в веб-версии.'
      }
    >
      <View style={{ backgroundColor: theme.surface, padding: 20, borderRadius: 20, gap: 20 }}>
        <FormField
          label="Почта"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!sending}
        />
        {!recovery ? (
          <>
            <FormField
              label="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!visible}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!sending}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={visible ? 'Скрыть пароль' : 'Показать пароль'}
              onPress={() => setVisible((v) => !v)}
              style={{ minHeight: 48, justifyContent: 'center' }}
            >
              <Text style={{ color: theme.primary, fontSize: 16 }}>
                {visible ? 'Скрыть пароль' : 'Показать пароль'}
              </Text>
            </Pressable>
          </>
        ) : null}
        {message || state.message ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={text}>
            {message || state.message}
          </Text>
        ) : null}
        <ActionButton
          label={sending ? 'Отправляем…' : recovery ? 'Отправить письмо' : 'Войти'}
          disabled={sending}
          onPress={() => {
            void submit();
          }}
        />
        <ActionButton
          secondary
          label={recovery ? 'Вернуться ко входу' : 'Забыли пароль?'}
          disabled={sending}
          onPress={() => {
            setRecovery((v) => !v);
            setMessage('');
            setPassword('');
          }}
        />
      </View>
      <Text style={text}>
        Учётную запись и доступ к бизнесу настраивает администратор в веб-версии.
      </Text>
    </Screen>
  );
}
