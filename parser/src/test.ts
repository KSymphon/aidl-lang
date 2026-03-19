#!/usr/bin/env node
// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Test Suite — Vérifie parser + validator sur les exemples
// ══════════════════════════════════════════════
//
// Usage: npx tsx src/test.ts
//

import { readFileSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { parseAndValidate } from './index.js';
import type { AIDLDocument, ValidationResult } from './types.js';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
};

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string): void {
  if (condition) {
    passed++;
    console.log(`  ${COLORS.green}✓${COLORS.reset} ${testName}`);
  } else {
    failed++;
    console.log(`  ${COLORS.red}✗${COLORS.reset} ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

function loadExample(name: string): { doc: AIDLDocument; validation: ValidationResult; source: string } {
  const path = resolve(import.meta.dirname, '../../examples', name);
  const source = readFileSync(path, 'utf-8');
  const { document, validation } = parseAndValidate(source);
  return { doc: document, validation, source };
}

// ══════════════════════════════════════
// TEST 1: Tous les exemples sont valides
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Exemples: validité ═══${COLORS.reset}\n`);

const examplesDir = resolve(import.meta.dirname, '../../examples');
const exampleFiles = readdirSync(examplesDir).filter(f => f.endsWith('.aidl'));

for (const file of exampleFiles) {
  const source = readFileSync(resolve(examplesDir, file), 'utf-8');
  const { validation } = parseAndValidate(source);
  assert(validation.valid, `${file} est VALIDE`);
}

// ══════════════════════════════════════
// TEST 2: app-ecommerce — structure complète
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: structure ═══${COLORS.reset}\n`);

const ecom = loadExample('app-ecommerce.aidl');

assert(ecom.doc.header.fileType === 'app', 'Type de fichier: app');
assert(ecom.doc.header.name === 'shopflow', 'Nom: shopflow');
assert(ecom.doc.header.stack === 'next.js 15', 'Stack: next.js 15');
assert(ecom.doc.header.dependencies?.length === 3, 'Dépendances: 3 (supabase, zustand, stripe)');

assert(Object.keys(ecom.doc.dictionary.entries).length >= 2, 'Dictionnaire: au moins 2 termes (SKU, SSE)');
assert(ecom.doc.dictionary.entries['SKU'] !== undefined, 'Dictionnaire contient SKU');

assert(ecom.doc.lieux.length === 15, `Lieux: 15 (trouvé ${ecom.doc.lieux.length})`);
assert(ecom.doc.portes.length === 7, `Portes API: 7 (trouvé ${ecom.doc.portes.length})`);
assert(ecom.doc.stores.length === 2, `Stores: 2 (trouvé ${ecom.doc.stores.length})`);
assert(ecom.doc.signaux.length >= 3, `Signaux: au moins 3 (trouvé ${ecom.doc.signaux.length})`);

// ══════════════════════════════════════
// TEST 3: Lieux et permissions
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: lieux & permissions ═══${COLORS.reset}\n`);

const home = ecom.doc.lieux.find(l => l.name === 'home');
assert(home !== undefined, '@home existe');
assert(home?.permissions.includes('public'), '@home est #public');
assert(!home?.locked, '@home n\'est pas 🔒');

const cart = ecom.doc.lieux.find(l => l.name === 'cart');
assert(cart !== undefined, '@cart existe');
assert(cart?.permissions.includes('authenticated'), '@cart est #authenticated');
assert(cart?.locked === true, '@cart est 🔒');

// ══════════════════════════════════════
// TEST 4: Objets dans les lieux
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: objets ═══${COLORS.reset}\n`);

assert(home !== undefined && home.objects.length >= 3, `@home: au moins 3 objets (trouvé ${home?.objects.length})`);
const searchBar = home?.objects.find(o => o.name === 'search_bar');
assert(searchBar !== undefined, '.search_bar existe dans @home');
assert(searchBar?.qualifiers.includes('write'), '.search_bar a qualificateur write');

// ══════════════════════════════════════
// TEST 5: Multi-navigation (→@a →@b →@c)
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: multi-navigation ═══${COLORS.reset}\n`);

