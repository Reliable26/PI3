import { classifyFireEvent, extractPropertyName, normalizeTitle } from './src/fire-intelligence.js';
const tests=[];function t(name,fn){tests.push({name,fn});}
t('excludes vehicle fire',()=>classifyFireEvent({title:'Vehicle fire on I-77 in Charlotte'}).include===false);
t('excludes house fire',()=>classifyFireEvent({title:'Family displaced after house fire in Charlotte'}).include===false);
t('includes apartment fire',()=>classifyFireEvent({title:'Fire damages Ashley Place Apartments in southeast Charlotte'}).include===true);
t('classifies apartment fire as multifamily',()=>classifyFireEvent({title:'2 hurt after crews battle 2-alarm apartment fire in east Charlotte'}).category==='FIRE_MULTIFAMILY');
t('extracts named apartments',()=>extractPropertyName(normalizeTitle('Fire damages Ashley Place Apartments in southeast Charlotte; no injuries reported'))==='Ashley Place Apartments');
let failed=0;for(const x of tests){try{if(!x.fn()){console.error('FAIL',x.name);failed++;}else console.log('PASS',x.name);}catch(e){console.error('ERROR',x.name,e);failed++;}}
if(failed){process.exit(1);}console.log(`${tests.length} tests passed`);
