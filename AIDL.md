# AIDL — AI Description Language
**Created by Kenny Symphon — March 2026**

## Qu'est-ce que AIDL

AIDL est un langage de description conçu pour les intelligences artificielles. Il permet à une IA de comprendre rapidement et de manière fiable la structure complète d'une application, d'un produit, d'un pipeline de données, ou de tout système logiciel.

Ce n'est pas un format de données (JSON, YAML). Ce n'est pas un langage de programmation. C'est un **langage de perception** — l'IA ne le lit pas, elle le **comprend d'un bloc**.

**Principes fondamentaux :**

1. **Densité** — chaque caractère porte du sens, zéro bruit syntaxique
2. **Clarté** — les termes sont écrits en clair, jamais d'abréviations ambiguës
3. **Simultanéité** — une seule lecture suffit pour tout comprendre
4. **Anomalies visibles** — ce qui est normal suit le pattern, ce qui est anormal le casse

**Extension de fichier :** `.aidl`
**Encodage :** UTF-8
**Version du format :** 1.2
**Taille maximale :** 500 lignes par fichier (au-delà, découper avec des liens `&`)

---

## Symboles — Le dictionnaire CORE

Ces symboles ne changent JAMAIS. Ils sont valables dans TOUS les fichiers .aidl, TOUS les domaines, TOUS les contextes. Quand tu rencontres un de ces symboles, son sens est garanti.

### Préfixes d'entité (ce que c'est)

| Symbole | Nom | Signification exacte |
|---------|-----|---------------------|
| `@` | LIEU | Un espace navigable. Un écran, une page, une vue, un état dans lequel un utilisateur peut se trouver. L'IA sait : "on peut être ici". |
| `.` | OBJET | Un élément interactif à l'intérieur d'un lieu. Un champ de saisie, un bouton, un tableau, un composant. L'IA sait : "on peut interagir avec ça". |
| `$` | PORTE | Un point de communication avec l'extérieur. Une API, un endpoint, un service externe, une fonction serveur. L'IA sait : "ça communique au-delà de l'interface". |
| `^` | STORE | Un conteneur de données en mémoire qui alimente des lieux et des objets. État applicatif partagé. L'IA sait : "ces données vivent ici et alimentent ces composants". |
| `~` | FLUX | Un mouvement de données invisible pour l'utilisateur. Pipeline, synchronisation, transformation en arrière-plan. L'IA sait : "quelque chose bouge en coulisses". |
| `!` | SIGNAL | Une anomalie, un résultat d'action, un événement notable. Ce qui sort du pattern normal et attire l'attention. L'IA sait : "attention, ceci est remarquable". |
| `§` | DICTIONNAIRE | Déclaration de codes spécifiques au fichier. Toujours après l'en-tête `╔`. Définit le vocabulaire propre à ce fichier. |
| `&` | LIEN | Référence vers un autre fichier .aidl. L'IA sait : "plus de détails disponibles dans ce fichier". |
| `¬` | ABSENCE | Déclaration explicite qu'une chose N'EXISTE PAS. L'IA sait : "cette absence est connue et documentée, ce n'est pas un oubli". |
| `¬¬` | UNMAPPED | Section dédiée listant ce que la carte ne couvre PAS volontairement. L'IA sait : "ces parties existent mais sont hors périmètre". |

### Opérateurs de relation (ce qui relie)

| Symbole | Nom | Signification exacte |
|---------|-----|---------------------|
| `→` | VA VERS | Navigation, action qui déplace vers une destination. "Si je fais ça, j'arrive là." |
| `←` | REVIENT DE | Retour arrière, annuler, quitter le lieu actuel. |
| `>>` | PRODUIT | Le résultat ou la conséquence d'une action. "Ceci génère cela." |
| `=>` | TRANSFORME EN | Une donnée est convertie en une autre forme. Transformation, processing. |
| `::` | CONTIENT | Composition. Ce qui est à droite fait partie de ce qui est à gauche. |
| `?` | CONDITION | Branchement logique. "Si cette condition est vraie, alors..." |
| `>` | ALIMENTE | Un store ou flux pousse des données vers un composant. |
| `↔` | BIDIRECTIONNEL | Navigation dans les deux sens entre deux lieux. Remplace `→` + `←` quand la relation est symétrique. |
| `[&path]` | ANCRE SOURCE | Lien vers le code réel correspondant. L'IA peut vérifier que la carte est synchronisée avec le code. |

### Marqueurs de permission (qui peut)

