export function createHealth({ id, name, status = 'PASS', itemsRetrieved = 0, opportunitiesCreated = 0, errors = [], startedAt, finishedAt }) {
  const start = startedAt ? new Date(startedAt).getTime() : Date.now();
  const finish = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  return { id, name, status, itemsRetrieved, opportunitiesCreated, errors, durationMs: Math.max(0, finish - start), lastRun: new Date().toISOString() };
}

export function createOpportunity(input) {
  return {
    opportunityId: input.opportunityId,
    propertyName: input.propertyName || 'Needs property match',
    address: input.address || '',
    county: input.county || 'Needs review',
    propertyType: input.propertyType || 'Needs review',
    owner: input.owner || 'Needs verification',
    managementCompany: input.managementCompany || 'Needs verification',
    category: input.category,
    opportunityScore: input.opportunityScore || 0,
    confidenceScore: input.confidenceScore || 0,
    relationshipScore: input.relationshipScore || 0,
    whatChanged: input.whatChanged || '',
    whyThisMatters: input.whyThisMatters || '',
    recommendedServices: input.recommendedServices || [],
    reasonMatrix: input.reasonMatrix || [],
    sources: input.sources || [],
    firstSeen: input.firstSeen || new Date().toISOString(),
    lastVerified: input.lastVerified || new Date().toISOString(),
    status: input.status || 'Needs Review'
  };
}
