const assert = require('assert');
const { classifyFire, extractPropertyName, isInsideTargetTerritory } = require('../scripts/update-intelligence.js');

assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').keep, true);
assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').category, 'Multifamily Fire');
assert.strictEqual(classifyFire('Single-family house fire displaces family').keep, false);
assert.strictEqual(classifyFire('Vehicle fire on I-77').keep, false);
assert.strictEqual(extractPropertyName('Fire damages Ashley Place Apartments in Charlotte'), 'Ashley Place Apartments');
assert.strictEqual(isInsideTargetTerritory({ title: 'Apartment fire in Belgium leaves residents displaced', source: 'International News', description: 'Brussels Belgium' }), false);
assert.strictEqual(isInsideTargetTerritory({ title: 'Fire damages Ashley Place Apartments in southeast Charlotte', source: 'Charlotte Observer', description: 'Charlotte NC' }), true);
console.log('All tests passed.');
