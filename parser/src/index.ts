// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL — Module principal
// ══════════════════════════════════════════════

export { parse } from './parser.js';
export { validate } from './validator.js';
export type * from './types.js';

import { parse } from './parser.js';
import { validate } from './validator.js';
import type { ParseResult } from './types.js';

/**
 * Parse et valide un fichier .aidl en une seule opération.
 * Retourne l'AST complet + le rapport de validation.
 */
export function parseAndValidate(source: string): ParseResult {
  const document = parse(source);
  const totalLines = source.split('\n').length;
  const validation = validate(document, totalLines);
  return { document, validation };
}
