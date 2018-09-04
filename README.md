# RESTeasy
RESTeasy lets you focus on markup and styling by abstracting away all the boilerplate JavaScript for communicating with your REST API.

## Features
RESTeasy can:
- Display resources in a table, with support for searching and pagination
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

Name                | Type      |                 | Description
------------------- | --------- | --------------- | -------------- 
endpoint            |`string`   | **Required**    | The REST API endpoint for this resource.
tableElement        |`<table>`  | **Required**    | An HTML `<table>` for listing items, an item can be selected for editing by selecting them in this table. <br>The table must have a `<tbody>`.
tableFields         |`string[]` | **Required**    | An array of item fields corresponding to each column in tableElement. <br>Supports sub-properties. e.g. `["address.postcode"]`
formElement         |`<form>`   | **Required**    | An HTML `<form>` for editing items. <br>The form must have an `<input>` with name equal to idField. <br>e.g. `<input type="hidden" name="id">`
log                 |`function` | Optional        | A function for logging actions and errors. If not set (or not a function), nothing will be logged.
tableClasses        |`string[]` | Optional        | An array of classNames to apply to cells, corresponding to each column in tableElement.
searchElement       |`<input>`  | Optional        | An HTML `<input>` for the search term. <br>This can be any element with a `.value` property.
searchParam         |`string`   | Default: 'q'    | The querystring parameter name for the search term.
pageSizeParam       |`string`   | Optional        | The querystring parameter name for pagination page size.
pageNumberParam     |`string`   | Optional        | The querystring parameter name for pagination page number.
pageSize            |`integer`  | Default: 10     | The number of items to request per pagination page.
pageIncrement       |`integer`  | Default: 1      | The amount to increase or decrease page number by. This will typically be either 1 or pageSize.
pageTotalProperty   |`string`   | Optional        | The search response property for the total number of paginated items. <br>Supports nested properties. <br>e.g. `"meta.total"`
pageNextElement     |`<button>` | Optional        | An HTML control for requesting the next pagination page.
pagePreviousElement |`<button>` | Optional        | An HTML control for requesting the previous pagination page.
pageStatusElement   |`<p>`      | Optional        | An HTML element for displaying status and errors. <br>This can be any element with a `.innerText` property.
statusElement       |`<p>`      | Optional        | An HTML element for displaying status and errors. <br>This can be any element with a `.innerText` property.
deleteElement       |`<button>` | Optional        | An HTML control for deleting the selected item. <br>This can be any element which fires a `submit` event.
createElement       |`<button>` | Optional        | An HTML control for creating new items. <br>This can be any element which fires a `submit` event.
idField             |`string`   | Optional        | The item field to use for identification, defaults to "id". <br>RESTeasy will not function if this is not correct. <br>If your database is MongoDB, this is usually `"_id"`.
nameField           |`string`   | Default: 'name' | The item field to use for display name.
headers             |`object`   | Optional        | An object containing headers to include in all requests. <br>Content-type will default to `application/json` if not set.

If RESTeasy is not initialized correctly it will let you know what's wrong in the browser console.

#### Events and functions
RESTeasy intercepts events fired by the HTML elements supplied. You can also trigger some actions programmatically using additional functions RESTeasy attaches to those elements.

Element             | Function          | Action
------------------- | ----------------- | -------------- 
tableElement        |`easyCreate`       | Resets the selection in tableElement and clears formElement.
tableElement        |`easyDelete`       | Deletes the item selected in tableElement and clear formElement.
tableElement        |`easySearch`       | Searches for items matching the query in searchElement and updates tableElement.
tableElement        |`easyNextPage`     | Requests the next page of results and updates tableElement.
tableElement        |`easyPreviousPage` | Requests the previous page of results and updates tableElement.
tableElement        |`easySelect(id)`   | Uses id passed as a parameter to selects an item in tableElement and load its values into formElement. <br>If an id is not supplied or matches no items, the selection will be cleared.
tableElement.row    |`onclick`          | Selects the clicked row in tableElement and loads the item's values into formElement.
formElement         |`onsubmit`         | Saves the item being edited in formElement. Uses POST for new items, or PUT if editing.
formElement         |`onreset`          | Reloads the values of the item being edited in formElement.
searchElement       |`onkeyup`          | Same as `easySearch`.
pageNextElement     |`onclick`          | Same as `easyNextPage`.
pagePreviousElement |`onclick`          | Same as `easyPreviousPage`.
createElement       |`onclick`          | Same as `easyCreate`.
deleteElement       |`onclick`          | Same as `easyDelete`.

