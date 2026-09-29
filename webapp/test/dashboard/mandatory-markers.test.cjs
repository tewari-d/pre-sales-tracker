const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const forms = {
  create: fs.readFileSync('webapp/view/fragments/CreateOpportunity.fragment.xml', 'utf8'),
  edit: fs.readFileSync('webapp/view/Detail.view.xml', 'utf8')
};

function smartField(source, field) {
  const tag = [...source.matchAll(/<smartField:SmartField\b[^>]*>/g)]
    .map(match => match[0])
    .find(value => value.includes(`value="{${field}}"`));
  assert.ok(tag, `${field} SmartField exists`);
  return tag;
}

test('all always-required opportunity fields have SmartField mandatory markers', () => {
  const fields = [
    'CustomerName', 'Geography', 'LineOfBusiness', 'Country', 'DealType',
    'BUDetails', 'Status', 'SapSystem', 'SapSystemCategory', 'OppType',
    'OpportunityType', 'Complexity', 'ProposalTypeOp', 'ReceivedDate'
  ];

  for (const [name, source] of Object.entries(forms)) {
    for (const field of fields) {
      assert.match(smartField(source, field), /\bmandatory="true"/, `${name}: ${field}`);
    }
    assert.doesNotMatch(source, /<smartField:SmartField\b[^>]*\brequired=/,
      `${name}: SmartField does not support a required property`);
  }
});

test('status-dependent mandatory markers match the save rules', () => {
  for (const source of Object.values(forms)) {
    for (const status of ['SUBMITTED', 'WIN', 'COMPLETE']) {
      assert.ok(smartField(source, 'OppTcv').includes(status), `Opp. Size: ${status}`);
    }
    for (const status of ['WIN', 'LOSS', 'COMPLETE']) {
      assert.ok(smartField(source, 'CloseDate').includes(status), `Win/Loss Date: ${status}`);
    }
    assert.match(smartField(source, 'OppTcv'), /\bmandatory="\{=/);
    assert.match(smartField(source, 'CloseDate'), /\bmandatory="\{=/);
  }

  const editOnly = [
    ['SubmissionDate', 'SUBMITTED'], ['PracticeReviewwer', 'SUBMITTED'],
    ['PreSalesReviewwer', 'SUBMITTED'], ['ResourceFutureDemandUpdated', 'SUBMITTED'],
    ['CommModel', 'WIN'], ['DeliveryHandover', 'COMPLETE']
  ];
  for (const [field, status] of editOnly) {
    assert.match(smartField(forms.edit, field), /\bmandatory="\{=/);
    assert.ok(smartField(forms.edit, field).includes(status), `${field}: ${status}`);
  }
});
