<!-- источник: https://exely.com/dev-portal/docs/scenarios/webpms-api/pms-get-reservation · скачано 2026-09-08 -->

Retrieves detailed information about a single booking.

Request:

`GET /api/pms/reservations/20241014-500821-16817363?languageCode=en HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Parameters:

 | | Parameter | Type | Required | Description
 | `languageCode` | string | No | Language code according to ISO 639-1. Supported: en, ru, bg, cs, fr, id, ka, km, ko, pl, th, tr, uk, uz, vi

Response:

`{
 "reservation": {
 "number": "20241014-500821-16817363",
 "customerLanguageCode": "en",
 "visitPurpose": {
 "id": "2",
 "displayName": "Tourism"
 },
 "customerComment": "",
 "modifyDateTime": "2024-10-14T08:09:02Z",
 "currencyCode": "EUR",
 "customer": {
 "pmsPersonId": "4503599627505588",
 "personName": {
 "lastName": "Smith",
 "firstName": "John",
 "middleName": null
 },
 "birthDate": null,
 "citizenship": "GBR",
 "status": {
 "id": "0",
 "displayName": "Not selected"
 },
 "emails": [
 {
 "address": "john.smith@example.com"
 }
 ],
 "phones": [],
 "gender": "Male"
 },
 "creationSource": {
 "id": "25",
 "name": "Online"
 },
 "channelInformation": null,
 "reservationStatus": "Confirmed",
 "roomStays": [
 {
 "pmsRoomStayId": "4503599628346335",
 "roomId": "4503599627373590",
 "roomTypeId": "315367",
 "guestsIds": [
 "4503599627505588"
 ],
 "checkInDateTime": "2024-10-14T14:00",
 "checkOutDateTime": "2024-10-22T12:00",
 "actualCheckInDateTime": null,
 "actualCheckOutDateTime": null,
 "status": "New",
 "guestCount": {
 "adults": 1,
 "children": 0
 },
 "totalPrice": {
 "amount": {
 "value": 200.0000,
 "currencyCode": null
 },
 "payAmount": {
 "value": 200.0000,
 "currencyCode": null
 },
 "refundAmount": {
 "value": 0.0,
 "currencyCode": null
 }
 },
 "amenities": []
 }
 ]
 }
}
`