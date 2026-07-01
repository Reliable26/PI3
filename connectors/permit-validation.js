export async function runPermitValidationConnector() {
  return {
    connector: 'permit-intelligence',
    version: '0.1.0-research',
    status: 'RESEARCH',
    durationMs: 0,
    itemsRetrieved: 0,
    sourceResults: [
      {
        source: 'Mecklenburg / Charlotte permit portals',
        status: 'RESEARCH',
        note: 'Source validation required before production automation. This module is intentionally not marked production-ready until access method is proven.'
      }
    ],
    events: []
  };
}
