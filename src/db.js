const DB_NAME = "basa-tractor-crm";
const DB_VERSION = 1;

const STORE_NAMES = {
  clients: "clients",
  orders: "orders",
  expenses: "expenses",
  settings: "settings",
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAMES.clients)) {
        const clientStore = db.createObjectStore(STORE_NAMES.clients, { keyPath: "id" });
        clientStore.createIndex("by_name", "name", { unique: false });
        clientStore.createIndex("by_city", "city", { unique: false });
        clientStore.createIndex("by_createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.orders)) {
        const orderStore = db.createObjectStore(STORE_NAMES.orders, { keyPath: "id" });
        orderStore.createIndex("by_clientId", "clientId", { unique: false });
        orderStore.createIndex("by_status", "status", { unique: false });
        orderStore.createIndex("by_plannedDate", "plannedDate", { unique: false });
        orderStore.createIndex("by_completedDate", "completedDate", { unique: false });
        orderStore.createIndex("by_createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.expenses)) {
        const expenseStore = db.createObjectStore(STORE_NAMES.expenses, { keyPath: "id" });
        expenseStore.createIndex("by_date", "date", { unique: false });
        expenseStore.createIndex("by_category", "category", { unique: false });
        expenseStore.createIndex("by_createdAt", "createdAt", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_NAMES.settings)) {
        db.createObjectStore(STORE_NAMES.settings, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, handler) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    Promise.resolve(handler(store, transaction))
      .then((value) => {
        transaction.oncomplete = () => resolve(value);
      })
      .catch((error) => {
        reject(error);
      });
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll(storeName) {
  return withStore(storeName, "readonly", async (store) => requestToPromise(store.getAll()));
}

export async function getById(storeName, id) {
  return withStore(storeName, "readonly", async (store) => requestToPromise(store.get(id)));
}

export async function putRecord(storeName, record) {
  return withStore(storeName, "readwrite", async (store) => requestToPromise(store.put(record)));
}

export async function deleteRecord(storeName, id) {
  return withStore(storeName, "readwrite", async (store) => requestToPromise(store.delete(id)));
}

export async function clearStore(storeName) {
  return withStore(storeName, "readwrite", async (store) => requestToPromise(store.clear()));
}

export async function bulkPut(storeName, records) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);

    records.forEach((record) => {
      store.put(record);
    });

    transaction.oncomplete = () => resolve(records);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function exportDatabase() {
  const [clients, orders, expenses, settings] = await Promise.all([
    getAll(STORE_NAMES.clients),
    getAll(STORE_NAMES.orders),
    getAll(STORE_NAMES.expenses),
    getAll(STORE_NAMES.settings),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    clients,
    orders,
    expenses,
    settings,
  };
}

export async function importDatabase(payload) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(Object.values(STORE_NAMES), "readwrite");

    Object.values(STORE_NAMES).forEach((storeName) => {
      transaction.objectStore(storeName).clear();
    });

    (payload.clients || []).forEach((client) => {
      transaction.objectStore(STORE_NAMES.clients).put(client);
    });

    (payload.orders || []).forEach((order) => {
      transaction.objectStore(STORE_NAMES.orders).put(order);
    });

    (payload.expenses || []).forEach((expense) => {
      transaction.objectStore(STORE_NAMES.expenses).put(expense);
    });

    (payload.settings || []).forEach((setting) => {
      transaction.objectStore(STORE_NAMES.settings).put(setting);
    });

    transaction.oncomplete = () => resolve(payload);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export { STORE_NAMES };
