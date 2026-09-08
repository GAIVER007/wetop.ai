<!-- источник: https://exely.com/dev-portal/docs/scenarios/webhooks/webhooks-processing · скачано 2026-09-08 -->

On this page

### Notification response​

To confirm receipt of data, the server must return a response with a 2xx status code, for example, `200 OK`.
New events are not sent until successful processing of previous events is confirmed.

#### Retry algorithm​

If delivery fails, the system gradually increases the time between retry attempts to reduce system load.

Maximum interval is 24 hours.

Interval reset occurs only after a successful response (2xx status code).

Changing the notification delivery URL triggers an immediate retry attempt. If successful, the interval is also reset.

Notification response