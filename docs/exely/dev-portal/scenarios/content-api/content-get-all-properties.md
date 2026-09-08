<!-- источник: https://exely.com/dev-portal/docs/scenarios/content-api/content-get-all-properties · скачано 2026-09-08 -->

Flow:

Send an initial request:
`GET /api/content/v1/properties?count=5 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Continue sending requests while the previous response returns a non-empty `next` value:
`GET /api/content/v1/properties?count=5&since={{ next }} HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Paginated response example:

`{
 "next": "UlUtLU5RPT0=",
 "properties": [
 {
 "id": "9063"
 },
 {
 "id": "32189"
 },
 {
 "id": "500006"
 },
 {
 "id": "500046"
 },
 {
 "id": "500360"
 }
 ],
 "warnings": []
}
`

Note: Use the `since` parameter to retrieve the next page of results.