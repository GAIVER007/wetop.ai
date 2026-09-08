<!-- источник: https://exely.com/dev-portal/docs/scenarios/content-api/content-get-property · скачано 2026-09-08 -->

On this page

### Get a list of properties​

Request:

`GET /api/content/v1/properties?count=200 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Parameters:

 | | Parameter | Type | Required | Description
 | `count` | int | No | Maximum number of properties to return (max: 200)

Response:

`{
 "properties": [
 {
 "id": "500360"
 }
 ],
 "warnings": []
}
`

### Get property details​

Request:

`GET /api/content/v1/properties/{{ property_id }} HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "id": "500360",
 "name": "PartnerAPI for service certification",
 "description": "\"A peaceful retreat\": Where time flows slowly and the soul finds rest.\r\n\r\nWelcome to the \"Oasis of Tranquility\" - a cozy hotel nestled among greenery, where you can escape the hustle of city life and enjoy the silence of nature.\r\n\r\nWebhook testing. Works or not.",
 "currency": "EUR",
 "images": [
 {
 "url": "https://connect-static.hopenapi.com/images/p/500360/637883111354153043-f7d11a78-50a0-4316-a3b7-79362f345231"
 },
 ...
 ],
 "stars": 3,
 "stayUnitKind": "NightRate",
 "contactInfo": {
 "address": {
 "postalCode": "England",
 "countryCode": "GBR",
 "region": "England",
 "regionId": "44",
 "cityName": "London",
 "cityId": "101",
 "addressLine": "10 Downing Street, London SW1A 1AA",
 "latitude": 51.503,
 "longitude": 0.1276
 },
 "phones": [
 {
 "phoneNumber": "+44 20 7925 0918",
 "techType": "Fax",
 "remark": "test1"
 }
 ],
 "emails": [
 "test_hotel@example.com"
 ]
 },
 "policy": {
 "checkInTime": "13:00",
 "checkOutTime": "11:00"
 },
 "timeZone": {
 "id": "Europe/London"
 },
 "ratePlans": [
 {
 "id": "307224",
 "name": "Best Price of the Day",
 "description": "The best available rate plan for booking on the official website.",
 "currency": "EUR",
 "isStayWithChildrenOnly": false,
 "cancellationRuleId": "556876",
 "extraStayRuleId": "487308"
 },
 {
 "id": "307225",
 "name": "Online",
 "description": "<p>The most affordable rate plan for your stay</p>",
 "currency": "EUR",
 "isStayWithChildrenOnly": true,
 "cancellationRuleId": "665703",
 "extraStayRuleId": "519845",
 "vat": {
 "applicable": true,
 "included": true,
 "percent": 20
 }
 }
 ],
 "roomTypes": [
 {
 "id": "340935",
 "name": "Family Apartments",
 "description": "Cozy apartments overlooking an apple garden. Perfect for families and friends.",
 "amenities": [
 {
 "code": "wifi_internet",
 "name": "Wi-Fi"
 },
 {
 "code": "queen_bed",
 "name": "Queen-size bed"
 },
 {
 "code": "work_table",
 "name": "Desk"
 },
 {
 "code": "multi",
 "name": "Multicooker"
 },
 {
 "code": "flat_screen_TV",
 "name": "Flat-screen TV"
 },
 {
 "code": "possible_with_pets",
 "name": "Pet-friendly"
 }
 ],
 "images": [
 {
 "url": "https://connect-static.hopenapi.com/images/rt/340935/637620279088060777-9ae71c3a-f5c6-4f55-bb1c-f4949ed401e1"
 },
 {
 "url": "https://connect-static.hopenapi.com/images/rt/340935/638434404379504850-f8667678-6143-436f-b168-9d0a8f9a151f"
 },
 {
 "url": "https://connect-static.hopenapi.com/images/rt/340935/638434404447807261-fe68ad38-fe8f-4841-8865-b39799af09dc"
 }
 ],
 "size": {
 "value": 40,
 "unit": "SquareMetre"
 },
 "categoryCode": "Apartments",
 "categoryName": "Apartments",
 "occupancy": {
 "adultBed": 2,
 "extraBed": 4,
 "childWithoutBed": 2
 },
 "placements": [
 {
 "kind": "ExtraAdult",
 "count": 1
 },
 {
 "kind": "ChildBandWithoutBed",
 "count": 1,
 "minAge": 0,
 "maxAge": 2
 },
 {
 "kind": "ExtraChild",
 "count": 1,
 "minAge": 8,
 "maxAge": 13
 },
 {
 "kind": "Adult",
 "count": 2
 },
 {
 "kind": "ExtraChild",
 "count": 1,
 "minAge": 2,
 "maxAge": 8
 },
 {
 "kind": "ExtraChild",
 "count": 1,
 "minAge": 13,
 "maxAge": 18
 },
 {
 "kind": "ExtraChild",
 "count": 1,
 "minAge": 0,
 "maxAge": 2
 },
 {
 "kind": "Child",
 "count": 1,
 "minAge": 8,
 "maxAge": 13
 },
 {
 "kind": "Child",
 "count": 1,
 "minAge": 2,
 "maxAge": 8
 },
 {
 "kind": "Child",
 "count": 1,
 "minAge": 13,
 "maxAge": 18
 },
 {
 "kind": "Child",
 "count": 1,
 "minAge": 0,
 "maxAge": 2
 },
 {
 "kind": "Adult",
 "count": 1
 }
 ],
 "position": 50
 }
 ],
 "services": [
 {
 "id": "497246",
 "name": "Gym",
 "description": "1 hour of free gym access included",
 "kind": "Common",
 "images": [],
 "status": "Active",
 "vat": {
 "applicable": true,
 "percent": 0
 }
 },
 {
 "id": "697275",
 "name": "Parking",
 "description": "",
 "kind": "Common",
 "images": [],
 "status": "Active",
 "vat": {
 "applicable": false
 }
 }
 ],
 "multiLocationProperty": false
}
`

Get a list of properties
Get property details