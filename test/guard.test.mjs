import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBasicAuth, DailyCap } from '../src/guard.mjs';

const basic = (user, pass) => 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');

test('auth: no password configured means open', () => {
  assert.equal(checkBasicAuth(undefined, ''), true);
  assert.equal(checkBasicAuth('garbage', undefined), true);
});

test('auth: right password passes with any username; wrong, missing or malformed fail', () => {
  assert.equal(checkBasicAuth(basic('mum', 'faers-2026'), 'faers-2026'), true);
  assert.equal(checkBasicAuth(basic('', 'faers-2026'), 'faers-2026'), true);
  assert.equal(checkBasicAuth(basic('mum', 'faers-2025'), 'faers-2026'), false);
  assert.equal(checkBasicAuth(basic('mum', 'faers-20260'), 'faers-2026'), false);   // longer
  assert.equal(checkBasicAuth(undefined, 'faers-2026'), false);
  assert.equal(checkBasicAuth('Bearer abc', 'faers-2026'), false);
  assert.equal(checkBasicAuth('Basic !!!notbase64', 'faers-2026'), false);
});

test('auth: a password containing a colon still works', () => {
  assert.equal(checkBasicAuth(basic('u', 'a:b:c'), 'a:b:c'), true);
});

test('cap: counts down within a day and resets when the date changes', () => {
  let day = '2026-09-14';
  const cap = new DailyCap(3, () => new Date(`${day}T12:00:00Z`));
  assert.equal(cap.remaining(), 3);
  assert.ok(cap.take()); assert.ok(cap.take()); assert.ok(cap.take());
  assert.equal(cap.take(), false);
  assert.equal(cap.remaining(), 0);
  day = '2026-09-15';
  assert.equal(cap.remaining(), 3);
  assert.ok(cap.take());
});
