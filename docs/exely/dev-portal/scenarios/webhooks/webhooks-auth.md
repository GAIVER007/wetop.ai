<!-- источник: https://exely.com/dev-portal/docs/scenarios/webhooks/webhooks-auth · скачано 2026-09-08 -->

The server receiving event notifications can be protected from unauthorized access.

No authentication - notifications are accepted without additional verification.

API key - notifications are accepted with an API key in the request header.

Example:

`API-KEY: 1afce52e-80b6-4941-a6ae-2010c340bea1
`

Basic authentication - notifications are accepted with a username and password in the Authorization request header encoded in Base64.

Example:

`Authorization: Basic YWRtaW46YWRtaW4=
`

If authentication fails, return HTTP `401 Unauthorized`.