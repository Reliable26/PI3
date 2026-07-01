const assert = require('assert');
const { classifyFire, extractPropertyName, isInsideTargetTerritory, classifyPermit, normalizePermitFeature } = require('../scripts/update-intelligence.js');

assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').keep, true);
assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').category, 'Multifamily Fire');
assert.strictEqual(classifyFire('Single-family house fire displaces family').keep, false);
assert.strictEqual(classifyFire('Vehicle fire on I-77').keep, false);
assert.strictEqual(extractPropertyName('Fire damages Ashley Place Apartments in Charlotte'), 'Ashley Place Apartments');
assert.strictEqual(isInsideTargetTerritory({ title: 'Apartment fire in Belgium leaves residents displaced', source: 'International News', description: 'Brussels Belgium' }), false);
assert.strictEqual(isInsideTargetTerritory({ title: 'Fire damages Ashley Place Apartments in southeast Charlotte', source: 'Charlotte Observer', description: 'Charlotte NC' }), true);

assert.strictEqual(classifyPermit({ Descriptio: 'Commercial alteration roof replacement at office building', ProposedUs: 'COMM' }).keep, true);
assert.strictEqual(classifyPermit({ Descriptio: 'Commercial alteration roof replacement at office building', ProposedUs: 'COMM' }).category, 'Roofing');
assert.strictEqual(classifyPermit({ Descriptio: 'Single family deck addition', ProposedUs: 'RES' }).keep, false);
const permit = normalizePermitFeature({ attributes: { CaseNumber: 'B123456', Descriptio: 'Commercial alteration exterior waterproofing', IssuedDate: 1764547200000, Address: '100 N TRYON ST', ProposedUs: 'COMM', Cost: 100000 } }, { name:'Mecklenburg Building Permits ArcGIS', sourceUrl:'https://example.com' });
assert.strictEqual(permit.keep, true);
assert.strictEqual(permit.category, 'Waterproofing');
console.log('All tests passed.');
