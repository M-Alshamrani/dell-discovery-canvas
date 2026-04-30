// migrations/helpers/collection.js — v3.0 · MIGRATION sec M9
//
// Helpers for converting v2.x flat arrays into v3.0 Collection<T>
// shape `{byId, allIds}` with optional secondary indexes.

export function toCollection(arr) {
  const byId = Object.create(null);
  const allIds = [];
  for (const item of arr) {
    if (!item || !item.id) continue;
    byId[item.id] = item;
    allIds.push(item.id);
  }
  return { byId, allIds };
}

// Specialized for instances which have a byState secondary index.
export function toInstancesCollection(arr) {
  const byId = Object.create(null);
  const allIds = [];
  const byState = { current: [], desired: [] };
  for (const item of arr) {
    if (!item || !item.id) continue;
    byId[item.id] = item;
    allIds.push(item.id);
    if (item.state === "current") byState.current.push(item.id);
    else if (item.state === "desired") byState.desired.push(item.id);
  }
  return { byId, allIds, byState };
}
