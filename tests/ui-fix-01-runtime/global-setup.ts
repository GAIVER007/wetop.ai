import { seedRuntime } from './runtime-state';

export default async function globalSetup() {
  await seedRuntime();
}
