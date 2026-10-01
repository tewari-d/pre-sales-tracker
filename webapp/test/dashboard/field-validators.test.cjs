const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let validators;
vm.runInNewContext(fs.readFileSync('webapp/utils/FieldValidators.js', 'utf8'), {
  sap: { ui: { define: (_, factory) => { validators = factory(); } } }
});
test('creation and every edit in submitted or won statuses requires a usable opportunity size', () => {
  for (const status of ['SUBMITTED', 'WIN', 'COMPLETE']) {
    assert.match(validators.opportunitySizeError(status, '', 'EUR'), /required/);
    assert.match(validators.opportunitySizeError(status, '0', 'EUR'), /greater than zero/);
    assert.match(validators.opportunitySizeError(status, '1', 'EUR'), /greater than 1/);
    assert.match(validators.opportunitySizeError(status, 1, 'USD'), /greater than 1/);
    assert.equal(validators.opportunitySizeError(status, '1.001', 'EUR'), '');
    assert.equal(validators.opportunitySizeError(status, '2', 'USD'), '');
    assert.match(validators.opportunitySizeError(status, '0', 'EUR', 'WIP'), /greater than zero/);
    assert.match(validators.opportunitySizeError(status, '0', 'EUR', status), /greater than zero/);
  }
  assert.equal(validators.opportunitySizeError('WIP', '', ''), '');
  assert.equal(validators.opportunitySizeError('WIP', '0', 'EUR'), '');
  assert.equal(validators.opportunitySizeError('WIP', 1, 'USD'), '');
  assert.equal(validators.opportunitySizeError('HOLD', '0', 'EUR', 'WIN'), '');
  assert.equal(validators.opportunitySizeError('SUBMITTED', 1, 'GBP'), '');
});

test('required opportunity fields cover every status and terminal Win/Loss Date', () => {
  const base = {
    CustomerName: 'Customer', OpportunityType: 'AMS', SapSystemCategory: 'S4_PUBLIC',
    ReceivedDate: new Date('2026-09-01'), CloseDate: new Date('2026-09-10')
  };
  assert.deepEqual(Array.from(validators.missingOpportunityFields({ ...base, Status: 'WIP' }), item => item.field), []);
  assert.deepEqual(Array.from(validators.missingOpportunityFields({ ...base, CustomerName: ' ', OpportunityType: '', SapSystemCategory: null, ReceivedDate: null, Status: 'WIP' }), item => item.field),
    ['CustomerName', 'OpportunityType', 'SapSystemCategory', 'ReceivedDate']);
  for (const status of ['WIN', 'COMPLETE', 'LOSS']) {
    assert.deepEqual(Array.from(validators.missingOpportunityFields({ ...base, Status: status, CloseDate: '' }), item => item.field), ['CloseDate']);
  }
  assert.deepEqual(Array.from(validators.missingOpportunityFields({ ...base, Status: 'WIN', ReceivedDate: new Date('invalid') }), item => item.field), ['ReceivedDate']);
});
