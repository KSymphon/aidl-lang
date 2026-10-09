# OBSERVER — module de découverte (agent de renseignement)

Règles pour tout agent (Codex, Claude Code, Grok Build) qui modifie ce dossier.

## Doctrine (décision humaine requise pour la changer)
- Grok observe, il n'agit pas. Aucune fonction d'écriture, de publication ou d'interaction n'est déclarée au modèle : pas de `send_dm`, `auto_like`, `auto_reply`, `auto_follow`, ni d'écriture en base par function calling.
- Le modèle renvoie un JSON conforme à `src/contract.ts`. Le code valide, vérifie les preuves, déduplique, score et enregistre.
- Zéro candidat est un résultat normal. La sélectivité passe avant le volume.
- Aucun chiffre déclaré par le modèle n'est publié sans vérification humaine (`exposure.verified: false`).

## xAI : consignes techniques à jour (vérifiées le 2026-10-06)
- Appel REST `POST https://api.x.ai/v1/responses` avec l'outil serveur `x_search`. Pas de SDK : il faut lire le JSON brut de `usage`.
- Interdit : `search_parameters` et `max_search_results` (Live Search retirée le 2026-01-12, HTTP 410), ainsi que les modèles retirés (`grok-3`, `grok-4-fast`, `grok-code-fast-1`).
- `x_search` n'a pas de `max_results`. Les seuls leviers sont `max_turns`, la fenêtre `from_date`/`to_date` (au jour près), `excluded_x_handles` (20 max) et le prompt.
- X Search est facturé 0,005 $ par post et 0,01 $ par profil, sans dédoublonnage entre recherches ; chaque post d'un thread récupéré compte. Pas de `x_thread_fetch` pendant un scan de découverte.
- Coût réel : `usage.cost_in_usd_ticks` (1 USD = 1e10 ticks). Compteurs : `usage.server_side_tool_usage_details.{x_posts_fetched, x_users_fetched, x_search_calls}`.
- Toute hausse du coût par scan (max_turns, nouvelles pistes, vidéo, threads) doit être signalée dans `handoffs/LOG.md`.

## Pratique
- `npm test` et `npm run typecheck` doivent passer avant tout commit.
- Pour itérer sans dépenser : `npm run scan -- --dry-run` (requête sans envoi) et `npm run replay -- data/scans/<scan>.json` (rejeu d'une réponse sauvegardée).
- Les réponses de `test/fixtures.ts` sont synthétiques : ne jamais les présenter comme un résultat de scan.
- Après une tâche importante, ajouter une entrée à `handoffs/LOG.md` (format TASK / STATUS / WHAT_CHANGED / FILES_CHANGED / DECISIONS / OPEN_QUESTIONS / NEXT_OWNER / NEXT_ACTION).