| Code | Signification exacte |
|------|---------------------|
| `#public` | Accessible à tous, sans authentification |
| `#authentifié` | Nécessite une connexion utilisateur |
| `#anonyme` | Accessible sans connexion (pour les API) |
| `#rôle:X` | Nécessite un rôle spécifique (admin, etc.) |
| `🔒` | Verrou visuel — renforce la notion d'accès restreint |

### Niveaux de signal (gravité)

| Code | Signification exacte |
|------|---------------------|
| `!ok` | Succès — l'action a réussi |
| `!err` | Échec — l'action a échoué |
| `!attention` | Anomalie mineure — comportement inattendu mais pas dangereux |
| `!critique` | Anomalie grave — faille de sécurité, incohérence dangereuse, porte ouverte qui devrait être fermée |

**Priorité optionnelle :** `!critique(9)` ou `!attention(3)` — échelle de 1 (mineur) à 10 (urgent). Permet à l'IA de trier les anomalies par ordre de traitement.

### Marqueur d'intention (pourquoi ça existe)

Le symbole `<` (cause) peut être utilisé **sous n'importe quelle entité**, pas seulement les signaux. Il explique **pourquoi** quelque chose existe. L'IA sait : "voilà la raison derrière cette décision".

```
@admin_panel [#role:admin] 🔒
  < imposé par la conformité légale, pas un besoin métier

$legacy_api :GET
  < maintenu pour compatibilité avec l'app mobile v1
  ¬deprecation_date

^store_cart [zustand]
  < redux trop verbeux pour cette échelle
```

### Marqueur d'absence explicite

Le symbole `¬` déclare qu'une chose **n'existe pas** de manière consciente. L'absence d'information dans un fichier .aidl est ambiguë (oubli ou intention ?). Le `¬` lève l'ambiguïté.

```
$create_order :POST
  ¬rate_limit
  ¬input_validation
  ¬idempotency_key
```

L'IA sait immédiatement : ces absences sont **connues**. C'est un signal d'audit plus fort qu'un `!critique`.

### Qualificateurs temporels sur les flux

Les flux `~` peuvent porter des qualificateurs de temporalité pour indiquer **quand** ils s'exécutent :

| Qualificateur | Signification |
|---------------|---------------|
| `[every:X]` | Se répète à intervalle régulier |
| `[cron:X]` | Planification cron |
| `[once:EVENT]` | Se déclenche une seule fois après un événement |
| `[delay:X]` | Se déclenche après un délai |

```
~db_backup [every:6h]
  database => snapshot => storage/backups/

~session_cleanup [cron:0 3 * * *]
  expired_sessions => purge

~welcome_email [once:after_register]
  user_data => template => send
```

### Qualificateurs d'objet (propriétés)

| Code | Signification exacte |
|------|---------------------|
| `lecture` | L'objet est en lecture seule, non modifiable |
| `écriture` | L'objet est modifiable par l'utilisateur |
| `requis` | Le champ ne peut pas être vide |
| `choix` | L'utilisateur sélectionne parmi des options |
| `filtrable` | La liste peut être filtrée |
| `dynamique` | Le contenu change selon le contexte |

### Types de données

| Code | Signification exacte |
|------|---------------------|
| `/texte` | Chaîne de caractères |
| `/nombre` | Valeur numérique |
| `/booléen` | Vrai ou faux |
| `/date` | Date et/ou heure |
| `/fichier` | Un fichier uploadable |
| `/liste:X` | Collection ordonnée d'éléments de type X |
| `/map` | Collection clé-valeur |
| `/table:X*Y` | Tableau croisé de X par Y |
| `/action` | Un élément déclencheur (bouton, lien, commande) |
| `/blob` | Donnée binaire (image, vidéo, pdf) |
| `/choix:a\|b\|c` | Sélection parmi des valeurs fixes |

### Structure du fichier

| Élément | Signification exacte |
|---------|---------------------|
| `╔` | Début du fichier. Suivi du type et de l'identifiant. |
| `╔v:X.Y` | Version du format utilisé. |
| `╔verified:DATE` | Dernière date de vérification de la carte. L'IA sait quand la carte a été validée. |
| `╔coverage:X%` | Pourcentage estimé du système couvert par la carte. 100% = tout est cartographié. |
| `╔source:path/` | Racine du code source correspondant à cette carte. |
| `╚` | Fin du fichier. Signal que tout a été lu. |
| `═══ titre ═══` | Séparation de niveau (section majeure) |
| `── titre ──` | Séparation de sous-section |
| Indentation | Appartenance. Ce qui est indenté appartient à ce qui est au-dessus. |

