import { fireEvent, render, screen } from '@testing-library/react-native';
import { NavigationShell } from '../src/navigation/navigation-shell';

test('shows only provided routes and announces the selected tab', async () => {
  const navigate = jest.fn();
  await render(<NavigationShell items={[{ id: 'today', label: 'Сегодня', icon: 'today' }, { id: 'menu', label: 'Меню', icon: 'menu' }]} selectedId="today" onSelect={navigate} />);
  expect(screen.queryByText('Клиенты')).toBeNull();
  expect(screen.getByRole('tab', { name: 'Сегодня', selected: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'Меню' }));
  expect(navigate).toHaveBeenCalledWith('menu');
});
