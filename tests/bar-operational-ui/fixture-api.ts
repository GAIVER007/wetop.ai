import { barOperationalFixture } from '../tools/bar-operational-fixture';
const f = await barOperationalFixture(55994);
const d = await f.prepare();
f.setBrowserData({ ...d, side: f.primary });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => { void f.close().then(() => process.exit(0)); });
