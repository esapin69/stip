#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const HTML_EXEMPT = new Set([
  'print.html',
]);
const ROOT_TOKEN_FILES = new Set([
  'stip-theme-base.css',
  'stip-theme.css',
]);

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return fallback;
  }
}

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function normalize(file) {
  return file.replaceAll('\\', '/');
}

function resolveBase() {
  const explicit = process.env.STIP_DESIGN_BASE?.trim();
  if (explicit) return explicit;

  const githubBase = process.env.GITHUB_BASE_REF?.trim();
  if (githubBase) {
    const remote = `origin/${githubBase}`;
    if (git(['rev-parse', '--verify', remote])) return remote;
    if (git(['rev-parse', '--verify', githubBase])) return githubBase;
  }

  if (git(['rev-parse', '--verify', 'HEAD^'])) return 'HEAD^';
  return null;
}

function changedFiles(base) {
  if (!base) return [];
  const out = git([
    'diff', '--name-only', '--diff-filter=ACMR', `${base}..HEAD`, '--', '*.html', '*.css',
  ]);
  return out ? out.split('\n').map(normalize).filter(Boolean) : [];
}

function addedLines(base, file) {
  if (!base) return [];
  const diff = git([
    'diff', '--unified=0', `${base}..HEAD`, '--', file,
  ]);
  if (!diff) return [];
  return diff
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1));
}

function isNewFile(base, file) {
  if (!base) return true;
  const status = git(['diff', '--name-status', `${base}..HEAD`, '--', file]);
  return status.split('\n').some((line) => line.startsWith('A\t'));
}

const base = resolveBase();
const files = changedFiles(base);
const errors = [];
const warnings = [];

if (!base) {
  warnings.push('Aucune base Git trouvée : audit incrémental ignoré.');
}

for (const file of files) {
  if (!exists(file)) continue;
  const ext = path.extname(file).toLowerCase();
  const additions = addedLines(base, file);
  const content = read(file);

  if (ext === '.html') {
    const basename = path.basename(file);
    const exempt = HTML_EXEMPT.has(basename);

    if (isNewFile(base, file) && !exempt && !/stip-theme\.css(?:\?|["'])/i.test(content)) {
      errors.push(`${file}: toute nouvelle page STIP doit charger stip-theme.css.`);
    }

    for (const line of additions) {
      if (/stip-ui\.css/i.test(line)) {
        errors.push(`${file}: nouvel import de stip-ui.css interdit ; utiliser stip-theme.css.`);
      }
      if (/<style(?:\s|>)/i.test(line)) {
        errors.push(`${file}: nouveau bloc <style> interdit ; déplacer la règle dans le thème ou la feuille métier.`);
      }
      if (/\sstyle\s*=\s*["']/i.test(line)) {
        errors.push(`${file}: nouveau style inline interdit ; utiliser une classe STIP.`);
      }
    }

    if (!exempt && !/stip-theme\.css(?:\?|["'])/i.test(content)) {
      warnings.push(`${file}: page existante encore hors stip-theme.css ; à migrer lors de sa prochaine refonte visuelle.`);
    }
  }

  if (ext === '.css') {
    const basename = path.basename(file);
    for (const line of additions) {
      if (/^\s*:root\s*\{/i.test(line) && !ROOT_TOKEN_FILES.has(basename)) {
        errors.push(`${file}: nouvelle déclaration :root interdite hors thème maître.`);
      }
      if (/--stip-[a-z0-9-]+\s*:/i.test(line) && !ROOT_TOKEN_FILES.has(basename)) {
        errors.push(`${file}: un token --stip-* ne peut être défini que dans le thème maître.`);
      }
      if (/stip-ui\.css/i.test(line) && /@import/i.test(line)) {
        errors.push(`${file}: nouvel import de stip-ui.css interdit.`);
      }

      const hardColor = /(?:color|background(?:-color)?|border(?:-color)?|box-shadow)\s*:[^;]*(?:#[0-9a-f]{3,8}\b|rgba?\()/i.test(line);
      const usesToken = /var\(--stip-/i.test(line);
      if (hardColor && !usesToken && !ROOT_TOKEN_FILES.has(basename)) {
        warnings.push(`${file}: valeur visuelle locale détectée ; préférer un token --stip-* si elle n’est pas strictement métier.`);
      }
    }
  }
}

const uniqueErrors = [...new Set(errors)];
const uniqueWarnings = [...new Set(warnings)];

console.log('STIP design contract');
console.log(`Base: ${base ?? 'aucune'}`);
console.log(`Fichiers contrôlés: ${files.length}`);

if (uniqueWarnings.length) {
  console.log('\nAvertissements:');
  for (const warning of uniqueWarnings) console.log(`  - ${warning}`);
}

if (uniqueErrors.length) {
  console.error('\nErreurs:');
  for (const error of uniqueErrors) console.error(`  - ${error}`);
  console.error('\nLe thème STIP est la source de vérité visuelle. Voir THEME_FIRST.md.');
  process.exit(1);
}

console.log('\nOK — aucune dérive visuelle bloquante détectée.');
