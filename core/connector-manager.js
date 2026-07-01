import { runGoogleNewsFireConnector } from '../connectors/google-news-fire.js';
import { runPermitValidationConnector } from '../connectors/permit-validation.js';

export async function runConnectors() {
  const connectors = [runGoogleNewsFireConnector, runPermitValidationConnector];
  const results = [];
  for (const connector of connectors) {
    try {
      results.push(await connector());
    } catch (err) {
      results.push({ connector: connector.name, status: 'ERROR', error: String(err.message || err), events: [], sourceResults: [] });
    }
  }
  return results;
}
