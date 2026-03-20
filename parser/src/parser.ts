// AIDL Parser — AI Description Language
// Created by Kenny Symphon, March 2026
// License: MIT
//
// ══════════════════════════════════════════════
// AIDL Parser — Lit un fichier .aidl et produit un AST
// ══════════════════════════════════════════════

import type {
  AIDLDocument, AIDLHeader, AIDLDictionary, AIDLLink,
  AIDLLieu, AIDLObject, AIDLNavigation, AIDLResult,
  AIDLStore, AIDLPorte, AIDLFlux, AIDLSignal, AIDLSection,
  AIDLCondition, AIDLFileType, SignalLevel,
} from './types.js';

// ── Détection de type de ligne ──

const PATTERNS = {
  header:     /^╔([APFGDX]):(.+)$/,
  footer:     /^╚/,
  dict:       /^§\s+(.+)$/,
  link:       /^&(.+\.aidl)$/,
  sectionMaj: /^═{3,}\s+(.+?)\s+═{3,}$/,
  sectionMin: /^──\s+(.+?)\s+──$/,
  lieu:       /^@(\S+)(.*)$/,
  objet:      /^\.(\S+)(.*)$/,
  store:      /^\^(\S+)(.*)$/,
  porte:      /^\$(\S+)(.*)$/,
  flux:       /^~(\S+)(.*)$/,
  signal:     /^!(critique|critical|attention|ok|err)(?:\(\d+\))?\s+(.+)$/,
  navForward: /^→(.+)$/,
  navBack:    /^←(.+)$/,
  result:     /^!(ok|err)(?:\(\d+\))?(.*)$/,
  condition:  /^\?(.+?)\s*::$/,
  cause:      /^<\s*(.+)$/,
  impact:     /^=\s*(.+)$/,
  feedsTo:    /^>\s*(.+)$/,
  chain:      /^(?:chaîne|chain):\s*(.+)$/,
  input:      /^(?:entrée|input):\s*\{(.+)\}$/,
  output:     /^(?:sortie|output):\s*\{(.+)\}$/,
};

// ── Utilitaires ──

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function stripIndent(line: string): string {
  return line.trimStart();
}

function parsePermissions(text: string): { permissions: string[]; locked: boolean; modifiers: string[] } {
  const permissions: string[] = [];
  const modifiers: string[] = [];
  let locked = false;

  if (text.includes('🔒')) locked = true;

  const bracketMatch = text.match(/\[([^\]]+)\]/g);
  if (bracketMatch) {
    for (const bracket of bracketMatch) {
      const content = bracket.slice(1, -1);
      const parts = content.split(',').map(p => p.trim());
      for (const part of parts) {
        if (part.startsWith('#')) {
          permissions.push(part.slice(1));
        } else {
          modifiers.push(part);
        }
      }
    }
  }

  return { permissions, locked, modifiers };
}

function parseQualifiers(text: string): { dataType?: string; qualifiers: string[]; contains?: string[] } {
  const qualifiers: string[] = [];
  let dataType: string | undefined;
  let contains: string[] | undefined;

  // Type: /texte, /liste:X, etc.
  const typeMatch = text.match(/\/(\S+)/);
  if (typeMatch) {
    dataType = typeMatch[1];
  }

  // Qualifiers: {lecture, requis, écriture}
  const qualMatch = text.match(/\{([^}]+)\}/);
  if (qualMatch) {
    qualifiers.push(...qualMatch[1].split(',').map(q => q.trim()));
  }

  // Contains: :: a, b, c
  const containsMatch = text.match(/::\s*(.+)/);
  if (containsMatch) {
    contains = containsMatch[1].split(',').map(c => c.trim());
  }

  return { dataType, qualifiers, contains };
}

