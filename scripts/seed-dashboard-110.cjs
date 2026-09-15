// Synthetic development data only. Uses the authenticated local PS4/110 proxy.
// Commands: plan, pilot, load, verify, retire-old. No production requests are made.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../.local-data/seed-110');
const base = 'http://localhost:8080/sap/opu/odata/ngr/OD_PS_TRACKER_SRV/';
const entity = 'xNGRxCDS_PS_MASTER';
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, ''));
const save = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
const marker = 'SYNTHETIC-110-20260914';
const day = 86400000, end = Date.UTC(2026, 8, 14);
const date = stamp => '/Date(' + stamp + ')/';
let randomState = 9142026;
const random = () => ((randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = values => values[Math.floor(random() * values.length)];
let csrf, cookies;
async function request(resource, method = 'GET', body) {
    const url = new URL(resource, base);
    assert.equal(url.origin, 'http://localhost:8080');
    assert.ok(url.pathname.startsWith('/sap/opu/odata/ngr/OD_PS_TRACKER_SRV/'));
    url.searchParams.set('sap-client', '110'); url.searchParams.set('sap-language', 'EN');
    if (method === 'GET') url.searchParams.set('$format', 'json');
    const headers = { Accept: 'application/json' };
    if (method !== 'GET') {
        if (!csrf) {
            const token = await fetch(base + '?sap-client=110&sap-language=EN', {headers: {'x-csrf-token':'Fetch',Accept:'application/json'}});
            assert.equal(token.status, 200, 'CSRF preflight must succeed');
            csrf = token.headers.get('x-csrf-token');
            cookies = token.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
            assert.ok(csrf && csrf !== 'Required');
        }
        headers['x-csrf-token'] = csrf; headers.Cookie = cookies;
        headers['Content-Type'] = 'application/json';
        if (method === 'DELETE' || method === 'MERGE') headers['If-Match'] = '*';
    }
    const response = await fetch(url, {method, headers, body: body ? JSON.stringify(body) : undefined});
    const text = await response.text();
    if (!response.ok) throw new Error(method + ' ' + resource + ' ' + response.status + ' ' + text.slice(0,1600));
    return text ? JSON.parse(text).d : null;
}
async function all(resource) {
    const result = await request(resource + '?$top=5000&$inlinecount=allpages');
    assert.equal(result.results.length, Number(result.__count), 'Do not accept partial data');
    assert.ok(!result.__next);
    return result.results;
}
function plan() {
    // Compare names only with the existing local snapshot, never read production.
    const productionPath = path.resolve(root, '../ps4-500/mockdata/xNGRxCDS_PS_MASTER.json');
    const production = JSON.parse(fs.readFileSync(productionPath, 'utf8'));
    const usedNames = new Set(production.flatMap(r => [r.CustomerName, r.Owner]).filter(Boolean).map(s => s.trim().toLowerCase()));
    const companyBank = ['Patagonia','ASICS','Garmin','Sonos','Logitech','Fender','Bose','Osprey','Fjallraven','Yamaha','Roland','Casio','Shimano','Mizuno','Salomon','Hoka','Brooks Running','On Running','Allbirds','Crocs','Skechers','Birkenstock','Trek Bicycle','Specialized','Giant Bicycles','Brompton','Peloton','Technogym','Dyson','SharkNinja','iRobot','Breville','DeLonghi','Smeg','Miele','Herman Miller','Steelcase','Haworth','Vitra','Kartell','Baccarat','Lalique','Le Creuset','Staub','Zwilling','Victorinox','Samsonite','Tumi','Rimowa','Thule','Yeti','Stanley 1913','Hydro Flask','CamelBak','Coleman','Deuter','Gregory','Black Diamond','Petzl','Arc\u0027teryx'];
    const ownerBank = ['Anika Deshmukh','Rohan Bhatia','Meera Krishnan','Kunal Mehta','Tara Menon','Dev Malhotra','Nisha Kulkarni','Arjun Sethi','Kavya Iyer','Ishaan Kapoor','Elena Novak','Luca Moretti','Sofia Lindberg','Oliver Bennett','Amelia Brooks','Daniel Fischer','Maya Chen','Ethan Wallace','Hana Tanaka','Mateo Silva','Zara Haddad','Noah Petersen','Leila Mansour','Adrian Weber'];
    const companies = companyBank.filter(n => !usedNames.has(n.toLowerCase()));
    const owners = ownerBank.filter(n => !usedNames.has(n.toLowerCase()));
    assert.ok(companies.length >= 30 && owners.length >= 16);
    const bu = read('bu.json').map(r => r.DomainValue);
    const domains = read('domains.json');
    const values = suffix => domains.filter(r => r.DomainName === '/NGR/DO_PS_' + suffix).map(r => r.DomainValue);
    const markets = [['NA','US','USD'],['NA','CA','CAD'],['EUROPE','DE','EUR'],['EUROPE','FR','EUR'],['EUROPE','NL','EUR'],['EUROPE','SE','SEK'],['EUROPE','CH','CHF'],['UK','GB','GBP'],['APAC','IN','INR'],['APAC','JP','JPY'],['APAC','SG','SGD'],['MENA','AE','AED'],['MENA','SA','SAR'],['AUS','AU','AUD'],['AUS','NZ','NZD'],['AFRICA','ZA','ZAR']];
    // Fixed synthetic FX multipliers diversify native amounts; the dashboard still uses its live rates.
    const factors = {EUR:1,USD:1.16,CAD:1.58,SEK:11,CHF:.94,GBP:.86,INR:102,JPY:170,SGD:1.49,AED:4.26,SAR:4.35,AUD:1.76,NZD:1.96,ZAR:20.3};
    const topics = ['S/4HANA finance transformation','BTP integration discovery','Warehouse automation assessment','SuccessFactors rollout','SAP analytics planning','Procurement process redesign','Commerce platform migration','Manufacturing execution pilot','Supply chain visibility','Data quality modernization','Cloud ERP fit-to-standard','Service management rollout','SAP security assessment','Application support transition','AI-assisted demand planning'];
    const statusPool = ['WIP','WIP','WIP','SUBMITTED','SUBMITTED','HOLD','WIN','WIN','LOSS','COMPLETE','CLSD','NOGO'];
    const amountBands = [0.5,12000,38000,62000,275000,1400000];
    const rows = [];
    for (let month = 0; month < 21; month++) {
        const first = Date.UTC(2025 + Math.floor(month / 12), month % 12, 1);
        const last = Math.min(end, Date.UTC(2025 + Math.floor(month / 12), month % 12 + 1, 0));
        for (let n = 0; n < 20; n++) {
            const i = rows.length, received = i === 0 ? first : month === 20 && n === 19 ? end : first + Math.floor(random() * ((last-first)/day+1))*day;
            const [geo,country,localCurrency] = markets[(i + Math.floor(random()*markets.length)) % markets.length];
            let status = i < 8 ? values('OPP_STAT')[i] : pick(statusPool);
            const due = Math.min(end, received + (10 + Math.floor(random()*35))*day);
            const submitted = Math.min(end, received + (5+Math.floor(random()*15))*day);
            const owner = i % 29 === 0 ? '' : owners[(i + Math.floor(random()*owners.length)) % owners.length];
            let currency = i % 3 === 0 ? 'EUR' : localCurrency;
            let eur = amountBands[i % amountBands.length] * (i%6===0 ? 1 : .8+random()*.4);
            // Dedicated value-help / incomplete-data cases, all visibly synthetic.
            if(i%37===0 && status !== 'SUBMITTED') currency = '';
            if(i%41===0 && status !== 'SUBMITTED') eur = 0;
            if(status === 'SUBMITTED' && eur < 1) eur = 9000;
            const boundary = {1:1,2:24999.99,3:25000,4:49999.99,5:50000,6:74999.99,7:75000,8:999999.99,9:1000000};
            if(boundary[i] !== undefined) { eur=boundary[i];currency='EUR'; }
            const proposal = i%31===0 ? '' : i%5<3 ? 'FULL' : 'CAP';
            const row = {
                CustomerName:companies[(i + Math.floor(random()*companies.length)) % companies.length],
                CustomerDesc:'Synthetic development scenario. Company names are illustrative; no actual engagement is represented.',
                OppDesc:pick(topics) + ' - ' + marker + '-' + String(i+1).padStart(3,'0'),
                Geography:geo,Country:country,BUDetails:i%43===0?'':bu[i%bu.length],LineOfBusiness:pick(values('LOB')),
                DealType:pick(values('DEAL_TYPE')),OppType:pick(values('OPP_TYPE')),SapSystem:'SAP S/4HANA; SAP BTP',
                SolutionArea:pick(topics),ProposalType:pick(['Implementation','Advisory','Migration','Managed services','Proof of concept','Integration']),ProposalTypeOp:proposal,
                ReceivedDate:date(received),DueSubmissionDate:date(due),PlannedSubmissionDate:date(due),
                SubmissionDate:['WIP','HOLD','NOGO'].includes(status)?null:date(submitted),
                CloseDate:['WIN','LOSS','COMPLETE','CLSD','NOGO'].includes(status)?date(Math.min(end,submitted+7*day)):null,
                Status:status,OppTcv:(eur*(factors[currency]||1)).toFixed(currency==='JPY'?0:2),Currency:currency,
                Probability:status==='WIN'||status==='COMPLETE'?'100':status==='LOSS'||status==='NOGO'?'0':String(20+Math.floor(random()*65)),
                Complexity:pick(values('COMPLEXITY')),WinChance:pick(values('WIN_CHANCE')),CommModel:pick(values('COMM_MDL')),
                PracticeReviewwer:pick(owners),PreSalesReviewwer:pick(owners),DeletionIndicator:false,DeliveryHandover:status==='COMPLETE',
                Reason:['LOSS','NOGO'].includes(status)?'Synthetic scenario: budget or solution-fit decision.':'',
                CloseRemarks:['WIN','COMPLETE'].includes(status)?'Synthetic scenario: proposal accepted for test coverage.':'',
                toParters:owner?[{PartnerFunction:'OWN',PartnerName:owner,PartnerEmail:''}]:[],
                toRemarks:[{RmText:marker+': Generated test opportunity, not a real customer engagement.'}]
            };
            if(i%4===0) row.toParters.push({PartnerFunction:'SALES',PartnerName:pick(owners),PartnerEmail:''});
            rows.push(row);
        }
    }
    assert.equal(rows.length,420);
    rows.forEach(r=>{assert.ok(!usedNames.has(r.CustomerName.toLowerCase()));r.toParters.forEach(p=>assert.ok(!usedNames.has(p.PartnerName.toLowerCase())));});
    save('plan.json', {marker,from:'2025-01-01',to:'2026-09-14',client:'110',rows});
    console.log(JSON.stringify({planned:rows.length,companies:companies.length,owners:owners.length,bus:bu.length,months:21,currentQuarter:60}));
}
async function load(pilot) {
    const plan = read('plan.json'); assert.equal(plan.client,'110'); assert.equal(plan.marker,marker);
    const existing = await all(entity);
    const byDescription = new Map(existing.map(r=>[r.OppDesc,r]));
    const journal = fs.existsSync(path.join(root,'created.json'))?read('created.json'):[];
    for(const row of (pilot?plan.rows.slice(0,1):plan.rows)) {
        if(byDescription.has(row.OppDesc)) continue;
        const result = await request(entity,'POST',row);
        assert.ok(result.Id);
        journal.push({Id:result.Id,OppDesc:row.OppDesc}); save('created.json',journal);
        byDescription.set(row.OppDesc,result);
        if(journal.length%20===0 || pilot) console.log(JSON.stringify({created:journal.length,lastId:result.Id}));
    }
}
async function verify() {
    const rows = await all(entity); save('after-master.json',rows);
    const seeded = rows.filter(r=>r.OppDesc?.includes(marker));
    const group = key => Object.fromEntries([...new Set(seeded.map(r=>r[key]||'Unassigned'))].map(v=>[v,seeded.filter(r=>(r[key]||'Unassigned')===v).length]));
    const months = {};
    seeded.forEach(r=>{const stamp=Number(/\d+/.exec(r.ReceivedDate)[0]);assert.ok(stamp>=Date.UTC(2025,0,1)&&stamp<=end);const month=new Date(stamp).toISOString().slice(0,7);months[month]=(months[month]||0)+1;});
    const result={seeded:seeded.length,total:rows.length,active:rows.filter(r=>!r.DeletionIndicator&&r.Status!=='DELE').length,months,statuses:group('Status'),owners:group('Owner'),bus:group('BUDetails'),proposals:group('ProposalTypeOp'),currencies:group('Currency')};
    save('verification.json',result); console.log(JSON.stringify(result));
    if(seeded.length!==420) throw new Error('Expected all 420 synthetic opportunities');
    const plan=read('plan.json').rows;
    for(const intended of plan) {
        const actual=seeded.find(r=>r.OppDesc===intended.OppDesc);assert.ok(actual);
        for(const key of ['ReceivedDate','Status','BUDetails','Country','Geography','ProposalTypeOp','Currency']) assert.equal(actual[key],intended[key],actual.Id+' '+key);
        // SAP correctly rounds JPY to its zero-decimal currency precision.
        assert.equal(Number(actual.OppTcv),intended.Currency==='JPY'?Math.round(Number(intended.OppTcv)):Number(intended.OppTcv));
        assert.equal(actual.Owner,intended.toParters.find(p=>p.PartnerFunction==='OWN')?.PartnerName||'');
    }
    const [partners,remarks] = await Promise.all([all('xNGRxCDS_PS_PARTNER'),all('xNGRxCDS_PS_REMARKS')]);
    const ids = new Set(seeded.map(r=>r.Id));
    const createdPartners=partners.filter(p=>ids.has(p.Id)),createdRemarks=remarks.filter(r=>ids.has(r.Id));
    assert.equal(createdPartners.length,plan.reduce((sum,r)=>sum+r.toParters.length,0));
    assert.equal(createdRemarks.length,420);
    assert.ok(createdRemarks.every(r=>r.RmText.includes(marker)));
    assert.ok(createdPartners.every(p=>!p.PartnerEmail));
    result.partners=createdPartners.length;result.remarks=createdRemarks.length;
    save('verification.json',result);
    console.log(JSON.stringify({verifiedPartners:createdPartners.length,verifiedRemarks:createdRemarks.length}));
}
async function retireOld() {
    await verify();
    const backup=read('before-'+entity+'.json').d;
    assert.equal(backup.results.length,Number(backup.__count));
    const current=await all(entity);
    for(const old of backup.results) {
        assert.ok(!old.OppDesc?.includes(marker));
        const live=current.find(r=>r.Id===old.Id);
        if(!live||live.DeletionIndicator) continue;
        assert.equal(live.CustomerName,old.CustomerName,'Old row changed since backup');
        assert.equal(live.OppDesc,old.OppDesc,'Old row changed since backup');
        for(const key of ['Status','UpdatedOn','UpdatedAt','UpdatedBy']) assert.deepEqual(live[key],old[key],'Old row changed since backup: '+old.Id+' '+key);
        await request(entity+"('"+old.Id+"')",'DELETE');
        fs.appendFileSync(path.join(root,'retired.jsonl'),JSON.stringify({Id:old.Id,at:new Date().toISOString()})+'\n');
    }
    console.log(JSON.stringify({retired:backup.results.length}));
    const remaining=await all(entity);
    assert.equal(remaining.filter(r=>!r.DeletionIndicator&&r.Status!=='DELE'&&!r.OppDesc?.includes(marker)).length,0,'Old opportunities must be absent from the active dashboard');
}
(async()=>{const command=process.argv[2];if(command==='plan')plan();else if(command==='pilot')await load(true);else if(command==='load')await load(false);else if(command==='verify')await verify();else if(command==='retire-old')await retireOld();else throw Error('Use plan, pilot, load, verify, or retire-old');})().catch(e=>{console.error(e.message);process.exitCode=1;});
