import { draftLine, type DraftLine } from './draft';
import type { MenuItem } from './contracts';
export type DraftState = {
  identity: string | null;
  lines: DraftLine[];
  tableId: string | null | undefined;
  guests: number;
  notice: string;
};
export class DraftStore {
  private state: DraftState = {
    identity: null,
    lines: [],
    tableId: undefined,
    guests: 1,
    notice: '',
  };
  private listeners = new Set<() => void>();
  snapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  update(patch: Partial<Omit<DraftState, 'identity'>>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  bind(identity: string | null) {
    if (identity === this.state.identity) return;
    this.state = { identity, lines: [], tableId: undefined, guests: 1, notice: '' };
    this.listeners.forEach((fn) => fn());
  }
  reconcile(items: MenuItem[]) {
    const changed: string[] = [];
    const lines: DraftLine[] = [];
    for (const old of this.state.lines) {
      const item = items.find((i) => i.id === old.item.id);
      try {
        if (!item || item.currency !== old.item.currency) throw new Error();
        const next = { ...draftLine(item, old.modifierIds, old.notes), qty: old.qty };
        if (
          next.unitMinor !== old.unitMinor ||
          JSON.stringify(next.item) !== JSON.stringify(old.item)
        )
          changed.push(`${old.item.name}: обновлены данные и цена`);
        lines.push(next);
      } catch {
        changed.push(`${old.item.name}: удалено из черновика, проверьте доступность и варианты`);
      }
    }
    this.update({ lines, notice: changed.length ? changed.join('. ') : this.state.notice });
  }
}
