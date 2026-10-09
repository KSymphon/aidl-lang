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
