/**
 * db.js — IndexedDB wrapper for JokeBook
 * All data lives on-device. No server, no cloud.
 */

const DB_NAME = 'JokeBookDB';
const DB_VERSION = 1;

const STORES = {
  jokes: { keyPath: 'id', indexes: ['category', 'status', 'updatedAt'] },
  versions: { keyPath: 'id', indexes: ['jokeId'] },
  performances: { keyPath: 'id', indexes: ['jokeId', 'date'] },
  setlists: { keyPath: 'id', indexes: ['date'] },
  bits: { keyPath: 'id' },
  captures: { keyPath: 'id', indexes: ['createdAt'] },
  settings: { keyPath: 'key' },
};

let dbInstance = null;

function open() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      for (const [name, config] of Object.entries(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: config.keyPath });
          if (config.indexes) {
            for (const idx of config.indexes) {
              store.createIndex(idx, idx, { unique: false });
            }
          }
        }
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    req.onerror = (e) => reject(e.target.error);
  });
}

async function tx(storeName, mode = 'readonly') {
  const db = await open();
  const transaction = db.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const DB = {
  async get(storeName, id) {
    const store = await tx(storeName);
    return reqToPromise(store.get(id));
  },

  async getAll(storeName) {
    const store = await tx(storeName);
    return reqToPromise(store.getAll());
  },

  async getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    const index = store.index(indexName);
    return reqToPromise(index.getAll(value));
  },

  async put(storeName, item) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.put(item));
  },

  async delete(storeName, id) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.delete(id));
  },

  async count(storeName) {
    const store = await tx(storeName);
    return reqToPromise(store.count());
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return reqToPromise(store.clear());
  },

  /** Get a setting value, with optional default */
  async getSetting(key, defaultValue = null) {
    const record = await this.get('settings', key);
    return record ? record.value : defaultValue;
  },

  /** Save a setting */
  async setSetting(key, value) {
    return this.put('settings', { key, value });
  },

  /** Export entire database as JSON */
  async exportAll() {
    const data = {};
    for (const name of Object.keys(STORES)) {
      data[name] = await this.getAll(name);
    }
    return data;
  },

  /** Import JSON data into database */
  async importAll(data) {
    for (const [name, items] of Object.entries(data)) {
      if (STORES[name] && Array.isArray(items)) {
        for (const item of items) {
          await this.put(name, item);
        }
      }
    }
  },

  /** Generate a unique ID */
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
};

export default DB;
