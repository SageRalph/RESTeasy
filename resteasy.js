/**
 * Initializes a resteasy editor.
 * @param {string} endpoint REST API endpoint
 * @param {<table>} tableElement Table for listing items
 * @param {string[]} tableFields item fields corresponding to each column in tableElement
 * @param {<form>} formElement Form for editing item
 * @param {function} [log] function for logging
 * @param {string[]} [tableClasses] Array of classNames corresponding to each column in tableElement
 * @param {<input>} [searchElement] Input for search term
 * @param {string} [searchParam=q] querystring parameter name for search term
 * @param {<p>} [statusElement] Text element for displaying status and errors
 * @param {<button>} [deleteElement] Button for deleting items
 * @param {<button>} [createElement] Button for creating items
 * @param {string} [idField=id] item field used for identification
 * @param {string} [nameField=name] item field to use for display name
 */
function resteasy({
    endpoint, tableElement, tableFields, formElement,
    log, tableClasses = [], searchElement = {}, searchParam = 'q', statusElement = {}, deleteElement = {}, createElement = {}, idField = 'id', nameField = 'name', headers = {},
    preSearch, preUpdateTable, preUpdateForm, preSave, preDelete, postUpdateTable, postUpdateForm, postSave, postDelete }) {

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

    if (typeof log !== 'function') log = () => { };

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
        try {
            _updateStatus('Searching...');
            await _updateTable();
            _updateStatus('');
        } catch (err) { }
    }

    /**
     * Select item with id in tableElement.
     */
    async function actionSelect(id) {
        try {
            _updateStatus('Working...');
            _updateSelected(id);
            const item = await _updateForm({ id });
            _updateStatus('Editing existing item', item[nameField] || id);
        } catch (err) { }
    }

    /**
     * Delete the item selected in tableElement.
     */
    async function actionDelete() {
        try {
            _updateStatus('Working...');
            await _deleteSelected();
            await _updateTable();
            await _updateForm({});
            _updateStatus('Item deleted');
        } catch (err) { }
    }

    /**
     * Begin editing a new item in formElement.
     */
    async function actionCreate() {
        try {
            _updateStatus('Working...');
            _updateSelected();
            await _updateForm({});
            _updateStatus('Editing new item');
        } catch (err) { }
    }

    /**
     * Save changes made in formElement.
     */
    async function actionSave() {
        try {
            _updateStatus('Working...');
            const item = await _save();
            if (item) {
                await _updateForm({ item });
                await _updateTable();
                _updateSelected(item[idField]);
                _updateStatus('Item saved\nEditing existing item', item[nameField] || item[idField]);
            }
        } catch (err) { }
    }

    /**
     * Cancel unsaved changes in formElement.
     */
    async function actionReset() {
        try {
            _updateStatus('Working...');
            const item = await _updateForm({ reload: true });
            if (item !== {}) _updateStatus('Editing existing item', item[nameField] || item[idField]);
            else _updateStatus('Editing new item');
        } catch (err) { }
    }


    // BEHAVIORS ---------------------------------------------------------------

    /**
     * Sets the class of row with id in tableElement to 'selected'.
     * All other rows will have their class reset.
     * If id is not set, no rows will be selected.
     */
    function _updateSelected(id) {
        Array.from(tableElement.rows).map(row => {
            if (row.id === id) row.classList.add('selected');
            else row.classList.remove('selected');
        });
    }

    /**
     * Fetches results matching the current search in searchElement and updates tableElement.
     */
    async function _updateTable() {
        try {
            // Support searching
            let url = endpoint;
            let searchValue = searchElement.value;

            searchValue = await _doHook(preSearch, searchValue);

            if (searchValue) {
                // Support endpoints with other query parameters
                url += url.includes('?') ? '&' : '?';
                url += searchParam + '=' + searchValue;
            }

            let data = await fetchJSON(url, { headers }, { array: true });

            data = await _doHook(preUpdateTable, data);

            // Update table
            tbody.innerHTML = '';
            for (let item of data) {
                let tr = document.createElement('tr');
                tr.id = item[idField];
                tr.addEventListener("click", actionSelect.bind(tr, tr.id));

                for (let col = 0; col < tableFields.length; col++) {
                    let td = document.createElement('td');
                    td.innerText = deepFind(item, tableFields[col]);
                    if (tableClasses.length > col) td.className = tableClasses[col];
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }

            await _doHook(postUpdateTable, data);

        } catch (err) {
            _updateStatus('Failed to load items', err);
            throw err;
        }
    }

    /**
     * Sets fields in formElement to match supplied item, item with id, or empty.
     * If reload is true, the current item, if any will be re-fetched.
     * Returns the item.
     */
    async function _updateForm({ item, id, reload }) {
        try {
            // Support reload
            if (reload) id = fid.value;

            // Support find by id
            if (!item && id) {
                item = await fetchJSON(endpointBase + '/' + id, { headers }, { first: true });
            }

            // Support reset
            if (!item) item = {};

            item = await _doHook(preUpdateForm, item);

            _writeFormFields(item);

            // Clear any errors
            _highlightErrors({});

            await _doHook(postUpdateForm, item);

            return item;

        } catch (err) {
            _updateStatus('Failed to load item', err);
            throw err;
        }
    }

    /**
     * Creates or updates a item using values form formElement.
     * Returns the updated item if the server returns it.
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

            let data = _readFormFields();

            data = await _doHook(preSave, data);

            let result;
            try {
                result = await fetchJSON(url, {
                    headers,
                    method,
                    body: JSON.stringify(data)
                }, { first: true });
            } catch (err) {
                _highlightErrors(err.errors || err.error || err);
                throw err;
            }

            await _doHook(postSave, result);

            return result;

        } catch (err) {
            _updateStatus('Item not saved', err);
            throw err;
        }
    }

    /**
     * Deletes the selected item.
     */
    async function _deleteSelected() {
        try {

            const id = await _doHook(preDelete, fid.value);

            if (!id) throw 'Nothing selected'; // NEVER DELETE endpoint/

            const url = endpointBase + '/' + id;

            let data = await fetchJSON(url, { headers, method: 'DELETE' }, { first: true });

            await _doHook(postDelete, data);

        } catch (err) {
            _updateStatus('Item not deleted', err);
            throw err;
        }
    }

    /**
     * Set's the text content of statusElement to match status.
     */
    function _updateStatus(text, status) {
        log(text, status);
        let msg = text;
        if (status) {
            if (typeof status === 'object' && status.message) status = status.message;
            else if (typeof status === 'object' && status.statusMessage) status = status.statusMessage;
            else if (typeof status !== 'string') status = JSON.stringify(val, null, 2);
            msg += ':\n' + status;
        }
        statusElement.innerText = msg;
    }

    /**
     * Highlights erroneous fields in formElement.
     */
    function _highlightErrors(errors) {
        const elements = formElement.elements;
        for (let field of elements) {
            let match = errors.hasOwnProperty(field.name);
            if (match) field.classList.add('invalidField');
            else field.classList.remove('invalidField');
        }
    }

    /**
     * Set's formElement's fields to match obj.
     */
    function _writeFormFields(obj) {
        const elements = formElement.elements;
        for (let field of elements) {
            let val = deepFind(obj, field.name);
            if (field.name) {
                // Checkbox
                if (field.type === 'checkbox') {
                    field.checked = val ? true : false;
                }
                // Date
                else if (field.type === 'date') {
                    field.value = val ? htmlDate(val) : '';
                }
                // Select
                else if (field.nodeName === 'SELECT' && typeof val === 'object') {
                    field.value = val[idField];
                }
                // JSON, Array, or Text
                else {
                    let value;
                    if (field.classList.contains('formatJSON')) value = JSON.stringify(val, null, 2);
                    else if (field.classList.contains('formatArray')) value = Array.isArray(val) ? val.join('\n') : val;
                    else value = val || '';
                    field.value = value;
                    field.placeholder = value;
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
        for (let field of elements) {

            // Ignore unnamed or disabled controls
            if (!field.name || field.disabled) continue;

            let value = field.value;

            // Checkbox
            if (field.type === 'checkbox') {
                value = field.checked ? true : false;
            }
            // Date
            else if (field.type === 'date') {
                value = field.value ? new Date(field.value) : null;
            }
            // JSON
            else if (field.classList.contains('formatJSON')) {
                try {
                    value = JSON.parse(field.value);
                } catch (e) { }
            }
            // Array
            else if (field.classList.contains('formatArray')) {
                value = field.value.split('\n').filter(l => l.trim().length);
            }

            // Assign value to object
            obj = deepSet(obj, field.name, value);
        }
        return obj;
    }

    /**
     * Executes hook with data if it is a function, otherwise returns data.
     * Returns the result of the hook, or data if nothing is returned.
     * Failed hooks will be caught and logged, data will be returned.
     */
    async function _doHook(hook, data) {
        try {
            if (typeof hook === 'function') return await hook(data) || data;
            else return data;
        } catch (err) {
            log('Error thrown by hook:\n', err);
            throw err;
        }
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

async function fetchJSON(url, options, { array, first }) {
    const response = await fetch(url, options);

    let data = {};

    // Support 204 (no content) when no results
    if (response.status === 204) return array ? [] : undefined;

    data = await response.json();

    // Check for HTTP error
    if (!response.ok) throw data;

    // Support either [item] or {results:[{item}]}
    if (array && Array.isArray(data)) return data;
    if (array && Array.isArray(data.results)) return data.results;
    if (array) return [];

    if (first && Array.isArray(data)) {
        if (!data.length) return;
        return data[0];
    }
    if (first && Array.isArray(data.results)) {
        if (!data.results.length) return;
        return data.results[0];
    }

    return data;
}