# OBSERVER — agent de renseignement

Premier module d'OBSERVER : un scan Grok + X Search qui repère des projets sous-exposés (V1 : jeux indépendants), vérifie les preuves par le code, et propose une décision que l'humain tranche.

```bash
npm install
npm test                         # tests unitaires (réponses xAI synthétiques)
npm run scan -- --dry-run        # requête exacte, sans envoi ni dépense
npm run scan -- --type evening   # vrai scan (XAI_API_KEY requis, voir .env.example)
```

Fonctionnement, coûts, garde-fous et points à valider au premier scan réel : [docs/X-DISCOVERY.md](docs/X-DISCOVERY.md).
Règles pour les agents de développement : [AGENTS.md](AGENTS.md). Journal de passation : [handoffs/LOG.md](handoffs/LOG.md).
