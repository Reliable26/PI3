const assert = require('assert');
const { classifyFire, classifyPermit, extractPropertyName, isInsideTargetTerritory } = require('../scripts/update-intelligence.js');

assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').keep, true);
assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').category, 'Multifamily Fire');
assert.strictEqual(classifyFire('Single-family house fire displaces family').keep, false);
assert.strictEqual(classifyFire('Vehicle fire on I-77').keep, false);
assert.strictEqual(extractPropertyName('Fire damages Ashley Place Apartments in Charlotte'), 'Ashley Place Apartments');
assert.strictEqual(isInsideTargetTerritory({ title: 'Apartment fire in Belgium leaves residents displaced', source: 'International News', description: 'Brussels Belgium' }), false);
assert.strictEqual(isInsideTargetTerritory({ title: 'Fire damages Ashley Place Apartments in southeast Charlotte', source: 'Charlotte Observer', description: 'Charlotte NC' }), true);

assert.strictEqual(classifyPermit('Charlotte commercial roof permit issued for SouthPark Office Center').keep, true);
assert.strictEqual(classifyPermit('Charlotte commercial roof permit issued for SouthPark Office Center').category, 'Commercial Roof Permit');
assert.strictEqual(classifyPermit('Mecklenburg County building envelope permit for University City Apartments').category, 'Building Envelope Permit');
assert.strictEqual(classifyPermit('Single family residential pool permit issued in Charlotte').keep, false);
assert.strictEqual(classifyPermit('Fence permit for home in Charlotte').keep, false);
assert.strictEqual(isInsideTargetTerritory({ title: 'Charlotte commercial alteration permit issued', source: 'Google News', description: 'Mecklenburg County NC' }), true);

console.log('All tests passed.');
