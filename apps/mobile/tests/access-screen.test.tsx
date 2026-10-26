import { fireEvent, render, screen } from '@testing-library/react-native';
import { DraftStore } from '../src/restaurant/draft-store';
import { AccessScreen } from '../src/auth/access-screen';
import { useAccess } from '../src/auth/provider';
jest.mock('../src/auth/provider', () => ({ useAccess: jest.fn() }));
const mocked = jest.mocked(useAccess);
function setup() {
  const login = jest.fn().mockResolvedValue(undefined);
  const reset = jest.fn().mockResolvedValue(undefined);
  mocked.mockReturnValue({
    draft: new DraftStore(),
    state: { kind: 'signed-out' },
    session: { login } as unknown as ReturnType<typeof useAccess>['session'],
    reset,
  });
  return { login, reset };
}
test('existing users only: no registration, email/password required', async () => {
  const { login } = setup();
  await render(<AccessScreen />);
  expect(screen.queryByText('Зарегистрироваться')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Войти' }));
  expect(login).not.toHaveBeenCalled();
  expect(screen.getByText('Введите корректную почту.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Почта'), 'user@example.invalid');
  await fireEvent.changeText(screen.getByLabelText('Пароль'), 'fixture-password');
  await fireEvent.press(screen.getByRole('button', { name: 'Войти' }));
  expect(login).toHaveBeenCalledWith('user@example.invalid', 'fixture-password');
  expect(screen.getByLabelText('Пароль').props.value).toBe('');
});
test('password recovery never exposes registration and does not submit a password', async () => {
  const { reset } = setup();
  await render(<AccessScreen />);
  await fireEvent.press(screen.getByRole('button', { name: 'Забыли пароль?' }));
  expect(screen.queryByLabelText('Пароль')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Почта'), 'user@example.invalid');
  await fireEvent.press(screen.getByRole('button', { name: 'Отправить письмо' }));
  expect(reset).toHaveBeenCalledWith('user@example.invalid');
  expect(screen.getByText(/Если эта почта зарегистрирована/)).toBeTruthy();
});
