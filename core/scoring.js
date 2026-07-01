import scoring from '../config/scoring.js';

export function scoreOpportunity(classification, event) {
  let score = scoring.base[classification.category] || 50;
  let confidence = event.confidence || 70;
  const scoreBreakdown = [{ label: classification.category, points: score }];
  if (classification.watchMatch) { score += scoring.bonuses.watchList; scoreBreakdown.push({ label: `Watch list: ${classification.watchMatch}`, points: scoring.bonuses.watchList }); }
  if (classification.inTerritory) { score += scoring.bonuses.localTerritory; scoreBreakdown.push({ label: 'Target territory', points: scoring.bonuses.localTerritory }); confidence += 5; }
  if ((event.sourceName || '').toLowerCase().includes('google news')) { confidence += 3; }
  score = Math.min(100, Math.round(score));
  confidence = Math.min(100, Math.round(confidence));
  const priority = score >= scoring.thresholds.critical ? 'Critical' : score >= scoring.thresholds.high ? 'High' : score >= scoring.thresholds.medium ? 'Medium' : 'Watch';
  return { score, confidence, priority, scoreBreakdown };
}
