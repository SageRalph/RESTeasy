class RESTeasy {
    /**
     * Initializes a resteasy editor.
     * @param {string} endpoint REST API endpoint
     * @param {<table>} tableElement Table for listing items
     * @param {string[]} tableFields item fields corresponding to each column in tableElement
     * @param {<form>} formElement Form for editing item
     * @param {function} [log]  for logging
     * @param {string[]} [tableClasses] Array of classNames corresponding to each column in tableElement
     * @param {<input>} [searchElement] Input for search term
     * @param {string} [searchParam=q] querystring parameter name for search term
     * @param {string} [pageSizeParam] querystring parameter name for pagination page size
     * @param {string} [pageNumberParam] querystring parameter name for pagination page number
     * @param {integer} [pageSize=10] Number of items to request per pagination page
     * @param {integer} [pageIncrement=1] Amount to increase or decrease page number by
     * @param {string} [pageTotalProperty] Search response property for the total number of paginated items, supports nested properties. e.g. "meta.total"
     * @param {<button>} [pageNextElement] Button for requesting the next pagination page
     * @param {<button>} [pagePreviousElement] Button for requesting the previous pagination page
     * @param {<p>} [pageStatusElement] Text element for displaying the current and total number of pagination pages
     * @param {<p>} [statusElement] Text element for displaying status and errors
     * @param {<button>} [deleteElement] Button for deleting items
     * @param {<button>} [createElement] Button for creating items 
     * @param {string} [idField=id] item field used for identification
     * @param {string} [nameField=name] item field to use for display name
     */
    constructor({
        endpoint, tableElement, tableFields, formElement,
        log, tableClasses = [], searchElement = {}, searchParam = 'q',
        pageSizeParam, pageNumberParam, pageSize = 10, pageIncrement = 1, pageTotalProperty,
        pageNextElement = {}, pagePreviousElement = {}, pageStatusElement = {},
        statusElement = {}, deleteElement = {}, createElement = {}, idField = 'id', nameField = 'name', headers = {},
        preSearch, preUpdateTable, preUpdateForm, preSave, preDelete,
        postUpdateTable, postUpdateForm, postSave, postDelete
    }) {

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

        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

        if (typeof log !== 'function') log = () => { };

        // Programmatic ways of triggering operations
        tableElement.easySelect = (id) => this.actionSelect(id);
        tableElement.easyCreate = () => this.actionCreate();
        tableElement.easyDelete = () => this.actionDelete();
        tableElement.easySearch = () => this.actionSearch();
        tableElement.easyNextPage = () => this.actionNextPage();
        tableElement.easyPreviousPage = () => this.actionPreviousPage();

        let me = this;

        formElement.onsubmit = function (e) {
            e.preventDefault();
            me.actionSave();
        }

        formElement.onreset = function (e) {
            e.preventDefault();
            me.actionReset();
        }

        searchElement.onkeyup = function (e) {
            e.preventDefault();
            me.actionSearch();
        }

        deleteElement.onclick = function (e) {
            e.preventDefault();
            me.actionDelete();
        }

        createElement.onclick = function (e) {
            e.preventDefault();
            me.actionCreate();
        }

        pageNextElement.onclick = function (e) {
            e.preventDefault();
            me.actionNextPage();
        }

        pagePreviousElement.onclick = function (e) {
            e.preventDefault();
            me.actionPreviousPage();
        }

        // Set instance properties
        this.endpoint = endpoint;
        this.tableElement = tableElement;
        this.tableFields = tableFields;
        this.formElement = formElement;
        this.log = log;
        this.tableClasses = tableClasses;
        this.searchElement = searchElement;
        this.searchParam = searchParam;
        this.pageSizeParam = pageSizeParam;
        this.pageNumberParam = pageNumberParam;
        this.pageSize = pageSize;
        this.pageIncrement = pageIncrement;
        this.pageTotalProperty = pageTotalProperty;
        this.pageNextElement = pageNextElement;
        this.pagePreviousElement = pagePreviousElement;
        this.pageStatusElement = pageStatusElement;
        this.statusElement = statusElement;
        this.deleteElement = deleteElement;
        this.createElement = createElement;
        this.idField = idField;
        this.nameField = nameField;
        this.headers = headers;
        this.preSearch = preSearch;
        this.preUpdateTable = preUpdateTable;
        this.preUpdateForm = preUpdateForm;
        this.preSave = preSave;
        this.preDelete = preDelete;
        this.postUpdateTable = postUpdateTable;
        this.postUpdateForm = postUpdateForm;
        this.postSave = postSave;
        this.postDelete = postDelete;
        this.tbody = tableElement.tBodies[0];
        this.fid = formElement.elements[idField];
        this.endpointBase = endpoint.includes('?') ? endpoint.split('?')[0] : endpoint;
        this.pageNumber = 0;
        this.pageTotal = 0;
        this._updateTable();
    }


    // ACTIONS -----------------------------------------------------------------

    /**
     * Search for items in tableElement.
     */
    async actionSearch() {
        try {
            this._updateStatus('Searching...');
            this.pageNumber = 0;
            await this._updateTable();
            this._updateStatus('');
        } catch (err) { this.log(err) }
    }

    /**
     * Show the next page of items in tableElement.
     */
    async actionNextPage() {
        try {
            this.pageNumber += this.pageIncrement;
            await this._updateTable();
        } catch (err) { this.log(err) }
    }

    /**
     * Show the previous page of items in tableElement.
     */
    async actionPreviousPage() {
        try {
            this.pageNumber -= this.pageIncrement;
            if (this.pageNumber < 0) this.pageNumber = 0;
            await this._updateTable();
        } catch (err) { this.log(err) }
    }

    /**
     * Select item with id in tableElement.
     */
    async actionSelect(id) {
        try {
            this._updateStatus('Working...');
            this._updateSelected(id);
            const item = await this._updateForm({ id });
            this._updateStatus('Editing existing item', item[this.nameField] || id);
        } catch (err) { this.log(err) }
    }

    /**
     * Delete the item selected in tableElement.
     */
    async actionDelete() {
        try {
            this._updateStatus('Working...');
            await this._deleteSelected();
            await this._updateTable();
            await this._updateForm({});
            this._updateStatus('Item deleted');
        } catch (err) { this.log(err) }
    }

    /**
     * Begin editing a new item in formElement.
     */
    async actionCreate() {
        try {
            this._updateStatus('Working...');
            this._updateSelected();
            await this._updateForm({});
            this._updateStatus('Editing new item');
        } catch (err) { this.log(err) }
    }

    /**
     * Save changes made in formElement.
     */
    async actionSave() {
        try {
            this._updateStatus('Working...');
            const item = await this._save();
            if (item) {
                await this._updateForm({ item });
                await this._updateTable();
                this._updateSelected(item[this.idField]);
                this._updateStatus('Item saved\nEditing existing item', item[this.nameField] || item[this.idField]);
            }
        } catch (err) { this.log(err) }
    }

    /**
     * Cancel unsaved changes in formElement.
     */
    async actionReset() {
        try {
            this._updateStatus('Working...');
            const item = await this._updateForm({ reload: true });
            if (item !== {}) this._updateStatus('Editing existing item', item[this.nameField] || item[this.idField]);
            else this._updateStatus('Editing new item');
        } catch (err) { this.log(err) }
    }


    // BEHAVIORS ---------------------------------------------------------------

    /**
     * Sets the class of row with id in tableElement to 'selected'.
     * All other rows will have their class reset.
     * If id is not set, no rows will be selected.
     */
    _updateSelected(id) {
        Array.from(this.tableElement.rows).map(row => {
            if (row.id === id) row.classList.add('selected');
            else row.classList.remove('selected');
        });
    }

    /**
     * Fetches results matching the current search in searchElement and updates tableElement.
     */
    async _updateTable() {
        try {
            // Support searching
            let url = this.endpoint;
            let searchValue = this.searchElement.value;

            searchValue = await this._doHook(this.preSearch, searchValue);

            // Determine query parameters
            let params = [];
            if (searchValue) params.push(this.searchParam + '=' + searchValue);
            if (this.pageSizeParam) params.push(this.pageSizeParam + '=' + this.pageSize);
            if (this.pageNumberParam) params.push(this.pageNumberParam + '=' + this.pageNumber);
            if (params.length) {
                // Support endpoints with other query parameters
                url += url.includes('?') ? '&' : '?';
                url += params.join('&');
            }

            let data = await this.fetchJSON(url, { headers: this.headers }, { array: true, count: true });

            data = await this._doHook(this.preUpdateTable, data);

            // Update table
            this.tbody.innerHTML = '';
            for (let item of data) {
                let tr = document.createElement('tr');
                tr.id = item[this.idField];
                tr.addEventListener("click", this.actionSelect.bind(this, tr.id));

                for (let col = 0; col < this.tableFields.length; col++) {
                    let td = document.createElement('td');
                    td.innerText = RESTeasy.deepFind(item, this.tableFields[col]);
                    if (this.tableClasses.length > col) td.className = this.tableClasses[col];
                    tr.appendChild(td);
                }
                this.tbody.appendChild(tr);
            }

            await this._doHook(this.postUpdateTable, data);

            // Update pagination status
            if (this.pageTotal) {
                let current = Math.floor(this.pageNumber / this.pageIncrement) + 1;
                let total = Math.floor(this.pageTotal / this.pageIncrement) + 1;
                this.pageStatusElement.innerText = 'Page ' + current + ' of ' + total;
                this.pageNextElement.disabled = current === total;
                this.pagePreviousElement.disabled = current === 1;
            }

        } catch (err) {
            this._updateStatus('Failed to load items', err);
            throw err;
        }
    }

    /**
     * Sets fields in formElement to match supplied item, item with id, or empty.
     * If reload is true, the current item, if any will be re-fetched.
     * Returns the item.
     */
    async _updateForm({ item, id, reload }) {
        try {
            // Support reload
            if (reload) id = this.fid.value;

            // Support find by id
            if (!item && id) {
                item = await this.fetchJSON(this.endpointBase + '/' + id, { headers: this.headers }, { first: true });
            }

            // Support reset
            if (!item) item = {};

            item = await this._doHook(this.preUpdateForm, item);

            this._writeFormFields(item);

            // Clear any errors
            this._highlightErrors({});

            await this._doHook(this.postUpdateForm, item);

            return item;

        } catch (err) {
            this._updateStatus('Failed to load item', err);
            throw err;
        }
    }

    /**
     * Creates or updates a item using values form formElement.
     * Returns the updated item if the server returns it.
     */
    async _save() {
        try {
            // Determine method and URL for create/update
            let method = 'POST';
            let url = this.endpointBase;
            if (this.fid.value) {
                method = 'PUT';
                url += '/' + this.fid.value;
            }

            let data = this._readFormFields();

            data = await this._doHook(this.preSave, data);

            let result;
            try {
                result = await this.fetchJSON(url, {
                    headers: this.headers,
                    method,
                    body: JSON.stringify(data)
                }, { first: true });
            } catch (err) {
                this._highlightErrors(err.errors || err.error || err);
                throw err;
            }

            await this._doHook(this.postSave, result);

            return result;

        } catch (err) {
            this._updateStatus('Item not saved', err);
            throw err;
        }
    }

    /**
     * Deletes the selected item.
     */
    async _deleteSelected() {
        try {

            const id = await this._doHook(this.preDelete, this.fid.value);

            if (!id) throw 'Nothing selected'; // NEVER DELETE endpoint/

            const url = this.endpointBase + '/' + id;

            let data = await this.fetchJSON(url, { headers: this.headers, method: 'DELETE' }, { first: true });

            await this._doHook(this.postDelete, data);

        } catch (err) {
            this._updateStatus('Item not deleted', err);
            throw err;
        }
    }

    /**
     * Set's the text content of statusElement to match status.
     */
    _updateStatus(text, status) {
        this.log(text, status);
        let msg = text;
        if (status) {
            if (typeof status === 'object' && status.message) status = status.message;
            else if (typeof status === 'object' && status.statusMessage) status = status.statusMessage;
            else if (typeof status !== 'string') status = JSON.stringify(val, null, 2);
            msg += ':\n' + status;
        }
        this.statusElement.innerText = msg;
    }

    /**
     * Highlights erroneous fields in formElement.
     */
    _highlightErrors(errors) {
        const elements = this.formElement.elements;
        for (let field of elements) {
            let match = errors.hasOwnProperty(field.name);
            if (match) field.classList.add('invalidField');
            else field.classList.remove('invalidField');
        }
    }

    /**
     * Set's formElement's fields to match obj.
     */
    _writeFormFields(obj) {
        const elements = this.formElement.elements;
        for (let field of elements) {
            let val = RESTeasy.deepFind(obj, field.name);
            if (field.name) {
                // Checkbox
                if (field.type === 'checkbox') {
                    field.checked = val ? true : false;
                }
                // Date
                else if (field.type === 'date') {
                    field.value = val ? RESTeasy.htmlDate(val) : '';
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
                    else value = (val === undefined || val === null) ? '' : val;
                    field.value = value;
                    field.placeholder = value;
                }
            }
        }
    }

    /**
     * Returns an object containing all values from formElement's inputs.
     */
    _readFormFields() {
        let obj = {};
        const elements = this.formElement.elements;
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
            obj = RESTeasy.deepSet(obj, field.name, value);
        }
        return obj;
    }

    /**
     * Executes hook with data if it is a , otherwise returns data.
     * Returns the result of the hook, or data if nothing is returned.
     * Failed hooks will be caught and logged, data will be returned.
     */
    async _doHook(hook, data) {
        try {
            if (typeof hook === 'function') return await hook(data) || data;
            else return data;
        } catch (err) {
            log('Exception thrown by hook:\n', err);
            throw err;
        }
    }


    // UTILITIES ---------------------------------------------------------------

    async fetchJSON(url, options, { array, first, count }) {
        const response = await fetch(url, options);

        let data = {};

        // Support 204 (no content) when no results
        if (response.status === 204) return array ? [] : undefined;

        data = await response.json();

        // Check for HTTP error
        if (!response.ok) throw data;

        // Update page total if needed
        if (count && this.pageTotalProperty && typeof data === 'object') {
            this.pageTotal = RESTeasy.deepFind(data, this.pageTotalProperty) || 0;
        }

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

    /**
     * Gets value from obj at path.
     * Path can be shallow or deep
     * e.g. obj[a] or obj[a[b]]
     */
    static deepFind(obj, path) {
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
    static deepSet(obj, path, value) {
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
    static htmlDate(str) {
        const date = new Date(str);
        const d = ("0" + date.getDate()).slice(-2);
        const m = ("0" + (date.getMonth() + 1)).slice(-2);
        const y = date.getFullYear();
        return y + "-" + m + "-" + d;
    }
}