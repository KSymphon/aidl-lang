# Journal de passation

## 2026-10-09 — Claude Code — prototype de l'agent de renseignement

- **TASK** : prototype du module de découverte X (Grok + x_search), testable seul, avant le dashboard.
- **STATUS** : code et tests terminés (npm test vert). Pas encore de scan réel : pas de clé xAI ni d'accès réseau à api.x.ai depuis la session cloud.
- **WHAT_CHANGED** :
  - client REST /v1/responses ;
  - contrat JSON strict ;
  - vérification des preuves par les citations ;
  - date des posts tirée du snowflake ;
  - dédoublonnage par clés ;
  - décision par portes et tranches ;
  - coût réel via cost_in_usd_ticks ;
  - budget quotidien, verrou et alertes ;
  - rejeu sans dépense.
- **FILES_CHANGED** : observer/ (src/, test/, docs/X-DISCOVERY.md, AGENTS.md, CLAUDE.md, .env.example).
- **DECISIONS** :
  - aucune fonction d'écriture exposée à Grok ;
  - pistes de recherche choisies par le code ;
  - scoring §19 remplacé par portes et tranches ;
  - WAIT_AND_WATCH retiré des raisons de rejet ;
  - `store: false` côté xAI ;
  - verticale V1 = jeux indépendants (provisoire, à confirmer par l'humain).
- **OPEN_QUESTIONS** :
  - verticale et langue définitives ;
  - les 5 points « À valider au premier scan réel » de docs/X-DISCOVERY.md ;
  - le repo définitif du projet (le dossier vit pour l'instant dans aidl-lang).
- **NEXT_OWNER** : humain (clé xAI et premier scan), puis Grok Build (réglage des pistes sur de vrais résultats), puis Codex (portage Store → Supabase et page OBSERVE).
- **NEXT_ACTION** : `npm run scan -- --type evening` avec XAI_API_KEY ; relire le rapport et la réponse brute ; ajuster prompt.ts et verticals.ts.

## 2026-10-09 — Claude Code — relecture adversariale et corrections

- **TASK** : relecture du prototype sous quatre angles (fidélité API xAI, bugs du pipeline, coûts et doctrine, tests), chaque constat contre-vérifié par reproduction.
- **STATUS** : 29 constats confirmés, 1 réfuté. Corrections appliquées. 61 tests verts, vérification de types propre.
- **WHAT_CHANGED** :
  - `include: ["no_inline_citations"]`, et retrait des liens `[[N]](url)` s'il en reste ;
  - validation candidat par candidat ;
  - notes en enum et `maxItems` dans le schéma ;
  - réserve de budget inscrite avant l'appel, coût inscrit avant le traitement, montant retenu prudent ;
  - auteur du post pris dans la citation, et jamais utilisé comme identité du créateur ;
  - hôtes partagés exclus des clés de dédoublonnage, `s.team` reconnu ;
  - historique compté une fois par scan, rejeu fidèle à l'historique d'avant le scan ;
  - verrou à jeton expiré après 2 × timeout + 60 s ;
  - CLI stricte : option inconnue → code 2, sans appel ;
  - prompt : pas d'URL construite dans `other_urls`, pas de détail personnel dans les écartés.
- **FILES_CHANGED** : src/contract.ts, scan.ts, store.ts, usage.ts, verify.ts, dedupe.ts, cli.ts, prompt.ts, xai-client.ts, config.ts ; test/* ; docs/X-DISCOVERY.md ; AGENTS.md ; .env.example.
- **DECISIONS** :
  - `parallel_tool_calls` reste à true par défaut ; à revoir après mesure réelle (point 6 de X-DISCOVERY.md) ;
  - `other_urls` n'est pas filtré par les citations, faute de garantie qu'elles contiennent les liens Steam.
- **OPEN_QUESTIONS** :
  - durée de conservation de `data/scans/*.json`, qui contient les réponses brutes avec les handles de tous les auteurs vus (RGPD) ;
  - les 6 points « À valider au premier scan réel ».
- **NEXT_OWNER** : humain (clé xAI, premier scan).
- **NEXT_ACTION** : `npm run scan -- --type evening`, puis relire les alertes et la réponse brute.
