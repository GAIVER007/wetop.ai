<!-- источник: https://exely.com/help/kb350850/ · скачано 2026-09-08 -->

# Knowledge Base

## Learn company top features of our solutions. Get help whenever you need.

 English

 Русский

 Українська

 Türkçe

 Knowledge base

 Public API

 Public API

 Read Reservation API — reading bookings

# 
 Read Reservation API — reading bookings 

 Last update: Apr 6, 2026 

 API allows you to get information about property bookings from Exely Booking Engine, Channel Manager and Exely PMS.

The process is described in detail in the specification.

To get a page listing of property bookings, follow the steps below:

## 1. Create an initial data request

In the initial request, specify the lastModification parameter. To retrieve the data, run the first query using the lastModification parameter. Example: 2023-06-20T10:41:04Z. It is important to pass it without the continueToken parameter.

## 2. Handle the response and retrieve the continueToken

The API returns data along with a continueToken that indicates how to retrieve the next set of data.

## 3. Use continueToken to retrieve the next set of data

Now that you have the continueToken, use it in the next request to retrieve the next data set.

## 4. Repeat the process

Continue to use the received continueToken from each subsequent response until you receive all required data or hasMoreData = false flag.

## 5. Use continueToken to retrieve new data

After receiving the last page of data, the response will contain the hasMoreData = false flag, which indicates that there is no more additional data to load. However, along with this flag, you will also receive a new continueToken. This token can be used later to retrieve new bookings that have appeared since your last request.

## Interaction schemes

### Full synchronization of bookings

### Updating bookings after full synchronization

## Parameters

### propertyId

The parameter indicates from which property the booking data will be retrieved.

### lastModification

The parameter specifies the minimum date from which bookings data will be received. In case the parameter is not specified, the earliest date of the booking modification by the property will be automatically selected.

The parameter is optional, but it cannot be used simultaneously with the continueToken parameter.

### Count

The parameter is used to specify the number of bookings that will be returned per response. If the parameter is not specified, the default value of 1000 will be used.

Optional parameter. It can be changed in each of the requests using continueToken.

### continueToken

The parameter is meant to provide the functionality of page by page view of the data, as opposed to using the lastModification parameter. The continueToken allows you to view the booking data sequentially and ensures that the complete data is displayed without omissions.

The parameter is useful for retrieving data updates, including new bookings that have occurred since the previous request.

continueToken is provided in each response, allowing you to use it for the next data request.

The parameter is optional and cannot be used at the same time as the lastModification parameter.

An example of the token in a response:

## What to do in case of continueToken loss

If continueToken is lost, we suggest that you run a new request using the lastModification parameter to retrieve a new continueToken.

It is recommended to define the lastModification value the following way: specify the last booking modification date lastModification minus two days. This approach will help you to avoid missing bookings in the subsequent data requests.

## Response fields

### continueToken

The field contains continueToken.

### hasMoreData

The field is present in every response.

If the value is true, it means there is data in the request that can be retrieved using continueToken.

If the value is false, there is no data to load on the page. In this case, we recommend saving continueToken in order to retrieve information about bookings in the future from where you stopped.

Example of the hasMoreData field in a response:

## Data update

After the complete synchronization, it is important to save the last received continuedToken. This will allow you to receive information in the future not only about newly created bookings, but also about those that have been modified.

When a booking is modified, the corresponding value in the lastModification field is updated to the date of the last modification. Thanks to this mechanism, a modified booking can be retrieved again on subsequent requests using continueToken.

It is important to closely monitor changes to bookings to avoid data collisions. If you have already worked with the original version of a booking and then received its updated version, it is necessary to correctly process both versions to ensure data relevance and integrity.

Method for obtaining detailed booking information

The method is intended for obtaining detailed information for a single booking. In this case, the booking version is always the latest one.

## Catalogs

### MealPlanCode (meal types)

The interpretation of this field can be found in ContentApi in the GET /v1/meal-plans method.

Example of finding the MealPlanCode in services:

### POS (point of sale)

The interpretation of POS can be found in the response examples in Swagger ReservationApi.

Example of POS:

## Examples of bookings from different systems

A booking from Exely Channel Manager:

A booking from Exely Booking Engine:

### Other articles in the category

 What is API

 How to work with API

 How to create API connections

 Request limits and the list of errors

 Content API — property description

 How to set up webhooks in Exely extranet

## Need More Help? Contact Support

 CONTACT SUPPORT