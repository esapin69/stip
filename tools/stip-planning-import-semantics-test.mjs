import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseStaffingReferences } from '../supabase/functions/_shared/planning-import-references.mjs';

const dates = [
  { col: 8, date: '2026-11-07' }, // samedi
  { col: 9, date: '2026-11-08' }, // dimanche
  { col: 10, date: '2026-11-09' }, // lundi
  { col: 11, date: '2026-11-10' }, // mardi
];
function novemberRows({ indent = 0, alternative = true, order = 'cumul-first' } = {}) {
  const col = (...cells) => [...Array(indent).fill(''), ...cells];
  const actual = [
    col('Cumul par Horaire'),
    col('06.50-14.40 (07.30) Fixe', 'M', ...Array(6).fill(''), 5, 5, 12, 12),
    col('08.30-16.20 (07.30) Fixe', 'J', ...Array(6).fill(''), 2, 0, 9, 9),
    col('10.10-18.00 (07.30) Fixe', 'J4', ...Array(6).fill(''), 0, 0, 4, 6),
    col('13.30-21.00 (07.30) Fixe', 'S', ...Array(6).fill(''), 4, 4, 5, 5),
    col('', 'TOTAL', ...Array(6).fill(''), 11, 9, 30, 32),
  ];
  const expected = [
    col('ATTENDU', 'Samedi', 'Dimanche', 'Semaine', alternative ? '' : 'Sens à confirmer'),
    col('M (12)', 5, 5, 12, alternative ? 12 : ''),
    col('J (10)', 3, '', 10, alternative ? 9 : ''),
    col('J4 (6)', '', '', 6, alternative ? 5 : ''),
    col('S (7)', 4, 4, 7, alternative ? 6 : ''),
    col('', 12, 9, 35, alternative ? 32 : ''),
  ];
  const space = [Array(14).fill(''), Array(14).fill('')];
  return order === 'expected-first'
    ? [...space, ...expected, ...space, ...actual]
    : [...space, ...actual, ...space, ...expected];
}
function get(refs, date, metric, code = null) {
  return refs.find(r => r.reference_date === date && r.metric === metric && r.shift_code === code);
}

test('Novembre : CUMUL=planifié, ATTENDU=référence ; samedi 11 vs 12', () => {
  const refs = parseStaffingReferences(novemberRows(), 'Planning collectif', dates);
  assert.equal(get(refs, '2026-11-07', 'shift', 'J')?.target_count, 3);
  assert.equal(get(refs, '2026-11-07', 'shift', 'J')?.raw_payload?.displayed_count, 2);
  assert.equal(get(refs, '2026-11-07', 'total')?.target_count, 12);
  assert.equal(get(refs, '2026-11-07', 'total')?.raw_payload?.displayed_count, 11);
  assert.equal(get(refs, '2026-11-08', 'total')?.target_count, 9);
});

test('Novembre : 35/32 ambigu -> aucun seuil semaine inventé', () => {
  const refs = parseStaffingReferences(novemberRows(), 'Planning collectif', dates);
  assert.equal(refs.filter(r => ['2026-11-09', '2026-11-10'].includes(r.reference_date)).length, 0);
  const warning = get(refs, '2026-11-07', 'total')?.raw_payload?.weekly_ambiguity;
  assert.equal(warning?.labeled, 35);
  assert.equal(warning?.unlabeled, 32);
  assert.ok(warning?.variant_shifts.some(x => x.code === 'J4' && x.count === 5));
});

test('ATTENDU déplacé avant CUMUL : même résultat', () => {
  const refs = parseStaffingReferences(novemberRows({ order: 'expected-first' }), 'Modifié', dates);
  assert.equal(get(refs, '2026-11-07', 'shift', 'J')?.target_count, 3);
  assert.equal(get(refs, '2026-11-09', 'total'), undefined);
});

test('Présentation déplacée horizontalement : colonnes détectées par intitulé', () => {
  const refs = parseStaffingReferences(novemberRows({ indent: 2 }), 'Autre mise en page', dates);
  assert.equal(get(refs, '2026-11-07', 'shift', 'M')?.target_count, 5);
  assert.equal(get(refs, '2026-11-08', 'shift', 'S')?.target_count, 4);
});

test('Semaine univoque : 35 et M/J/J4/S réutilisables', () => {
  const refs = parseStaffingReferences(novemberRows({ alternative: false }), 'Planning', dates);
  assert.equal(get(refs, '2026-11-09', 'total')?.target_count, 35);
  assert.equal(get(refs, '2026-11-09', 'shift', 'J4')?.target_count, 6);
});

test('Absence d’intitulés dans ATTENDU : neutralité, aucune cible inventée', () => {
  const rows = [['ATTENDU', '', '', 35, 32], ['M (12)', 5, 5, 12, 12]];
  assert.deepEqual(parseStaffingReferences(rows, 'Sans colonnes', dates), []);
});

test('Ancien format : samedi/dimanche et M(12) restent reconnus', () => {
  const rows = [
    ['Cumul par Horaire'],
    ['M (12)'], ['J (10)'], ['J4 (6)'], ['S (7)'],
    ['Samedi 5/3/4 = 12'], ['Dimanche 5/4 = 9']
  ];
  const refs = parseStaffingReferences(rows, 'Ancienne présentation', dates);
  assert.equal(get(refs, '2026-11-07', 'total')?.target_count, 12);
  assert.equal(get(refs, '2026-11-08', 'total')?.target_count, 9);
  assert.equal(get(refs, '2026-11-09', 'shift', 'J4')?.target_count, 6);
});

test('Le moteur existant consomme le module canonique et protège les identités', () => {
  const code = fs.readFileSync(new URL('../supabase/functions/admin-ghe-import/index.ts', import.meta.url), 'utf8');
  assert.match(code, /parseStaffingReferences\(rows,sn,dateCols\)/);
  assert.match(code, /nom\\s\*/); // ligne générique NOM : exclusion
  assert.match(code, /applyIdentityPrivacy\(p\.rows,privacy\)/);
  assert.match(code, /suspected_deletions/);
  assert.match(code, /function parseSpecialShifts/);
  assert.match(code, /Fixe\|Libre/);
  assert.match(code, /source_value/);
  assert.match(code, /weekly_ambiguity/);
});