function parseNavigation(text: string, line: number, type: 'forward' | 'back'): AIDLNavigation {
  let target = text.trim();
  let data: string[] | undefined;
  let condition: string | undefined;

  // Données: {x, y}
  const dataMatch = target.match(/\{([^}]+)\}/);
  if (dataMatch) {
    data = dataMatch[1].split(',').map(d => d.trim());
    target = target.replace(dataMatch[0], '').trim();
  }

  // Condition: [condition]
  const condMatch = target.match(/\[([^\]]+)\]/);
  if (condMatch) {
    condition = condMatch[1].trim();
    target = target.replace(condMatch[0], '').trim();
  }

  // Résultat: >> destination
  const resultMatch = target.match(/\s*>>\s*/);
  if (resultMatch) {
    const parts = target.split('>>').map(p => p.trim());
    target = parts[0];
    // Le résultat sera géré comme un target combiné
    if (parts[1]) {
      target = `${parts[0]} >> ${parts[1]}`;
    }
  }

  return { type, target, data, condition, line };
}

// ── Mapping type de fichier ──

function mapFileType(code: string): AIDLFileType {
  const map: Record<string, AIDLFileType> = {
    'A': 'app', 'P': 'produit', 'F': 'flux',
    'G': 'guide', 'D': 'données', 'X': 'audit',
  };
  return map[code] || 'app';
}

// ── Parser principal ──

