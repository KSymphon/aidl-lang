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
// TEST 12: Stress — fichier complexe avec toutes les features
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: fichier complexe complet ═══${COLORS.reset}\n`);

const stressSource = `╔A:mega-platform | next.js 15, node.js 20 | supabase, redis, stripe, elasticsearch, s3
§ domain: enterprise SaaS platform
§ state: production
§ SKU = stock keeping unit
§ RBAC = role-based access control
§ SSO = single sign-on
§ MFA = multi-factor authentication
§ ETL = extract-transform-load
&auth-module.aidl
&billing-module.aidl

═══ L1: LIEUX ═══

@landing [#public]
  .hero /texte {lecture}
  .cta_signup /action {écriture} →@register
  .cta_login /action {écriture} →@login
  .pricing /liste:plan {lecture, filtrable}
  .search /texte {écriture, dynamique}
  →@register →@login →@docs →@pricing →@blog

@register [#anonyme]
  .email /texte {requis, écriture}
  .password /texte {requis, écriture}
  .company_name /texte {requis, écriture}
  .plan /choix:free|starter|pro|enterprise {requis, choix}
  →$create_account {email, password, company_name, plan}
    !ok >> @onboarding {user_id, token}
    !err >> @register {error_message}
  ←@landing

@login [#anonyme]
  .email /texte {requis, écriture}
  .password /texte {requis, écriture}
  .mfa_code /nombre {écriture, dynamique}
  →$authenticate {email, password, mfa_code}
    !ok >> @dashboard {session}
    !err >> @login {error}
  →@forgot_password
  ←@landing

@dashboard [#authentifié] 🔒
  .stats_revenue /nombre {lecture, dynamique}
  .stats_users /nombre {lecture, dynamique}
  .stats_orders /nombre {lecture, dynamique}
  .alerts /liste:alert {lecture}
  .recent_activity /liste:event {lecture}
  .quick_actions /liste:action {lecture}
  →@users →@products →@orders →@analytics →@settings →@billing

@users [#rôle:admin] 🔒
  .list /liste:user {lecture, filtrable}
  .search /texte {écriture}
  .invite_button /action {écriture}
  →@user_detail{user_id} →@user_invite

@user_detail{user_id} [#rôle:admin] 🔒
  .profile /table:field*value {lecture, écriture}
  .activity_log /liste:event {lecture, filtrable}
  .permissions /liste:permission {lecture, écriture}
  →$update_user {user_id, changes}
    !ok >> @user_detail {updated}
    !err >> @user_detail {error}
  →$delete_user {user_id}
    !ok >> @users {deleted}
    !err >> @user_detail {error}
  ←@users

@products [#authentifié] 🔒
  .catalog /liste:product {lecture, filtrable}
  .search /texte {écriture}
  .filter_category /choix:electronics|clothing|food|other {choix}
  .add_product /action {écriture} →@product_edit{new}
  →@product_detail{sku}

@product_detail{sku} [#authentifié] 🔒
  .info /table:field*value {lecture}
  .images /liste:image {lecture}
  .variants /liste:variant {lecture, écriture}
  .stock_level /nombre {lecture, dynamique}
  →$update_product {sku, changes}
    !ok >> @product_detail {saved}
    !err >> @product_detail {error}
  ←@products

@orders [#authentifié] 🔒
  .list /liste:order {lecture, filtrable}
  .search /texte {écriture}
  .date_range /date {écriture}
  .status_filter /choix:pending|processing|shipped|delivered|cancelled {choix, filtrable}
  →@order_detail{order_id}

@order_detail{order_id} [#authentifié] 🔒
  .summary /table:field*value {lecture}
  .items /liste:order_item {lecture}
  .timeline /liste:event {lecture}
  .customer_info /table:field*value {lecture}
  .shipping_info /table:field*value {lecture, écriture}
  →$update_order_status {order_id, status}
    !ok >> @order_detail {updated}
    !err >> @order_detail {error}
  →$refund_order {order_id, amount, reason}
    !ok >> @order_detail {refunded}
    !err >> @order_detail {error}
  ←@orders

@analytics [#rôle:admin] 🔒
  .revenue_chart /table:date*amount {lecture, dynamique}
  .user_growth /table:date*count {lecture, dynamique}
  .top_products /liste:product {lecture}
  .conversion_funnel /table:step*rate {lecture, dynamique}
  .export_csv /action {écriture}

@settings [#rôle:admin] 🔒
  .company_info /table:field*value {lecture, écriture}
  .billing_plan /texte {lecture}
  .api_keys /liste:api_key {lecture}
  .integrations /liste:integration {lecture, écriture}
  .webhooks /liste:webhook {lecture, écriture}
  →@billing

@billing [#rôle:admin] 🔒
  .current_plan /texte {lecture}
  .usage /table:metric*value {lecture, dynamique}
  .invoices /liste:invoice {lecture}
  .payment_method /table:field*value {lecture, écriture}
  →$update_payment {card_token}
    !ok >> @billing {updated}
    !err >> @billing {error}
  →$change_plan {plan_id}
    !ok >> @billing {plan_changed}
    !err >> @billing {error}

@forgot_password [#anonyme]
  .email /texte {requis, écriture}
  →$request_reset {email}
    !ok >> @login {reset_email_sent}
    !err >> @forgot_password {error}

@onboarding [#authentifié] 🔒
  .welcome /texte {lecture}
  .setup_wizard /liste:step {lecture, écriture}
  .invite_team /liste:email {écriture}
  →@dashboard

@docs [#public]
  .documentation /texte {lecture}
  .api_reference /liste:endpoint {lecture, filtrable}
  .guides /liste:guide {lecture}

@blog [#public]
  .articles /liste:article {lecture}
  .search /texte {écriture}

@user_invite [#rôle:admin] 🔒
  .emails /liste:email {écriture, requis}
  .role /choix:viewer|editor|admin {requis, choix}
  →$send_invites {emails, role}
    !ok >> @users {invites_sent}
    !err >> @user_invite {error}
  ←@users

@product_edit{mode} [#rôle:admin] 🔒
  .name /texte {requis, écriture}
  .description /texte {écriture}
  .price /nombre {requis, écriture}
  .images /liste:fichier {écriture}
  .category /choix:electronics|clothing|food|other {requis, choix}
  →$save_product {product_data}
    !ok >> @product_detail {saved}
    !err >> @product_edit {error}
  ←@products

═══ L4: STORES ═══

^store_session [redis]
  {user_id, company_id, role, permissions, token, expires_at}
  > @dashboard {user_id, role}
  > @users {permissions}
  > @analytics {company_id}

^store_cart [zustand]
  {items, total, discount_code, shipping_method}
  > @orders {items, total}
  > @billing {total}

^store_notifications [zustand]
  {unread_count, items, last_fetched}
  > @dashboard {unread_count}
  > @landing {items}

═══ L4: PORTES API ═══

$create_account :POST
  input: {email, password, company_name, plan}
  output: {user_id, token, company_id}
  [#anonyme] (timeout: 10s, retry: 0)
  chain: validate_email >> check_duplicate >> hash_password >> create_user >> create_company >> send_welcome_email >> generate_token

$authenticate :POST
  input: {email, password, mfa_code}
  output: {session_token, user, permissions}
  [#anonyme] (timeout: 5s, retry: 1)
  chain: verify_credentials >> check_mfa >> generate_session >> load_permissions

$update_user :PATCH
  input: {user_id, changes}
  output: {updated_user}
  [#rôle:admin] (timeout: 5s, retry: 1)

$delete_user :DELETE
  input: {user_id}
  output: {success}
  [#rôle:admin] (timeout: 5s, retry: 0)

$update_product :PUT
  input: {sku, changes}
  output: {updated_product}
  [#authentifié] (timeout: 10s, retry: 1)

$save_product :POST
  input: {product_data}
  output: {sku, product}
  [#rôle:admin] (timeout: 15s, retry: 0)

$update_order_status :PATCH
  input: {order_id, status}
  output: {updated_order}
  [#authentifié] (timeout: 5s, retry: 2)

$refund_order :POST
  input: {order_id, amount, reason}
  output: {refund_id, status}
  [#rôle:admin] (timeout: 30s, retry: 0)

$request_reset :POST
  input: {email}
  output: {success}
  [#anonyme] (timeout: 5s, retry: 0)

$send_invites :POST
  input: {emails, role}
  output: {invites_sent, failures}
  [#rôle:admin] (timeout: 15s, retry: 0)

$update_payment :POST
  input: {card_token}
  output: {payment_method}
  [#rôle:admin] (timeout: 10s, retry: 0)

$change_plan :POST
  input: {plan_id}
  output: {new_plan, next_billing_date}
  [#rôle:admin] (timeout: 10s, retry: 0)

═══ L4: FLUX ═══

~session_cleanup [cron:0 3 * * *]
  expired_sessions => purge => log_purged_count

~analytics_aggregation [cron:0 */6 * * *]
  raw_events => aggregate_by_day => compute_metrics => update_dashboards

~product_index_sync [every:15min]
  products_db => transform_for_search => elasticsearch_bulk_index

~invoice_generation [cron:0 0 1 * *]
  active_subscriptions => calculate_usage => generate_invoice => send_email

~backup_daily [cron:0 2 * * *]
  all_databases => snapshot => compress => upload_s3 => verify_integrity

═══ L5: ANOMALIES ═══

!critique security_no_rate_limit [$authenticate]
  < no rate limiting on authentication endpoint
  = brute force attacks possible, account takeover risk

!critique security_no_mfa_enforcement [MFA]
  < MFA is optional, not enforced for admin accounts
  = admin accounts vulnerable to credential stuffing

!critique data_no_encryption_at_rest [supabase]
  < sensitive customer data stored without encryption at rest
  = GDPR/compliance violation risk

!attention performance_n_plus_1 [@orders]
  < order list loads items with N+1 queries
  = page load time > 3s with 100+ orders

!attention ux_no_pagination [@products]
  < product catalog loads all products at once
  = memory issues and slow rendering with 1000+ products

!attention billing_no_webhook_retry [$update_payment]
  < stripe webhooks not retried on failure
  = missed payment updates, billing state desync

╚═══════════════════════════════════════════
`;

const { document: stressDoc, validation: stressVal } = parseAndValidate(stressSource);

// Structure
assert(stressDoc.header.fileType === 'app', 'Stress: type app');
assert(stressDoc.header.name === 'mega-platform', 'Stress: nom mega-platform');
assert(stressDoc.header.stack === 'next.js 15, node.js 20', 'Stress: stack complète');
assert(stressDoc.header.dependencies !== undefined && stressDoc.header.dependencies.length >= 4, `Stress: ≥4 deps (trouvé ${stressDoc.header.dependencies?.length})`);

// Dictionnaire
const dictKeys = Object.keys(stressDoc.dictionary.entries);
assert(dictKeys.length >= 6, `Stress: ≥6 termes au dictionnaire (trouvé ${dictKeys.length})`);
assert(stressDoc.dictionary.entries['SKU'] !== undefined, 'Stress: dict contient SKU');
assert(stressDoc.dictionary.entries['MFA'] !== undefined, 'Stress: dict contient MFA');
assert(stressDoc.dictionary.entries['ETL'] !== undefined, 'Stress: dict contient ETL');

// Liens
assert(stressDoc.links.length === 2, `Stress: 2 liens (trouvé ${stressDoc.links.length})`);
assert(stressDoc.links[0].target === 'auth-module.aidl', 'Stress: lien vers auth-module.aidl');

// Lieux — doit tous les parser
assert(stressDoc.lieux.length === 19, `Stress: 19 lieux (trouvé ${stressDoc.lieux.length})`);

// Lieux publics vs protégés
const publicLieux = stressDoc.lieux.filter(l => l.permissions.includes('public'));
const authLieux = stressDoc.lieux.filter(l => l.locked);
assert(publicLieux.length === 3, `Stress: 3 lieux publics (trouvé ${publicLieux.length})`);
assert(authLieux.length >= 12, `Stress: ≥12 lieux verrouillés (trouvé ${authLieux.length})`);

// Lieux avec paramètres
const userDetail = stressDoc.lieux.find(l => l.name === 'user_detail');
assert(userDetail !== undefined, 'Stress: @user_detail existe');
assert(userDetail?.parameters === 'user_id', 'Stress: @user_detail{user_id} a paramètre');

const orderDetail = stressDoc.lieux.find(l => l.name === 'order_detail');
assert(orderDetail !== undefined, 'Stress: @order_detail existe');
assert(orderDetail?.parameters === 'order_id', 'Stress: @order_detail{order_id} a paramètre');

const productEdit = stressDoc.lieux.find(l => l.name === 'product_edit');
assert(productEdit !== undefined, 'Stress: @product_edit existe');
assert(productEdit?.parameters === 'mode', 'Stress: @product_edit{mode} a paramètre');

// ══════════════════════════════════════
// TEST 13: Stress — objets et navigations en profondeur
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: objets & navigations ═══${COLORS.reset}\n`);

// @landing — 5 objets, 5+ navigations
const landing = stressDoc.lieux.find(l => l.name === 'landing');
assert(landing !== undefined && landing.objects.length === 5, `Stress: @landing a 5 objets (trouvé ${landing?.objects.length})`);
const landingNavs = landing?.navigations.map(n => n.target) || [];
assert(landingNavs.length >= 5, `Stress: @landing ≥5 navigations (trouvé ${landingNavs.length})`);

// @dashboard — 6 objets, 6 navigations multi-inline
const dashboard = stressDoc.lieux.find(l => l.name === 'dashboard');
assert(dashboard !== undefined && dashboard.objects.length === 6, `Stress: @dashboard a 6 objets (trouvé ${dashboard?.objects.length})`);
const dashNavTargets = dashboard?.navigations.map(n => n.target) || [];
assert(dashNavTargets.length >= 6, `Stress: @dashboard ≥6 navigations (trouvé ${dashNavTargets.length})`);

// @register — navigation avec résultats !ok !err et données
const register = stressDoc.lieux.find(l => l.name === 'register');
const regApiNav = register?.navigations.find(n => n.target.includes('create_account'));
assert(regApiNav !== undefined, 'Stress: @register navigue vers $create_account');
assert(regApiNav?.data?.includes('email'), 'Stress: →$create_account envoie {email}');
assert(regApiNav?.results !== undefined && regApiNav.results.length === 2, `Stress: $create_account a 2 résultats (trouvé ${regApiNav?.results?.length})`);
const regOk = regApiNav?.results?.find(r => r.signal === 'ok');
assert(regOk?.target?.includes('onboarding'), 'Stress: !ok >> @onboarding');
assert(regOk?.data?.includes('user_id'), 'Stress: !ok transporte {user_id, token}');

// @user_detail — navigation delete avec résultat vers autre lieu
const userDetailNavs = userDetail?.navigations || [];
const deleteNav = userDetailNavs.find(n => n.target.includes('delete_user'));
assert(deleteNav !== undefined, 'Stress: @user_detail navigue vers $delete_user');
const deleteOk = deleteNav?.results?.find(r => r.signal === 'ok');
assert(deleteOk?.target?.includes('users'), 'Stress: $delete_user !ok >> @users');

// @order_detail — 2 API calls (update + refund)
const orderNavs = orderDetail?.navigations || [];
const updateStatusNav = orderNavs.find(n => n.target.includes('update_order_status'));
const refundNav = orderNavs.find(n => n.target.includes('refund_order'));
assert(updateStatusNav !== undefined, 'Stress: @order_detail navigue vers $update_order_status');
assert(refundNav !== undefined, 'Stress: @order_detail navigue vers $refund_order');
assert(refundNav?.data?.includes('amount'), 'Stress: $refund_order envoie {amount}');

// ══════════════════════════════════════
// TEST 14: Stress — stores multiples
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: stores ═══${COLORS.reset}\n`);

assert(stressDoc.stores.length === 3, `Stress: 3 stores (trouvé ${stressDoc.stores.length})`);

const sessionStore = stressDoc.stores.find(s => s.name === 'store_session');
assert(sessionStore !== undefined, 'Stress: ^store_session existe');
assert(sessionStore?.technology === 'redis', 'Stress: ^store_session utilise redis');
assert(sessionStore?.fields.length === 6, `Stress: ^store_session a 6 champs (trouvé ${sessionStore?.fields.length})`);
assert(sessionStore?.fields.includes('user_id'), 'Stress: champ user_id');
assert(sessionStore?.fields.includes('expires_at'), 'Stress: champ expires_at');
assert(sessionStore?.feeds.length === 3, `Stress: ^store_session a 3 feeds (trouvé ${sessionStore?.feeds.length})`);

const notifStore = stressDoc.stores.find(s => s.name === 'store_notifications');
assert(notifStore !== undefined, 'Stress: ^store_notifications existe');
assert(notifStore?.technology === 'zustand', 'Stress: ^store_notifications utilise zustand');

// ══════════════════════════════════════
// TEST 15: Stress — portes API complètes
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: portes API ═══${COLORS.reset}\n`);

assert(stressDoc.portes.length === 12, `Stress: 12 portes API (trouvé ${stressDoc.portes.length})`);

// $create_account — chaîne longue
const createAcct = stressDoc.portes.find(p => p.name === 'create_account');
assert(createAcct !== undefined, 'Stress: $create_account existe');
assert(createAcct?.method === 'POST', 'Stress: $create_account :POST');
assert(createAcct?.input?.length === 4, `Stress: $create_account 4 inputs (trouvé ${createAcct?.input?.length})`);
assert(createAcct?.output?.length === 3, `Stress: $create_account 3 outputs (trouvé ${createAcct?.output?.length})`);
assert(createAcct?.chain !== undefined && createAcct.chain.includes('hash_password'), 'Stress: chaîne contient hash_password');
assert(createAcct?.timeout === 'timeout: 10s', 'Stress: timeout 10s');

// $authenticate — méthode POST, MFA dans la chaîne
const auth = stressDoc.portes.find(p => p.name === 'authenticate');
assert(auth !== undefined, 'Stress: $authenticate existe');
assert(auth?.chain !== undefined && auth.chain.includes('check_mfa'), 'Stress: chaîne contient check_mfa');

// Toutes les méthodes HTTP
const methods = stressDoc.portes.map(p => p.method);
assert(methods.includes('POST'), 'Stress: a une porte POST');
assert(methods.includes('PATCH'), 'Stress: a une porte PATCH');
assert(methods.includes('DELETE'), 'Stress: a une porte DELETE');
assert(methods.includes('PUT'), 'Stress: a une porte PUT');

// $refund_order — timeout long
const refundPorte = stressDoc.portes.find(p => p.name === 'refund_order');
assert(refundPorte !== undefined, 'Stress: $refund_order existe');
assert(refundPorte?.timeout === 'timeout: 30s', 'Stress: refund timeout 30s');

// ══════════════════════════════════════
// TEST 16: Stress — flux planifiés
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: flux ═══${COLORS.reset}\n`);

assert(stressDoc.flux.length === 5, `Stress: 5 flux (trouvé ${stressDoc.flux.length})`);

const sessionCleanup = stressDoc.flux.find(f => f.name === 'session_cleanup');
assert(sessionCleanup !== undefined, 'Stress: ~session_cleanup existe');
assert(sessionCleanup?.context?.includes('cron'), 'Stress: ~session_cleanup a un cron');
assert(sessionCleanup?.steps !== undefined && sessionCleanup.steps.length >= 3, `Stress: ~session_cleanup ≥3 steps (trouvé ${sessionCleanup?.steps?.length})`);

const productSync = stressDoc.flux.find(f => f.name === 'product_index_sync');
assert(productSync !== undefined, 'Stress: ~product_index_sync existe');
assert(productSync?.context?.includes('every'), 'Stress: ~product_index_sync a every:15min');

const backup = stressDoc.flux.find(f => f.name === 'backup_daily');
assert(backup !== undefined, 'Stress: ~backup_daily existe');
assert(backup?.steps !== undefined && backup.steps.length >= 4, `Stress: ~backup_daily ≥4 steps (trouvé ${backup?.steps?.length})`);

// ══════════════════════════════════════
// TEST 17: Stress — signaux d'anomalie
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Stress: signaux ═══${COLORS.reset}\n`);

assert(stressDoc.signaux.length === 6, `Stress: 6 signaux (trouvé ${stressDoc.signaux.length})`);

const critiques = stressDoc.signaux.filter(s => s.level === 'critique');
const attentions = stressDoc.signaux.filter(s => s.level === 'attention');
assert(critiques.length === 3, `Stress: 3 !critique (trouvé ${critiques.length})`);
assert(attentions.length === 3, `Stress: 3 !attention (trouvé ${attentions.length})`);

// Chaque signal a cause et impact
assert(stressDoc.signaux.every(s => s.cause !== undefined), 'Stress: tous les signaux ont une cause');
assert(stressDoc.signaux.every(s => s.impact !== undefined), 'Stress: tous les signaux ont un impact');

// Signal spécifique
const noRateLimit = stressDoc.signaux.find(s => s.name.includes('no_rate_limit'));
assert(noRateLimit !== undefined, 'Stress: signal security_no_rate_limit trouvé');
assert(noRateLimit?.context?.includes('authenticate'), 'Stress: signal lié à $authenticate');
assert(noRateLimit?.cause?.includes('brute force') || noRateLimit?.cause?.includes('rate limit'), 'Stress: cause mentionne rate limit ou brute force');

// Validation globale
assert(stressVal.valid, 'Stress: validation globale VALIDE');
assert(stressVal.stats.lieux === 19, `Stress: stats montre 19 lieux (trouvé ${stressVal.stats.lieux})`);
assert(stressVal.stats.portes === 12, `Stress: stats montre 12 portes (trouvé ${stressVal.stats.portes})`);
assert(stressVal.stats.stores === 3, `Stress: stats montre 3 stores (trouvé ${stressVal.stats.stores})`);
assert(stressVal.stats.flux === 5, `Stress: stats montre 5 flux (trouvé ${stressVal.stats.flux})`);
assert(stressVal.stats.critiques === 3, `Stress: stats montre 3 critiques (trouvé ${stressVal.stats.critiques})`);

// ══════════════════════════════════════
// TEST 18: Edge — multi-navigation dense sur une ligne
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: multi-navigation dense ═══${COLORS.reset}\n`);

const multiNavSource = `╔A:nav-test | test
═══ L1: LIEUX ═══

@hub [#public]
  .content /texte {lecture}
  →@page_1 →@page_2 →@page_3 →@page_4 →@page_5 →@page_6

@page_1 [#public]
  ←@hub
@page_2 [#public]
  ←@hub
@page_3 [#public]
  ←@hub
@page_4 [#public]
  ←@hub
@page_5 [#public]
  ←@hub
@page_6 [#public]
  ←@hub

╚═══════════════════════════════════════════
`;

const { document: navDoc } = parseAndValidate(multiNavSource);
const hub = navDoc.lieux.find(l => l.name === 'hub');
assert(hub?.navigations.length === 6, `Edge: @hub a 6 navigations inline (trouvé ${hub?.navigations.length})`);
assert(navDoc.lieux.length === 7, `Edge: 7 lieux total (trouvé ${navDoc.lieux.length})`);

// Toutes les pages ont un back vers hub
const allHaveBack = navDoc.lieux
  .filter(l => l.name !== 'hub')
  .every(l => l.navigations.some(n => n.type === 'back'));
assert(allHaveBack, 'Edge: toutes les pages ont ←@hub');

// ══════════════════════════════════════
// TEST 19: Edge — signaux avec priorité numérique
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: signaux priorité ═══${COLORS.reset}\n`);

const prioritySource = `╔X:audit-test | security audit
═══ L5: ANOMALIES ═══

!critique security_critical [auth]
  < no input validation
  = SQL injection possible

!attention minor_issue [ui]
  < button not aligned
  = poor UX but no security risk

!critique another_critical [data]
  < no backup strategy
  = total data loss risk

╚═══════════════════════════════════════════
`;

const { document: prioDoc, validation: prioVal } = parseAndValidate(prioritySource);
assert(prioDoc.header.fileType === 'audit', 'Edge: type audit ╔X:');
assert(prioDoc.signaux.length === 3, `Edge: 3 signaux (trouvé ${prioDoc.signaux.length})`);
assert(prioDoc.signaux[0].level === 'critique', 'Edge: premier signal est critique');
assert(prioDoc.signaux[1].level === 'attention', 'Edge: deuxième signal est attention');
assert(prioDoc.signaux[2].level === 'critique', 'Edge: troisième signal est critique');
assert(prioVal.stats.critiques === 2, `Edge: stats 2 critiques (trouvé ${prioVal.stats.critiques})`);
assert(prioVal.stats.attentions === 1, `Edge: stats 1 attention (trouvé ${prioVal.stats.attentions})`);

// ══════════════════════════════════════
// TEST 20: Edge — portes avec chaîne longue et conditions
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: portes complexes ═══${COLORS.reset}\n`);

const complexPorteSource = `╔A:api-test | express
═══ L4: PORTES API ═══

$complex_process :POST
  input: {file_data, metadata, user_context}
  output: {processed_id, status, download_url}
  [#authentifié] (timeout: 120s, retry: 3)
  chain: validate_input >> virus_scan >> parse_file >> extract_metadata >> transform >> store_s3 >> index_elasticsearch >> notify_user

$simple_get :GET
  input: {id}
  output: {item}

╚═══════════════════════════════════════════
`;

const { document: porteDoc } = parseAndValidate(complexPorteSource);
assert(porteDoc.portes.length === 2, `Edge: 2 portes (trouvé ${porteDoc.portes.length})`);

const complexPorte = porteDoc.portes.find(p => p.name === 'complex_process');
assert(complexPorte?.method === 'POST', 'Edge: méthode POST');
assert(complexPorte?.input?.length === 3, `Edge: 3 inputs (trouvé ${complexPorte?.input?.length})`);
assert(complexPorte?.output?.length === 3, `Edge: 3 outputs (trouvé ${complexPorte?.output?.length})`);
assert(complexPorte?.timeout === 'timeout: 120s', 'Edge: timeout 120s');
assert(complexPorte?.retry === 'retry: 3', 'Edge: retry 3');
assert(complexPorte?.chain?.includes('virus_scan'), 'Edge: chaîne contient virus_scan');
assert(complexPorte?.chain?.includes('index_elasticsearch'), 'Edge: chaîne contient index_elasticsearch');

const simplePorte = porteDoc.portes.find(p => p.name === 'simple_get');
assert(simplePorte?.method === 'GET', 'Edge: simple GET');
assert(simplePorte?.timeout === undefined, 'Edge: simple GET pas de timeout');

// ══════════════════════════════════════
// TEST 21: Edge — flux avec transformations complexes
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: flux complexes ═══${COLORS.reset}\n`);

const fluxComplexSource = `╔F:data-pipeline | python | airflow, spark
§ domain: ML training pipeline
§ DAG = directed acyclic graph

═══ L4: FLUX ═══

~data_ingestion [cron:0 */2 * * *]
  kafka_stream => deduplicate => validate_schema => partition_by_date => parquet_store

~feature_engineering [cron:0 8 * * *]
  raw_data => clean_nulls => normalize => one_hot_encode => feature_vectors => feature_store

~model_training [cron:0 0 * * 0]
  feature_store => split_train_test => train_xgboost => evaluate_metrics => compare_champion => promote_or_reject

╚═══════════════════════════════════════════
`;

const { document: fluxDoc } = parseAndValidate(fluxComplexSource);
assert(fluxDoc.header.fileType === 'flux', 'Edge: type flux ╔F:');
assert(fluxDoc.flux.length === 3, `Edge: 3 flux (trouvé ${fluxDoc.flux.length})`);

const ingestion = fluxDoc.flux.find(f => f.name === 'data_ingestion');
assert(ingestion?.steps !== undefined && ingestion.steps.length >= 4, `Edge: ~data_ingestion ≥4 steps (trouvé ${ingestion?.steps?.length})`);

const featureEng = fluxDoc.flux.find(f => f.name === 'feature_engineering');
assert(featureEng?.steps !== undefined && featureEng.steps.length >= 5, `Edge: ~feature_engineering ≥5 steps (trouvé ${featureEng?.steps?.length})`);

const training = fluxDoc.flux.find(f => f.name === 'model_training');
assert(training?.context?.includes('cron'), 'Edge: ~model_training a un cron hebdomadaire');
assert(training?.steps?.some(s => s.includes('champion')), 'Edge: ~model_training inclut compare_champion');

// ══════════════════════════════════════
// TEST 22: Edge — fichier produit avec structures riches
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: fiche produit complexe ═══${COLORS.reset}\n`);

const productSource = `╔P:ventilator-pro-x7 | respiratory | classe IIb
§ domain: ventilateur médical de réanimation
§ MDR = Medical Device Regulation
§ GMDN = Global Medical Device Nomenclature
§ SpO2 = saturation pulsée en oxygène

═══ IDENTITÉ ═══

@identity
  .manufacturer: draeger
  .ref: vp-x7-2026
  .gmdn_code: 47832
  .class: IIb
  .ce_mark: oui [nb:0123]

═══ CARACTÉRISTIQUES ═══

@specifications
  .modes /liste:mode {lecture}
    :: VCV, PCV, PSV, SIMV, BiPAP, CPAP, HFOV
  .tidal_volume /nombre {lecture}
  .respiratory_rate /nombre {lecture}
  .peep_range /nombre {lecture}
  .fio2_range /nombre {lecture}
  .display /texte {lecture}
  .battery_backup /nombre {lecture}

═══ CONNECTIVITÉ ═══

@connectivity
  .hl7_fhir /texte {lecture}
  .dicom /texte {lecture}
  .wifi /texte {lecture}
  .bluetooth /texte {lecture}

═══ L5: ANOMALIES ═══

!attention alarms_config [safety]
  < alarm thresholds not user-configurable in HFOV mode
  = clinician cannot customize alerts for neonatal patients

!attention battery_life [autonomy]
  < battery backup only 4 hours
  = insufficient for inter-hospital transport > 3h

!attention spo2_accuracy [monitoring]
  < SpO2 sensor accuracy ±3% below 70%
  = unreliable readings in severe hypoxemia

╚═══════════════════════════════════════════
`;

const { document: prodDoc, validation: prodVal } = parseAndValidate(productSource);
assert(prodDoc.header.fileType === 'produit', 'Edge: type produit ╔P:');
assert(prodDoc.header.name === 'ventilator-pro-x7', 'Edge: nom ventilator-pro-x7');
assert(prodDoc.header.stack === 'respiratory', 'Edge: catégorie respiratory');

assert(Object.keys(prodDoc.dictionary.entries).length >= 4, `Edge: ≥4 termes de dictionnaire (trouvé ${Object.keys(prodDoc.dictionary.entries).length})`);
assert(prodDoc.dictionary.entries['MDR'] !== undefined, 'Edge: dict contient MDR');
assert(prodDoc.dictionary.entries['SpO2'] !== undefined, 'Edge: dict contient SpO2');

assert(prodDoc.lieux.length === 3, `Edge: 3 sections-lieux (trouvé ${prodDoc.lieux.length})`);
assert(prodDoc.signaux.length === 3, `Edge: 3 signaux (trouvé ${prodDoc.signaux.length})`);
assert(prodDoc.signaux.every(s => s.level === 'attention'), 'Edge: tous les signaux !attention');
assert(prodDoc.signaux.every(s => s.cause !== undefined && s.impact !== undefined), 'Edge: tous ont cause + impact');
assert(prodVal.valid, 'Edge: validation produit VALIDE');

// ══════════════════════════════════════
// TEST 23: Edge — objets avec contains (::)
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Edge: objets avec contains ═══${COLORS.reset}\n`);

const specs = prodDoc.lieux.find(l => l.name === 'specifications');
const modesObj = specs?.objects.find(o => o.name === 'modes');
assert(modesObj !== undefined, 'Edge: .modes existe');
assert(modesObj?.dataType === 'liste:mode', 'Edge: .modes type liste:mode');
// contains (::) sur ligne suivante — le parser ne supporte que :: inline
// Ce test vérifie que le parser ne crash pas sur cette syntaxe
assert(modesObj?.qualifiers.includes('lecture'), 'Edge: .modes a qualificateur lecture');

// ══════════════════════════════════════
// TEST 24: Validation — détection d'erreurs
// ══════════════════════════════════════

console.log(`\n${COLORS.bold}  ═══ Validation: détection d'erreurs ═══${COLORS.reset}\n`);

const invalidSource = `╔A:broken-app | test
═══ L1: LIEUX ═══

@page_without_permission
  .button /action {écriture}
  →@nonexistent_page

═══ L5: ANOMALIES ═══

!critique problem_one [security]
  < no auth
  = data leak

╚═══════════════════════════════════════════
`;

const { validation: invalidVal } = parseAndValidate(invalidSource);
// Le validator devrait détecter le lieu sans permission
const permIssues = invalidVal.issues.filter(i => i.rule === 'lieu_permission_missing');
assert(permIssues.length >= 1, `Validation: détecte lieu sans permission (trouvé ${permIssues.length} issues)`);

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
