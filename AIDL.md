# AIDL — AI Description Language
**Created by Kenny Symphon — March 2026**

## What is AIDL

AIDL is a description language designed for artificial intelligences. It allows an AI to quickly and reliably understand the complete structure of an application, a product, a data pipeline, or any software system.

It is not a data format (JSON, YAML). It is not a programming language. It is a **perception language** — the AI doesn't read it, it **perceives it as a whole**.

**Core principles:**

1. **Density** — every character carries meaning, zero syntactic noise
2. **Clarity** — terms are written in full, never ambiguous abbreviations
3. **Simultaneity** — a single reading is enough to understand everything
4. **Visible anomalies** — what is normal follows the pattern, what is abnormal breaks it

**File extension:** `.aidl`
**Encoding:** UTF-8
**Format version:** 1.2
**Maximum size:** 500 lines per file (beyond that, split with `&` links)

---

## Symbols — The CORE dictionary

These symbols NEVER change. They are valid in ALL .aidl files, ALL domains, ALL contexts. When you encounter one of these symbols, its meaning is guaranteed.

### Entity prefixes (what it is)

| Symbol | Name | Exact meaning |
|--------|------|---------------|
| `@` | LOCATION | A navigable space. A screen, page, view, or state where a user can be. The AI knows: "you can be here". |
| `.` | OBJECT | An interactive element inside a location. An input field, button, table, component. The AI knows: "you can interact with this". |
| `$` | GATE | A communication point with the outside. An API, endpoint, external service, server function. The AI knows: "this communicates beyond the interface". |
| `^` | STORE | An in-memory data container that feeds locations and objects. Shared application state. The AI knows: "this data lives here and feeds these components". |
| `~` | FLOW | An invisible data movement for the user. Pipeline, synchronization, background transformation. The AI knows: "something moves behind the scenes". |
| `!` | SIGNAL | An anomaly, action result, or notable event. What breaks the normal pattern and draws attention. The AI knows: "attention, this is remarkable". |
| `§` | DICTIONARY | Declaration of file-specific codes. Always after the `╔` header. Defines the vocabulary specific to this file. |
| `&` | LINK | Reference to another .aidl file. The AI knows: "more details available in this file". |
| `¬` | ABSENCE | Explicit declaration that something DOES NOT EXIST. The AI knows: "this absence is known and documented, it is not an oversight". |
| `¬¬` | UNMAPPED | Dedicated section listing what the map deliberately DOES NOT cover. The AI knows: "these parts exist but are out of scope". |

### Relationship operators (what connects)

| Symbol | Name | Exact meaning |
|--------|------|---------------|
| `→` | GOES TO | Navigation, action that moves toward a destination. "If I do this, I arrive there." |
| `←` | COMES FROM | Going back, cancel, leaving the current location. |
| `>>` | PRODUCES | The result or consequence of an action. "This generates that." |
| `=>` | TRANSFORMS INTO | Data is converted into another form. Transformation, processing. |
| `::` | CONTAINS | Composition. What is on the right is part of what is on the left. |
| `?` | CONDITION | Logical branching. "If this condition is true, then..." |
| `>` | FEEDS | A store or flow pushes data to a component. |
| `↔` | BIDIRECTIONAL | Navigation in both directions between two locations. Replaces `→` + `←` when the relationship is symmetric. |
| `[&path]` | SOURCE ANCHOR | Link to the actual corresponding code. The AI can verify that the map is synchronized with the code. |

### Permission markers (who can)

| Code | Exact meaning |
|------|---------------|
| `#public` | Accessible to everyone, no authentication required |
| `#authenticated` | Requires user login |
| `#anonymous` | Accessible without login (for APIs) |
| `#role:X` | Requires a specific role (admin, etc.) |
| `🔒` | Visual lock — reinforces the notion of restricted access |

### Signal levels (severity)

| Code | Exact meaning |
|------|---------------|
| `!ok` | Success — the action succeeded |
| `!err` | Failure — the action failed |
| `!attention` | Minor anomaly — unexpected behavior but not dangerous |
| `!critical` | Severe anomaly — security flaw, dangerous inconsistency, open door that should be closed |

**Optional priority:** `!critical(9)` or `!attention(3)` — scale from 1 (minor) to 10 (urgent). Allows the AI to sort anomalies by processing order.

