/**
 * Novera — IndexedDB Storage Engine
 * Persists EPUB binary data, metadata, reading progress, highlights, and notes.
 */

const NoveraDB = (() => {
  // Kept unchanged so existing Folio-era libraries and preferences remain available.
  const DB_NAME = 'FolioReaderDB';
  const DB_VERSION = 1;
  let dbInstance = null;

  function openDB() {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Books store
        if (!db.objectStoreNames.contains('books')) {
          const bookStore = db.createObjectStore('books', { keyPath: 'id' });
          bookStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          bookStore.createIndex('lastReadDate', 'lastReadDate', { unique: false });
          bookStore.createIndex('title', 'title', { unique: false });
        }

        // Annotations store (highlights, notes, bookmarks)
        if (!db.objectStoreNames.contains('annotations')) {
          const annStore = db.createObjectStore('annotations', { keyPath: 'id' });
          annStore.createIndex('bookId', 'bookId', { unique: false });
          annStore.createIndex('dateAdded', 'dateAdded', { unique: false });
          annStore.createIndex('type', 'type', { unique: false });
        }

        // Preferences store
        if (!db.objectStoreNames.contains('preferences')) {
          db.createObjectStore('preferences', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target.result;
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('Failed to open NoveraDB:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Generic transaction helper
  async function tx(storeName, mode, callback) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      let result;

      try {
        result = callback(store);
      } catch (err) {
        reject(err);
      }

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  return {
    // Books API
    async getAllBooks() {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('books', 'readonly');
        const store = transaction.objectStore('books');
        const books = [];
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) {
            resolve(books);
            return;
          }

          // Library cards only need metadata. Keep large EPUB binaries out of startup memory.
          const book = { ...cursor.value };
          delete book.fileData;
          books.push(book);
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
    },

    async getBook(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('books', 'readonly');
        const store = transaction.objectStore('books');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async saveBook(bookData) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('books', 'readwrite');
        const store = transaction.objectStore('books');
        const req = store.put(bookData);
        req.onsuccess = () => resolve(bookData);
        req.onerror = () => reject(req.error);
      });
    },

    async updateProgress(id, { currentCfi, progressPercent, currentChapter }) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('books', 'readwrite');
        const store = transaction.objectStore('books');
        const req = store.get(id);
        req.onsuccess = () => {
          const book = req.result;
          if (!book) return resolve(null);
          if (currentCfi !== undefined) book.currentCfi = currentCfi;
          if (progressPercent !== undefined) book.progressPercent = progressPercent;
          if (currentChapter !== undefined) book.currentChapter = currentChapter;
          book.lastReadDate = Date.now();
          store.put(book);
          resolve(book);
        };
        req.onerror = () => reject(req.error);
      });
    },

    async deleteBook(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['books', 'annotations'], 'readwrite');
        const bookStore = transaction.objectStore('books');
        const annStore = transaction.objectStore('annotations');

        bookStore.delete(id);

        // Delete all associated annotations
        const annIndex = annStore.index('bookId');
        const annReq = annIndex.getAllKeys(id);
        annReq.onsuccess = () => {
          annReq.result.forEach(k => annStore.delete(k));
        };

        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
      });
    },

    // Annotations API
    async getAnnotations(bookId) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('annotations', 'readonly');
        const store = transaction.objectStore('annotations');
        const index = store.index('bookId');
        const req = index.getAll(bookId);
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    },

    async saveAnnotation(annotation) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('annotations', 'readwrite');
        const store = transaction.objectStore('annotations');
        const req = store.put(annotation);
        req.onsuccess = () => resolve(annotation);
        req.onerror = () => reject(req.error);
      });
    },

    async deleteAnnotation(id) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction('annotations', 'readwrite');
        const store = transaction.objectStore('annotations');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    },

    // Preferences API
    async getPref(key, defaultValue = null) {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const transaction = db.transaction('preferences', 'readonly');
          const store = transaction.objectStore('preferences');
          const req = store.get(key);
          req.onsuccess = () => resolve(req.result ? req.result.value : defaultValue);
          req.onerror = () => resolve(defaultValue);
        });
      } catch (e) {
        return defaultValue;
      }
    },

    async setPref(key, value) {
      try {
        const db = await openDB();
        return new Promise((resolve) => {
          const transaction = db.transaction('preferences', 'readwrite');
          const store = transaction.objectStore('preferences');
          store.put({ key, value });
          transaction.oncomplete = () => resolve(true);
          transaction.onerror = () => resolve(false);
        });
      } catch (e) {
        return false;
      }
    }
  };
})();
