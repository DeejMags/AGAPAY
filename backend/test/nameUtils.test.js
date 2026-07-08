const test = require('node:test');
const assert = require('node:assert/strict');
const { buildUserNameData } = require('../utils/nameUtils');

test('manual signup uses separate first and last names', () => {
  const result = buildUserNameData({ firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' });

  assert.equal(result.firstName, 'Jane');
  assert.equal(result.lastName, 'Doe');
  assert.equal(result.fullName, 'Jane Doe');
  assert.equal(result.displayName, 'Jane Doe');
  assert.equal(result.username, 'Jane Doe');
});

test('google-style display name is split into first and last', () => {
  const result = buildUserNameData({ name: 'John Doe', email: 'john@example.com' });

  assert.equal(result.firstName, 'John');
  assert.equal(result.lastName, 'Doe');
  assert.equal(result.fullName, 'John Doe');
  assert.equal(result.displayName, 'John Doe');
});

test('falls back to the email local part when no name is available', () => {
  const result = buildUserNameData({ email: 'maria.santos@example.com' });

  assert.equal(result.fullName, 'maria santos');
  assert.equal(result.displayName, 'maria santos');
  assert.equal(result.username, 'maria santos');
});
