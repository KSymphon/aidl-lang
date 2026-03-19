// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Types — AST Structure
// ══════════════════════════════════════════════

/** AIDL file types */
export type AIDLFileType = 'app' | 'produit' | 'flux' | 'guide' | 'données' | 'audit';

/** Signal levels */
export type SignalLevel = 'ok' | 'err' | 'attention' | 'critique';

/** Permissions */
export type Permission = 'public' | 'authentifié' | 'anonyme' | string;

/** Object qualifiers */
export type Qualifier = 'lecture' | 'écriture' | 'requis' | 'choix' | 'filtrable' | 'dynamique' | string;

/** Data types */
export type DataType = 'texte' | 'nombre' | 'booléen' | 'date' | 'fichier' | 'liste' | 'map' | 'table' | 'blob' | 'choix' | string;

// ── AST Nodes ──

export interface AIDLHeader {
  fileType: AIDLFileType;
  name: string;
  stack?: string;
  dependencies?: string[];
  line: number;
}

export interface AIDLDictionary {
  entries: Record<string, string>;
  lines: number[];
}

export interface AIDLLink {
  target: string;
  line: number;
}

export interface AIDLObject {
  name: string;
  dataType?: string;
  qualifiers: string[];
  contains?: string[];
  navigation?: AIDLNavigation[];
  children?: AIDLObject[];
  line: number;
}

export interface AIDLNavigation {
  type: 'forward' | 'back';
  target: string;
  data?: string[];
  condition?: string;
  results?: AIDLResult[];
  line: number;
}

export interface AIDLResult {
  signal: SignalLevel;
  target?: string;
  data?: string[];
  line: number;
}

export interface AIDLCondition {
  expression: string;
  children: (AIDLObject | AIDLNavigation | AIDLCondition)[];
  line: number;
}

export interface AIDLLieu {
  name: string;
  parameters?: string;
  permissions: string[];
  locked: boolean;
  modifiers: string[];
  objects: AIDLObject[];
  navigations: AIDLNavigation[];
  conditions: AIDLCondition[];
  flux: AIDLFlux[];
  line: number;
}

export interface AIDLStore {
  name: string;
  technology?: string;
  fields: string[];
  feeds: { target: string; data: string[] }[];
  flux?: string;
  line: number;
}

export interface AIDLPorte {
  name: string;
  method?: string;
  input?: string[];
  output?: string[];
  permission?: string;
  timeout?: string;
  retry?: string;
  chain?: string;
  line: number;
}

export interface AIDLFlux {
  name: string;
  context?: string;
  content: string;
  steps?: string[];
  line: number;
}

export interface AIDLSignal {
  level: SignalLevel;
  name: string;
  context?: string;
  cause?: string;
  impact?: string;
  line: number;
}

export interface AIDLSection {
  title: string;
  type: 'major' | 'minor';
  line: number;
}

/** Complete AST of an .aidl file */
export interface AIDLDocument {
  header: AIDLHeader;
  dictionary: AIDLDictionary;
  links: AIDLLink[];
  lieux: AIDLLieu[];
  stores: AIDLStore[];
  portes: AIDLPorte[];
  flux: AIDLFlux[];
  signaux: AIDLSignal[];
  sections: AIDLSection[];
}

// ── Validation ──

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  severity: ValidationSeverity;
  message: string;
  line?: number;
  rule: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  stats: {
    lieux: number;
    objets: number;
    portes: number;
    stores: number;
    flux: number;
    signaux: number;
    critiques: number;
    attentions: number;
    lignes: number;
  };
}

export interface ParseResult {
  document: AIDLDocument;
  validation: ValidationResult;
}
