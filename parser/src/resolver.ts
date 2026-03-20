// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Resolver — Résout les modules &fichier.aidl et fusionne les AST
// ══════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { parse } from './parser.js';
import { validate } from './validator.js';
import type { AIDLDocument, ValidationResult, ValidationIssue } from './types.js';

export interface ResolvedModule {
  path: string;
  document: AIDLDocument;
  validation: ValidationResult;
}

export interface ResolvedProject {
  master: AIDLDocument;
  modules: ResolvedModule[];
  merged: AIDLDocument;
  validation: ValidationResult;
  issues: ValidationIssue[];
}

/**
 * Résout un fichier .aidl et tous ses modules &importés.
 * Fusionne les AST en un document unifié.
 * Vérifie la cohérence inter-fichiers.
 */
export function resolveProject(masterPath: string): ResolvedProject {
  const masterSource = readFileSync(masterPath, 'utf-8');
  const master = parse(masterSource);
  const masterLines = masterSource.split('\n').length;
  const masterValidation = validate(master, masterLines);

  const baseDir = dirname(masterPath);
  const modules: ResolvedModule[] = [];
  const issues: ValidationIssue[] = [];

  // Charger chaque module &lié
  for (const link of master.links) {
    const modulePath = resolve(baseDir, link.target);

    if (!existsSync(modulePath)) {
      issues.push({
        severity: 'error',
        message: `Module &${link.target} non trouvé: ${modulePath}`,
        rule: 'module_not_found',
        line: link.line,
      });
      continue;
    }

    const moduleSource = readFileSync(modulePath, 'utf-8');
    const moduleDoc = parse(moduleSource);
    const moduleLines = moduleSource.split('\n').length;
    const moduleValidation = validate(moduleDoc, moduleLines);

    modules.push({
      path: modulePath,
      document: moduleDoc,
      validation: moduleValidation,
    });

    // Collecter les issues du module
    for (const issue of moduleValidation.issues) {
      issues.push({
        ...issue,
        message: `[${link.target}] ${issue.message}`,
      });
    }
  }

  // Fusionner les AST
  const merged: AIDLDocument = {
    header: master.header,
    dictionary: { ...master.dictionary, entries: { ...master.dictionary.entries } },
    links: master.links,
    lieux: [...master.lieux],
    stores: [...master.stores],
    portes: [...master.portes],
    flux: [...master.flux],
    signaux: [...master.signaux],
    sections: [...master.sections],
  };

  for (const mod of modules) {
    // Fusionner les dictionnaires
    for (const [key, value] of Object.entries(mod.document.dictionary.entries)) {
      if (merged.dictionary.entries[key] && merged.dictionary.entries[key] !== value) {
        issues.push({
          severity: 'warning',
          message: `Terme § "${key}" défini différemment dans le module ${mod.path}`,
          rule: 'dict_conflict',
        });
      }
      merged.dictionary.entries[key] = value;
    }

    // Fusionner les entités
    merged.lieux.push(...mod.document.lieux);
    merged.stores.push(...mod.document.stores);
    merged.portes.push(...mod.document.portes);
    merged.flux.push(...mod.document.flux);
    merged.signaux.push(...mod.document.signaux);
  }

  // Validation inter-fichiers
  const allLieuNames = new Set(merged.lieux.map(l => l.name));
  const allPorteNames = new Set(merged.portes.map(p => p.name));
  const allStoreNames = new Set(merged.stores.map(s => s.name));

  // Vérifier les doublons de lieux
  const lieuCounts = new Map<string, number>();
  for (const lieu of merged.lieux) {
    lieuCounts.set(lieu.name, (lieuCounts.get(lieu.name) || 0) + 1);
  }
  for (const [name, count] of lieuCounts) {
    if (count > 1) {
      issues.push({
        severity: 'warning',
        message: `@${name} est défini ${count} fois dans le projet (modules inclus)`,
        rule: 'duplicate_lieu',
      });
    }
  }

  // Vérifier les doublons de portes
  const porteCounts = new Map<string, number>();
  for (const porte of merged.portes) {
    porteCounts.set(porte.name, (porteCounts.get(porte.name) || 0) + 1);
  }
  for (const [name, count] of porteCounts) {
    if (count > 1) {
      issues.push({
        severity: 'warning',
        message: `$${name} est défini ${count} fois dans le projet (modules inclus)`,
        rule: 'duplicate_porte',
      });
    }
  }

  // Vérifier les navigations inter-modules
  for (const lieu of merged.lieux) {
    for (const nav of lieu.navigations) {
      const targetClean = nav.target
        .replace(/\{[^}]*\}/g, '')
        .replace(/\[.*\]/g, '')
        .replace(/>>.*/, '')
        .trim();

      const atTargets = targetClean.match(/@(\S+)/g);
      if (atTargets) {
        for (const atTarget of atTargets) {
          const name = atTarget.slice(1).replace(/\{.*\}/, '');
          if (!name.includes('{') && !name.includes('/') && !allLieuNames.has(name)) {
            const found = [...allLieuNames].some(l =>
              l.startsWith(name) || name.startsWith(l) || l.includes(name)
            );
            if (!found) {
              issues.push({
                severity: 'warning',
                message: `Navigation vers @${name} — lieu non trouvé dans aucun module`,
                rule: 'cross_module_nav_missing',
                line: nav.line,
              });
            }
          }
        }
      }
    }
  }

  // Stats totales
  const totalLines = masterLines + modules.reduce((sum, m) => {
    const src = readFileSync(m.path, 'utf-8');
    return sum + src.split('\n').length;
  }, 0);

  const mergedValidation: ValidationResult = {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    stats: {
      lieux: merged.lieux.length,
      objets: merged.lieux.reduce((sum, l) => sum + l.objects.length, 0),
      portes: merged.portes.length,
      stores: merged.stores.length,
      flux: merged.flux.length,
      signaux: merged.signaux.length,
      critiques: merged.signaux.filter(s => s.level === 'critique').length,
      attentions: merged.signaux.filter(s => s.level === 'attention').length,
      lignes: totalLines,
    },
  };

  return {
    master,
    modules,
    merged,
    validation: mergedValidation,
    issues,
  };
}
