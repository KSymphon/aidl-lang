// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Validator — Vérifie la conformité d'un document
// ══════════════════════════════════════════════

import type { AIDLDocument, ValidationResult, ValidationIssue } from './types.js';

export function validate(doc: AIDLDocument, totalLines: number): ValidationResult {
  const issues: ValidationIssue[] = [];

  // ── Règle 1: Header obligatoire ──
  if (!doc.header || doc.header.name === 'unknown') {
    issues.push({
      severity: 'error',
      message: 'En-tête ╔ manquant ou invalide. Un fichier .aidl doit commencer par ╔TYPE:nom',
      rule: 'header_required',
      line: 1,
    });
  }

  // ── Règle 2: Dictionnaire § si termes spécifiques ──
  // On vérifie si des termes techniques apparaissent sans être définis dans §
  // Pour l'instant on signale juste si § est vide ET qu'il y a des termes avec =
  if (Object.keys(doc.dictionary.entries).length === 0) {
    // Pas de warning pour l'instant, le § est optionnel si pas de jargon
  }

  // ── Règle 3: Lieux doivent avoir des permissions ──
  // Exception: les guides (╔G:) et flux (╔F:) n'exigent pas de permissions sur les étapes
  const skipPermissionCheck = doc.header.fileType === 'guide' || doc.header.fileType === 'flux';
  for (const lieu of doc.lieux) {
    if (lieu.permissions.length === 0 && lieu.modifiers.length === 0 && !skipPermissionCheck) {
      issues.push({
        severity: 'warning',
        message: `@${lieu.name} n'a pas de permission déclarée [#public], [#authentifié], etc.`,
        rule: 'lieu_permission_missing',
        line: lieu.line,
      });
    }
  }

  // ── Règle 4: Navigations vers des lieux existants ──
  const lieuNames = new Set(doc.lieux.map(l => l.name));
  for (const lieu of doc.lieux) {
    for (const nav of lieu.navigations) {
      // Extraire le nom du lieu cible
      const targetClean = nav.target
        .replace(/\{[^}]*\}/g, '')
        .replace(/\[.*\]/g, '')
        .replace(/>>.*/, '')
        .replace(/\|.*/, '')
        .trim();

      // Vérifier les cibles @lieu
      const atTargets = targetClean.match(/@(\S+)/g);
      if (atTargets) {
        for (const atTarget of atTargets) {
          const name = atTarget.slice(1).replace(/\{.*\}/, '').replace(/\/\{.*\}/, '/{slug}');
          // On ne vérifie pas les patterns dynamiques comme /{slug}
          if (!name.includes('{') && !name.includes('/') && !lieuNames.has(name)) {
            // Vérifier aussi les noms partiels
            const found = [...lieuNames].some(l =>
              l.startsWith(name) || name.startsWith(l) || l.includes(name)
            );
            if (!found) {
              issues.push({
                severity: 'warning',
                message: `Navigation vers @${name} mais ce lieu n'est pas déclaré dans le fichier`,
                rule: 'navigation_target_missing',
                line: nav.line,
              });
            }
          }
        }
      }
    }
  }

  // ── Règle 5: Portes API doivent avoir une méthode ──
  for (const porte of doc.portes) {
    if (!porte.method) {
      issues.push({
        severity: 'warning',
        message: `$${porte.name} n'a pas de méthode HTTP déclarée (:POST, :GET, :AUTH, etc.)`,
        rule: 'porte_method_missing',
        line: porte.line,
      });
    }
  }

  // ── Règle 6: Signaux doivent avoir cause ET impact ──
  for (const signal of doc.signaux) {
    if (!signal.cause) {
      issues.push({
        severity: 'warning',
        message: `!${signal.level} ${signal.name} — cause manquante (ligne commençant par <)`,
        rule: 'signal_cause_missing',
        line: signal.line,
      });
    }
    if (!signal.impact) {
      issues.push({
        severity: 'warning',
        message: `!${signal.level} ${signal.name} — impact manquant (ligne commençant par =)`,
        rule: 'signal_impact_missing',
        line: signal.line,
      });
    }
  }

  // ── Règle 7: Taille max 500 lignes ──
  if (totalLines > 500) {
    issues.push({
      severity: 'warning',
      message: `Le fichier fait ${totalLines} lignes (max recommandé: 500). Envisager de découper avec &`,
      rule: 'file_too_long',
      line: totalLines,
    });
  }

  // ── Règle 8: Stores doivent avoir des champs ──
  for (const store of doc.stores) {
    if (store.fields.length === 0) {
      issues.push({
        severity: 'warning',
        message: `^${store.name} n'a pas de champs déclarés {champ1, champ2}`,
        rule: 'store_fields_missing',
        line: store.line,
      });
    }
  }

  // ── Règle 9: Liens & doivent pointer vers des fichiers .aidl ──
  for (const link of doc.links) {
    if (!link.target.endsWith('.aidl')) {
      issues.push({
        severity: 'error',
        message: `&${link.target} — les liens doivent pointer vers des fichiers .aidl`,
        rule: 'link_invalid_extension',
        line: link.line,
      });
    }
  }

  // ── Règle 10: Vérifier que les lieux 🔒 ont bien #authentifié ──
  for (const lieu of doc.lieux) {
    if (lieu.locked && !lieu.permissions.some(p => p.includes('authentifié') || p.includes('auth') || p.includes('rôle'))) {
      issues.push({
        severity: 'warning',
        message: `@${lieu.name} est marqué 🔒 mais n'a pas de permission #authentifié ou #rôle`,
        rule: 'locked_without_auth',
        line: lieu.line,
      });
    }
  }

  // ── Règle 11: Validation des qualificateurs ──
  const validQualifiers = new Set([
    // Français (spec)
    'lecture', 'écriture', 'requis', 'choix', 'filtrable', 'dynamique',
    // English equivalents
    'read', 'write', 'required', 'choice', 'filterable', 'dynamic',
  ]);
  // Patterns with values like minimum:5, maximum:100, source: x, reference: x
  const qualifierPatterns = [/^minimum(:.+)?$/, /^maximum(:.+)?$/, /^.+:\s*.+$/];

  for (const lieu of doc.lieux) {
    for (const obj of lieu.objects) {
      for (const q of obj.qualifiers) {
        const qLower = q.toLowerCase().trim();
        if (validQualifiers.has(qLower)) continue;
        if (qualifierPatterns.some(p => p.test(qLower))) continue;
        issues.push({
          severity: 'warning',
          message: `Qualificateur inconnu "${q}" sur l'objet "${obj.name}" dans @${lieu.name}. Qualificateurs valides: lecture, écriture, requis, choix, filtrable, dynamique`,
          rule: 'unknown_qualifier',
          line: obj.line,
        });
      }
    }
  }

  // ── Règle 12: Validation des types de données ──
  const validDataTypes = new Set([
    // Français (spec)
    'texte', 'nombre', 'booléen', 'date', 'fichier', 'liste', 'map', 'table', 'blob', 'choix',
    // English equivalents
    'text', 'number', 'boolean', 'file', 'list', 'choice', 'action',
  ]);
  // Types with modifiers like list:product, choice:a|b|c, table:X*Y
  const typeWithModifierPattern = /^([a-zéèê]+):.+$/;

  for (const lieu of doc.lieux) {
    for (const obj of lieu.objects) {
      if (!obj.dataType) continue;
      const dt = obj.dataType.toLowerCase().trim();
      if (validDataTypes.has(dt)) continue;
      // Check if it's a type with modifier (e.g. list:product, choice:a|b|c)
      const modifierMatch = dt.match(typeWithModifierPattern);
      if (modifierMatch && validDataTypes.has(modifierMatch[1])) continue;
      issues.push({
        severity: 'info',
        message: `Type de données inconnu "${obj.dataType}" sur l'objet "${obj.name}" dans @${lieu.name}. Types standard: texte, nombre, booléen, date, fichier, liste, map, table, blob, choix`,
        rule: 'unknown_data_type',
        line: obj.line,
      });
    }
  }

  // ── Règle 13: Termes abrégés/acronymes non définis dans § ──
  const acronymPattern = /^[A-Z]{2,4}$/;
  const dictionaryTerms = new Set(
    Object.keys(doc.dictionary.entries).map(k => k.toUpperCase())
  );

  for (const lieu of doc.lieux) {
    // Check lieu object names for acronyms
    for (const obj of lieu.objects) {
      const words = obj.name.split(/[\s_\-./]+/);
      for (const word of words) {
        if (acronymPattern.test(word) && !dictionaryTerms.has(word)) {
          issues.push({
            severity: 'warning',
            message: `Acronyme "${word}" utilisé dans l'objet "${obj.name}" mais non défini dans le dictionnaire §`,
            rule: 'undefined_acronym',
            line: obj.line,
          });
        }
      }
      // Check qualifiers for acronyms
      for (const q of obj.qualifiers) {
        const qWords = q.split(/[\s_\-./]+/);
        for (const word of qWords) {
          if (acronymPattern.test(word) && !dictionaryTerms.has(word)) {
            issues.push({
              severity: 'warning',
              message: `Acronyme "${word}" utilisé dans un qualificateur de "${obj.name}" mais non défini dans le dictionnaire §`,
              rule: 'undefined_acronym',
              line: obj.line,
            });
          }
        }
      }
    }
  }

  // ── Stats ──
  const totalObjets = doc.lieux.reduce((sum, l) => sum + l.objects.length, 0);

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      lieux: doc.lieux.length,
      objets: totalObjets,
      portes: doc.portes.length,
      stores: doc.stores.length,
      flux: doc.flux.length,
      signaux: doc.signaux.length,
      critiques: doc.signaux.filter(s => s.level === 'critique').length,
      attentions: doc.signaux.filter(s => s.level === 'attention').length,
      lignes: totalLines,
    },
  };
}
