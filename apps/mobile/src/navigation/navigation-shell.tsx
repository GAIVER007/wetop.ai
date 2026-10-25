import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

export type NavigationItem = { id: string; label: string; icon: 'today' | 'menu' };
type Props = { items: readonly NavigationItem[]; selectedId: string; onSelect: (id: string) => void };

export function NavigationShell({ items, selectedId, onSelect }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: theme.surface }]}>
      {items.map((item) => {
        const selected = item.id === selectedId;
        const color = selected ? theme.primary : theme.secondary;
        return <Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={item.label}
          accessibilityState={{ selected }} onPress={() => onSelect(item.id)}
          style={({ pressed }) => [styles.tab, { backgroundColor: selected ? theme.primarySoft : theme.surface, opacity: pressed ? 0.7 : 1 }]}>
          <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
            style={[styles.icon, item.icon === 'today' && { borderWidth: 1.5, borderColor: color, borderRadius: 4 }]}>
            <View style={[styles.line, { backgroundColor: color }]} />
            <View style={[styles.line, { backgroundColor: color }]} />
            {item.icon === 'menu' ? <View style={[styles.line, { backgroundColor: color }]} /> : null}
          </View>
          <Text style={[styles.label, { color }]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', padding: 8, gap: 8 },
  tab: { flex: 1, minHeight: 56, padding: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 4 },
  icon: { width: 24, height: 24, padding: 4, gap: 3, justifyContent: 'center' },
  line: { height: 1.5, width: '100%' },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
});
