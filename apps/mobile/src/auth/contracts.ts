export type User = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  organizationId: string;
};
export type Login = { token: string; expiresAt: string; user: User };
export type Branch = {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  vertical: string;
  locationId: string;
  location: { businessId: string };
};
export type Organization = { id: string; name: string; role: string; current: boolean };
export type Me = {
  user: User | null;
  sessionIssuedAt?: string;
  context?: { businessId: string | null; locationId: string | null; vertical: string | null };
};
export type Branches = { items: Branch[]; personal?: boolean };
export interface AccessApi {
  login(email: string, password: string): Promise<Login>;
  me(token: string, scope?: string): Promise<Me>;
  branches(token: string): Promise<Branches>;
  organizations(token: string): Promise<Organization[]>;
  switchOrganization(token: string, id: string): Promise<Login>;
  logout(token: string): Promise<void>;
  food(
    token: string,
    scope: string,
    action: 'tables' | 'orders',
    cursor?: string,
  ): Promise<unknown>;
  reset(email: string): Promise<void>;
}
export interface TokenStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}
export class AccessError extends Error {
  constructor(
    public readonly kind:
      'unauthorized' | 'forbidden' | 'network' | 'limited' | 'invalid' | 'configuration',
  ) {
    super(kind);
  }
}
