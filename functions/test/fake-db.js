'use strict';
// Firestore tiruan di memori (subset API firebase-admin yang dipakai service.js) untuk pengujian.
function makeDb() {
  const data = {}; // { coll: { id: obj } }
  const clone = (o) => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  let auto = 0;
  const snap = (c, id) => { const v = data[c] && data[c][id]; return { id, exists: v !== undefined, data: () => clone(v), ref: docRef(c, id) }; };
  function docRef(c, id) {
    return {
      id,
      async get() { return snap(c, id); },
      async set(v, opt) { data[c] = data[c] || {}; data[c][id] = opt && opt.merge ? { ...(data[c][id] || {}), ...clone(v) } : clone(v); },
      async update(v) { if (!data[c] || data[c][id] === undefined) throw new Error('NOT_FOUND ' + c + '/' + id); data[c][id] = { ...data[c][id], ...clone(v) }; },
      async create(v) { data[c] = data[c] || {}; if (data[c][id] !== undefined) throw new Error('ALREADY_EXISTS'); data[c][id] = clone(v); },
      async delete() { if (data[c]) delete data[c][id]; },
    };
  }
  function query(c, filters) {
    return {
      where(f, op, v) { return query(c, [...filters, [f, op, v]]); },
      async get() {
        const docs = Object.keys(data[c] || {}).filter(id => filters.every(([f, op, v]) => { const x = data[c][id][f];
          return op === '==' ? x === v : op === 'in' ? v.includes(x) : op === '<' ? x < v : op === '>' ? x > v : false; })).map(id => snap(c, id));
        return { docs, size: docs.length, empty: !docs.length };
      },
    };
  }
  const db = {
    _data: data,
    collection(c) { return { ...query(c, []), doc: (id) => docRef(c, id || 'auto' + (++auto)), async add(v) { const id = 'auto' + (++auto); await docRef(c, id).set(v); return docRef(c, id); } }; },
    async runTransaction(fn) {
      const backup = clone(data); const writes = [];
      const tx = { get: (r) => r.get(), set: (r, v) => writes.push(() => r.set(v)), update: (r, v) => writes.push(() => r.update(v)) };
      try { const out = await fn(tx); for (const w of writes) await w(); return out; } catch (e) { for (const k of Object.keys(data)) delete data[k]; Object.assign(data, backup); throw e; }
    },
  };
  return db;
}
module.exports = { makeDb };
