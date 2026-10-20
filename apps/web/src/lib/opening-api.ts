import { getJsonPublic, sendJson } from './api';
export interface OpeningInput {
 effectiveFrom: string; effectiveTo: string;
 intervals: { weekday: number; localStart: string; localEnd: string; endsNextDay: boolean }[];
 closures: { day: string; reason: string }[];
}
/** Actual GET returns PostgreSQL snake_case rows, not the PUT shape. */
export interface OpeningRow {
 id: string; area_id: string | null; timezone: string;
 effective_from: string; effective_to: string; recorded_at: string;
 intervals: { weekday: number; local_start: string; local_end: string; ends_next_day: boolean }[];
 closures: { day: string; reason: string }[];
}
export interface OpeningState { enabled: boolean; schedule: OpeningRow | null; error?: string }
export const openingApi = {
 read: () => getJsonPublic<OpeningRow[]>('/food-service/opening-schedule'),
 confirm: (body: OpeningInput) => sendJson<{ id: string }>('PUT', '/food-service/opening-schedule', body),
};
