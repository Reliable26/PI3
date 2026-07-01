export function scoreOpportunity(event, context) {
  let score = 20;
  const text = `${event.headline || ''} ${event.description || ''}`.toLowerCase();

  if (event.category === 'fire') score += 45;
  if (text.includes('apartment') || text.includes('multifamily')) score += 15;
  if (text.includes('commercial') || text.includes('warehouse') || text.includes('hotel') || text.includes('office')) score += 12;
  if (text.includes('2 alarm') || text.includes('3 alarm') || text.includes('working fire')) score += 10;
  if (text.includes('sprinkler') || text.includes('water damage') || text.includes('fire suppression')) score += 8;
  if (context.watchListMatch) score += 10;
  if (context.territoryMatch) score += 8;

  return Math.max(0, Math.min(100, score));
}

export function confidenceScore(event, context) {
  let confidence = event.confidence || 50;
  if (event.sourceUrl) confidence += 15;
  if (context.territoryMatch) confidence += 10;
  if (event.address) confidence += 10;
  if (context.excluded) confidence -= 40;
  return Math.max(0, Math.min(100, confidence));
}
