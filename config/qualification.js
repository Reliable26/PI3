export const qualificationConfig = {
  emergencyMaxAgeHours: 72,
  standardMaxAgeDays: 14,
  strategicMaxAgeDays: 30,
  commercialTerms: [
    'apartment', 'apartments', 'multifamily', 'multi-family', 'hotel', 'motel', 'extended stay',
    'warehouse', 'industrial', 'office', 'retail', 'shopping center', 'mall', 'medical', 'hospital',
    'assisted living', 'skilled nursing', 'school', 'university', 'college', 'business', 'commercial',
    'restaurant', 'store', 'plant', 'facility', 'complex'
  ],
  residentialRejectTerms: [
    'single-family', 'single family', 'home fire', 'house fire', 'mobile home', 'townhome', 'townhouse',
    'duplex', 'condo unit', 'residential structure', 'garage fire', 'shed fire'
  ],
  nonTargetRejectTerms: [
    'church', 'synagogue', 'mosque', 'temple', 'ministry', 'parish', 'cathedral', 'state government',
    'federal government', 'federal courthouse', 'state agency'
  ],
  businessSignalTerms: [
    'fire', 'smoke', 'water damage', 'sprinkler', 'suppression', 'roof', 'renovation', 'restoration',
    'mold', 'biohazard', 'water intrusion', 'building envelope', 'exterior', 'permit', 'acquisition',
    'sold', 'financing', 'management change'
  ],
  eventPrefixes: [
    'fire damages', 'fire destroys', 'fire at', 'blaze at', 'blaze damages', 'commercial fire at',
    'apartment fire at', '2-alarm fire at', '3-alarm fire at', 'two-alarm fire at', 'three-alarm fire at',
    'crews battle fire at', 'firefighters respond to fire at', 'fire reported at', 'explosion at',
    'water main break at', 'roof collapse at'
  ]
};
