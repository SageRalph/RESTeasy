/**
 * Initializes a resteasy editor.
 * @param {string} endpoint REST API endpoint
 * @param {<table>} tableElement Table for listing records
 * @param {string[]} tableFields Record fields for each table column
 * @param {<form>} formElement Form for editing record
 * @param {<input>} searchElement Input for search term
 * @param {string} searchParam API parameter name for search term
 * @param {<p>} statusElement Text element for displaying status and errors
 * @param {<button>} deleteElement Button for deleting records
 * @param {<button>} createElement Button for creating records
 * @param {string} idField Name of field holding record id
 */
function resteasy({
    endpoint, tableElement, tableFields, formElement,
    searchElement = {}, searchParam = 'q', statusElement = {}, deleteElement = {}, createElement = {}, idField = 'id', headers = {} }) {

    // BINDINGS ----------------------------------------------------------------

    if (typeof endpoint !== 'string' || !endpoint.length)
        throw 'Invalid endpoint passed to RESTeasy: must be non-empty string';
    if (!(tableElement instanceof HTMLElement) || tableElement.nodeName !== 'TABLE')
        throw 'Invalid tableElement passed to RESTeasy: must be a <table> object';
    if (!Array.isArray(tableFields))
        throw 'Invalid tableFields passed to RESTeasy: must be an array';
    if (!(formElement instanceof HTMLElement) || formElement.nodeName !== 'FORM')
        throw 'Invalid endpoint passed to RESTeasy: must be a <form> object';
    if (!tableElement.tBodies.length)
        throw 'tableElement passed to RESTeasy is missing <tbody>';
    if (!formElement.elements[idField])
        throw 'formElement passed to RESTeasy is missing <input name=[idField]>';
    if (typeof headers !== 'object')
        throw 'headers passed to RESTeasy was not an object';

    const tbody = tableElement.tBodies[0];
    const fid = formElement.elements[idField];
    const endpointBase = endpoint.includes('?') ? endpoint.split('?')[0] : endpoint;

    if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

    formElement.onsubmit = function (e) {
        e.preventDefault();
        actionSave();
    }

    formElement.onreset = function (e) {
        e.preventDefault();
        actionReset();
    }

    searchElement.onkeyup = function (e) {
        e.preventDefault();
        actionSearch();
    }

    deleteElement.onclick = function (e) {
        e.preventDefault();
        actionDelete();
    }

    createElement.onclick = function (e) {
        e.preventDefault();
        actionCreate();
    }

    //Load initial data
    _updateTable();


    // ACTIONS -----------------------------------------------------------------

    /**
     * Search for items in tableElement.
     */
    async function actionSearch() {
        _updateStatus('Searching...');
        await _updateTable();
        _updateStatus('');
    }

    /**
     * Select item with id in tableElement.
     */
    async function actionSelect(id) {
        _updateStatus('Working...');
        _updateSelected(id);
        const record = await _updateForm({ id });
        _updateStatus('Editing existing item: ' + record.name || id);
    }

    /**
     * Delete the item selected in tableElement.
     */
    async function actionDelete() {
        _updateStatus('Working...');
        await _deleteSelected();
        await _updateTable();
        await _updateForm({});
        _updateStatus('Item deleted');
    }

    /**
     * Begin editing a new item in formElement.
     */
    async function actionCreate() {
        _updateStatus('Working...');
        _updateSelected();
        await _updateForm({});
        _updateStatus('Editing new item');
    }

    /**
     * Save changes made in formElement.
     */
    async function actionSave() {
        _updateStatus('Working...');
        const record = await _save();
        if (record) {
            await _updateForm({ record });
            await _updateTable();
            _updateSelected(record[idField]);
            _updateStatus('Item saved');
        }
    }

    /**
     * Cancel unsaved changes in formElement.
     */
    async function actionReset() {
        _updateStatus('Working...');
        const record = await _updateForm({ reload: true });
        if (record !== {}) _updateStatus('Editing existing item: ' + record.name || record.id);
        else _updateStatus('Editing new item');
    }


    // BEHAVIORS ---------------------------------------------------------------

    /**
     * Sets the class of row with id in tableElement to 'selected'.
     * All other rows will have their class reset.
     * If id is not set, no rows will be selected.
     */
    function _updateSelected(id) {
        Array.from(tableElement.rows).map(row => row.className = row.id === id ? 'selected' : '');
    }

    /**
     * Fetches results matching the current search in searchElement and updates tableElement.
     */
    async function _updateTable() {
        try {
            // Support searching
            let url = endpoint;
            if (searchElement.value) {
                // Support endpoints with other query parameters
                url += url.includes('?') ? '&' : '?';
                url += searchParam + '=' + searchElement.value;
            }

            const response = await fetch(url, { headers });
            let data = await response.json();

            if (!response.ok) throw (data);

            // Support either [item] or {results:[{item}]}
            if (data.results) data = data.results;

            // Update table
            tbody.innerHTML = data.map(row =>
                '<tr id=' + row[idField] + '>' + tableFields.map(field => '<td>' + row[field] + '</td>').join('') + '</tr>'
            ).join('');
            Array.from(tableElement.rows).map(row => row.addEventListener("click", actionSelect.bind(row, row.id)));

        } catch (err) {
            _updateStatus(err || 'Failed to load records');
        }
    }

    /**
     * Sets fields in formElement to match supplied record, record with id, or empty.
     * If reload is true, the current record, if any will be re-fetched.
     * Returns the record.
     */
    async function _updateForm({ record, id, reload }) {
        try {
            // Support reload
            if (reload) id = fid.value;

            // Support find by id
            if (!record && id) {
                const data = await fetch(endpointBase + '/' + id, { headers });
                const datajson = await data.json();
                // Support either {item} or {results:[{item}]}
                record = datajson.results ? datajson.results[0] : datajson;
            }

            // Support reset
            if (!record) record = {};

            _writeFormFields(record);

            // Clear any errors
            highlightErrors({});

            return record;

        } catch (err) {
            _updateStatus(err || 'Failed to load record');
        }
    }

    /**
     * Creates or updates a record using values form formElement.
     * Returns the updated record if the server returns it.
     */
    async function _save() {
        try {
            // Determine method and URL for create/update
            let method = 'POST';
            let url = endpointBase;
            if (fid.value) {
                method = 'PUT';
                url += '/' + fid.value;
            }

            const data = _readFormFields();

            const response = await fetch(url, {
                headers,
                method,
                body: JSON.stringify(data)
            });

            const resJSON = await response.json();

            if (!response.ok) {
                highlightErrors(resJSON.errors);
                throw resJSON;
            }

            // Support either {item} or {results:[{item}]}
            return resJSON.results ? resJSON.results[0] : resJSON;

        } catch (err) {
            _updateStatus(err || 'Failed to save record');
        }
    }

    /**
     * Deletes the selected record.
     */
    async function _deleteSelected() {
        try {
            if (!fid.value) return; // NEVER DELETE endpoint/

            const url = endpointBase + '/' + fid.value;
            await fetch(url, { headers, method: 'DELETE' });

        } catch (err) {
            _updateStatus(err || 'Failed to delete record');
        }
    }

    /**
     * Set's the text content of statusElement to match status.
     */
    function _updateStatus(status) {
        console.log(status);
        if (typeof status === 'object' && status.message) status = status.message;
        else if (typeof status === 'object' && status.statusMessage) status = status.statusMessage;
        else if (typeof status !== 'string') status = JSON.stringify(val, null, 2);
        statusElement.innerText = status;
    }

    /**
     * Highlights erroneous fields in formElement.
     */
    function highlightErrors(errors) {
        const elements = formElement.elements;
        for (let item of elements) {
            item.className = errors.hasOwnProperty(item.name) ? 'invalidField' : '';
        }
    }

    /**
     * Set's formElement's fields to match obj.
     */
    function _writeFormFields(obj) {
        const elements = formElement.elements;
        for (let item of elements) {
            let val = deepFind(obj, item.name);
            if (item.name) {
                // Checkbox
                if (item.type === 'checkbox') {
                    item.checked = val ? true : false;
                }
                // Date
                else if (item.type === 'date') {
                    item.value = val ? htmlDate(val) : '';
                }
                // Select
                else if (item.nodeName === 'SELECT' && typeof val === 'object') {
                    item.value = val[idField];
                }
                // JSON, Array, or Text
                else {
                    let value;
                    if (item.className.includes('formatJSON')) value = JSON.stringify(val, null, 2);
                    else if (item.className.includes('formatArray')) value = Array.isArray(val) ? val.join('\n') : val;
                    else value = val || '';
                    item.value = value;
                    item.placeholder = value;
                }
            }
        }
    }

    /**
     * Returns an object containing all values from formElement's inputs.
     */
    function _readFormFields() {
        let obj = {};
        const elements = formElement.elements;
        for (let item of elements) {

            // Ignore unnamed controls
            if (!item.name) continue;

            let value = item.value;

            // Checkbox
            if (item.type === 'checkbox') {
                value = item.checked ? true : false;
            }
            // Date
            else if (item.type === 'date') {
                value = item.value ? new Date(item.value) : null;
            }
            // JSON
            else if (item.className.includes('formatJSON')) {
                try {
                    value = JSON.parse(item.value);
                } catch (e) { }
            }
            // Array
            else if (item.className.includes('formatArray')) {
                value = item.value.split('\n');
            }

            // Assign value to object
            obj = deepSet(obj, item.name, value);
        }
        return obj;
    }

}

