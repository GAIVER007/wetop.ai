<!-- источник: https://exely.com/dev-portal/docs/scenarios/webpms-api/pms-save-payment · скачано 2026-09-08 -->

Saves a payment to a stay by the `pmsRoomStayId` identifier.

Request:

`POST /api/pms/reservations/20240921-5431-16521710/room-stays/4503599628319617/process-payment HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Request body fields:

 | | Parameter | Type | Required | Description
 | `actionDateTime` | string | Yes | Payment date and time in ISO-8601 YYYY-MM-DDThh:mm format, local time
 | `pmsPaymentSystemId` | string | Yes | Payment system identifier in Exely PMS
 | `total` | object | Yes | Payment amount with currency
 | `comment` | string | No | Child ages

Request body

`{
 "actionDateTime": "2024-07-11T14:00",
 "pmsPaymentSystemId": "Mn3SlC3FKSNAonFsGRfzHw==",
 "total": {
 "value": "20",
 "currencyCode": "EUR"
 },
 "comment": "aaaaaaaaaaaa"
}
`

Response:

HTTP 204 No-Content