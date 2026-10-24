import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActionButton } from '../src/ui/action-button';

test('disabled action cannot be submitted', async () => {
  const action = jest.fn();
  await render(<ActionButton label="Продолжить" disabled onPress={action} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
  expect(action).not.toHaveBeenCalled();
});

test('enabled action is submitted once', async () => {
  const action = jest.fn();
  await render(<ActionButton label="Продолжить" onPress={action} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Продолжить' }));
  expect(action).toHaveBeenCalledTimes(1);
});
