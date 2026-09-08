<!-- источник: https://exely.com/dev-portal/docs/scenarios/authorization · скачано 2026-09-08 -->

On this page

### Before you start​

To use the API, you must obtain an access token (`access_token`). Access tokens are issued based on the `client_id` and `client_secret` credentials.

You can obtain these credentials through a property integration.

The hotelier creates an API integration in the Exely account and provides you with the `client_id` and `client_secret` credentials. For more information, see Integration through the property.

Once you have obtained your credentials, send a request to the authorization endpoint. The response will include an access token (`access_token`).

Include `access_token` in the `Authorization` header of every API request:

`Authorization: Bearer <access_token>
`

### Get access token​

Request:

`POST /auth/token HTTP/1.1
Host: connect.hopenapi.com
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={{ client_id }}&client_secret={{ client_secret }}
`

Parameters:

 | | Parameter | Type | Required | Description
 | `grant_type` | string | Yes | `client_credentials`
 | `client_id` | string | Yes | Client identifier
 | `client_secret` | string | Yes | Secret key

Successful response:

`{
 "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICI2OGZjOHRNUGFSUHRyRHYtVHV2WEpncUNGTE1CVGRheTBpQkdJSUE3amxvIn0.eyJleHAiOjE3NTA5NDkyMzgsImlhdCI6MTc1MDk0ODMzOCwianRpIjoiMDFkYWI4YWYtN2VjYS00ZTNkLWI5NDMtNzQ1ZjhjOWQ0NzMwIiwiaXNzIjoiaHR0cHM6Ly9wYXJ0bmVyLnRsaW50ZWdyYXRpb24uY29tL2F1dGgvcmVhbG1zL1BhcnRuZXJBcGkiLCJhdWQiOiJUcmF2ZWxMaW5lLlBhcnRuZXJBUEkiLCJzdWIiOiJiYzA4OWVjMC04NDk3LTQ4N2MtYmZiZC1mNmI4Zjk2NWRmMTMiLCJ0eXAiOiJCZWFyZXIiLCJhenAiOiJ0ZXN0X2NsaWVudCIsInNjb3BlIjoiIiwiY2xpZW50SG9zdCI6IjEwLjEwLjMuMTA2IiwiYXBpX2FjY2Vzc2VzIjpbInJlc2VydmF0aW9uX2FwaSIsImNvbnRlbnQiXSwicm9sZXMiOlsiY29udGVudDpmdWxsX2luZm9fcmVhZGVyIl0sImNsaWVudEFkZHJlc3MiOiIxMC4xMC4zLjEwNiIsImNsaWVudF9pZCI6InRlc3RfY2xpZW50In0.AiWMlNTBm1zNvVE6cQTLAAteKSA6Iq8h_zWAZV_pgdMsFwIz4hfKLRR1hLhilwNZRkgxLHUdJBPfxISUeOzPbUarmbjEj_wLNkcsRv1tTsT0DY0WIeCWBB2mjjglEufKJpxSPzw3YDZ0Bz8yBdEuJwxiwZOCxRhB3TIoA-xJ0Naljmeg--iCoHJ1vy48_lfReTZVJ5kbPGFKoJOF9kU4siq5pwgps3kGTzlafB99vZpjo1hCLLCvHUB8bzzyX83jehkFlQujOqbjTKIMNTcihYFgXai4gECw0s9ZOtbhTC5GXwC_zmud-GpBiRN6iiJxXOTvnkYH-7yIhRC1F1g-Lg",
 "expires_in": 1800,
 "refresh_expires_in": 0,
 "token_type": "Bearer",
 "not-before-policy": 0,
 "scope": ""
}

Test message
`

Error handling:

If `client_id` or `client_secret` is invalid:

`{
 "error": "unauthorized_client",
 "error_description": "Invalid client or Invalid client credentials"
}
`

Before you start
Get access token