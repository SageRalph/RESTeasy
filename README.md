# RESTeasy
RESTeasy lets you focus on markup and styling by abstracting away all the boilerplate JavaScript for communicating with your REST API.

## Features
RESTeasy can:
- Display resources in a table (also supports searching)
- Populate a form with the item selected in the table
- Save changes to the selected item
- Delete the selected item
- Create new items
- Display status and error messages

All without you writing any JavaScript (other than initializing RESTeasy).

## Requirements
RESTeasy has absolutley zero dependencies, no jQuery needed.

RESTeasy uses modern JavaScript language features including Async/Await, map, fetch, and object destructuring. These are supported natively by recent versions of Chrome and Firefox, but transpiling with babel is recommended to support other browsers.

## Demo
The demo folder contains a single page site demostrating usage of RESTeasy. You can open this in directly your web browser, no server required.

## Usage
Using RESTeasy is as simple as importing the library (using a `<script>` tag) and calling `resteasy({params})`.

Parameters should be supplied as an object, supporting the following properties:

Name          | Type      |               | Description
------------- | --------- | ------------- | -------------- 
endpoint      |`string`   | **Required**  | The REST API endpoint for this resource.
tableElement  |`<table>`  | **Required**  | An HTML `<table>` for listing records, record can be selected for editing by selecting them in this table. <br>The table must have a `<tbody>`.
tableFields   |`string[]` | **Required**  | An array of field names corisponding to each table column.
formElement   |`<form>`   | **Required**  | An HTML `<form>` for editing records. <br>The form must have an `<input>` with name equal to idField. <br>e.g. `<input type="hidden" name="id"></input>`
searchElement | `<input>` | Optional      | An HTML `<input>` for the search term. <br>This can be any element with a `.value` property.
searchParam   | `string`  | Optional      | The querystring parameter name for the search term.
statusElement | `<p>`     | Optional      | An HTML element for displaying status and errors. <br>This can be any element with a `.innerText` property.
deleteElement |`<button>` | Optional      | An HTML control for deleting the selected record. <br>This can be any element which fires a `submit` event.
createElement |`<button>` | Optional      | An HTML control for creating new records. <br>This can be any element which fires a `submit` event.
idField       |`string`   | Optional      | The name of the id field for records, defaults to "id". <br>RESTeasy will not function if this is not correct. <br>If your database is MongoDB, this is usually "_id".

If RESTeasy is not initialised correctly it will let you know what's wrong in the browser console.