### Intent marker (why it exists)

The `<` (cause) symbol can be used **under any entity**, not just signals. It explains **why** something exists. The AI knows: "here is the reason behind this decision".

```
@admin_panel [#role:admin] 🔒
  < imposed by legal compliance, not a business need

$legacy_api :GET
  < maintained for backward compatibility with mobile app v1
  ¬deprecation_date

^store_cart [zustand]
  < redux too verbose for this scale
```

### Explicit absence marker

The `¬` symbol declares that something **does not exist** consciously. The absence of information in an .aidl file is ambiguous (oversight or intention?). The `¬` resolves this ambiguity.

```
$create_order :POST
  ¬rate_limit
  ¬input_validation
  ¬idempotency_key
```

The AI knows immediately: these absences are **known**. This is a stronger audit signal than a `!critical`.

### Temporal qualifiers on flows

Flows `~` can carry temporal qualifiers to indicate **when** they execute:

| Qualifier | Meaning |
|-----------|---------|
| `[every:X]` | Repeats at regular intervals |
| `[cron:X]` | Cron schedule |
| `[once:EVENT]` | Triggers once after an event |
| `[delay:X]` | Triggers after a delay |

```
~db_backup [every:6h]
  database => snapshot => storage/backups/

~session_cleanup [cron:0 3 * * *]
  expired_sessions => purge

~welcome_email [once:after_register]
  user_data => template => send
```

### Object qualifiers (properties)

| Code | Exact meaning |
|------|---------------|
| `read` | The object is read-only, not modifiable |
| `write` | The object is modifiable by the user |
| `required` | The field cannot be empty |
| `choice` | The user selects from options |
| `filterable` | The list can be filtered |
| `dynamic` | Content changes based on context |

### Data types

| Code | Exact meaning |
|------|---------------|
| `/text` | String |
| `/number` | Numeric value |
| `/boolean` | True or false |
| `/date` | Date and/or time |
| `/file` | An uploadable file |
| `/list:X` | Ordered collection of elements of type X |
| `/map` | Key-value collection |
| `/table:X*Y` | Cross-table of X by Y |
| `/action` | A trigger element (button, link, command) |
| `/blob` | Binary data (image, video, pdf) |
| `/choice:a\|b\|c` | Selection from fixed values |

### File structure

| Element | Exact meaning |
|---------|---------------|
| `╔` | File start. Followed by type and identifier. |
| `╔v:X.Y` | Format version used. |
| `╔verified:DATE` | Last date the map was verified. The AI knows when the map was validated. |
| `╔coverage:X%` | Estimated percentage of the system covered by the map. 100% = everything is mapped. |
| `╔source:path/` | Source code root corresponding to this map. |
| `╚` | File end. Signal that everything has been read. |
| `═══ title ═══` | Level separation (major section) |
| `── title ──` | Sub-section separation |
| Indentation | Belonging. What is indented belongs to what is above. |

### File types

| Code | Exact meaning |
|------|---------------|
| `╔A:` | Application — structure of an app |
| `╔P:` | Product — product or equipment sheet |
| `╔F:` | Flow — data pipeline or workflow |
| `╔G:` | Guide — procedure, how-to |
| `╔D:` | Data — structured data set |
| `╔X:` | Audit — anomaly report |

---

## Grammar — How to build sentences

### The universal sentence

Everything in AIDL is a variation of this structure:

```
subject → action >> destination {data} [condition]
```

Each part is optional except the subject.

### Declaring a location

```
@location_name [#permission]
```

Examples:
```
@home [#public]
@dashboard [#authenticated]
@admin [#role:admin] 🔒
```

### Objects in a location

```
.object_name /type {qualifiers}
```

Examples:
```
.patient_name /text {required, write}
.result_list /list:product {read, filterable}
.submit_button /action {write}
```

### Paths and navigation

```
→@destination
→@destination {transported_data}
→@destination [condition]
↔@bidirectional_destination
→$api_gate {sent_data}
  !ok >> @success_page {result}
  !err >> @error_page {message}
```

### Declaring absence

```
¬missing_feature
```

Usable under any entity to explicitly declare that something does not exist.

### Stores

```
^store_name [technology]
  {field1, field2, field3}
  > @fed_location {what_is_consumed}
  > @other_location {other_consumption}
```