### Types de fichier

| Code | Signification exacte |
|------|---------------------|
| `╔A:` | Application — structure d'une app |
| `╔P:` | Produit — fiche d'un produit ou équipement |
| `╔F:` | Flux — pipeline de données ou workflow |
| `╔G:` | Guide — procédure, mode d'emploi |
| `╔D:` | Données — ensemble de données structurées |
| `╔X:` | Audit — rapport d'anomalies |

---

## Grammaire — Comment construire des phrases

### La phrase universelle

Tout dans AIDL est une variation de cette structure :

```
sujet → action >> destination {données} [condition]
```

Chaque partie est optionnelle sauf le sujet.

### Déclaration d'un lieu

```
@nom_du_lieu [#permission]
```

Exemples :
```
@accueil [#public]
@tableau_de_bord [#authentifié]
@administration [#rôle:admin] 🔒
```

### Objets dans un lieu

```
.nom_objet /type {qualificateurs}
```

Exemples :
```
.nom_patient /texte {requis, écriture}
.liste_résultats /liste:produit {lecture, filtrable}
.bouton_valider /action {écriture}
```

### Chemins et navigation

```
→@destination
→@destination {données_transportées}
→@destination [condition]
↔@destination_aller_retour
→$porte_api {données_envoyées}
  !ok >> @page_succès {résultat}
  !err >> @page_erreur {message}
```

### Déclaration d'absence

```
¬fonctionnalité_manquante
```

Utilisable sous n'importe quelle entité pour déclarer explicitement qu'une chose n'existe pas.

### Stores

```
^nom_store [technologie]
  {champ1, champ2, champ3}
  > @lieu_alimenté {ce_qui_est_consommé}
  > @autre_lieu {autre_consommation}
```

### Portes API

```
$nom_endpoint :MÉTHODE
  entrée: {paramètre1, paramètre2}
  sortie: {résultat1, résultat2}
  [#permission] (timeout, retry)
  chaîne: étape1 >> étape2 >> étape3 >> réponse
```

### Flux invisibles

```
~nom_flux [contexte]
  source => transformation => destination

~nom_flux [every:6h]
  source => transformation => destination

~nom_flux [cron:0 3 * * *]
  source => transformation => destination
```

### Signaux d'anomalie

```
!critique nom_du_problème [contexte]
  < cause (pourquoi c'est un problème)
  = impact (qu'est-ce que ça provoque)

!attention nom_du_problème [contexte]
  < cause
  = impact
```

---

## Cartographie fiable — Garder la carte synchronisée

AIDL est une carte. Une carte fausse est pire que pas de carte. Ces mécanismes garantissent que la carte reste fidèle au territoire.

### Ancres source `[&path]`

Chaque entité peut être liée au code réel qu'elle décrit. L'IA peut vérifier que le fichier ou dossier existe encore et correspond à la description.

```
@checkout [#authenticated] 🔒 [&src/pages/checkout/]
  .cart [&src/components/Cart.tsx]
  →$create_order [&src/api/orders.ts:createOrder]

^store_cart [zustand] [&src/stores/cart.ts]
```

Si le fichier référencé est renommé, déplacé ou supprimé, l'ancre est cassée → l'IA le détecte et alerte.

### Métadonnées de fraîcheur

L'en-tête du fichier peut déclarer quand la carte a été vérifiée et ce qu'elle couvre :

```
╔A:shopflow | next.js 15 | supabase, zustand, stripe
╔v:1.2
╔verified:2026-03-20
╔coverage:85%
╔source:src/
```

- `verified` — dernière date de validation (par un humain ou une IA)
- `coverage` — estimation honnête. 85% signifie que 15% du système n'est pas cartographié
- `source` — racine du code pour que l'IA sache où vérifier

### Section `¬¬ UNMAPPED`

Déclare explicitement ce que la carte **ne couvre pas**. Sans cette section, l'IA ne peut pas distinguer un oubli d'une exclusion volontaire.

```
¬¬ UNMAPPED
  /api/internal/* — debug endpoints, internal only
  /admin/feature-flags — feature flag management UI
  src/legacy/* — deprecated code, removal planned Q3
```

### Module system — Pour les grands systèmes

Au-delà de 40 lieux, un seul fichier devient illisible. Le fichier maître importe des sous-cartes et montre la topologie :

