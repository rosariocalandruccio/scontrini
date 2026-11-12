// Archivio locale su IndexedDB: nessun dato lascia il dispositivo.
const NOME = 'scontrini', VERSIONE = 1;
let dbp;
function apri() {
  return dbp ??= new Promise((ok, ko) => {
    const r = indexedDB.open(NOME, VERSIONE);
    r.onupgradeneeded = () => {
      const db = r.result;
      db.createObjectStore('spese', { keyPath: 'id' }).createIndex('data', 'data');
      db.createObjectStore('impostazioni');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}
async function tx(store, modo, fn) {
  const db = await apri();
  return new Promise((ok, ko) => {
    const t = db.transaction(store, modo);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => ok(req?.result);
    t.onerror = () => ko(t.error);
  });
}
export const tutteLeSpese = () => tx('spese', 'readonly', s => s.getAll());
export const salvaSpesa = (sp) => tx('spese', 'readwrite', s => s.put(sp));
export const eliminaSpesa = (id) => tx('spese', 'readwrite', s => s.delete(id));
export const leggiImpostazione = (k) => tx('impostazioni', 'readonly', s => s.get(k));
export const scriviImpostazione = (k, v) => tx('impostazioni', 'readwrite', s => s.put(v, k));
