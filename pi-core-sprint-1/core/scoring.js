export function scoreEvent(event, rules) {
  const text = `${event.headline || ''} ${event.description || ''}`.toLowerCase();
  const reasonMatrix = [];
  let score = 40;
  let confidence = event.confidence || 60;
  let relationship = 50;

  if (text.includes('apartment') || text.includes('multifamily')) { score += 20; relationship += 15; reasonMatrix.push(['Multifamily signal', 20]); }
  if (text.includes('commercial') || text.includes('warehouse') || text.includes('hotel') || text.includes('office')) { score += 20; relationship += 10; reasonMatrix.push(['Commercial property signal', 20]); }
  if (text.includes('fire') || text.includes('smoke')) { score += 30; reasonMatrix.push(['Fire or smoke signal', 30]); }
  if (text.includes('water') || text.includes('sprinkler')) { score += 15; reasonMatrix.push(['Water mitigation signal', 15]); }
  if (rules.watchCompanies.some(c => text.includes(c.toLowerCase()))) { score += 15; relationship += 20; reasonMatrix.push(['Watch company signal', 15]); }
  if (event.sourceUrl) { confidence += 10; reasonMatrix.push(['Public source link', 10]); }
  if (event.address) { confidence += 15; reasonMatrix.push(['Address present', 15]); }

  return {
    opportunityScore: Math.min(100, score),
    confidenceScore: Math.min(100, confidence),
    relationshipScore: Math.min(100, relationship),
    reasonMatrix
  };
}
