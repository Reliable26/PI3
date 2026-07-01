import { nowIso } from './utils.js';

export function createHealthRecord({ connectorId, connectorName, status, startedAt, itemsRetrieved = 0, commercialMatches = 0, residentialFiltered = 0, opportunitiesCreated = 0, errors = [] }) {
  const finishedAt = nowIso();
  return {
    connectorId,
    connectorName,
    status,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    itemsRetrieved,
    commercialMatches,
    residentialFiltered,
    opportunitiesCreated,
    errors
  };
}
