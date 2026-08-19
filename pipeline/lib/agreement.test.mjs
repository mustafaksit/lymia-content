import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agreementIssues } from './agreement.mjs';

test('bozuk cumleleri yakalar', () => {
  assert.ok(agreementIssues('She feel happy.').length >= 1);
  assert.ok(agreementIssues('They are in a area.').length >= 1);
  assert.ok(agreementIssues('Sam and Maya are child.').length >= 1);
  assert.ok(agreementIssues('The market has many shop.').length >= 1);
  assert.ok(agreementIssues('The sky be clear.').length >= 1);
});

test('dogru cumlelerde YANLIS-POZITIF vermez', () => {
  for (const t of ['She writes a note.','They are in an area.','They are children.',
    'He can go home.','It was clear.','I have many shops.','He pushed the door open.',
    'The map shows a place.']) {
    assert.equal(agreementIssues(t).length, 0, t);
  }
});