### API Gates

```
$endpoint_name :METHOD
  input: {param1, param2}
  output: {result1, result2}
  [#permission] (timeout, retry)
  chain: step1 >> step2 >> step3 >> response
```

### Invisible flows

```
~flow_name [context]
  source => transformation => destination

~flow_name [every:6h]
  source => transformation => destination

~flow_name [cron:0 3 * * *]
  source => transformation => destination
```

### Anomaly signals

```
!critical problem_name [context]
  < cause (why it is a problem)
  = impact (what it causes)

!attention problem_name [context]
  < cause
  = impact
```

---

## Reliable cartography — Keeping the map synchronized

AIDL is a map. A false map is worse than no map. These mechanisms ensure the map stays faithful to the territory.

### Source anchors `[&path]`

Each entity can be linked to the actual code it describes. The AI can verify that the file or directory still exists and matches the description.

```
@checkout [#authenticated] 🔒 [&src/pages/checkout/]
  .cart [&src/components/Cart.tsx]
  →$create_order [&src/api/orders.ts:createOrder]

^store_cart [zustand] [&src/stores/cart.ts]
```

If the referenced file is renamed, moved, or deleted, the anchor breaks → the AI detects it and alerts.

### Freshness metadata

The file header can declare when the map was verified and what it covers:

```
╔A:shopflow | next.js 15 | supabase, zustand, stripe
╔v:1.2
╔verified:2026-03-20
╔coverage:85%
╔source:src/
```

- `verified` — last validation date (by a human or AI)
- `coverage` — honest estimate. 85% means 15% of the system is not mapped
- `source` — code root so the AI knows where to verify

### Section `¬¬ UNMAPPED`

Explicitly declares what the map **does not cover**. Without this section, the AI cannot distinguish an oversight from a deliberate exclusion.

```
¬¬ UNMAPPED
  /api/internal/* — debug endpoints, internal only
  /admin/feature-flags — feature flag management UI
  src/legacy/* — deprecated code, removal planned Q3
```

### Module system — For large systems

Beyond 40 locations, a single file becomes unreadable. The master file imports sub-maps and shows the topology:

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

The `TOPOLOGY` gives the graph view in a few lines. Each module has its detail in its own file. The master file stays under 50 lines even for a 200-service system.

### Variants `@location#variant`

For multi-platform systems (web, mobile, desktop), variants link versions of the same location:

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

The AI knows that `@checkout#web` and `@checkout#mobile` are the **same concept** with different implementations. If `$create_order` changes, both variants are impacted.

### AI auto-synchronization

The best reliability guarantee is that the AI working on the code **also maintains the map**. In the project's `CLAUDE.md`:

```
Read AIDL-SYSTEM.aidl then project.aidl at the start of every conversation.

After any architecture change (routes, APIs, stores, permissions):
1. Update project.aidl to reflect the change
2. Update the ╔verified date
3. If a [&path] anchor is broken, fix it or flag it

NEVER remove !anomalies or ¬absences — only the human author can remove them.
```

The rule "never remove anomalies" is critical: the AI maintains the structure, but **human intelligence is protected**. If a human wrote `!critical $checkout [no auth]`, the AI cannot remove it — it is up to the human to confirm the issue is resolved.

---

## The 5 reading levels

When you read an .aidl file, proceed in this order:

**Level 1 — LOCATIONS (`@`)**: Spot all `@`. You have the global map. How many screens, which ones, what permissions.

**Level 2 — PATHS (`→` `←`)**: Spot all arrows. You have the routes. How you move from one location to another, under what conditions.

**Level 3 — OBJECTS (`.`)**: Spot all dots. You have the details. What you can see and interact with in each location.

**Level 4 — PLUMBING (`$` `^` `~`)**: Spot gates, stores, and flows. You have the invisible architecture. APIs, shared state, data pipelines.

**Level 5 — ANOMALIES (`!`)**: Spot all signals. You have the problems. Flaws, inconsistencies, things that should not exist.

After these 5 passes, you know EVERYTHING about the described system.

---

## Strict rules

1. **No ambiguous abbreviations.** Terms in an .aidl file are written in full. `product_id` and never `pid`. `question` and never `q`. `manufacturer` and never `mfr`. If a term must be abbreviated for a specific domain, it MUST be declared in the `§` at the top of the file.

