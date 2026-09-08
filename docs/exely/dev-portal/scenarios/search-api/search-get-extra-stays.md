<!-- источник: https://exely.com/dev-portal/docs/scenarios/search-api/search-get-extra-stays · скачано 2026-09-08 -->

On this page

Retrieves `Early check-in and late check-out` services provided by a specific property based on the room type, rate plan, guest configuration, and period of stay.

### 1. Get a list of accommodations in a specific property​

Request:

`GET /api/search/v1/properties/{{ property_id }}/room-stays?arrivalDate=2025-09-21&departureDate=2025-09-22&adults=1&includeExtraStays=false&includeExtraServices=false HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Parameters:

 | | Parameter | Type | Required | Description
 | `arrivalDate` | string | Yes | Check-in date
 | `departureDate` | string | Yes | Check-out date
 | `adults` | int | Yes | Number of adults
 | `childAges` | array[int] | No | Child ages
 | `corporateIds` | array[string] | No | Corporate client identifiers
 | `includeExtraStays` | boolean | No | Include early check-in and late check-out options in the results
 | `includeExtraServices` | boolean | No | Include extra services in the results

Response:

`{
 "roomStays": [
 {
 "extraServicesAvailable": true,
 "extraStays": null,
 "extraServices": null,
 "propertyId": "500360",
 "roomType": {
 "placements": [
 {
 "code": "AdultBed-1",
 "count": 1,
 "kind": "Adult",
 "minAge": null,
 "maxAge": null
 }
 ],
 "id": "394546"
 },
 "ratePlan": {
 "id": "440534",
 "corporateIds": null
 },
 "guestCount": {
 "adultCount": 1,
 "childAges": []
 },
 "stayDates": {
 "arrivalDateTime": "2025-09-21T08:00",
 "departureDateTime": "2025-09-22T20:00"
 },
 "availability": 75,
 "currencyCode": "EUR",
 "total": {
 "priceBeforeTax": 400,
 "taxAmount": 40,
 "taxes": [
 {
 "amount": 40,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "cancellationPolicy": {
 "freeCancellationPossible": false,
 "freeCancellationDeadlineLocal": null,
 "freeCancellationDeadlineUtc": null,
 "penaltyAmount": 410
 },
 "includedServices": [],
 "mealPlanCode": "RoomOnly",
 "checksum": "eyJDaGVja3N1bVdpdGhPdXRFeHRyYXMiOnsiVG90YWxBbW91bnRBZnRlclRheCI6IjQ1MTAuMDAiLCJDdXJyZW5jeUNvZGUiOiJSVUIiLCJTdGFydFBlbmFsdHlBbW91bnQiOiI0MTAuMDAifSwiQ2hlY2tzdW1XaXRoRXh0cmFzIjp7IlRvdGFsQW1vdW50QWZ0ZXJUYXgiOiI0NTEwLjAwIiwiQ3VycmVuY3lDb2RlIjoiUlVCIiwiU3RhcnRQZW5hbHR5QW1vdW50IjoiNDEwLjAwIn19",
 "fullPlacementsName": "1 adult with main occupancy",
 "bookingFormLink": "Booking engine link"
 },
 {
 "extraServicesAvailable": true,
 "extraStays": null,
 "extraServices": null,
 "propertyId": "500360",
 "roomType": {
 "placements": [
 {
 "code": "AdultBed-1",
 "count": 1,
 "kind": "Adult",
 "minAge": null,
 "maxAge": null
 }
 ],
 "id": "394547"
 },
 "ratePlan": {
 "id": "440534",
 "corporateIds": null
 },
 "guestCount": {
 "adultCount": 1,
 "childAges": []
 },
 "stayDates": {
 "arrivalDateTime": "2025-09-21T08:00",
 "departureDateTime": "2025-09-22T20:00"
 },
 "availability": 75,
 "currencyCode": "EUR",
 "total": {
 "priceBeforeTax": 100,
 "taxAmount": 20,
 "taxes": [
 {
 "amount": 20,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "cancellationPolicy": {
 "freeCancellationPossible": false,
 "freeCancellationDeadlineLocal": null,
 "freeCancellationDeadlineUtc": null,
 "penaltyAmount": 1000
 },
 "includedServices": [],
 "mealPlanCode": "RoomOnly",
 "checksum": "eyJDaGVja3N1bVdpdGhPdXRFeHRyYXMiOnsiVG90YWxBbW91bnRBZnRlclRheCI6IjEyMDAwLjAwIiwiQ3VycmVuY3lDb2RlIjoiUlVCIiwiU3RhcnRQZW5hbHR5QW1vdW50IjoiMTAwMC4wMCJ9LCJDaGVja3N1bVdpdGhFeHRyYXMiOnsiVG90YWxBbW91bnRBZnRlclRheCI6IjEyMDAwLjAwIiwiQ3VycmVuY3lDb2RlIjoiUlVCIiwiU3RhcnRQZW5hbHR5QW1vdW50IjoiMTAwMC4wMCJ9fQ==",
 "fullPlacementsName": "1 adult with main occupancy",
 "bookingFormLink": "Booking engine link"
 }
 ],
 "services": [],
 "content": null,
 "warnings": [
 null
 ]
}
`

### 2. Get information about available accommodations with early check-in and late check-out services​

Request:

`POST /api/search/v1/properties/{{ property_id }}/services HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}

{
 "roomType": {
 "placements": [
 {
 "code": "AdultBed-1",
 "count": 1,
 "kind": "Adult",
 "minAge": null,
 "maxAge": null
 }
 ],
 "id": "394546"
 },
 "ratePlan": {
 "id": "440534",
 "corporateIds": null
 },
 "guestCount": {
 "adultCount": 1,
 "childAges": []
 },
 "stayDates": {
 "arrivalDateTime": "2025-09-21T08:00",
 "departureDateTime": "2025-09-22T20:00"
 }
}
`

Response:

`{
 "extraStays": {
 "earlyCheckIn": [
 {
 "total": {
 "priceBeforeTax": 400,
 "taxAmount": 40,
 "taxes": [
 {
 "amount": 40,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-21T07:30",
 "isOccupyQuota": false
 },
 {
 "total": {
 "priceBeforeTax": 400,
 "taxAmount": 40,
 "taxes": [
 {
 "amount": 40,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-21T07:00",
 "isOccupyQuota": false
 },
 {
 "total": {
 "priceBeforeTax": 400,
 "taxAmount": 40,
 "taxes": [
 {
 "amount": 41,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-21T06:30",
 "isOccupyQuota": false
 }
 ],
 "lateCheckOut": [
 {
 "total": {
 "priceBeforeTax": 200,
 "taxAmount": 20,
 "taxes": [
 {
 "amount": 20,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-22T23:59",
 "isOccupyQuota": false
 },
 {
 "total": {
 "priceBeforeTax": 200,
 "taxAmount": 20,
 "taxes": [
 {
 "amount": 20,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-22T23:30",
 "isOccupyQuota": false
 },
 {
 "total": {
 "priceBeforeTax": 200,
 "taxAmount": 20,
 "taxes": [
 {
 "amount": 20,
 "name": "Dynamic",
 "description": "Description of the dynamic tax"
 }
 ]
 },
 "currencyCode": "EUR",
 "dateTimeLocal": "2025-09-22T23:00",
 "isOccupyQuota": false
 }
 ]
 }
}
`

1. Get a list of accommodations in a specific property
2. Get information about available accommodations with early check-in and late check-out services