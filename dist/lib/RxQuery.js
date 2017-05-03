'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

exports.create = create;

var _deepEqual = require('deep-equal');

var _deepEqual2 = _interopRequireDefault(_deepEqual);

var _mquery = require('./mquery/mquery');

var _mquery2 = _interopRequireDefault(_mquery);

var _util = require('./util');

var util = _interopRequireWildcard(_util);

var _RxDocument = require('./RxDocument');

var RxDocument = _interopRequireWildcard(_RxDocument);

var _QueryChangeDetector = require('./QueryChangeDetector');

var QueryChangeDetector = _interopRequireWildcard(_QueryChangeDetector);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultQuery = {
    _id: {}
};

var _queryCount = 0;
var newQueryID = function newQueryID() {
    return ++_queryCount;
};

var RxQuery = function () {
    function RxQuery(op) {
        var queryObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultQuery;
        var collection = arguments[2];

        _classCallCheck(this, RxQuery);

        this.op = op;
        this.collection = collection;
        this.defaultQuery = false;
        this.id = newQueryID();

        // force _id
        if (!queryObj._id) queryObj._id = {};

        this.mquery = new _mquery2.default(queryObj);

        this._queryChangeDetector = QueryChangeDetector.create(this);
        this._resultsData = null;
        this._results$ = new util.Rx.BehaviorSubject(null);
        this._observable$ = null;
        this._latestChangeEvent = -1;
        this._runningPromise = Promise.resolve(true);

        /**
         * if this is true, the results-state is not equal to the database
         * which means that the query must run agains the database again
         * @type {Boolean}
         */
        this._mustReExec = true;

        /**
         * counts how often the execution on the whole db was done
         * (used for tests and debugging)
         * @type {Number}
         */
        this._execOverDatabaseCount = 0;
    }

    // returns a clone of this RxQuery


    _createClass(RxQuery, [{
        key: '_clone',
        value: function _clone() {
            var cloned = new RxQuery(this.op, defaultQuery, this.collection);
            cloned.mquery = this.mquery.clone();
            return cloned;
        }

        /**
         * run this query through the QueryCache
         * @return {RxQuery} can be this or another query with the equal state
         */

    }, {
        key: '_tunnelQueryCache',
        value: function _tunnelQueryCache() {
            return this.collection._queryCache.getByQuery(this);
        }
    }, {
        key: 'toString',
        value: function toString() {
            if (!this.stringRep) {
                var stringObj = util.sortObject({
                    op: this.op,
                    options: this.mquery.options,
                    _conditions: this.mquery._conditions,
                    _path: this.mquery._path,
                    _fields: this.mquery._fields
                }, true);
                this.stringRep = JSON.stringify(stringObj);
            }
            return this.stringRep;
        }

        /**
         * ensures that the results of this query is equal to the results which a query over the database would give
         * @return {Promise<boolean>} true if results have changed
         */

    }, {
        key: '_ensureEqual',
        value: function () {
            var _ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
                var ret, resolve, missedChangeEvents, runChangeEvents, changeResult, latestAfter, newResultData;
                return regeneratorRuntime.wrap(function _callee$(_context) {
                    while (1) {
                        switch (_context.prev = _context.next) {
                            case 0:
                                if (!(this._latestChangeEvent >= this.collection._changeEventBuffer.counter)) {
                                    _context.next = 2;
                                    break;
                                }

                                return _context.abrupt('return', false);

                            case 2:
                                ret = false;

                                // make sure it does not run in parallel

                                _context.next = 5;
                                return this._runningPromise;

                            case 5:

                                // console.log('_ensureEqual(' + this.toString() + ') '+ this._mustReExec);

                                resolve = void 0;

                                this._runningPromise = new Promise(function (res) {
                                    resolve = res;
                                });

                                if (!this._mustReExec) {
                                    try {
                                        missedChangeEvents = this.collection._changeEventBuffer.getFrom(this._latestChangeEvent + 1);
                                        // console.dir(missedChangeEvents);

                                        this._latestChangeEvent = this.collection._changeEventBuffer.counter;
                                        runChangeEvents = this.collection._changeEventBuffer.reduceByLastOfDoc(missedChangeEvents);
                                        changeResult = this._queryChangeDetector.runChangeDetection(runChangeEvents);

                                        if (!Array.isArray(changeResult) && changeResult) this._mustReExec = true;
                                        if (Array.isArray(changeResult) && !(0, _deepEqual2.default)(changeResult, this._resultsData)) {
                                            ret = true;
                                            this._setResultData(changeResult);
                                        }
                                    } catch (e) {
                                        console.error('RxQuery()._ensureEqual(): Unexpected Error:');
                                        console.dir(e);
                                        this._mustReExec = true;
                                    }
                                }

                                if (!this._mustReExec) {
                                    _context.next = 15;
                                    break;
                                }

                                // counter can change while _execOverDatabase() is running
                                latestAfter = this.collection._changeEventBuffer.counter;
                                _context.next = 12;
                                return this._execOverDatabase();

                            case 12:
                                newResultData = _context.sent;

                                this._latestChangeEvent = latestAfter;
                                if (!(0, _deepEqual2.default)(newResultData, this._resultsData)) {
                                    ret = true;
                                    this._setResultData(newResultData);
                                }

                            case 15:

                                // console.log('_ensureEqual DONE (' + this.toString() + ')');

                                resolve(true);
                                return _context.abrupt('return', ret);

                            case 17:
                            case 'end':
                                return _context.stop();
                        }
                    }
                }, _callee, this);
            }));

            function _ensureEqual() {
                return _ref.apply(this, arguments);
            }

            return _ensureEqual;
        }()
    }, {
        key: '_setResultData',
        value: function _setResultData(newResultData) {
            this._resultsData = newResultData;
            var newResults = this.collection._createDocuments(this._resultsData);
            this._results$.next(newResults);
        }

        /**
         * executes the query on the database
         * @return {Promise<{}[]>} returns new resultData
         */

    }, {
        key: '_execOverDatabase',
        value: function () {
            var _ref2 = _asyncToGenerator(regeneratorRuntime.mark(function _callee2() {
                var docsData, ret;
                return regeneratorRuntime.wrap(function _callee2$(_context2) {
                    while (1) {
                        switch (_context2.prev = _context2.next) {
                            case 0:
                                this._execOverDatabaseCount++;
                                docsData = void 0, ret = void 0;
                                _context2.t0 = this.op;
                                _context2.next = _context2.t0 === 'find' ? 5 : _context2.t0 === 'findOne' ? 9 : 13;
                                break;

                            case 5:
                                _context2.next = 7;
                                return this.collection._pouchFind(this);

                            case 7:
                                docsData = _context2.sent;
                                return _context2.abrupt('break', 14);

                            case 9:
                                _context2.next = 11;
                                return this.collection._pouchFind(this, 1);

                            case 11:
                                docsData = _context2.sent;
                                return _context2.abrupt('break', 14);

                            case 13:
                                throw new Error('RxQuery.exec(): op (' + this.op + ') not known');

                            case 14:

                                this._mustReExec = false;
                                return _context2.abrupt('return', docsData);

                            case 16:
                            case 'end':
                                return _context2.stop();
                        }
                    }
                }, _callee2, this);
            }));

            function _execOverDatabase() {
                return _ref2.apply(this, arguments);
            }

            return _execOverDatabase;
        }()
    }, {
        key: 'toJSON',
        value: function toJSON() {
            var _this = this;

            if (this._toJSON) return this._toJSON;

            var json = {
                selector: this.mquery._conditions
            };

            var options = this.mquery._optionsForExec();

            // sort
            if (options.sort) {
                var sortArray = [];
                Object.keys(options.sort).map(function (fieldName) {
                    var dirInt = options.sort[fieldName];
                    var dir = 'asc';
                    if (dirInt == -1) dir = 'desc';
                    var pushMe = {};
                    // TODO run primary-swap somewhere else
                    if (fieldName == _this.collection.schema.primaryPath) fieldName = '_id';

                    pushMe[fieldName] = dir;
                    sortArray.push(pushMe);
                });
                json.sort = sortArray;
            } else {
                // sort by primaryKey as default
                json.sort = [_defineProperty({}, this.collection.schema.primaryPath, 'asc')];
            }

            if (options.limit) {
                if (typeof options.limit !== 'number') throw new TypeError('limit() must get a number');
                json.limit = options.limit;
            }

            if (options.skip) {
                if (typeof options.skip !== 'number') throw new TypeError('skip() must get a number');
                json.skip = options.skip;
            }

            // add not-query to _id to prevend the grabbing of '_design..' docs
            // this is not the best solution because it prevents the usage of a 'language'-field
            if (!json.selector.language) json.selector.language = {};
            json.selector.language.$ne = 'query';

            // primary swap
            if (this.collection.schema.primaryPath && json.selector[this.collection.schema.primaryPath]) {
                var primPath = this.collection.schema.primaryPath;

                // selector
                json.selector._id = json.selector[primPath];

                if (primPath !== '_id' || Object.keys(json.selector[primPath]).length == 0) delete json.selector[primPath];
            }

            this._toJSON = json;
            return this._toJSON;
        }
    }, {
        key: 'keyCompress',


        /**
         * get the key-compression version of this query
         * @return {{selector: {}, sort: []}} compressedQuery
         */
        value: function keyCompress() {
            return this.collection._keyCompressor.compressQuery(this.toJSON());
        }

        /**
         * deletes all found documents
         * @return {Promise(RxDocument|RxDocument[])} promise with deleted documents
         */

    }, {
        key: 'remove',
        value: function () {
            var _ref4 = _asyncToGenerator(regeneratorRuntime.mark(function _callee3() {
                var docs;
                return regeneratorRuntime.wrap(function _callee3$(_context3) {
                    while (1) {
                        switch (_context3.prev = _context3.next) {
                            case 0:
                                _context3.next = 2;
                                return this.exec();

                            case 2:
                                docs = _context3.sent;

                                if (!Array.isArray(docs)) {
                                    _context3.next = 8;
                                    break;
                                }

                                _context3.next = 6;
                                return Promise.all(docs.map(function (doc) {
                                    return doc.remove();
                                }));

                            case 6:
                                _context3.next = 10;
                                break;

                            case 8:
                                _context3.next = 10;
                                return docs.remove();

                            case 10:
                                return _context3.abrupt('return', docs);

                            case 11:
                            case 'end':
                                return _context3.stop();
                        }
                    }
                }, _callee3, this);
            }));

            function remove() {
                return _ref4.apply(this, arguments);
            }

            return remove;
        }()
    }, {
        key: 'exec',
        value: function () {
            var _ref5 = _asyncToGenerator(regeneratorRuntime.mark(function _callee4() {
                return regeneratorRuntime.wrap(function _callee4$(_context4) {
                    while (1) {
                        switch (_context4.prev = _context4.next) {
                            case 0:
                                _context4.next = 2;
                                return this.$.first().toPromise();

                            case 2:
                                return _context4.abrupt('return', _context4.sent);

                            case 3:
                            case 'end':
                                return _context4.stop();
                        }
                    }
                }, _callee4, this);
            }));

            function exec() {
                return _ref5.apply(this, arguments);
            }

            return exec;
        }()

        /**
         * regex cannot run on primary _id
         * @link https://docs.cloudant.com/cloudant_query.html#creating-selector-expressions
         */

    }, {
        key: 'regex',
        value: function regex(params) {
            if (this.mquery._path == this.collection.schema.primaryPath) throw new Error('You cannot use .regex() on the primary field \'' + this.mquery._path + '\'');

            this.mquery.regex(params);
            return this;
        }
    }, {
        key: 'sort',


        /**
         * make sure it searches index because of pouchdb-find bug
         * @link https://github.com/nolanlawson/pouchdb-find/issues/204
         */
        value: function sort(params) {
            var clonedThis = this._clone();

            // workarround because sort wont work on unused keys
            if ((typeof params === 'undefined' ? 'undefined' : _typeof(params)) !== 'object') {
                var checkParam = params.charAt(0) == '-' ? params.substring(1) : params;
                if (!clonedThis.mquery._conditions[checkParam]) {
                    var schemaObj = clonedThis.collection.schema.getSchemaByObjectPath(checkParam);
                    if (schemaObj && schemaObj.type == 'integer')
                        // TODO change back to -Infinity when issue resolved
                        // @link https://github.com/pouchdb/pouchdb/issues/6454
                        clonedThis.mquery.where(checkParam).gt(-9999999999999999999999999999); // -Infinity does not work since pouchdb 6.2.0
                    else clonedThis.mquery.where(checkParam).gt(null);
                }
            } else {
                Object.keys(params).filter(function (k) {
                    return !clonedThis.mquery._conditions[k] || !clonedThis.mquery._conditions[k].$gt;
                }).forEach(function (k) {
                    var schemaObj = clonedThis.collection.schema.getSchemaByObjectPath(k);
                    if (schemaObj.type == 'integer')
                        // TODO change back to -Infinity when issue resolved
                        // @link https://github.com/pouchdb/pouchdb/issues/6454
                        clonedThis.mquery.where(k).gt(-9999999999999999999999999999); // -Infinity does not work since pouchdb 6.2.0

                    else clonedThis.mquery.where(k).gt(null);
                });
            }
            clonedThis.mquery.sort(params);
            return clonedThis._tunnelQueryCache();
        }
    }, {
        key: 'limit',
        value: function limit(amount) {
            if (this.op == 'findOne') throw new Error('.limit() cannot be called on .findOne()');else {
                var clonedThis = this._clone();
                clonedThis.mquery.limit(amount);
                return clonedThis._tunnelQueryCache();
            }
        }
    }, {
        key: '$',
        get: function get() {
            var _this2 = this;

            if (!this._observable$) {

                var res$ = this._results$.mergeMap(function () {
                    var _ref6 = _asyncToGenerator(regeneratorRuntime.mark(function _callee5(results) {
                        var hasChanged;
                        return regeneratorRuntime.wrap(function _callee5$(_context5) {
                            while (1) {
                                switch (_context5.prev = _context5.next) {
                                    case 0:
                                        _context5.next = 2;
                                        return _this2._ensureEqual();

                                    case 2:
                                        hasChanged = _context5.sent;

                                        if (!hasChanged) {
                                            _context5.next = 5;
                                            break;
                                        }

                                        return _context5.abrupt('return', 'WAITFORNEXTEMIT');

                                    case 5:
                                        return _context5.abrupt('return', results);

                                    case 6:
                                    case 'end':
                                        return _context5.stop();
                                }
                            }
                        }, _callee5, _this2);
                    }));

                    return function (_x2) {
                        return _ref6.apply(this, arguments);
                    };
                }()).filter(function (results) {
                    return results != 'WAITFORNEXTEMIT';
                }).asObservable();

                var changeEvents$ = this.collection.$.filter(function (cEvent) {
                    return ['INSERT', 'UPDATE', 'REMOVE'].includes(cEvent.data.op);
                }).mergeMap(function () {
                    var _ref7 = _asyncToGenerator(regeneratorRuntime.mark(function _callee6(changeEvent) {
                        return regeneratorRuntime.wrap(function _callee6$(_context6) {
                            while (1) {
                                switch (_context6.prev = _context6.next) {
                                    case 0:
                                        return _context6.abrupt('return', _this2._ensureEqual());

                                    case 1:
                                    case 'end':
                                        return _context6.stop();
                                }
                            }
                        }, _callee6, _this2);
                    }));

                    return function (_x3) {
                        return _ref7.apply(this, arguments);
                    };
                }()).filter(function () {
                    return false;
                });

                this._observable$ = util.Rx.Observable.merge(res$, changeEvents$).filter(function (x) {
                    return x != null;
                }).map(function (results) {
                    if (_this2.op != 'findOne') return results;else if (results.length == 0) return null;else return results[0];
                });
            }
            return this._observable$;
        }
    }]);

    return RxQuery;
}();

// tunnel the proto-functions of mquery to RxQuery


var protoMerge = function protoMerge(rxQueryProto, mQueryProto) {
    Object.keys(mQueryProto).filter(function (attrName) {
        return !attrName.startsWith('_');
    }).filter(function (attrName) {
        return !rxQueryProto[attrName];
    }).forEach(function (attrName) {
        rxQueryProto[attrName] = function (p1) {
            var clonedThis = this._clone();
            clonedThis.mquery[attrName](p1);
            return clonedThis._tunnelQueryCache();
        };
    });
};

var protoMerged = false;
function create(op) {
    var queryObj = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultQuery;
    var collection = arguments[2];

    if ((typeof queryObj === 'undefined' ? 'undefined' : _typeof(queryObj)) !== 'object') throw new TypeError('query must be an object');
    if (Array.isArray(queryObj)) throw new TypeError('query cannot be an array');

    var ret = new RxQuery(op, queryObj, collection);

    if (!protoMerged) {
        protoMerged = true;
        protoMerge(Object.getPrototypeOf(ret), Object.getPrototypeOf(ret.mquery));
    }

    return ret;
}