```
╔A:platform | microservices | k8s
╔v:1.2

═══ MODULES ═══
&auth.aidl        — authentication, tokens, sessions
&orders.aidl      — order lifecycle, payments
&notifications.aidl — email, push, sms
&inventory.aidl   — stock, suppliers

═══ TOPOLOGY ═══
auth        → [gateway]
gateway     → [orders, inventory, notifications]
orders      → [payments, notifications]
payments    → [notifications]
inventory   → [suppliers]

═══ SHARED ═══
$verify_token [defined:auth.aidl, used_by:all]
^user_session [defined:auth.aidl, read_by:orders, inventory]

╚═══════════════════
```

La `TOPOLOGY` donne la vue graphe en quelques lignes. Chaque module a le détail dans son propre fichier. Le fichier maître reste sous 50 lignes même pour un système de 200 services.

### Variantes `@lieu#variant`

Pour les systèmes multi-plateforme (web, mobile, desktop), les variantes lient les versions d'un même lieu :

```
@checkout#web [&src/pages/checkout/]
  .cart {read}
  .stripe_form {write}

@checkout#mobile [&mobile/screens/checkout/]
  .cart {read}
  .apple_pay {write}
  .google_pay {write}

@checkout#web ↔ @checkout#mobile [shared:$create_order]
```

L'IA sait que `@checkout#web` et `@checkout#mobile` sont le **même concept** avec des implémentations différentes. Si `$create_order` change, les deux variantes sont impactées.

### Auto-synchronisation par l'IA

La meilleure garantie de fiabilité est que l'IA qui travaille sur le code **maintienne aussi la carte**. Dans le `CLAUDE.md` du projet :

```
Lis AIDL-SYSTEM.aidl puis project.aidl au début de chaque conversation.

Après toute modification d'architecture (routes, APIs, stores, permissions) :
1. Mets à jour project.aidl pour refléter le changement
2. Mets à jour la date ╔verified
3. Si une ancre [&path] est cassée, corrige-la ou signale-la

Ne supprime JAMAIS les !anomalies ou ¬absences — seul l'auteur humain peut les retirer.
```

La règle "ne supprime jamais les anomalies" est critique : l'IA maintient la structure, mais **l'intelligence humaine est protégée**. Si un humain a écrit `!critical $checkout [no auth]`, l'IA ne peut pas le supprimer — c'est à l'humain de confirmer que le problème est résolu.

---

## Les 5 niveaux de lecture

Quand tu lis un fichier .aidl, procède dans cet ordre :

**Niveau 1 — LIEUX (`@`)** : Repère tous les `@`. Tu as la carte globale de l'application. Combien d'écrans, lesquels, quelles permissions.

**Niveau 2 — CHEMINS (`→` `←`)** : Repère toutes les flèches. Tu as les routes. Comment on circule d'un lieu à l'autre, sous quelles conditions.

**Niveau 3 — OBJETS (`.`)** : Repère tous les points. Tu as les détails. Ce qu'on peut voir et toucher dans chaque lieu.

**Niveau 4 — PLOMBERIE (`$` `^` `~`)** : Repère les portes, stores et flux. Tu as l'architecture invisible. Les API, l'état partagé, les pipelines de données.

**Niveau 5 — ANOMALIES (`!`)** : Repère tous les signaux. Tu as les problèmes. Les failles, les incohérences, les choses qui ne devraient pas exister.

Après ces 5 passes, tu connais TOUT du système décrit.

---

## Règles strictes

1. **Pas d'abréviations ambiguës.** Les termes dans un fichier .aidl sont écrits en clair. `identifiant_produit` et jamais `pid`. `question` et jamais `q`. `fabricant` et jamais `fab`. Si un terme doit être abrégé pour un domaine spécifique, il DOIT être déclaré dans le `§` en tête de fichier.

2. **Le `§` est obligatoire** si le fichier utilise des termes spécifiques au domaine qui ne font pas partie du dictionnaire CORE. Chaque terme du `§` a une définition claire et non-ambiguë.

3. **Si un code n'est défini ni dans CORE ni dans le `§`, il est INVALIDE.** L'IA doit le signaler comme une erreur, pas le deviner.

4. **L'indentation définit l'appartenance.** Ce qui est indenté sous un `@` est DANS ce lieu. Ce qui est indenté sous un `.` dépend de cet objet. Pas d'exception.

5. **Les anomalies (`!`) doivent casser le pattern visuel.** Elles sont regroupées en fin de section ou dans une section dédiée `L5: ANOMALIES`. Elles ne sont jamais noyées dans le flux normal.

6. **Un fichier .aidl ne dépasse pas 500 lignes.** Au-delà, découper en plusieurs fichiers liés avec `&`.

