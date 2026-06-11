/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HealthDataStore } from "../types";

const DB_NAME = "MyHealthSyncDB";
const DB_VERSION = 1;
const STORE_NAME = "health_cache";
const CACHE_KEY = "health_data_payload";

/**
 * Initializes the browser IndexedDB connection.
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

/**
 * Saves the entire health data store payload inside IndexedDB cache.
 */
export async function saveHealthData(data: HealthDataStore): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(data, CACHE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to write health data cache to IndexedDB:", err);
  }
}

/**
 * Loads cached health records from IndexedDB.
 */
export async function loadHealthData(): Promise<HealthDataStore | null> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(CACHE_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (err) {
    console.error("Failed to fetch health data cache from IndexedDB:", err);
    return null;
  }
}

/**
 * Clears the IndexedDB cache when user disconnects.
 */
export async function clearHealthData(): Promise<void> {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(CACHE_KEY);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.error("Failed to wipe health database from IndexedDB:", err);
  }
}
