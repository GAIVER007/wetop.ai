<!-- источник: https://exely.com/dev-portal/docs/scenarios/webhooks/webhooks-event-types · скачано 2026-09-08 -->

On this page

## Message structure​

Notifications are sent in batches of up to 1,000 events as a JSON array with a fixed structure.

Example:

`[
 {
 "eventId": "01952268-cd6e-73ce-afbf-c4e5f1cd8d7d",
 "eventType": "webpms:check_in",
 "creationTime": "2025-02-20T08:07:47.1234567Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
 }
]
`

Events are sent in the order they were created, starting with the oldest ones.

`payload` is a JSON object whose structure depends on `eventType`. Personal data must not be included in `payload`.

## Event types​

Events differ by type. The type identifier has a prefix — the module identifier (API).
Currently, events are published by Exely PMS и PMS Integration modules.

### Exely PMS - Bookings​

 | | Name | Description
 | `webpms:create_booking` | New booking
 | `webpms:cancel_booking` | Booking cancellation
 | `webpms:change_room` | Room change
 | `webpms:add_room_group_booking` | Adding a stay to a group booking
 | `webpms:delete_room_group_booking` | Deleting a stay from a group booking

### Exely PMS - Check-ins​

 | | Name | Description
 | `webpms:check_in` | Check-in
 | `webpms:check_out` | Check-out
 | `webpms:cancel_check_in` | Check-in cancellation
 | `webpms:cancel_check_out` | Check-out cancellation
 | `webpms:change_check_in_datetime` | Change of check-in date and time
 | `webpms:change_check_out_datetime` | Change of check-out date and time

### PMS Integration - Synchronization​

 | | Name | Description
 | `pms_integration_storage:booking_changed` | Booking created/modified in an external PMS
 | `pms_integration_storage:inventory_changed` | Room availability updated in an external PMS
 | `pms_integration_storage:inventory_block_changed` | Availability block created/modified in an external PMS

## `payload` examples by event type​

Below are examples of a single event (an array item) for each `eventType` listed above.

### Exely PMS - Bookings​

#### `webpms:create_booking`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:create_booking",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:cancel_booking`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:cancel_booking",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:change_room`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:change_room",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:add_room_group_booking`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:add_room_group_booking",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:delete_room_group_booking`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:delete_room_group_booking",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

### Exely PMS - Check-ins​

#### `webpms:check_in`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:check_in",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:check_out`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:check_out",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:cancel_check_in`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:cancel_check_in",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:cancel_check_out`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:cancel_check_out",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:change_check_in_datetime`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:change_check_in_datetime",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

#### `webpms:change_check_out_datetime`​

`{
 "eventId": "e09a9f4b-e44e-46b7-a18a-0e977c0d442e",
 "eventType": "webpms:change_check_out_datetime",
 "creationTime": "2026-03-20T14:36:16.407Z",
 "payload": {
 "BookingNumber": "2026b319-500360-421894386",
 "PropertyId": "500360"
 }
}
`

Message structure
Event typesExely PMS - Bookings
Exely PMS - Check-ins
PMS Integration - Synchronization

`payload` examples by event typeExely PMS - Bookings
Exely PMS - Check-ins