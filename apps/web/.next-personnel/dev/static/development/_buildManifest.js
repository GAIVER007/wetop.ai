self.__BUILD_MANIFEST = {
  "__rewrites": {
    "afterFiles": [],
    "beforeFiles": [
      {
        "has": [
          {
            "type": "header",
            "key": "next-url",
            "value": "/.*"
          }
        ],
        "source": "/reservations/:nxtPnumber",
        "destination": "/(.)reservations/:nxtPnumber"
      },
      {
        "has": [
          {
            "type": "header",
            "key": "next-url",
            "value": "/.*"
          }
        ],
        "source": "/reservations/new",
        "destination": "/(.)reservations/new"
      },
      {
        "has": [
          {
            "type": "header",
            "key": "next-url",
            "value": "/.*"
          }
        ],
        "source": "/reservations/:nxtPnumber",
        "destination": "/(.)reservations/:nxtPnumber"
      },
      {
        "has": [
          {
            "type": "header",
            "key": "next-url",
            "value": "/.*"
          }
        ],
        "source": "/reservations/new",
        "destination": "/(.)reservations/new"
      },
      {
        "has": [
          {
            "type": "header",
            "key": "next-url",
            "value": "/inventory(?:/.*)?"
          }
        ],
        "source": "/units/:nxtPcode",
        "destination": "/inventory/(..)units/:nxtPcode"
      }
    ],
    "fallback": []
  },
  "sortedPages": [
    "/_app",
    "/_error"
  ]
};self.__BUILD_MANIFEST_CB && self.__BUILD_MANIFEST_CB()