#### Life-cycle hooks
RESTeasy also supports life-cycle hooks. These are optional functions you can pass as parameters on initialization.    
Hooks should be awaitable functions (either synchronous or return a promise) and will be called with relevant data each time the life-cycle event occurs.   

There are two types of hooks: pre and post. pre hooks give the opportunity to modify data before an action is performed, or block the action by throwing an error. post hooks allow you to react to actions.    

Both types of hooks will be passed a data object as a parameter, pre hooks may return a modified data object. If a pre hook does not return anything the data will continue unmodified. If a pre hook throws an error, the life-cycle operation will not proceed. If a hook throws an error the failure will be logged to the browser console and displayed in statusElement. post hooks will only be run if the life-cycle operation (and any pre hooks) was successful.  
Some hooks will also be passed a meta object as the second parameter. This object can be modified in pre hooks to change the action, for example, by rewriting the target URL. Refer to the table below for available meta properties.   

Name            | Description
--------------- | -------------- 
preSearch       | Called with the term to search with (if any). <br>Allows interruption of the action, or modification of the query or meta.url before the request is sent. <br>*Note: There is no postSearch event as searching is immediately followed by updateTable. The response to the query can be obtained from preUpdateTable.* <br>*Note 2: This hook will be run even if searchElement is not set, allowing for programmatic query generation.*
preUpdateTable  | Called with the array of search results to be displayed. <br>Allows modification of results before they are written to the table.
postUpdateTable | Called with the array of search results displayed.
preFindByID     | Called with the id of the resource to be read. <br>Allows interruption of the action, or modification of meta.url before the request is sent. <br>*Note: There is no postFindByID event as the request is immediately followed by updateForm. The response to the query can be obtained from preUpdateForm.*
preUpdateForm   | Called with the resource to be written. <br>Allows interruption of the action, or modification of the resource before it is written to the form.
postUpdateForm  | Called with the resource that was written to the form.
preSave         | Called with the resource to be saved. <br>Allows interruption of the action, or modification of the resource or meta.url before the request is sent.
postSave        | Called with the response from saving the resource. 
preDelete       | Called with the id of the resource to be deleted. <br>Allows interruption of the action, or modification of meta.url before the request is sent. <br>*Note: This hook will be run even if no element is selected, allowing for programmatic selection. The delete event will only proceed if an element was selected or a value is returned by this hook*
postDelete      | Called with the response from deleting the resource. 

### Form Design
RESTeasy allows editing items using a HTML `<form>`.  
The minimum requirement is a form containing an input with name equal to idField.  
```
<form id="myform">
  <input type="hidden" name="id">
</form>
```
You can add your resource's fields as normal form inputs. RESTeasy does not require any use of classes or ids to identify most fields.

#### Custom parsing
RESTeasy uses custom form parsing which works a little differently from normal form serialization.  
Here are the important differences:

- You can specify sub-properties by putting `.`s in an input's name attribute. *Note: This also works for tableFields*.   
e.g.   
`<input type="text" name="company.address.postcode" value="ABC123">`  
Produces:   
`{ company: { address: { postcode: "ABC123" } } }`

- Checkbox values will always appear in output.   
i.e. an unchecked checkbox will have the value false rather than being omitted from the item.   
e.g.   
`<input type="checkbox" name="mybool">`   
Produces:   
`{ mybool: false }`

- Array editing is supported in `<textarea>`s by adding the class `formatArray`.   
Each line is treated as an array item.   
e.g.   
`<textarea name="tags" class="formatArray" value="REST\nclient\nlibrary"></textarea>`   
Produces:   
`{ tags: ["REST", "client", "library"] }`

- JSON editing is supported in `<textarea>`s by adding the class `formatJSON`.   
`JSON.parse()` is used to read the content. If parsing fails, the field will be ommited.      
e.g.   
`<textarea name="myjsonfield" class="formatJSON" value="{ a: { b: 'c' } }"></textarea>`   
Produces:   
`{ myjsonfield: { a: { b: 'c' } } }`