export function parse(source: string): AIDLDocument {
  const lines = source.split('\n');
  const doc: AIDLDocument = {
    header: { fileType: 'app', name: 'unknown', line: 0 },
    dictionary: { entries: {}, lines: [] },
    links: [],
    lieux: [],
    stores: [],
    portes: [],
    flux: [],
    signaux: [],
    sections: [],
  };

  let currentLieu: AIDLLieu | null = null;
  let currentStore: AIDLStore | null = null;
  let currentPorte: AIDLPorte | null = null;
  let currentSignal: AIDLSignal | null = null;
  let currentFluxBlock: AIDLFlux | null = null;
  let currentCondition: { expression: string; children: any[]; line: number; indent: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i];
    const indent = getIndentLevel(rawLine);
    const line = stripIndent(rawLine);

    // Lignes vides ou décoratives
    if (!line || line.startsWith('║') && line.trim() === '║') continue;

    // ── HEADER ──
    const headerMatch = line.match(PATTERNS.header);
    if (headerMatch) {
      const [, typeCode, rest] = headerMatch;
      const parts = rest.split('|').map(p => p.trim());
      doc.header = {
        fileType: mapFileType(typeCode),
        name: parts[0],
        stack: parts[1] || undefined,
        dependencies: parts.slice(2).filter(Boolean).length > 0
          ? parts.slice(2).flatMap(p => p.split(',').map(d => d.trim()))
          : undefined,
        line: lineNum,
      };
      continue;
    }

    // ── FOOTER ──
    if (PATTERNS.footer.test(line)) continue;

    // ── DICTIONNAIRE ──
    const dictMatch = line.match(PATTERNS.dict);
    if (dictMatch) {
      const content = dictMatch[1];
      // Format: "clé = valeur" ou "clé: valeur"
      const eqMatch = content.match(/^(.+?)\s*[=:]\s*(.+)$/);
      if (eqMatch) {
        doc.dictionary.entries[eqMatch[1].trim()] = eqMatch[2].trim();
      }
      doc.dictionary.lines.push(lineNum);
      continue;
    }

    // ── LIEN ──
    const linkMatch = line.match(PATTERNS.link);
    if (linkMatch) {
      doc.links.push({ target: linkMatch[1], line: lineNum });
      continue;
    }

    // ── SECTIONS ──
    const sectionMajMatch = line.match(PATTERNS.sectionMaj);
    if (sectionMajMatch) {
      doc.sections.push({ title: sectionMajMatch[1], type: 'major', line: lineNum });
      // Finaliser les blocs en cours
      if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }
      if (currentStore) { doc.stores.push(currentStore); currentStore = null; }
      if (currentPorte) { doc.portes.push(currentPorte); currentPorte = null; }
      if (currentSignal) { doc.signaux.push(currentSignal); currentSignal = null; }
      if (currentFluxBlock) { doc.flux.push(currentFluxBlock); currentFluxBlock = null; }
      continue;
    }

    const sectionMinMatch = line.match(PATTERNS.sectionMin);
    if (sectionMinMatch) {
      doc.sections.push({ title: sectionMinMatch[1], type: 'minor', line: lineNum });
      if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }
      if (currentStore) { doc.stores.push(currentStore); currentStore = null; }
      if (currentPorte) { doc.portes.push(currentPorte); currentPorte = null; }
      if (currentSignal) { doc.signaux.push(currentSignal); currentSignal = null; }
      if (currentFluxBlock) { doc.flux.push(currentFluxBlock); currentFluxBlock = null; }
      continue;
    }

    // ── SIGNAL (niveau 0 ou 1) ──
    const signalMatch = line.match(PATTERNS.signal);
    if (signalMatch && indent < 4) {
      if (currentSignal) doc.signaux.push(currentSignal);
      if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }

      const [, level, rest] = signalMatch;
      const contextMatch = rest.match(/\[([^\]]+)\]/);
      const name = rest.replace(/\[.*\]/, '').trim();

      currentSignal = {
        level: (level === 'critical' ? 'critique' : level) as SignalLevel,
        name,
        context: contextMatch ? contextMatch[1].trim() : undefined,
        line: lineNum,
      };
      continue;
    }

    // Cause / Impact (sous un signal)
    if (currentSignal) {
      const causeMatch = line.match(PATTERNS.cause);
      if (causeMatch) {
        currentSignal.cause = causeMatch[1];
        continue;
      }
      const impactMatch = line.match(PATTERNS.impact);
      if (impactMatch) {
        currentSignal.impact = impactMatch[1];
        continue;
      }
    }

    // ── LIEU (indent 0) ──
    if (indent === 0) {
      currentCondition = null;
      const lieuMatch = line.match(PATTERNS.lieu);
      if (lieuMatch) {
        if (currentLieu) doc.lieux.push(currentLieu);
        if (currentStore) { doc.stores.push(currentStore); currentStore = null; }
        if (currentPorte) { doc.portes.push(currentPorte); currentPorte = null; }
        if (currentSignal) { doc.signaux.push(currentSignal); currentSignal = null; }
        if (currentFluxBlock) { doc.flux.push(currentFluxBlock); currentFluxBlock = null; }

        const [, name, rest] = lieuMatch;
        const { permissions, locked, modifiers } = parsePermissions(rest);

        // Paramètres: @lieu{param}
        const paramMatch = name.match(/^([^{]+)\{(.+)\}$/);

        currentLieu = {
          name: paramMatch ? paramMatch[1] : name,
          parameters: paramMatch ? paramMatch[2] : undefined,
          permissions,
          locked,
          modifiers,
          objects: [],
          navigations: [],
          conditions: [],
          flux: [],
          line: lineNum,
        };
        continue;
      }

      // ── STORE (indent 0) ──
      const storeMatch = line.match(PATTERNS.store);
      if (storeMatch) {
        if (currentStore) doc.stores.push(currentStore);
        if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }
        if (currentPorte) { doc.portes.push(currentPorte); currentPorte = null; }

        const [, name, rest] = storeMatch;
        const techMatch = rest.match(/\[([^\]]+)\]/);

        currentStore = {
          name,
          technology: techMatch ? techMatch[1].trim() : undefined,
          fields: [],
          feeds: [],
          line: lineNum,
        };
        continue;
      }

      // ── PORTE (indent 0) ──
      const porteMatch = line.match(PATTERNS.porte);
      if (porteMatch) {
        if (currentPorte) doc.portes.push(currentPorte);
        if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }
        if (currentStore) { doc.stores.push(currentStore); currentStore = null; }

        const [, name, rest] = porteMatch;
        const methodMatch = rest.match(/:(\S+)/);
        const permMatch = rest.match(/\[([^\]]+)\]/);
        const timeoutMatch = rest.match(/\(([^)]+)\)/);

        currentPorte = {
          name,
          method: methodMatch ? methodMatch[1] : undefined,
          permission: permMatch ? permMatch[1].trim() : undefined,
          line: lineNum,
        };

        if (timeoutMatch) {
          const parts = timeoutMatch[1].split(',').map(p => p.trim());
          currentPorte.timeout = parts[0];
          currentPorte.retry = parts[1];
        }
        continue;
      }

      // ── FLUX (indent 0) ──
      const fluxMatch = line.match(PATTERNS.flux);
      if (fluxMatch) {
        if (currentFluxBlock) doc.flux.push(currentFluxBlock);
        if (currentLieu) { doc.lieux.push(currentLieu); currentLieu = null; }

        const [, name, rest] = fluxMatch;
        const ctxMatch = rest.match(/\[([^\]]+)\]/);

        currentFluxBlock = {
          name,
          context: ctxMatch ? ctxMatch[1].trim() : undefined,
          content: '',
          line: lineNum,
        };
        continue;
      }
    }

    // ── Contenu indenté ──

    // Sous un LIEU
    if (currentLieu && indent >= 2) {
      // Reset currentCondition if we're back at or above the condition's indent level
      if (currentCondition && indent <= currentCondition.indent) {
        currentCondition = null;
      }

      // Objet
      const objMatch = line.match(PATTERNS.objet);
      if (objMatch) {
        const [, name, rest] = objMatch;
        const { dataType, qualifiers, contains } = parseQualifiers(rest);

        // Navigation intégrée: .search /texte {écriture} →@destination
        let embeddedNav: AIDLNavigation | undefined;
        const navInline = rest.match(/→(\S+.*)/);
        if (navInline) {
          embeddedNav = parseNavigation(navInline[1], lineNum, 'forward');
        }

        const obj: AIDLObject = {
          name, dataType, qualifiers, contains, line: lineNum,
          navigation: embeddedNav ? [embeddedNav] : undefined,
        };
        if (currentCondition && indent > currentCondition.indent) {
          currentCondition.children.push(obj);
        } else {
          currentLieu.objects.push(obj);
        }
        continue;
      }

      // Navigation → (supports multiple on one line: →@a →@b →@c)
      const navFwdMatch = line.match(PATTERNS.navForward);
      if (navFwdMatch) {
        const parts = navFwdMatch[1].split('→').filter(p => p.trim() !== '');
        for (const part of parts) {
          const nav = parseNavigation(part.trim(), lineNum, 'forward');
          if (currentCondition && indent > currentCondition.indent) {
            currentCondition.children.push(nav);
          } else {
            currentLieu.navigations.push(nav);
          }
        }
        continue;
      }

      // Navigation ← (supports multiple on one line: ←@a ←@b ←@c)
      const navBackMatch = line.match(PATTERNS.navBack);
      if (navBackMatch) {
        const parts = navBackMatch[1].split('←').filter(p => p.trim() !== '');
        for (const part of parts) {
          const nav = parseNavigation(part.trim(), lineNum, 'back');
          if (currentCondition && indent > currentCondition.indent) {
            currentCondition.children.push(nav);
          } else {
            currentLieu.navigations.push(nav);
          }
        }
        continue;
      }

      // Condition ?xxx ::
      const condMatch = line.match(PATTERNS.condition);
      if (condMatch) {
        const cond = {
          expression: condMatch[1].trim(),
          children: [] as any[],
          line: lineNum,
          indent,
        };
        currentLieu.conditions.push(cond);
        currentCondition = cond;
        continue;
      }

      // Flux ~
      const fluxInLieu = line.match(PATTERNS.flux);
      if (fluxInLieu) {
        currentLieu.flux.push({
          name: fluxInLieu[1],
          content: fluxInLieu[2]?.trim() || '',
          line: lineNum,
        });
        continue;
      }

      // Résultat !ok / !err
      const resultMatch = line.match(PATTERNS.result);
      if (resultMatch) {
        const [, level, rest] = resultMatch;
        const nav = currentLieu.navigations[currentLieu.navigations.length - 1];
        if (nav) {
          if (!nav.results) nav.results = [];
          const rawTarget = rest.replace(/^[+\s]*>>/, '').trim();
          const dataMatch = rawTarget.match(/\{([^}]+)\}/);
          const resultData = dataMatch ? dataMatch[1].split(',').map((d: string) => d.trim()) : undefined;
          const cleanTarget = rawTarget.replace(/\{[^}]*\}/, '').trim();
          nav.results.push({
            signal: level as SignalLevel,
            target: cleanTarget,
            data: resultData,
            line: lineNum,
          });
        }
        continue;
      }
    }

    // Sous un STORE
    if (currentStore && indent >= 2) {
      // Champs: {a, b, c}
      const fieldsMatch = line.match(/^\{(.+)\}$/);
      if (fieldsMatch) {
        currentStore.fields = fieldsMatch[1].split(',').map(f => f.trim());
        continue;
      }

      // Feed: > @target {data}, > @target, > target {data}
      const feedMatch = line.match(/^>\s*(@?\S+)(?:\s*\{(.+)\})?$/);
      if (feedMatch) {
        currentStore.feeds.push({
          target: feedMatch[1],
          data: feedMatch[2] ? feedMatch[2].split(',').map(d => d.trim()) : [],
        });
        continue;
      }

      // Flux interne au store
      const fluxInStore = line.match(PATTERNS.flux);
      if (fluxInStore) {
        currentStore.flux = fluxInStore[2]?.trim() || fluxInStore[1];
        continue;
      }
    }

    // Sous une PORTE
    if (currentPorte && indent >= 2) {
      const inputMatch = line.match(PATTERNS.input);
      if (inputMatch) {
        currentPorte.input = inputMatch[1].split(',').map(p => p.trim());
        continue;
      }

      const outputMatch = line.match(PATTERNS.output);
      if (outputMatch) {
        currentPorte.output = outputMatch[1].split(',').map(p => p.trim());
        continue;
      }

      const chainMatch = line.match(PATTERNS.chain);
      if (chainMatch) {
        currentPorte.chain = chainMatch[1];
        continue;
      }

      // Continuation de chaîne (lignes suivantes commençant par >>)
      if (line.startsWith('>>') && currentPorte.chain) {
        currentPorte.chain += ' ' + line;
        continue;
      }

      // Permission et timeout sur une ligne séparée
      const permLine = line.match(/^\[([^\]]+)\]\s*\(([^)]+)\)$/);
      if (permLine) {
        currentPorte.permission = permLine[1].trim();
        const parts = permLine[2].split(',').map(p => p.trim());
        currentPorte.timeout = parts[0];
        currentPorte.retry = parts[1];
        continue;
      }
    }

    // Sous un FLUX
    if (currentFluxBlock && indent >= 2) {
      currentFluxBlock.content += (currentFluxBlock.content ? '\n' : '') + line;
      // Extract steps when line contains => (transformation chain)
      if (line.includes('=>')) {
        if (!currentFluxBlock.steps) currentFluxBlock.steps = [];
        const stepParts = line.split('=>').map(s => s.trim()).filter(Boolean);
        currentFluxBlock.steps.push(...stepParts);
      }
      continue;
    }
  }

  // Finaliser les blocs restants
  if (currentLieu) doc.lieux.push(currentLieu);
  if (currentStore) doc.stores.push(currentStore);
  if (currentPorte) doc.portes.push(currentPorte);
  if (currentSignal) doc.signaux.push(currentSignal);
  if (currentFluxBlock) doc.flux.push(currentFluxBlock);

  return doc;
}