const homeNavTargets = home?.navigations.map(n => n.target) || [];
assert(homeNavTargets.length >= 3, `@home: au moins 3 navigations (trouvé ${homeNavTargets.length})`);
// Vérifie que les navigations sont séparées (pas un seul blob)
const hasCartNav = homeNavTargets.some(t => t.includes('cart'));
const hasLoginNav = homeNavTargets.some(t => t.includes('login'));
assert(hasCartNav, '@home navigue vers @cart');
assert(hasLoginNav, '@home navigue vers @login');

// ══════════════════════════════════════
// TEST 6: Portes API
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: portes API ═══${COLORS.reset}\n`);

const createOrder = ecom.doc.portes.find(p => p.name === 'create_order');
assert(createOrder !== undefined, '$create_order existe');
assert(createOrder?.method === 'POST', '$create_order méthode POST');
assert(createOrder?.input !== undefined && createOrder.input.length > 0, '$create_order a des entrées');
assert(createOrder?.output !== undefined && createOrder.output.length > 0, '$create_order a des sorties');

// ══════════════════════════════════════
// TEST 7: Stores
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ app-ecommerce: stores ═══${COLORS.reset}\n`);

const storeCart = ecom.doc.stores.find(s => s.name === 'store_cart');
assert(storeCart !== undefined, '^store_cart existe');
assert(storeCart?.technology === 'zustand', '^store_cart utilise zustand');
assert(storeCart !== undefined && storeCart.fields.length >= 3, `^store_cart: au moins 3 champs (trouvé ${storeCart?.fields.length})`);
assert(storeCart !== undefined && storeCart.feeds.length >= 3, `^store_cart: au moins 3 feeds (trouvé ${storeCart?.feeds.length})`);

// ══════════════════════════════════════
// TEST 8: product-medical-equipment
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ product-medical-equipment ═══${COLORS.reset}\n`);

const med = loadExample('product-medical-equipment.aidl');
assert(med.doc.header.fileType === 'produit', 'Type: produit');
assert(med.doc.header.name === 'ergopro-x3', 'Nom: ergopro-x3');
assert(med.doc.signaux.length === 3, `3 signaux d'attention (trouvé ${med.doc.signaux.length})`);
assert(med.doc.signaux.every(s => s.level === 'attention'), 'Tous les signaux sont !attention');
assert(med.doc.signaux.every(s => s.cause !== undefined), 'Tous les signaux ont une cause');
assert(med.doc.signaux.every(s => s.impact !== undefined), 'Tous les signaux ont un impact');
assert(med.validation.valid, 'Validation: VALIDE');
assert(med.validation.issues.length === 0, '0 problèmes de validation');

// ══════════════════════════════════════
// TEST 9: pipeline-data-etl
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ pipeline-data-etl ═══${COLORS.reset}\n`);

const etl = loadExample('pipeline-data-etl.aidl');
assert(etl.doc.header.fileType === 'flux', 'Type: flux');
assert(etl.doc.header.name === 'content-pipeline', 'Nom: content-pipeline');
assert(etl.doc.lieux.length === 5, `5 étapes (trouvé ${etl.doc.lieux.length})`);
assert(etl.doc.flux.length >= 1, `Au moins 1 flux (trouvé ${etl.doc.flux.length})`);

// Flux steps (=> parsing)
const mainFlux = etl.doc.flux[0];
assert(mainFlux !== undefined, '~main_flow existe');
assert(mainFlux?.steps !== undefined && mainFlux.steps.length >= 4, `Flux a des steps parsées (trouvé ${mainFlux?.steps?.length})`);

// ══════════════════════════════════════
// TEST 10: guide-troubleshooting
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ guide-troubleshooting ═══${COLORS.reset}\n`);

