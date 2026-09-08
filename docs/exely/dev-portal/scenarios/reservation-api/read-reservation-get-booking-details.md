<!-- источник: https://exely.com/dev-portal/docs/scenarios/reservation-api/read-reservation-get-booking-details · скачано 2026-09-08 -->

On this page

### 1. Get a list of bookings​

Request:

`GET /api/read-reservation/v1/properties/{{ property_id }}/bookings?count=1000 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "continueToken": "eyJCb29raW5nSWRzIjpbNzU1NDI3N10sIk1pbGxpc2Vjb25kc0Zyb20iOjE2MjU5NjA2MzEyMTN9",
 "hasMoreData": true,
 "bookingSummaries": [
 {
 "number": "20210325-500360-6987835",
 "propertyId": "500360",
 "status": "Cancelled",
 "createdDateTime": "2021-03-19T15:18:23Z",
 "modifiedDateTime": "2021-03-19T15:18:54Z"
 },
 {
 "number": "20210601-500360-7229443",
 "propertyId": "500360",
 "status": "Active",
 "createdDateTime": "2021-05-12T09:08:47Z",
 "modifiedDateTime": "2021-05-12T09:08:47Z"
 },
 {
 "number": "20210601-500360-7229978",
 "propertyId": "500360",
 "status": "Active",
 "createdDateTime": "2021-05-12T16:29:49Z",
 "modifiedDateTime": "2021-05-12T16:29:49Z"
 },
 {
 "number": "20210601-500360-7253706",
 "propertyId": "500360",
 "status": "Cancelled",
 "createdDateTime": "2021-05-17T08:04:05Z",
 "modifiedDateTime": "2021-05-17T08:04:47Z"
 },
 {
 "number": "20211001-500360-7554276",
 "propertyId": "500360",
 "status": "Cancelled",
 "createdDateTime": "2021-07-10T23:34:30Z",
 "modifiedDateTime": "2021-07-10T23:43:51Z"
 },
 ...
 ]
}
`

### 2. Get booking details​

Request:

`GET /api/read-reservation/v1/properties/{{ property_id }}/bookings/{{ booking_number }} HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "booking": {
 "propertyId": "500360",
 "number": "20210325-500360-6987835",
 "status": "Cancelled",
 "createdDateTime": "2021-03-19T15:18:23Z",
 "modifiedDateTime": "2021-03-19T15:18:53Z",
 "guaranteeInfo": {
 "loyalty": null,
 "totalPrepaid": 0.0
 },
 "currencyCode": "EUR",
 "roomStays": [
 {
 "stayDates": {
 "arrivalDateTime": "2021-03-25T14:00",
 "departureDateTime": "2021-03-26T12:00"
 },
 "ratePlans": [
 {
 "id": "307225",
 "name": "Online"
 }
 ],
 "roomType": {
 "id": "340935",
 "name": "Standard"
 },
 "guestCount": {
 "adultCount": 1,
 "childAges": []
 },
 "guests": [],
 "dailyRates": [
 {
 "ratePlanId": "307225",
 "priceBeforeTax": 28.000,
 "date": "2021-03-25T00:00:00"
 }
 ],
 "total": {
 "priceBeforeTax": 28.0000,
 "priceAfterTax": 28.0000,
 "taxAmount": 0.0000,
 "taxes": [],
 "discounts": []
 },
 "services": [],
 "extraStayCharges": {
 "earlyArrival": null,
 "lateDeparture": null
 }
 }
 ],
 "services": [],
 "total": {
 "priceBeforeTax": 28.0000,
 "priceAfterTax": 28.0000,
 "taxAmount": 0.0000,
 "taxes": [],
 "discounts": []
 },
 "taxes": [],
 "cancellation": {
 "penaltyAmount": 0.0,
 "cancelledDateTime": "2021-03-19T15:18:53Z"
 },
 "source": {
 "type": "Channel",
 "code": "PA2"
 },
 "customer": null
 }
}
`

1. Get a list of bookings
2. Get booking details