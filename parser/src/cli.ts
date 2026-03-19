#!/usr/bin/env node
// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL CLI — Outil en ligne de commande
// ══════════════════════════════════════════════
//
// Usage:
//   npx tsx src/cli.ts <fichier.aidl>              Analyse et affiche le rapport
//   npx tsx src/cli.ts <fichier.aidl> --json        Exporte l'AST en JSON
//   npx tsx src/cli.ts <fichier.aidl> --validate    Validation uniquement
//   npx tsx src/cli.ts <fichier.aidl> --stats       Stats uniquement
//

import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';
import { parseAndValidate } from './index.js';
import { formatFull, formatStats, formatValidation } from './formatter.js';

// ── Arguments ──
const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith('--'));
const files = args.filter(a => !a.startsWith('--'));

if (files.length === 0) {
  console.log(`
  ${'\x1b[1m'}AIDL Parser v0.1${'\x1b[0m'} — AI Description Language

  Usage:
    npx tsx src/cli.ts <fichier.aidl>              Analyse complète
    npx tsx src/cli.ts <fichier.aidl> --json        Export AST en JSON
    npx tsx src/cli.ts <fichier.aidl> --json-out    Export AST dans un fichier .json
    npx tsx src/cli.ts <fichier.aidl> --validate    Validation uniquement
    npx tsx src/cli.ts <fichier.aidl> --stats       Statistiques uniquement

  Exemples:
    npx tsx src/cli.ts ../exemples/assistia.aidl
    npx tsx src/cli.ts ../exemples/assistia.aidl --json-out
    npx tsx src/cli.ts ../exemples/produit-kuschall-ksl.aidl
  `);
  process.exit(0);
}

// ── Traitement ──
for (const filePath of files) {
  const fullPath = resolve(filePath);
  const fileName = basename(fullPath);

  let source: string;
  try {
    source = readFileSync(fullPath, 'utf-8');
  } catch (err) {
    console.error(`\x1b[31m  Erreur: impossible de lire ${fullPath}\x1b[0m`);
    process.exit(1);
  }

  const { document, validation } = parseAndValidate(source);

  // ── Mode JSON ──
  if (flags.includes('--json')) {
    console.log(JSON.stringify({ document, validation }, null, 2));
    continue;
  }

  // ── Mode JSON export fichier ──
  if (flags.includes('--json-out')) {
    const outPath = fullPath.replace(/\.aidl$/, '.ast.json');
    writeFileSync(outPath, JSON.stringify({ document, validation }, null, 2), 'utf-8');
    console.log(`\x1b[32m  ✓ AST exporté: ${outPath}\x1b[0m`);
    continue;
  }

  // ── Mode validation seule ──
  if (flags.includes('--validate')) {
    console.log(formatValidation(validation));
    continue;
  }

  // ── Mode stats seules ──
  if (flags.includes('--stats')) {
    console.log(formatStats(validation));
    continue;
  }

  // ── Mode complet (défaut) ──
  console.log(`\n  \x1b[2mFichier: ${fileName}\x1b[0m`);
  console.log(formatFull(document, validation));
}
