export function validateSettingsObservation(text: string):
  | { ok: true; groups: number }
  | { ok: false; reason: string };