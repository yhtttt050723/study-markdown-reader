const DB_NAME = 'video-dash-fs'
const STORE = 'handles'
const KEY_STUDY = 'studyVideoProgressDir'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export async function saveStudyVideoDirHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(handle, KEY_STUDY)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function loadStudyVideoDirHandle(): Promise<
  FileSystemDirectoryHandle | undefined
> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(KEY_STUDY)
    req.onsuccess = () =>
      resolve(req.result as FileSystemDirectoryHandle | undefined)
    req.onerror = () => reject(req.error)
  })
}

export async function clearStudyVideoDirHandle(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(KEY_STUDY)
    tx.oncomplete = () => res()
    tx.onerror = () => rej(tx.error)
  })
}

export async function ensureDirWritable(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const q = await handle.queryPermission({ mode: 'readwrite' })
  if (q === 'granted') return true
  const r = await handle.requestPermission({ mode: 'readwrite' })
  return r === 'granted'
}
