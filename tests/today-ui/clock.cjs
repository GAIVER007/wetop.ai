const OriginalDate = Date;
class FixtureDate extends OriginalDate {
  constructor(...args) {
    super(...(args.length ? args : ['2026-10-04T20:30:00.000Z']));
  }
}
globalThis.Date = FixtureDate;
