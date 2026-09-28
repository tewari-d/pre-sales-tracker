const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let validators;
vm.runInNewContext(fs.readFileSync('webapp/utils/FieldValidators.js', 'utf8'), {
  sap: { ui: { define: (_, factory) => { validators = factory(); } } }
});
test('submitted and won statuses require a usable opportunity size', () => {
  for (const status of ['SUBMITTED', 'WIN', 'COMPLETE']) {
    assert.match(validators.opportunitySizeError(status, '', 'EUR'), /required/);
    assert.match(validators.opportunitySizeError(status, '0', 'EUR'), /greater than zero/);
    assert.match(validators.opportunitySizeError(status, '1', 'EUR'), /greater than 1/);
    assert.match(validators.opportunitySizeError(status, 1, 'USD'), /greater than 1/);
    assert.equal(validators.opportunitySizeError(status, '1.001', 'EUR'), '');
    assert.equal(validators.opportunitySizeError(status, '2', 'USD'), '');
  }
  assert.equal(validators.opportunitySizeError('WIP', '', ''), '');
  assert.match(validators.opportunitySizeError('WIP', 1, 'USD'), /greater than 1/);
  assert.equal(validators.opportunitySizeError('SUBMITTED', 1, 'GBP'), '');
});