const guide = loadExample('guide-troubleshooting.aidl');
assert(guide.doc.header.fileType === 'guide', 'Type: guide');
assert(guide.doc.header.name === 'server-down-diagnostic', 'Nom: server-down-diagnostic');
assert(guide.doc.lieux.length === 7, `7 étapes (trouvé ${guide.doc.lieux.length})`);
assert(guide.doc.signaux.length >= 3, `Au moins 3 signaux (trouvé ${guide.doc.signaux.length})`);

// Les guides ne doivent pas avoir de warnings de permissions
const permWarnings = guide.validation.issues.filter(i => i.rule === 'lieu_permission_missing');
assert(permWarnings.length === 0, 'Pas de warnings de permissions sur un guide');

// ══════════════════════════════════════
// TEST 11: Parser edge cases
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge cases: parsing inline ═══${COLORS.reset}\n`);

const edgeCaseSource = `╔A:test_app | test_stack
§ domain: test

═══ L1: LIEUX ═══

@page_a [#public]
  .button /action {write}
    →$api_call {data}
      !ok >> @page_b {result}
      !err >> @page_a {error}
  →@page_b →@page_c

@page_b [#authentifié] 🔒
  .content /texte {lecture}
  ←@page_a

@page_c [#public]
  .items /liste:item {filtrable}

═══ L4: STORES ═══

^test_store [redis]
  {field1, field2, field3}
  > @page_a {field1}
  > @page_b {field2, field3}

═══ L5: ANOMALIES ═══

!critique security_hole [auth]
  < no rate limiting on $api_call
  = brute force attacks possible

╚═══════════════════════════════════════════
`;

const { document: edgeDoc, validation: edgeVal } = parseAndValidate(edgeCaseSource);

assert(edgeDoc.lieux.length === 3, `3 lieux parsés (trouvé ${edgeDoc.lieux.length})`);

// Multi-nav
const pageA = edgeDoc.lieux.find(l => l.name === 'page_a');
const pageANavs = pageA?.navigations || [];
assert(pageANavs.length >= 3, `@page_a: au moins 3 navigations (trouvé ${pageANavs.length})`);

// Inline results avec data
const apiNav = pageANavs.find(n => n.target.includes('api_call'));
assert(apiNav?.results !== undefined && apiNav.results.length === 2, 'Navigation vers $api a 2 résultats');
const okResult = apiNav?.results?.find(r => r.signal === 'ok');
assert(okResult?.data !== undefined && okResult.data.includes('result'), '!ok >> @page_b {result} — data capturée');

// Back nav
const pageB = edgeDoc.lieux.find(l => l.name === 'page_b');
assert(pageB?.locked === true, '@page_b est 🔒');
assert(pageB?.navigations.some(n => n.type === 'back'), '@page_b a une navigation ←');

// Store
assert(edgeDoc.stores.length === 1, '1 store');
assert(edgeDoc.stores[0].fields.length === 3, 'Store a 3 champs');
assert(edgeDoc.stores[0].feeds.length === 2, 'Store a 2 feeds');

// Signal critique
assert(edgeDoc.signaux.length === 1, '1 signal');
assert(edgeDoc.signaux[0].level === 'critique', 'Signal est !critique');
assert(edgeDoc.signaux[0].cause !== undefined, 'Signal a une cause');
assert(edgeDoc.signaux[0].impact !== undefined, 'Signal a un impact');

// ══════════════════════════════════════
// RÉSULTAT
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ════════════════════════════════════════${COLORS.reset}`);
if (failed === 0) {
  console.log(`  ${COLORS.green}${COLORS.bold}✓ ${passed} tests passés${COLORS.reset}`);
} else {
  console.log(`  ${COLORS.green}✓ ${passed} passés${COLORS.reset}  ${COLORS.red}✗ ${failed} échoués${COLORS.reset}`);
}
console.log(`${COLORS.bold}  ════════════════════════════════════════${COLORS.reset}\n`);

process.exit(failed > 0 ? 1 : 0);
