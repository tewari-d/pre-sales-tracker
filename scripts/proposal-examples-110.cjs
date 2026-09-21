// Development-only examples for the re-cut proposal type domain. Uses the
// authenticated local PS4/110 proxy (npm start) and only touches synthetic
// client-110 opportunities. Commands: plan, pilot (first row only), apply, verify, revert.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const http = require('node:http');
// Plain http instead of fetch: Node 24's undici aborts on the proxy's large chunked responses.
const fetch = (url, { method = 'GET', headers = {}, body } = {}) => new Promise((resolve, reject) => {
    const req = http.request(url, { method, headers }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
            status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 300,
            headers: { get: name => res.headers[name.toLowerCase()], getSetCookie: () => [].concat(res.headers['set-cookie'] || []) },
            text: async () => Buffer.concat(chunks).toString('utf8'),
        }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});
const root = path.resolve(__dirname, '../.local-data/proposal-examples-20260916');
const base = 'http://localhost:8080/sap/opu/odata/ngr/OD_PS_TRACKER_SRV/';
const entity = 'xNGRxCDS_PS_MASTER';
const marker = 'SYNTHETIC-110-20260914';
// Rows to move per code and received-date quarter; the rest stay as they are.
const targets = { '2026-Q3': { FUNNEL: 8, RFI: 8, STAFF: 10 }, '2026-Q2': { FUNNEL: 4, RFI: 4, STAFF: 4 } };
const save = (name, value) => fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2) + '\n');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
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
            const token = await fetch(base + '?sap-client=110&sap-language=EN', { headers: { 'x-csrf-token': 'Fetch', Accept: 'application/json' } });
            assert.equal(token.status, 200, 'CSRF preflight must succeed');
            csrf = token.headers.get('x-csrf-token');
            cookies = token.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
            assert.ok(csrf && csrf !== 'Required');
        }
        Object.assign(headers, { 'x-csrf-token': csrf, Cookie: cookies, 'Content-Type': 'application/json', 'If-Match': '*' });
    }
    const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const text = await response.text();
    if (!response.ok) throw new Error(method + ' ' + resource + ' ' + response.status + ' ' + text.slice(0, 1600));
    return text ? JSON.parse(text).d : null;
}
async function all() {
    const result = await request(entity + '?$top=5000&$inlinecount=allpages');
    assert.equal(result.results.length, Number(result.__count), 'Do not accept partial data');
    assert.ok(!result.__next);
    return result.results;
}
const quarter = row => { const d = new Date(Number(/\d+/.exec(row.ReceivedDate)[0])); return d.getUTCFullYear() + '-Q' + (Math.floor(d.getUTCMonth() / 3) + 1); };
const strip = row => Object.fromEntries(Object.entries(row).filter(([k]) => k !== '__metadata' && !k.startsWith('to')));
async function plan() {
    fs.mkdirSync(root, { recursive: true });
    const rows = await all();
    save('before-' + entity + '.json', rows.map(strip));
    const candidates = rows.filter(r => !r.DeletionIndicator && r.Status !== 'DELE' && r.OppDesc?.includes(marker) && ['FULL', 'CAP'].includes(r.ProposalTypeOp));
    const changes = [];
    for (const [q, codes] of Object.entries(targets)) {
        // Round-robin over owners so every owner's stack gets several colours.
        const pool = candidates.filter(r => quarter(r) === q).sort((a, b) => (a.Owner || '').localeCompare(b.Owner || '') || a.Id.localeCompare(b.Id));
        const byOwner = new Map();
        pool.forEach(r => byOwner.set(r.Owner || '', (byOwner.get(r.Owner || '') || []).concat(r)));
        const queue = []; let left = true;
        while (left) { left = false; for (const list of byOwner.values()) { if (list.length) { queue.push(list.shift()); left = true; } } }
        for (const [code, count] of Object.entries(codes)) {
            for (let i = 0; i < count; i++) { const r = queue.shift(); assert.ok(r, 'not enough candidates in ' + q); changes.push({ Id: r.Id, Owner: r.Owner, quarter: q, from: r.ProposalTypeOp, to: code, UpdatedOn: r.UpdatedOn, UpdatedAt: r.UpdatedAt }); }
        }
    }
    save('plan.json', changes);
    const summary = {};
    changes.forEach(c => { summary[c.quarter] = summary[c.quarter] || {}; summary[c.quarter][c.to] = (summary[c.quarter][c.to] || 0) + 1; });
    console.log(JSON.stringify({ candidates: candidates.length, changes: changes.length, summary }, null, 2));
}
async function apply(limit = Infinity) {
    const changes = read('plan.json').slice(0, limit);
    const live = new Map((await all()).map(r => [r.Id, r]));
    const journal = path.join(root, 'applied.jsonl');
    const done = fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).Id) : [];
    for (const c of changes) {
        if (done.includes(c.Id)) continue;
        const row = live.get(c.Id);
        assert.ok(row && row.OppDesc.includes(marker), 'only synthetic rows are changed: ' + c.Id);
        assert.equal(row.ProposalTypeOp, c.from, 'row changed since plan: ' + c.Id);
        assert.deepEqual([row.UpdatedOn, row.UpdatedAt], [c.UpdatedOn, c.UpdatedAt], 'row changed since plan: ' + c.Id);
        // MERGE round-trips the whole entity through UPDATE_ENTITY, which stores the
        // computed WinChance; send the stored value back so it does not drift.
        await request(entity + "('" + c.Id + "')", 'MERGE', { ProposalTypeOp: c.to, WinChance: row.WinChanceSource });
        fs.appendFileSync(journal, JSON.stringify({ Id: c.Id, to: c.to, at: new Date().toISOString() }) + '\n');
    }
    await verify();
}
async function verify() {
    const journal = path.join(root, 'applied.jsonl');
    const applied = new Set(fs.existsSync(journal) ? fs.readFileSync(journal, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).Id) : []);
    const changes = read('plan.json').filter(c => applied.has(c.Id));
    const before = new Map(read('before-' + entity + '.json').map(r => [r.Id, r]));
    const rows = await all();
    save('after-' + entity + '.json', rows.map(strip));
    const ignore = new Set(['ProposalTypeOp', 'ProposalTypeOpText', 'UpdatedOn', 'UpdatedAt', 'UpdatedBy', '__metadata']);
    let mismatches = 0;
    for (const row of rows) {
        const old = before.get(row.Id); if (!old) { mismatches++; console.log('new row', row.Id); continue; }
        const change = changes.find(c => c.Id === row.Id);
        for (const key of Object.keys(old)) {
            if (ignore.has(key) || key.startsWith('to')) continue;
            if (JSON.stringify(old[key]) !== JSON.stringify(row[key])) { mismatches++; console.log('unexpected change', row.Id, key, old[key], row[key]); }
        }
        const expected = change ? change.to : old.ProposalTypeOp;
        if (row.ProposalTypeOp !== expected) { mismatches++; console.log('proposal mismatch', row.Id, row.ProposalTypeOp, expected); }
    }
    const counts = {};
    rows.filter(r => !r.DeletionIndicator && r.Status !== 'DELE').forEach(r => { const q = quarter(r); counts[q] = counts[q] || {}; const k = r.ProposalTypeOp || '(blank)'; counts[q][k] = (counts[q][k] || 0) + 1; });
    console.log(JSON.stringify({ rows: rows.length, mismatches, '2026-Q3': counts['2026-Q3'], '2026-Q2': counts['2026-Q2'] }, null, 2));
    assert.equal(mismatches, 0, 'verification failed');
}
async function revert() {
    const changes = read('plan.json');
    const before = new Map(read('before-' + entity + '.json').map(r => [r.Id, r]));
    for (const c of changes) { await request(entity + "('" + c.Id + "')", 'MERGE', { ProposalTypeOp: c.from, WinChance: before.get(c.Id).WinChanceSource }); }
    fs.rmSync(path.join(root, 'applied.jsonl'), { force: true });
    console.log(JSON.stringify({ reverted: changes.length }));
}
(async () => {
    const command = process.argv[2];
    if (command === 'plan') await plan(); else if (command === 'pilot') await apply(1);
    else if (command === 'repair-winchance') { const before = new Map(read('before-' + entity + '.json').map(r => [r.Id, r])); for (const id of process.argv.slice(3)) { const old = before.get(id); await request(entity + "('" + id + "')", 'MERGE', { WinChance: old.WinChanceSource }); } await verify(); } else if (command === 'apply') await apply(); else if (command === 'verify') await verify(); else if (command === 'revert') await revert();
    else throw Error('Use plan, pilot, apply, verify, or revert');
})().catch(e => { console.error(e.message); process.exitCode = 1; });
