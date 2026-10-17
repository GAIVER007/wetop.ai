import { mkdir, writeFile, readFile, unlink, stat } from 'node:fs/promises';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import type { SiteAssetStorage } from '../../apps/api/src/marketing-site/asset-storage';

/** Test-only persistent storage. Never registered by production modules. */
export class DiskPortalStorage implements SiteAssetStorage {
  private readonly root: string;
  private readonly origin: string;
  constructor(root = mkdtempSync(join(tmpdir(), 'wetop-portal-assets-')), origin = 'http://127.0.0.1:26831') {
    this.root = resolve(root);
    const url = new URL(origin);
    if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Fixture assets must be localhost');
    this.origin = url.origin;
  }
  private path(key: string) {
    if (!key || key.includes('\\') || key.includes('\0') || key.split('/').some(p => !p || p === '.' || p === '..') || !/^[A-Za-z0-9/_.,-]+$/.test(key)) throw new Error('Invalid asset key');
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root + sep)) throw new Error('Asset traversal rejected');
    return p;
  }
  async put(input: { key: string; body: Buffer; contentType: string }) {
    const p = this.path(input.key);
    await mkdir(dirname(p), { recursive: true, mode: 0o700 });
    await writeFile(p, input.body, { mode: 0o600 });
  }
  async delete(key: string) { await unlink(this.path(key)).catch((e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; }); }
  async signedGet(key: string, expiresInSeconds: number) {
    // Local fixture URLs do not expire; production storage implements the requested TTL.
    void expiresInSeconds;
    this.path(key);
    return `${this.origin}/__assets/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async exists(key: string) {
    try { return (await stat(this.path(key))).isFile(); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
  }
  private keyFromUrl(raw: string) {
    const u = new URL(raw, this.origin);
    if (u.origin !== this.origin || !u.pathname.startsWith('/__assets/')) throw new Error('Foreign asset URL');
    const key = decodeURIComponent(u.pathname.slice('/__assets/'.length));
    this.path(key);
    return key;
  }
  async existsByUrl(url: string) { return this.exists(this.keyFromUrl(url)); }
  async readByUrl(url: string) { return readFile(this.path(this.keyFromUrl(url))); }
}
