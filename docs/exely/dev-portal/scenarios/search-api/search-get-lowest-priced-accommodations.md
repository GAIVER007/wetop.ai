<!-- источник: https://exely.com/dev-portal/docs/scenarios/search-api/search-get-lowest-priced-accommodations · скачано 2026-09-08 -->

On this page

Retrieves a list of available accommodations, filtered by the specified criteria and sorted by the lowest price.

### 1. Get a list of accommodation types​

Request:

`POST /api/search/v1/properties/room-stays/search HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}

{
 "propertyIds": ["500360", "32189", "9063", "500006", "500046"],
 "adults": 1,
 "childAges": [],
 "include": "",
 "arrivalDate": "2025-08-21",
 "departureDate": "2025-08-22",
 "mealPreference": { "mealType": "All" },
 "pricePreference": { "currencyCode": "EUR", "minPrice": 0, "maxPrice": 15 },
 "corporateIds": []
}
`

Response:

`{
 "roomStays": [
 {
 "fullPlacementsName": "1 adult with main occupancy",
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
 "id": "359453"
 },
 "ratePlan": {
 "id": "367840",
 "corporateIds": null
 },
 "currencyCode": "EUR",
 "total": {
 "priceBeforeTax": 10,
 "taxAmount": 0,
 "taxes": []
 },
 "includedServices": [],
 "mealPlanCode": "RoomOnly",
 "bookingFormLink": null
 },
 {
 "fullPlacementsName": "1 adult with main occupancy",
 "propertyId": "500046",
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
 "id": "380307"
 },
 "ratePlan": {
 "id": "435264",
 "corporateIds": null
 },
 "currencyCode": "EUR",
 "total": {
 "priceBeforeTax": 3,
 "taxAmount": 0,
 "taxes": []
 },
 "includedServices": [],
 "mealPlanCode": "RoomOnly",
 "bookingFormLink": null
 },
 { ... }
 ],
 "warnings": []
}
`

1. Get a list of accommodation types