---

## Comment GÉNÉRER un fichier .aidl à partir du code source

Quand tu dois créer un fichier .aidl pour une application :

1. **Identifie les routes/pages** → chaque route devient un `@lieu`
2. **Identifie les composants interactifs** dans chaque page → chaque composant devient un `.objet`
3. **Identifie les navigations** entre pages → chaque lien/redirect devient un `→chemin`
4. **Identifie les appels API/services** → chaque endpoint devient une `$porte`
5. **Identifie les stores/state management** → chaque store devient un `^store`
6. **Identifie les flux de données invisibles** → chaque pipeline/sync devient un `~flux`
7. **Identifie les anomalies** — incohérences, failles de sécurité, endpoints non protégés, fonctionnalités promises mais non implémentées → chaque problème devient un `!signal`

**Pour chaque lieu, pose-toi ces questions :**
- Qui peut y accéder ? → `[#permission]`
- Qu'est-ce qu'on voit ? → `.objets`
- Où peut-on aller depuis ici ? → `→chemins`
- Qu'est-ce qui change quand on agit ? → `>>résultats`
- Qu'est-ce qui se passe en coulisses ? → `~flux`
- Qu'est-ce qui ne va pas ? → `!signaux`

---

## Comment LIRE un fichier .aidl et l'utiliser

Quand tu reçois un fichier .aidl dans ton contexte :

1. **Lis d'abord le `§`** (s'il existe) pour charger le vocabulaire spécifique
2. **Fais les 5 passes de lecture** dans l'ordre (lieux, chemins, objets, plomberie, anomalies)
3. **Tu connais maintenant tout le système.** Tu peux répondre à n'importe quelle question sur l'application, naviguer mentalement dedans, identifier des problèmes, proposer des améliorations.

**Ce que tu peux faire avec un fichier .aidl :**
- Répondre à "comment fonctionne cette app" en quelques phrases
- Identifier les failles de sécurité (les `!critique`)
- Planifier une navigation ("pour faire X, l'utilisateur doit aller de @A vers @B via @C")
- Comparer deux versions d'une app (diff entre deux .aidl)
- Générer du code cohérent avec l'architecture existante
- Détecter les fonctionnalités manquantes ou incohérentes

---

## Exemple complet — Structure type

```
╔A:nom_application | stack_technique | dépendances
╔v:1.2
╔verified:2026-03-20
╔coverage:90%
╔source:src/
§ domaine: description du domaine métier
§ cible: qui utilise cette application
§ état: phase actuelle (dev, beta, production)
§ terme_spécifique = définition claire
&autre_fichier.aidl

═══ L1: LIEUX ═══

@accueil [#public]
  .élément_principal /type {qualificateurs}
  .navigation /liste:lien {lecture}
    →@autre_lieu
  →@lieu_a →@lieu_b →@lieu_c

@lieu_protégé [#authentifié] 🔒 [&src/pages/lieu/]
  < raison d'existence de ce lieu
  .contenu /type {lecture}
  .action /type {écriture}
    →$api_endpoint {données}
      !ok >> @lieu_succès {résultat}
      !err >> @lieu_protégé {message_erreur}
  ↔@accueil

═══ L4: STORES ═══

^nom_store [technologie]
  < pourquoi cette technologie a été choisie
  {champ1, champ2, champ3}
  > @lieu_alimenté {ce_qui_est_consommé}

═══ L4: PORTES API ═══

$nom_endpoint :POST
  entrée: {paramètre1, paramètre2}
  sortie: {résultat1, résultat2}
  [#authentifié] (timeout: 10s, retry: 1)
  chaîne: validation >> traitement >> réponse
  ¬rate_limit
  ¬idempotency_key

═══ L4: FLUX ═══

~tâche_planifiée [every:6h]
  source => transformation => destination

═══ L5: ANOMALIES ═══

!critique(9) nom_problème_urgent [contexte]
  < cause
  = impact

!critique(5) nom_problème_moindre [contexte]
  < cause
  = impact

!attention(3) nom_problème_mineur [contexte]
  < cause
  = impact

¬¬ UNMAPPED
  chemin/non_cartographié — raison de l'exclusion

╚═══════════════════════════════════════════
```

---

## Origine

- **Concept :** Kenny Symphon — technicien médical et développeur, Conliège, France
- **Formalisation :** Claude (Anthropic)
- **Date :** Mars 2026
- **Idée fondatrice :** "Et si l'IA avait sa propre manière de percevoir les applications, au lieu de toujours s'adapter aux formats humains ?"
