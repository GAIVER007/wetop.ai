import { barOperationalFixture } from '../tools/bar-operational-fixture';
const f = await barOperationalFixture(55994, true);
const d = await f.prepare();
f.setBrowserData({ ...d, side: f.primary, userId: f.user.id });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { void f.close().then(() => process.exit(0)); });
