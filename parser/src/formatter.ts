// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Formatter — Affichage lisible des résultats
// ══════════════════════════════════════════════

import type { AIDLDocument, ValidationResult } from './types.js';

const COLORS = {
  reset:    '\x1b[0m',
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  italic:   '\x1b[3m',
  red:      '\x1b[31m',
  green:    '\x1b[32m',
  yellow:   '\x1b[33m',
  blue:     '\x1b[34m',
  magenta:  '\x1b[35m',
  cyan:     '\x1b[36m',
  white:    '\x1b[37m',
  bgRed:    '\x1b[41m',
  bgGreen:  '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

export function formatHeader(doc: AIDLDocument): string {
  const h = doc.header;
  const lines: string[] = [];
  lines.push('');
  lines.push(c('bold', `  ╔ ${h.fileType.toUpperCase()}: ${h.name}`));
  if (h.stack) lines.push(c('dim', `  ║ Stack: ${h.stack}`));
  if (h.dependencies?.length) lines.push(c('dim', `  ║ Deps: ${h.dependencies.join(', ')}`));

  if (Object.keys(doc.dictionary.entries).length > 0) {
    lines.push(c('yellow', `  ║ § Dictionnaire: ${Object.keys(doc.dictionary.entries).length} termes`));
  }
  if (doc.links.length > 0) {
    lines.push(c('cyan', `  ║ & Liens: ${doc.links.map(l => l.target).join(', ')}`));
  }

  return lines.join('\n');
}

export function formatStats(validation: ValidationResult): string {
  const s = validation.stats;
  const lines: string[] = [];

  lines.push('');
  lines.push(c('bold', '  ── STRUCTURE ──'));
  lines.push('');
  lines.push(`  ${c('magenta', `@ ${s.lieux}`)} lieux`);
  lines.push(`  ${c('blue', `. ${s.objets}`)} objets`);
  lines.push(`  ${c('cyan', `$ ${s.portes}`)} portes API`);
  lines.push(`  ${c('green', `^ ${s.stores}`)} stores`);
  lines.push(`  ${c('dim', `~ ${s.flux}`)} flux`);
  lines.push(`  ${c('yellow', `! ${s.signaux}`)} signaux (${c('red', `${s.critiques} critiques`)}, ${c('yellow', `${s.attentions} attentions`)})`);
  lines.push(c('dim', `  ${s.lignes} lignes`));

  return lines.join('\n');
}

export function formatLieux(doc: AIDLDocument): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(c('bold', '  ── CARTE DES LIEUX (L1) ──'));
  lines.push('');

  for (const lieu of doc.lieux) {
    const perms = lieu.permissions.length > 0
      ? c('dim', ` [${lieu.permissions.map(p => '#' + p).join(', ')}]`)
      : '';
    const lock = lieu.locked ? ' 🔒' : '';
    const params = lieu.parameters ? c('cyan', `{${lieu.parameters}}`) : '';
    const objCount = lieu.objects.length > 0 ? c('dim', ` (${lieu.objects.length} objets)`) : '';
    const navCount = lieu.navigations.length > 0 ? c('dim', ` → ${lieu.navigations.length} chemins`) : '';

    lines.push(`  ${c('magenta', '@' + lieu.name)}${params}${perms}${lock}${objCount}${navCount}`);
  }

  return lines.join('\n');
}

export function formatPortes(doc: AIDLDocument): string {
  if (doc.portes.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push(c('bold', '  ── PORTES API (L4) ──'));
  lines.push('');

  for (const porte of doc.portes) {
    const method = porte.method ? c('green', `:${porte.method}`) : '';
    const perm = porte.permission ? c('dim', ` [${porte.permission}]`) : '';
    const timing = porte.timeout ? c('dim', ` (${porte.timeout}${porte.retry ? ', ' + porte.retry : ''})`) : '';
    lines.push(`  ${c('cyan', '$' + porte.name)}${method}${perm}${timing}`);

    if (porte.input?.length) {
      lines.push(c('dim', `    entrée: {${porte.input.join(', ')}}`));
    }
    if (porte.output?.length) {
      lines.push(c('dim', `    sortie: {${porte.output.join(', ')}}`));
    }
  }

  return lines.join('\n');
}

export function formatSignaux(doc: AIDLDocument): string {
  if (doc.signaux.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push(c('bold', '  ── ANOMALIES (L5) ──'));
  lines.push('');

  for (const signal of doc.signaux) {
    const levelColor = signal.level === 'critique' ? 'red' : 'yellow';
    const icon = signal.level === 'critique' ? '⛔' : '⚠';
    const ctx = signal.context ? c('dim', ` [${signal.context}]`) : '';

    lines.push(`  ${icon} ${c(levelColor, `!${signal.level}`)} ${signal.name}${ctx}`);
    if (signal.cause) lines.push(c('dim', `     < ${signal.cause}`));
    if (signal.impact) lines.push(c('dim', `     = ${signal.impact}`));
  }

  return lines.join('\n');
}

export function formatValidation(validation: ValidationResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(c('bold', '  ── VALIDATION ──'));
  lines.push('');

  if (validation.issues.length === 0) {
    lines.push(`  ${c('green', '✓ Aucun problème détecté')}`);
  } else {
    const errors = validation.issues.filter(i => i.severity === 'error');
    const warnings = validation.issues.filter(i => i.severity === 'warning');
    const infos = validation.issues.filter(i => i.severity === 'info');

    if (errors.length > 0) {
      lines.push(c('red', `  ✗ ${errors.length} erreur(s):`));
      for (const e of errors) {
        lines.push(c('red', `    L${e.line || '?'}: ${e.message}`));
      }
    }

    if (warnings.length > 0) {
      lines.push(c('yellow', `  ⚠ ${warnings.length} avertissement(s):`));
      for (const w of warnings) {
        lines.push(c('yellow', `    L${w.line || '?'}: ${w.message}`));
      }
    }

    if (infos.length > 0) {
      for (const info of infos) {
        lines.push(c('dim', `    ℹ L${info.line || '?'}: ${info.message}`));
      }
    }
  }

  lines.push('');
  const badge = validation.valid
    ? c('bgGreen', c('bold', ' VALIDE '))
    : c('bgRed', c('bold', ' INVALIDE '));
  lines.push(`  Résultat: ${badge}`);

  return lines.join('\n');
}

export function formatFull(doc: AIDLDocument, validation: ValidationResult): string {
  const parts: string[] = [];

  parts.push(c('bold', '\n  ════════════════════════════════════════'));
  parts.push(c('bold', '   AIDL Parser — Analyse complète'));
  parts.push(c('bold', '  ════════════════════════════════════════'));

  parts.push(formatHeader(doc));
  parts.push(formatStats(validation));
  parts.push(formatLieux(doc));
  parts.push(formatPortes(doc));
  parts.push(formatSignaux(doc));
  parts.push(formatValidation(validation));

  parts.push('');

  return parts.join('\n');
}
