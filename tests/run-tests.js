import { classifyEvent } from '../core/classifier.js';

const cases = [
  { name: 'Apartment fire accepted', headline: 'Crews respond to apartment fire in Charlotte', expect: true },
  { name: 'Commercial fire accepted', headline: 'Working fire at commercial building in Charlotte', expect: true },
  { name: 'Hotel fire accepted', headline: 'Smoke reported during hotel fire in Charlotte', expect: true },
  { name: 'House fire rejected', headline: 'Family displaced after house fire in Charlotte', expect: false },
  { name: 'Vehicle fire rejected', headline: 'Vehicle fire blocks I-77 in Charlotte', expect: false },
  { name: 'Dumpster fire rejected', headline: 'Dumpster fire reported behind store in Charlotte', expect: false }
];
let failures = 0;
for (const c of cases) {
  const result = classifyEvent({ headline: c.headline, description: '', sourceName: 'Test', confidence: 90 });
  const pass = result.accepted === c.expect;
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.name}`);
  if (!pass) { failures++; console.log(result); }
}
if (failures) process.exit(1);
console.log('All PI tests passed.');
