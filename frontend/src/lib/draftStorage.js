const databaseName = 'pg-blog-drafts'
const storeName = 'drafts'

export function draftKey(userID, postID) {
  return `${userID}:${postID}`
}

function openDatabase() {
  if (!globalThis.indexedDB) return Promise.reject(new Error('IndexedDB is unavailable'))
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(databaseName, 1)
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(storeName, { keyPath: 'key' })
      store.createIndex('user_id', 'user_id', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact(mode, action) {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    let result
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    action(store, (value) => { result = value }, reject)
    transaction.oncomplete = () => { database.close(); resolve(result) }
    transaction.onerror = () => { database.close(); reject(transaction.error) }
    transaction.onabort = () => { database.close(); reject(transaction.error) }
  })
}

export async function getDraft(userID, postID) {
  return transact('readonly', (store, resolve, reject) => {
    const request = store.get(draftKey(userID, postID))
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function saveDraft(userID, postID, payload) {
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.put({ key: draftKey(userID, postID), user_id: userID, post_id: postID, payload, saved_at: Date.now() })
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteDraft(userID, postID) {
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.delete(draftKey(userID, postID))
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function deleteUserDrafts(userID) {
  return transact('readwrite', (store, resolve, reject) => {
    const request = store.index('user_id').getAllKeys(userID)
    request.onsuccess = () => {
      request.result.forEach((key) => store.delete(key))
      resolve()
    }
    request.onerror = () => reject(request.error)
  })
}