/**
 * Gets value from obj at path.
 * Path can be shallow or deep
 * e.g. obj[a] or obj[a[b]]
 */
function deepFind(obj, path) {
    // Shallow (e.g. {name})
    if (!path.includes('.')) return obj[path];

    // Deep (e.g. {address:{street}})
    const parts = path.split('.')
    let cursor = obj;
    for (let field of parts) {
        if (cursor[field] == undefined) return undefined;
        else cursor = cursor[field];
    }
    return cursor;
}

/**
 * Sets value in obj at path.
 * Path can be shallow or deep
 * e.g. obj[a] or obj[a[b]]
 */
function deepSet(obj, path, value) {
    // Shallow (e.g. {name})
    if (!path.includes('.')) {
        obj[path] = value;
        return obj;
    }
    // Deep (e.g. {address:{street}})
    let parts = path.split('.');
    let cursor = obj;
    for (let field of parts.slice(0, -1)) {
        if (cursor[field] === undefined) cursor[field] = {};
        cursor = cursor[field];
    }
    cursor[parts.pop()] = value;
    return obj;
}

/**
 * Converts a JSON date string to a HTML date string.
 */
function htmlDate(str) {
    const date = new Date(str);
    const d = ("0" + date.getDate()).slice(-2);
    const m = ("0" + (date.getMonth() + 1)).slice(-2);
    const y = date.getFullYear();
    return y + "-" + m + "-" + d;
}