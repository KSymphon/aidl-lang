# X-DISCOVERY — l'agent de renseignement d'OBSERVER

Version : discovery.v1 · 2026-10-09 · verticale V1 : jeux indépendants

## Rôle

Un scan pose une question à Grok (modèle xAI) équipé du seul outil `x_search`. Grok cherche sur X dans une fenêtre de dates et renvoie **au plus 5 candidats** sous-exposés, au format JSON du contrat. Il ne peut rien écrire ni publier.

Tout le reste est fait par le code, de façon déterministe :

```
pistes choisies par le code ─▶ Grok + x_search ─▶ JSON (contrat)
                                                    │
         ┌──────────────────────────────────────────┘
         ▼
 validation zod ─▶ preuve citée ? ─▶ date du post ─▶ dédoublonnage ─▶ exposition (code)
                                                                        │
           rapport + réponse brute sauvegardés ◀─ coût réel ◀─ décision suggérée
```

## Ce que le code vérifie (et pourquoi)

| Contrôle | Règle | Effet |
|---|---|---|
| Preuve | `evidence_post_url` doit être un post X dont l'identifiant figure dans les citations de la réponse | Sinon `INSUFFICIENT_EVIDENCE` : hallucination possible |
| Recherche réelle | au moins un appel `x_search` ou un post facturé | Sinon tous les candidats sont rejetés |
| Date | la date est décodée depuis l'identifiant du post (snowflake) | Drapeau `OUTSIDE_WINDOW` si hors fenêtre |
| Auteur | le handle de l'URL est comparé au handle du créateur | Drapeau `HANDLE_MISMATCH` (un tiers peut partager le projet) |
| Chiffres | abonnés, likes et vues sont « déclarés par le modèle » | `exposure.verified: false` : rien n'est publié sans vérification humaine |
| Doublons | clés normalisées : handle X, page Steam, page itch.io, dépôt GitHub, domaine | Le doublon le moins bien classé est rejeté (`DUPLICATE`) |
| Historique | clés déjà vues lors de scans précédents | Drapeau `SEEN_BEFORE` (base de la future watchlist) |

## Décision suggérée (l'humain tranche)

Ce système remplace la somme pondérée du §19 de la spec. Dans une somme, un sujet excellent mais déjà exposé passait devant la pépite.

1. **Portes** : preuve non vérifiée → rejet ; doublon → rejet ; exposition `large` (≥ 250 000 abonnés) → `ALREADY_MAINSTREAM`.
2. **Mérite** : moyenne de `quality` et `originality`, notées de 1 à 5 par Grok sur une grille ancrée. En dessous de 3 → rejet.
3. **Exposition** : calculée par le code à partir des tranches d'abonnés de la verticale (nano < 1k, micro < 10k, petit < 50k, moyen < 250k).
4. **Résultat** :
   - `SHORTLIST` si le mérite est ≥ 4, l'histoire ≥ 3 et l'exposition nano, micro ou petite ;
   - sinon `WATCH`, par exemple quand l'exposition est inconnue ou moyenne, ou qu'il n'y a pas encore d'angle.

Le nombre entre crochets (`[78]`) n'est qu'un ordre d'affichage : 60 % mérite, 25 % sous-exposition, 15 % histoire. Ce n'est pas une mesure.

## Coût et garde-fous

- **Tarifs** (vérifiés le 2026-10-06, en vigueur depuis le 2026-09-21) :
  - X Search : 0,005 $ par post et 0,01 $ par profil, sans dédoublonnage entre recherches ;
  - tokens en plus.
- **Coût réel** : `usage.cost_in_usd_ticks / 1e10`. L'estimation (`PRICING` dans `src/config.ts`) ne sert qu'au contrôle. Un écart supérieur à ×5 déclenche une alerte.
- **Leviers côté requête** :
  - `max_turns` (3 par défaut) ;
  - fenêtre au jour près ;
  - 12 gros comptes exclus ;
  - pas d'analyse d'image ni de vidéo ;
  - consigne de 4 recherches au plus et pas de `x_thread_fetch`.
  
  Aucun de ces leviers n'est un plafond garanti : le modèle décide du nombre de recherches.
- **Garde-fous côté code** :
  - budget quotidien (UTC) avec une réserve par scan ;
  - un seul scan à la fois (verrou) ;
  - alertes au-delà de 150 posts ou de 1 $ par scan ;
  - un seul nouvel essai, uniquement sur HTTP 429. Après une erreur 5xx ou un délai dépassé, pas de nouvel essai : le scan a pu être facturé.
- **Plafond dur** : crédits prépayés sans recharge automatique dans la console xAI.
- **Ordre de grandeur attendu** : 0,5 à 2 $ par scan, soit environ 65 à 160 $ par mois pour 3 scans par jour. À confirmer sur les premiers scans réels.

## Lancer un scan

```bash
cd observer
npm install
cp .env.example .env            # renseigner XAI_API_KEY
npm run scan -- --dry-run       # affiche la requête exacte, n'envoie rien
set -a; . ./.env; set +a
npm run scan -- --type evening  # vrai scan : morning | noon | evening
npm run replay -- data/scans/<scan_id>.json   # rejoue le pipeline sans appel ni dépense
npm run ledger                  # dépenses enregistrées
```

Depuis la session cloud Claude Code, il faut deux réglages d'environnement :
- `api.x.ai` dans les domaines réseau autorisés ;
- la variable `XAI_API_KEY`.

## À valider au premier scan réel

Ces points reposent sur la documentation et sur le SDK `@ai-sdk/xai` 5.0.20, pas encore sur une réponse réelle. Le code les traite de façon défensive, et la réponse brute est toujours sauvegardée.

1. **Citations** : `citations` (racine) et/ou annotations `url_citation` contiennent bien les URLs des posts récupérés. Si ce n'est pas le cas, tous les candidats sortent en `INSUFFICIENT_EVIDENCE`, avec l'alerte « Aucune citation ».
2. **Compteurs facturés** : `usage.server_side_tool_usage_details` porte `x_posts_fetched` et `x_users_fetched`. Sinon, une alerte le signale.
3. **Unité du coût** : `cost_in_usd_ticks` est bien en 1e-10 USD. Une alerte se déclenche si l'écart avec l'estimation dépasse ×5.
4. **Sortie structurée** : `text.format` json_schema strict est accepté avec `x_search`. En cas de refus, l'erreur HTTP est enregistrée.
5. **Recherches effectives** : les appels apparaissent comme `custom_tool_call` (`x_keyword_search`, …) ou `x_search_call`. Ils sont listés dans « Requêtes de Grok ».

## Intégration (Codex)

- Les fonctions du pipeline sont pures : `processResponse`, `checkEvidence`, `suggestDecision`, `keysFor`.
- `Store` (`src/store.ts`) est l'interface à porter sur Supabase :
  - `scans` : rapport et réponse brute ;
  - `candidates` / `observations` ;
  - un ledger ;
  - un verrou (ligne `scans` en `running` avec contrainte d'unicité).
- **Ne pas appeler `runLiveScan` dans une requête HTTP synchrone.** Un scan dure de quelques dizaines de secondes à plusieurs minutes. Il faut une ligne `scans` en `running`, l'exécution en tâche de fond et un affichage qui interroge régulièrement l'état.
- Statuts de candidat proposés : `NEW → SHORTLISTED → SELECTED | WATCHING | REJECTED`. La décision du moteur n'est qu'une suggestion.
