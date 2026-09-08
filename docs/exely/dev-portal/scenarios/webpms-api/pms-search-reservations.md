<!-- источник: https://exely.com/dev-portal/docs/scenarios/webpms-api/pms-search-reservations · скачано 2026-09-08 -->

On this page

### Create the initial data request​

Specify the start and end dates of the period.
Send the request without the `pageToken` parameter.

Request:

`GET /api/pms/reservations/search?state=Active&startAffectPeriodDateTime=2024-10-21T11:11&endAffectPeriodDateTime=2024-11-22T11:11 HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "pageToken": "eyJCb29raW5nSWRzIjpbMTIwNDAzMzNdLCJNaWxsaXNlY29uZHNGcm9tIjoxNjg3NDM3NTIwMjEwfQ==",
 "hasNextPage": true,
 "reservations": [
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

### Process the response and extract `pageToken`​

API returns data together with `nextPageToken`, which indicates how to retrieve the next set of data.

### Use `nextPageToken` to retrieve the next set of data​

Once you have `nextPageToken`, use it in the next request to retrieve the next set of data.

`{
 "pageToken": "eyJCb29raW5nSWRzIjpbMTIwNDg3MDFdLCJNaWxsaXNlY29uZHNGcm9tIjoxNjg3NTExMTA4NzgzfQ==",
 "hasNextPage": true,
 "reservations": [
 {
 "number": "20230622-500821-12040458"
 },
 {
 "number": "20230722-500821-12034091"
 },
 {
 "number": "20230723-500821-12048663"
 },
 {
 "number": "20230723-500821-12048673"
 },
 {
 "number": "20230723-500821-12048701"
 },
 ...
 ]
}
`

### Repeat the process​

Continue using `nextPageToken` from each subsequent response until you retrieve all required data or `hasNextPage` = `false`

Response:

`{
 "pageToken": "eyJCb29raW5nSWRzIjpbMTg0OTQ5OTVdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTYxMzk2ODMzfQ==",
 "hasNextPage": false,
 "reservations": [
 {
 "number": "20250427-500821-18494992"
 },
 {
 "number": "20250515-500821-18494994"
 }
 ]
}
`

### Use nextPageToken to retrieve new data​

After the last page of data is retrieved, the response returns `hasNextPage` = `false`,
which indicates that there is no more data to retrieve. Together with this flag, you also receive a new `nextPageToken`.
This token can later be used to retrieve new bookings created after your last request.

Request:

`GET /api/pms/reservations/search?pageToken=eyJCb29raW5nSWRzIjpbMTg0OTQ5OTVdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTYxMzk2ODMzfQ== HTTP/1.1
Host: connect.hopenapi.com
Authorization: Bearer {{ access_token }}
`

Response:

`{
 "nextPageToken": "eyJCb29raW5nSWRzIjpbMTg0OTU1NjFdLCJNaWxsaXNlY29uZHNGcm9tIjoxNzQyNTY4MTExOTcwfQ==",
 "hasNextPage": false,
 "reservations": [
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

Create the initial data request
Process the response and extract `pageToken`
Use `nextPageToken` to retrieve the next set of data
Repeat the process
Use nextPageToken to retrieve new data