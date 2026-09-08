<!-- источник: https://exely.com/dev-portal/docs/scenarios/analytics-api/analytics-get-daily-occupancy · скачано 2026-09-08 -->

On this page

The method returns the property's daily occupancy and revenue statistics for the specified period.

Limits: the range between `startStayDate` and `endStayDate` must not exceed 31 days.

Request:

`GET /api/pms-analytics/v1/properties/5431/daily-occupancy?startStayDate=2026-01-01&endStayDate=2026-01-25 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Parameters:

 | | Parameter | Type | Required | Description
 | `propertyId` | path | Yes | Property identifier
 | `startStayDate` | query | Yes | Start date of the period in ISO-8601 YYYY-MM-DD format. The range limit is 31 days.
 | `endStayDate` | query | Yes | End date of the period in ISO-8601 YYYY-MM-DD format. The range limit is 31 days.
 | `otbDate` | query | No | OTB (On-the-Books) snapshot date. Filters data by booking creation date.

Response:

`{
 "currencyCode": "EUR",
 "propertyRoomCount": 90,
 "dailyOccupancies": [
 {
 "date": "2026-01-01",
 "occupancyRate": 0.85,
 "closedRoomCount": 7,
 "occupancyRoomCount": 79,
 "complimentaryOccupancyRoomCount": 3,
 "roomRevenue": 158,
 "revenue": 195,
 "mealRevenue": 37,
 "arrivalCount": 15,
 "guestCount": 120
 },
 {
 "date": "2026-01-02",
 "occupancyRate": 0.82,
 "closedRoomCount": 7,
 "occupancyRoomCount": 76,
 "complimentaryOccupancyRoomCount": 2,
 "roomRevenue": 152,
 "revenue": 188,
 "mealRevenue": 36,
 "arrivalCount": 12,
 "guestCount": 115
 }
 ]
}
`

### Optional otbDate parameter​

The `otbDate` parameter retrieves statistics based on a booking snapshot for the specified date.
If the parameter is provided, only bookings created on or before `otbDate` are included in the calculation.
This is useful for historical analysis and OTB (On-the-Books) reporting for a specific date.

otbDate request example:

`GET /api/pms-analytics/v1/properties/5431/daily-occupancy?startStayDate=2026-01-01&endStayDate=2026-01-25&otbDate=2025-12-15 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Optional otbDate parameter