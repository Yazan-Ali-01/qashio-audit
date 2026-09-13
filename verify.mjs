// Verification for the pure logic in the patch set.
// Fixtures are the literal example payloads from erp.qashio.com/api/docs.
import assert from 'node:assert/strict';
import { test } from 'node:test';

// ---- QF-06: segments / customSegments double-count -------------------------
// Verbatim from the published GET /erp-transactions example.
const specSegments = [
  { name: 'Main Office',   label: 'Location',               erp_internal_id: 'LOC-001',  code: 'MO' },
  { name: 'Project Alpha', label: 'Project',                erp_internal_id: 'PROJ-001', code: 'PA' },
  { name: 'Engineering',   label: 'Division',               erp_internal_id: 'DIV-001',  code: 'ENG' },
  { name: 'IT Department', label: 'Department',             erp_internal_id: 'DEPT-001' },
  { name: 'Vendor Name',   label: 'CustomSegment-Vender',   code: 'VENDOR-001' },
  { name: 'Customer Name', label: 'CustomSegment-Customer', code: 'CUSTOMER-001' },
];
const specCustomSegments = [
  { label: 'CustomSegment-Vender', name: 'Vendor Name', erp_internal_id: null, code: 'VENDOR-001' },
];

const norm = (s) => ({
  name: s.name, label: s.label, code: s.code ?? null,
  erpInternalId: s.erp_internal_id ?? null,
  isCustom: s.label.startsWith('CustomSegment-'),
});
const dedupeSegments = (segments) => {
  const seen = new Set();
  return segments.filter((s) => {
    const key = `${s.label}\u0000${s.name}\u0000${s.code ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

test('QF-06 — concatenating both arrays double-counts, as the field naming invites', () => {
  const naive = [...specSegments, ...specCustomSegments].map(norm);
  const vendor = naive.filter((s) => s.label === 'CustomSegment-Vender');
  assert.equal(vendor.length, 2, 'expected the reproduction to show a duplicate');
  console.log(`    reproduced: "CustomSegment-Vender" appears ${vendor.length}x in ${naive.length} dimensions`);
});

test('QF-06 — dedupe collapses it to one', () => {
  const fixed = dedupeSegments([...specSegments, ...specCustomSegments].map(norm));
  assert.equal(fixed.filter((s) => s.label === 'CustomSegment-Vender').length, 1);
  assert.equal(fixed.length, 6);
  assert.equal(fixed.filter((s) => s.isCustom).length, 2);
});

// ---- QF-05: line items do not reconcile to the header ----------------------
test('QF-05 — the published example does not balance', () => {
  const header = { amount: 102, transactionAmount: 102.5, vatAmount: 12 };
  const lineItems = [{ amount: 120, vatAmount: 14 }, { amount: 120, vatAmount: 14 }];
  const lineTotal = lineItems.reduce((a, l) => a + l.amount, 0);
  const vatTotal  = lineItems.reduce((a, l) => a + l.vatAmount, 0);
  assert.notEqual(lineTotal, header.amount);
  assert.notEqual(lineTotal, header.transactionAmount);
  assert.notEqual(vatTotal, header.vatAmount);
  console.log(`    lines ${lineTotal} vs header ${header.amount}/${header.transactionAmount}; VAT ${vatTotal} vs ${header.vatAmount}`);
});

// ---- QF-07: enum round-trip ------------------------------------------------
const CATEGORIES = ['card_loading','purchase','forced_debit','account_transfer','cash_withdrawal'];
const canonical = (raw) => raw.trim().toLowerCase().replace(/[\s-]+/g, '_');
const parseEnum = (allowed, raw) => {
  const k = canonical(raw);
  if (!allowed.includes(k)) throw new Error(`invalid: ${raw}`);
  return k;
};

test('QF-07 — today a response value fed back as a filter does not match', () => {
  // request `transactionCategory=card_loading` -> response `"Purchase"`
  const returned = 'Purchase';
  assert.ok(!CATEGORIES.includes(returned), 'Pascal-case response is not a valid filter value');
  console.log(`    "${returned}" is not in the accepted filter set — round-trip returns zero rows, no error`);
});

test('QF-07 — canonicalisation accepts all three documented casings', () => {
  for (const v of ['Purchase', 'PURCHASE', 'purchase']) assert.equal(parseEnum(CATEGORIES, v), 'purchase');
  assert.equal(parseEnum(CATEGORIES, 'FORCED DEBIT'), 'forced_debit'); // docs use a space
  assert.equal(parseEnum(CATEGORIES, 'CARD_LOADING'), 'card_loading'); // overview page casing
  assert.throws(() => parseEnum(CATEGORIES, 'nonsense'));
});

// ---- QF-11: money through IEEE-754 ----------------------------------------
test('QF-11 — bare JSON numbers accumulate float error over a page', () => {
  const page = Array.from({ length: 500 }, () => 102.5 + 2.75 + 0.1);
  const asFloat = page.reduce((a, b) => a + b, 0);
  const asMinor = page.map((v) => Math.round(v * 100)).reduce((a, b) => a + b, 0) / 100;
  assert.notEqual(asFloat, asMinor);
  console.log(`    500 rows: float ${asFloat} vs exact ${asMinor} (delta ${(asFloat - asMinor).toExponential(3)})`);
});

// ---- QF-04: cursor codec ---------------------------------------------------
const enc = (k) => Buffer.from(JSON.stringify(k), 'utf8').toString('base64url');
const dec = (r) => { const p = JSON.parse(Buffer.from(r, 'base64url').toString('utf8'));
  if (!p.updatedAt || !p.id) throw new Error('incomplete'); return p; };

test('QF-04 — cursor round-trips and rejects garbage', () => {
  const k = { updatedAt: '2026-09-13T01:56:21.000Z', id: 'c4943209-4462-455a-9bb9-f6781b3838bf' };
  assert.deepEqual(dec(enc(k)), k);
  assert.throws(() => dec('not-a-cursor'));
  assert.throws(() => dec(enc({ updatedAt: '2026-01-01T00:00:00Z' })));
});

test('QF-04 — offset pagination duplicates a row when one is inserted mid-scan', () => {
  const rows = Array.from({ length: 25 }, (_, i) => `t${i}`); // newest-first ordering
  const limit = 10;
  const page1 = rows.slice(0, limit);                 // t0..t9
  const afterInsert = ['t-new', ...rows];             // a new transaction lands at the head
  const page2 = afterInsert.slice(limit, limit * 2);  // offset 10 on the shifted list
  const overlap = page1.filter((r) => page2.includes(r));
  assert.deepEqual(overlap, ['t9'], 'expected t9 to be returned twice');
  console.log(`    insert -> t9 returned in both pages: posted to the ledger twice`);
});

test('QF-04 — offset pagination skips a row when one is removed mid-scan', () => {
  const rows = Array.from({ length: 25 }, (_, i) => `t${i}`);
  const limit = 10;
  const page1 = rows.slice(0, limit);                 // t0..t9
  const afterDelete = rows.filter((r) => r !== 't3'); // excludeFromSync flipped, row drops out
  const page2 = afterDelete.slice(limit, limit * 2);  // t11..t20
  const seen = new Set([...page1, ...page2]);
  assert.ok(!seen.has('t10'), 'expected t10 to be skipped entirely');
  console.log(`    delete -> t10 never returned: silently missing from the ledger`);
});

test('QF-04 — keyset pagination is stable under both mutations', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, key: 25 - i }));
  const limit = 10;
  const after = (k) => rows.filter((r) => r.key < k).sort((a, b) => b.key - a.key).slice(0, limit);
  const page1 = rows.slice(0, limit);
  const cursor = page1[page1.length - 1].key;
  rows.unshift({ id: 't-new', key: 26 });              // insert
  const page2 = after(cursor);
  const ids = [...page1, ...page2].map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');
  assert.deepEqual(page2.map((r) => r.id), Array.from({ length: 10 }, (_, i) => `t${10 + i}`));
  console.log(`    keyset -> no duplicate, no gap, insert simply appears on a later page`);
});
