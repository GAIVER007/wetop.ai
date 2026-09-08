<!-- источник: https://exely.com/dev-portal/docs/scenarios/reservation-api/read-reservation-get-all-bookings · скачано 2026-09-08 -->

On this page

### Create an initial data request​

In the initial request, specify the `lastModification` parameter. To retrieve data, send the first request
using `lastModification`. Example: 2023-06-20T10:41:04Z. Send this request without `continueToken`.

Request:

`GET /api/read-reservation/v1/properties/500821/bookings?count=1000&lastModification=2023-06-20T10:41:04Z HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "continueToken": "eyJCb29raW5nSWRzIjpbMTIwNDAzMzNdLCJNaWxsaXNlY29uZHNGcm9tIjoxNjg3NDM3NTIwMjEwfQ==",
 "hasMoreData": true,
 "bookingSummaries": [
 {
 "number": "20230622-500821-12025196",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-21T05:17:16Z",
 "modifiedDateTime": "2023-06-21T05:17:16Z"
 },
 {
 "number": "20230622-500821-12025552",
 "propertyId": 500821,
 "status": "Cancelled",
 "createdDateTime": "2023-06-21T05:27:35Z",
 "modifiedDateTime": "2023-06-21T05:30:12Z"
 },
 {
 "number": "20230622-500821-12039864",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-22T10:50:40Z",
 "modifiedDateTime": "2023-06-22T10:51:40Z"
 },
 {
 "number": "20230810-500821-12039886",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-22T10:58:15Z",
 "modifiedDateTime": "2023-06-22T10:58:15Z"
 },
 {
 "number": "20230822-500821-12040332",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-22T12:36:30Z",
 "modifiedDateTime": "2023-06-22T12:38:40Z"
 },
 ...
 ]
}
`

### Process the response and extract `continueToken`​

The API returns data along with a `continueToken`, which indicates how to retrieve the next set of data.

### Use `continueToken` to get the next data set​

Once you have `continueToken`, use it in the next request to retrieve the following data set.

`{
 "continueToken": "eyJCb29raW5nSWRzIjpbMTIwNDg3MDFdLCJNaWxsaXNlY29uZHNGcm9tIjoxNjg3NTExMTA4NzgzfQ==",
 "hasMoreData": true,
 "bookingSummaries": [
 {
 "number": "20230622-500821-12040458",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-22T13:37:12Z",
 "modifiedDateTime": "2023-06-22T13:40:34Z"
 },
 {
 "number": "20230722-500821-12034091",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-22T08:19:55Z",
 "modifiedDateTime": "2023-06-23T08:39:31Z"
 },
 {
 "number": "20230723-500821-12048663",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-23T08:57:46Z",
 "modifiedDateTime": "2023-06-23T08:58:17Z"
 },
 {
 "number": "20230723-500821-12048673",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-23T09:01:48Z",
 "modifiedDateTime": "2023-06-23T09:01:51Z"
 },
 {
 "number": "20230723-500821-12048701",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2023-06-23T09:05:05Z",
 "modifiedDateTime": "2023-06-23T09:05:08Z"
 },
 ...
 ]
}
`

### Repeat the process​

Use `continueToken` from each response in the next request until all required data has been retrieved or `hasMoreData` = `false`.

Response:

`{
 "continueToken": "eyJCb29raW5nSWRzIjpbMTg0OTQ5OTVdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTYxMzk2ODMzfQ==",
 "hasMoreData": false,
 "bookingSummaries": [
 {
 "number": "20250427-500821-18494992",
 "propertyId": 500821,
 "status": "Cancelled",
 "createdDateTime": "2025-03-21T12:48:58Z",
 "modifiedDateTime": "2025-03-21T12:49:18Z"
 },
 {
 "number": "20250515-500821-18494994",
 "propertyId": 500821,
 "status": "Cancelled",
 "createdDateTime": "2025-03-21T12:49:39Z",
 "modifiedDateTime": "2025-03-21T12:49:56Z"
 }
 ]
}
`

### Use `continueToken` to get new data​

When the last page is reached, the response returns `hasMoreData` = `false`, indicating
that no more data is currently available. New `continueToken` is also returned.
You can use this token later to retrieve bookings created after your last request.

Request:

`GET /api/read-reservation/v1/properties/500821/bookings?count=175&continueToken=eyJCb29raW5nSWRzIjpbMTg0OTQ5OTVdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTYxMzk2ODMzfQ== HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "continueToken": "eyJCb29raW5nSWRzIjpbMTg0OTU1NjFdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTY4MTExOTcwfQ==",
 "hasMoreData": false,
 "bookingSummaries": [
 {
 "number": "20250321-500821-18495561",
 "propertyId": 500821,
 "status": "Active",
 "createdDateTime": "2025-03-21T14:41:51Z",
 "modifiedDateTime": "2025-03-21T14:41:51Z"
 }
 ]
}
`

Create an initial data request
Process the response and extract `continueToken`
Use `continueToken` to get the next data set
Repeat the process
Use `continueToken` to get new data