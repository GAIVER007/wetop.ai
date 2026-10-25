import {
  AccessError,
  type AccessApi,
  type Branch,
  type Me,
  type Organization,
  type TokenStore,
  type User,
} from './contracts';
type Context = { user: User; branches: Branch[]; organizations: Organization[]; personal: boolean };
export type SessionState =
  | { kind: 'loading' | 'signed-out' | 'error'; message?: string }
  | ({ kind: 'choose' | 'empty'; message?: string } & Context)
  | ({ kind: 'ready'; branch: Branch; identity: string; message?: string } & Context);
export function accessMessage(error: unknown): string {
  if (error instanceof AccessError) {
    return {
      unauthorized: 'Проверьте почту и пароль или войдите заново.',
      forbidden: 'Доступ недоступен. Обратитесь к администратору.',
      network: 'Не удалось связаться с сервером. Проверьте интернет и повторите.',
      limited: 'Слишком много попыток. Попробуйте позже.',
      invalid: 'Не удалось проверить ответ сервера. Попробуйте позже.',
      configuration: 'Подключение приложения ещё не настроено. Обратитесь к администратору.',
    }[error.kind];
  }
  return 'Не удалось безопасно сохранить или прочитать вход на устройстве. Попробуйте выйти и войти снова.';
}
export class SessionController {
  state: SessionState = { kind: 'loading' };
  private token: string | null = null;
  private epoch = 0;
  private busy = false;
  private listeners = new Set<() => void>();
  private storageQueue: Promise<void> = Promise.resolve();
  private remembered = new Map<string, string>();
  constructor(
    private api: AccessApi,
    private store: TokenStore,
  ) {}
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private publish(state: SessionState) {
    this.state = state;
    this.listeners.forEach((fn) => fn());
  }
  private storage(action: () => Promise<void>) {
    const task = this.storageQueue.then(action, action);
    this.storageQueue = task.catch(() => {});
    return task;
  }
  private async clear() {
    this.token = null;
    await this.storage(() => this.store.clear());
  }
  private async failure(error: unknown, epoch: number) {
    if (epoch !== this.epoch) return;
    if (error instanceof AccessError && error.kind === 'unauthorized') {
      try {
        await this.clear();
        if (epoch === this.epoch)
          this.publish({ kind: 'signed-out', message: accessMessage(error) });
      } catch {
        if (epoch === this.epoch)
          this.publish({
            kind: 'error',
            message: 'Не удалось удалить сохранённый вход. Повторите выход.',
          });
      }
    } else this.publish({ kind: 'error', message: accessMessage(error) });
  }
  private async resolve(epoch: number, chosen?: string) {
    const token = this.token;
    if (!token) return;
    const me = await this.api.me(token);
    if (epoch !== this.epoch) return;
    if (!me.user) throw new AccessError('unauthorized');
    const [list, organizations] = await Promise.all([
      this.api.branches(token),
      this.api.organizations(token),
    ]);
    if (epoch !== this.epoch) return;
    const context: Context = {
      user: me.user,
      branches: list.items,
      organizations,
      personal: list.personal === true,
    };
    if (!list.items.length) {
      this.publish({ kind: 'empty', ...context });
      return;
    }
    const remembered = chosen ?? this.remembered.get(`${me.user.id}:${me.user.organizationId}`);
    const branch =
      list.items.length === 1 ? list.items[0] : list.items.find((b) => b.locationId === remembered);
    if (!branch) {
      this.publish({ kind: 'choose', ...context });
      return;
    }
    const verified: Me = await this.api.me(
      token,
      `business=${branch.location.businessId};location=${branch.locationId}`,
    );
    if (epoch !== this.epoch) return;
    if (!verified.user) throw new AccessError('unauthorized');
    if (
      verified.user.id !== me.user.id ||
      verified.user.organizationId !== me.user.organizationId ||
      verified.context?.businessId !== branch.location.businessId ||
      verified.context?.locationId !== branch.locationId ||
      verified.context?.vertical !== branch.vertical
    ) {
      this.publish({
        kind: 'choose',
        ...context,
        message:
          'Доступ к филиалу изменился. Выберите доступный филиал или обратитесь к администратору.',
      });
      return;
    }
    this.remembered.set(`${me.user.id}:${me.user.organizationId}`, branch.locationId);
    this.publish({
      kind: 'ready',
      ...context,
      user: verified.user,
      branch,
      identity: `${me.user.id}:${me.user.organizationId}:${verified.sessionIssuedAt ?? ''}:${branch.locationId}`,
    });
  }
  async start() {
    if (this.busy) return;
    this.busy = true;
    const epoch = ++this.epoch;
    this.publish({ kind: 'loading' });
    try {
      const token = await this.store.read();
      if (epoch !== this.epoch) return;
      this.token = token;
      if (token) await this.resolve(epoch);
      else this.publish({ kind: 'signed-out' });
    } catch (e) {
      await this.failure(e, epoch);
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  async retry() {
    if (this.busy) return;
    if (!this.token) {
      await this.start();
      return;
    }
    await this.run(() => this.resolve(this.epoch));
  }
  private async run(action: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    const epoch = ++this.epoch;
    this.publish({ kind: 'loading' });
    try {
      await action();
    } catch (e) {
      await this.failure(e, epoch);
    } finally {
      if (epoch === this.epoch) this.busy = false;
    }
  }
  async login(email: string, password: string) {
    await this.run(async () => {
      const epoch = this.epoch;
      const result = await this.api.login(email.trim(), password);
      if (epoch !== this.epoch) {
        await this.api.logout(result.token).catch(() => {});
        return;
      }
      try {
        await this.storage(() => this.store.write(result.token));
      } catch (e) {
        await this.api.logout(result.token).catch(() => {});
        throw e;
      }
      if (epoch !== this.epoch) {
        await this.api.logout(result.token).catch(() => {});
        return;
      }
      this.token = result.token;
      await this.resolve(epoch);
    });
  }
  async choose(id: string) {
    if (this.state.kind !== 'choose' || !this.state.branches.some((b) => b.locationId === id))
      return;
    await this.run(() => this.resolve(this.epoch, id));
  }
  async readFood(
    action: 'tables' | 'orders' | 'categories' | 'items',
    cursor?: string,
  ): Promise<unknown> {
    const current = this.state;
    const token = this.token;
    const epoch = this.epoch;
    if (current.kind !== 'ready' || current.branch.vertical !== 'FOOD_SERVICE' || !token)
      throw new AccessError('forbidden');
    try {
      const result = await this.api.food(
        token,
        `business=${current.branch.location.businessId};location=${current.branch.locationId}`,
        action,
        cursor,
      );
      if (
        epoch !== this.epoch ||
        this.state.kind !== 'ready' ||
        this.state.identity !== current.identity
      )
        throw new AccessError('forbidden');
      return result;
    } catch (error) {
      if (epoch === this.epoch && error instanceof AccessError && error.kind === 'unauthorized') {
        ++this.epoch;
        this.publish({ kind: 'loading' });
        await this.failure(error, this.epoch);
      }
      throw error;
    }
  }
  async changeBranch() {
    if (this.state.kind !== 'ready') return;
    ++this.epoch;
    const { user, branches, organizations, personal } = this.state;
    this.publish({ kind: 'choose', user, branches, organizations, personal });
  }
  async switchOrganization(id: string) {
    if (
      !('organizations' in this.state) ||
      !this.state.organizations.some((o) => o.id === id) ||
      !this.token
    )
      return;
    const old = this.token;
    await this.run(async () => {
      const epoch = this.epoch;
      let next;
      try {
        next = await this.api.switchOrganization(old, id);
      } catch (e) {
        if (epoch === this.epoch) await this.clear();
        throw e;
      }
      if (epoch !== this.epoch) {
        await this.api.logout(next.token).catch(() => {});
        return;
      }
      this.token = null;
      try {
        await this.storage(() => this.store.write(next.token));
      } catch (e) {
        await this.api.logout(next.token).catch(() => {});
        await this.clear();
        throw e;
      }
      if (epoch !== this.epoch) {
        await this.api.logout(next.token).catch(() => {});
        return;
      }
      this.token = next.token;
      await this.resolve(epoch);
    });
  }
  async logout() {
    const token = this.token;
    const epoch = ++this.epoch;
    this.busy = true;
    this.token = null;
    this.remembered.clear();
    this.publish({ kind: 'loading' });
    const [local, remote] = await Promise.allSettled([
      this.storage(() => this.store.clear()),
      token ? this.api.logout(token) : Promise.resolve(),
    ]);
    if (epoch !== this.epoch) return;
    this.busy = false;
    this.publish(
      local.status === 'rejected'
        ? { kind: 'error', message: 'Не удалось удалить сохранённый вход. Повторите выход.' }
        : {
            kind: 'signed-out',
            message:
              remote.status === 'rejected'
                ? 'Вы вышли на устройстве. Отзыв сессии на сервере не подтверждён.'
                : undefined,
          },
    );
  }
}
