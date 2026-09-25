/**
 * Verify the PWA artifact produced by `npm run build` before it is published.
 *
 * Usage: run `npm run build`, then `node scripts/verify-production-build.mjs` from the repo root.
 * Exits nonzero if the entry page or any of its local asset references is missing, absolute,
 * or outside dist/. A passing run prints the number of checked assets.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';

const dist = resolve('dist');
const entry = resolve(dist, 'index.html');
assert.ok(existsSync(entry), 'Build did not produce dist/index.html');

const html = readFileSync(entry, 'utf8');
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith('data:') && !/^https?:/.test(reference));

assert.ok(references.some((reference) => reference.includes('/assets/') && reference.endsWith('.js')),
  'Built page does not load a JavaScript bundle');

for (const reference of references) {
  assert.ok(reference.startsWith('./'), `Build emitted a non-relative asset URL: ${reference}`);
  const target = resolve(dist, reference);
  assert.ok(target.startsWith(`${dist}${sep}`), `Asset escapes dist/: ${reference}`);
  assert.ok(existsSync(target), `Referenced asset is missing: ${reference}`);
}

for (const asset of ['manifest.webmanifest', 'sw.js']) {
  assert.ok(existsSync(resolve(dist, asset)), `PWA asset is missing: ${asset}`);
}

console.log(`Verified production build: ${references.length} page assets and PWA files.`);
