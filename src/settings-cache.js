// In-memory cache for diskdb collections that are read on the hot
// per-segment streaming path but written rarely (settings-like data).
// diskdb's find() does a synchronous file read + JSON.parse on every call
// with no caching of its own, so repeated reads here were blocking the
// event loop on every stream transition. Safe to cache because this
// process is the only writer of these collections.
const cache = {};

function getAll(db, collection) {
    if (!(collection in cache)) {
        cache[collection] = db[collection].find();
    }
    return cache[collection];
}

function invalidate(collection) {
    delete cache[collection];
}

module.exports = { getAll, invalidate };
