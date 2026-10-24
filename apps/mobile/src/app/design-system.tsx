import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { FormField } from '../ui/form-field';
import { Screen } from '../ui/screen';
import { StateView, type ScreenState } from '../ui/state-view';
import { ActionButton } from '../ui/action-button';
import { useTheme } from '../theme/theme';

const options: { id: ScreenState; label: string; message: string }[] = [
  { id: 'empty', label: 'Нет данных', message: 'Когда появятся данные, вы увидите их здесь.' },
  { id: 'loading', label: 'Загрузка', message: 'Подготавливаем экран.' },
  { id: 'offline', label: 'Нет сети', message: 'Проверьте подключение к интернету и попробуйте ещё раз.' },
  { id: 'forbidden', label: 'Нет доступа', message: 'Обратитесь к владельцу бизнеса, чтобы уточнить доступ к разделу.' },
  { id: 'error', label: 'Ошибка', message: 'Попробуйте загрузить данные ещё раз.' },
];

export default function StatesScreen() {
  const [name, setName] = useState('Демонстрация');
  const [state, setState] = useState<ScreenState>('empty');
  const [retried, setRetried] = useState(false);
  const theme = useTheme();
  const current = options.find((option) => option.id === state)!;
  return <Screen title="Состояния экрана" subtitle="Демонстрация. Запросы к серверу не отправляются.">
    <ActionButton secondary label="Назад" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => <Pressable key={option.id} accessibilityRole="button"
        accessibilityState={{ selected: option.id === state }}
        onPress={() => { setState(option.id); setRetried(false); }}
        style={{ minHeight: 48, padding: 14, borderRadius: 10, backgroundColor: option.id === state ? theme.primary : theme.surface }}>
        <Text style={{ fontSize: 16, color: option.id === state ? theme.onPrimary : theme.text }}>{option.label}</Text>
      </Pressable>)}
    </View>
    <FormField label="Пример поля" value={name} onChangeText={setName} error={name.trim() ? undefined : "Введите название"} />
    <StateView state={state} message={current.message}
      action={state === 'offline' || state === 'error' ? { label: 'Повторить', onPress: () => setRetried(true) } : undefined} />
    {retried ? <Text accessibilityLiveRegion="polite" style={{ color: theme.secondary, fontSize: 16 }}>Демонстрация повтора: действие получено, сетевой запрос не выполнялся.</Text> : null}
  </Screen>;
}
