import { AccessibilityInfo, Platform } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StateView } from '../src/ui/state-view';

test('offline state explains recovery and invokes retry', async () => {
  const retry = jest.fn();
  await render(<StateView state="offline" message="Проверьте подключение к интернету." action={{ label: 'Повторить', onPress: retry }} />);
  expect(screen.getByText('Нет соединения')).toBeTruthy();
  expect(screen.getByRole('header').props.accessibilityLiveRegion).toBeUndefined();
  await fireEvent.press(screen.getByRole('button', { name: 'Повторить' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('forbidden state has no inert retry button', async () => {
  await render(<StateView state="forbidden" message="Обратитесь к владельцу бизнеса." />);
  expect(screen.getByText('Нет доступа')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('loading is announced without a retry action', async () => {
  await render(<StateView state="loading" message="Подготавливаем экран." />);
  expect(screen.getByText('Загрузка')).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('announces loading to VoiceOver on iOS', async () => {
  const original = Platform.OS;
  Platform.OS = 'ios';
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
  try {
    await render(<StateView state="loading" message="Подготавливаем экран." />);
    expect(announce).toHaveBeenCalledWith('Загрузка. Подготавливаем экран.');
  } finally {
    announce.mockRestore();
    Platform.OS = original;
  }
});