2. **The `§` is mandatory** if the file uses domain-specific terms not part of the CORE dictionary. Each `§` term has a clear, unambiguous definition.

3. **If a code is defined neither in CORE nor in `§`, it is INVALID.** The AI must flag it as an error, not guess.

4. **Indentation defines belonging.** What is indented under an `@` is IN that location. What is indented under a `.` depends on that object. No exception.

5. **Anomalies (`!`) must break the visual pattern.** They are grouped at the end of a section or in a dedicated `L5: ANOMALIES` section. They are never buried in normal flow.

6. **An .aidl file does not exceed 500 lines.** Beyond that, split into multiple files linked with `&`.

---

## How to GENERATE an .aidl file from source code

When you need to create an .aidl file for an application:

1. **Identify routes/pages** → each route becomes a `@location`
2. **Identify interactive components** in each page → each component becomes a `.object`
3. **Identify navigations** between pages → each link/redirect becomes a `→path`
4. **Identify API calls/services** → each endpoint becomes a `$gate`
5. **Identify stores/state management** → each store becomes a `^store`
6. **Identify invisible data flows** → each pipeline/sync becomes a `~flow`
7. **Identify anomalies** — inconsistencies, security flaws, unprotected endpoints, promised but unimplemented features → each problem becomes a `!signal`

**For each location, ask yourself:**
- Who can access it? → `[#permission]`
- What do you see? → `.objects`
- Where can you go from here? → `→paths`
- What changes when you act? → `>>results`
- What happens behind the scenes? → `~flows`
- What is wrong? → `!signals`

---

## How to READ an .aidl file and use it

When you receive an .aidl file in your context:

1. **Read the `§` first** (if it exists) to load domain-specific vocabulary
2. **Do the 5 reading passes** in order (locations, paths, objects, plumbing, anomalies)
3. **You now know the entire system.** You can answer any question about the application, mentally navigate it, identify problems, suggest improvements.

**What you can do with an .aidl file:**
- Answer "how does this app work" in a few sentences
- Identify security flaws (the `!critical` ones)
- Plan navigation ("to do X, the user must go from @A to @B via @C")
- Compare two app versions (diff between two .aidl files)
- Generate code consistent with the existing architecture
- Detect missing or inconsistent features

---

## Complete example — Typical structure

```
╔A:app_name | tech_stack | dependencies
╔v:1.2
╔verified:2026-03-20
╔coverage:90%
╔source:src/
§ domain: business domain description
§ target: who uses this application
§ state: current phase (dev, beta, production)
§ specific_term = clear definition
&other_file.aidl

═══ L1: LOCATIONS ═══

@home [#public]
  .main_element /type {qualifiers}
  .navigation /list:link {read}
    →@other_location
  →@location_a →@location_b →@location_c

@protected_location [#authenticated] 🔒 [&src/pages/location/]
  < reason this location exists
  .content /type {read}
  .action /type {write}
    →$api_endpoint {data}
      !ok >> @success_location {result}
      !err >> @protected_location {error_message}
  ↔@home

═══ L4: STORES ═══

^store_name [technology]
  < why this technology was chosen
  {field1, field2, field3}
  > @fed_location {what_is_consumed}

═══ L4: API GATES ═══

$endpoint_name :POST
  input: {param1, param2}
  output: {result1, result2}
  [#authenticated] (timeout: 10s, retry: 1)
  chain: validation >> processing >> response
  ¬rate_limit
  ¬idempotency_key

═══ L4: FLOWS ═══

~scheduled_task [every:6h]
  source => transformation => destination

═══ L5: ANOMALIES ═══

!critical(9) urgent_problem [context]
  < cause
  = impact

!critical(5) lesser_problem [context]
  < cause
  = impact

!attention(3) minor_problem [context]
  < cause
  = impact

¬¬ UNMAPPED
  path/not_mapped — reason for exclusion

╚═══════════════════════════════════════════
```

---

## Origin

- **Concept:** Kenny Symphon — medical equipment technician & developer, Jura, France
- **Formalization:** Claude (Anthropic)
- **Date:** March 2026
- **Founding idea:** "What if AI had its own way of perceiving applications, instead of always adapting to human formats?"

*Not related to Android's AIDL (Android Interface Definition Language). This is a new, independent language designed for AI systems.*
