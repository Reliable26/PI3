const assert = require('assert');
const { classifyFire, classifyIncident, extractPropertyName, isInsideTargetTerritory, classifyPermit, normalizePermitFeature } = require('../scripts/update-intelligence.js');

assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').keep, true);
assert.strictEqual(classifyFire('Fire damages Ashley Place Apartments in Charlotte').category, 'Multifamily Fire');
assert.strictEqual(classifyFire('Single-family house fire displaces family').keep, false);
assert.strictEqual(classifyFire('Vehicle fire on I-77').keep, false);
assert.strictEqual(extractPropertyName('Fire damages Ashley Place Apartments in Charlotte'), 'Ashley Place Apartments');
assert.strictEqual(isInsideTargetTerritory({ title: 'Apartment fire in Belgium leaves residents displaced', source: 'International News', description: 'Brussels Belgium' }), false);
assert.strictEqual(isInsideTargetTerritory({ title: 'Fire damages Ashley Place Apartments in southeast Charlotte', source: 'Charlotte Observer', description: 'Charlotte NC' }), true);
assert.strictEqual(classifyIncident('Charlotte fire station closed due to mold', 'Fire Station 26 operations displaced for remediation').keep, true);
assert.strictEqual(classifyIncident('How to remove mold in your home', 'DIY mold removal tips').keep, false);

assert.strictEqual(classifyPermit({ description_of_work: 'Commercial alteration roof replacement at office building', permit_type: 'COMMERCIAL' }).keep, true);
assert.strictEqual(classifyPermit({ description_of_work: 'Commercial alteration roof replacement at office building', permit_type: 'COMMERCIAL' }).category, 'Roofing');
assert.strictEqual(classifyPermit({ description_of_work: 'Single family deck addition', permit_type: 'RESIDENTIAL' }).keep, false);
const permit = normalizePermitFeature({ attributes: { permit_number: 'B123456', description_of_work: 'Commercial alteration exterior waterproofing', issue_date: 1764547200000, project_address: '100 N TRYON ST', permit_type: 'COMMERCIAL', building_construction_cost_customer: '100000' } }, { name:'Mecklenburg Building Permits Accela', sourceUrl:'https://example.com' });
assert.strictEqual(permit.keep, true);
assert.strictEqual(permit.category, 'Waterproofing');
console.log('All tests passed.');
