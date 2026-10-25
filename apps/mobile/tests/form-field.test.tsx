import { fireEvent, render, screen } from '@testing-library/react-native';
import { FormField } from '../src/ui/form-field';

test('keeps entered value visible with a labelled validation error', async () => {
  const change = jest.fn();
  await render(<FormField label="Название" value="Демо" onChangeText={change} error="Уточните название" />);
  const input = screen.getByLabelText('Название');
  expect(screen.getByDisplayValue('Демо')).toBeTruthy();
  expect(screen.getByText('Уточните название')).toBeTruthy();
  await fireEvent.changeText(input, 'Демонстрация');
  expect(change).toHaveBeenCalledWith('Демонстрация');
});
