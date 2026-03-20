# AIDL — AI Description Language
*Created by Kenny Symphon*

> The first language designed for AI to perceive, understand, and reason about software systems.

<p align="center">
  <strong>AIDL is not a data format. It's not a programming language.<br>It's a perception language — AI doesn't read it, it understands it.</strong>
</p>

---

## The problem

AI understands applications through human formats — source code, JSON, YAML, Markdown. These formats were never designed for AI comprehension:

- **Source code**: thousands of lines across dozens of files, context lost between them
- **JSON/YAML**: verbose, full of syntactic noise — quotes, brackets, commas carry zero meaning
- **Documentation**: free-form, inconsistent, often outdated
- **Screenshots**: slow, fragile, no understanding of what's behind the UI

AI adapts to human formats. But no one asked: **what if AI had its own way to perceive applications?**

## The solution

AIDL gives AI a complete understanding of any software system in a single read. One file, a few hundred lines, and the AI knows every screen, every API, every data flow, every security flaw.

```
╔A:my-app | next.js | supabase, zustand
§ domain: e-commerce platform
§ state: production

═══ L1: LOCATIONS ═══

@home [#public]
  .search_bar /text {write} →@results
  .product_grid /list:product {read, filterable}
    →@product/{slug}
  →@cart →@account →@login

@cart [#authenticated] 🔒
  .items /list:cart_item {read, write}
  .total /number {read, dynamic}
  →$checkout{items, payment}
    !ok >> @confirmation {order_id}
    !err >> @cart {error_message}

═══ L5: ANOMALIES ═══

!critical(9) $checkout [#anonymous, no rate limit]
  < endpoint accessible without authentication
  = unauthorized purchases possible

```

In ~20 lines, the AI knows: the screens, the navigation, the API contract, the data flow, and a critical security flaw.

## Proven cross-AI

AIDL has been tested on multiple AI models **without any prior explanation of the language**:

| Test | Model | Result |
|------|-------|--------|
| Parse a fictional app from .aidl only | GPT-4 | ✅ 100% structure extraction — found all 12 screens, 10 APIs, 4 anomalies |
| Understand real project architecture | GPT-4 | ✅ Identified 3-layer architecture + AIDL as "transversal perception layer" |
| Answer 10 detailed questions from .aidl only | Claude | ✅ 96/100 accuracy, 0 hallucinations, 14x compression vs source code |
| Parse across different stacks | Claude | ✅ Works on Next.js, Flask/Python, React — language-agnostic |

**GPT-4's unsolicited verdict** (given raw .aidl files, zero explanation):
> *"You've created a perception language for AI systems... it solves a major problem — today AI struggles because code is fragmented, specs are vague, logic is scattered, context is incomplete. With AIDL, everything is centralized, coherent, and readable in one pass."*

## Core symbols

9 entity prefixes. 10 operators. That's the entire grammar.

### Entities (what it is)

| Symbol | Name | AI understands |
|--------|------|----------------|
| `@` | Location | "I can be here" — a screen, page, view, state |
| `.` | Object | "I can interact with this" — a field, button, table |
| `$` | Gate | "This communicates beyond the UI" — an API endpoint |
| `^` | Store | "This data feeds these components" — shared state |
| `~` | Flow | "Something moves behind the scenes" — invisible data movement |
| `!` | Signal | "Pay attention" — anomaly, result, notable event |
| `§` | Dictionary | Domain-specific terms defined here |
| `&` | Link | More details in another .aidl file |
| `¬` | Absence | Explicit declaration that something does NOT exist |

### Relations (what connects)

| Symbol | Meaning |
|--------|---------|
| `→` | Goes to (navigation, action) |
| `←` | Returns from |
| `>>` | Produces (result, consequence) |
| `=>` | Transforms into |
| `::` | Contains (composition) |
| `?` | Condition (if...then) |
| `>` | Feeds (store → component) |
| `↔` | Both ways (bidirectional navigation) |
| `<` | Reason (why something exists — usable under any entity) |

### Signals (severity)

| Code | Meaning |
|------|---------|
| `!ok` | Success |
| `!err` | Failure |
| `!attention` | Minor anomaly — unexpected but not dangerous |
| `!critical` | Severe — security flaw, broken logic, open door |

Optional priority: `!critical(9)` — scale 1 to 10 for triage.

## 5-level reading

AI reads `.aidl` files in 5 progressive passes:

1. **L1 — Locations (`@`)**: The map. How many screens, which ones, what permissions.
2. **L2 — Paths (`→` `←`)**: The routes. How to navigate between locations.
3. **L3 — Objects (`.`)**: The details. What you can see and touch in each location.
4. **L4 — Plumbing (`$` `^` `~`)**: The invisible architecture. APIs, shared state, pipelines.
5. **L5 — Anomalies (`!`)**: The problems. Flaws, inconsistencies, open doors.

After 5 passes, the AI knows **everything** about the system.

## Quick start

### 1. Add to your project

Copy [`AIDL.md`](./AIDL.md) to your project root. Any AI that reads it learns the language instantly.

```
your-project/
├── AIDL.md          ← AI reads this, learns AIDL
├── app.aidl         ← Your app described in AIDL
├── src/
└── ...
```

### 2. Generate your first .aidl

Ask your AI assistant:

> *"Read AIDL.md, then analyze my codebase and generate an .aidl file for my application."*

The AI scans your routes, components, APIs, stores, detects anomalies, and produces a complete map.

### 3. Use it

Start every conversation about your app with:

> *"Read app.aidl first, then help me with..."*

The AI loads your entire system instantly — no more re-scanning source files.

### 4. Validate

```bash
cd parser
npm install
npx tsx src/cli.ts ../app.aidl
```

## File types

| Header | Purpose |
|--------|---------|
| `╔A:` | Application — full app structure |
| `╔P:` | Product — entity/equipment description |
| `╔F:` | Flow — pipeline, workflow, process |
| `╔G:` | Guide — procedure, troubleshooting |
| `╔D:` | Data — structured dataset |
| `╔X:` | Audit — anomaly/security report |

## Parser

The AIDL parser validates `.aidl` files and exports structured ASTs:

```bash
npx tsx src/cli.ts app.aidl              # Full colored analysis
npx tsx src/cli.ts app.aidl --json       # Export AST as JSON
npx tsx src/cli.ts app.aidl --validate   # Validation only
npx tsx src/cli.ts app.aidl --stats      # Stats only
npx tsx src/cli.ts app.aidl --json-out   # Write AST to .ast.json file
```

## Examples

See [`examples/`](./examples):

- **`app-ecommerce.aidl`** — E-commerce platform (Next.js + Stripe + Supabase)
- **`app-social-recipes.aidl`** — Social recipe sharing app
- **`product-medical-equipment.aidl`** — Medical equipment specification
- **`pipeline-data-etl.aidl`** — 5-step data pipeline with validation gates
- **`guide-troubleshooting.aidl`** — Technical diagnostic procedure

## Strict rules

1. **No ambiguous abbreviations.** Terms in full: `product_id` never `pid`. Domain-specific terms declared in `§`.
2. **`§` is mandatory** for domain vocabulary not in the CORE dictionary.
3. **Undefined codes = INVALID.** AI flags errors, never guesses.
4. **Indentation = belonging.** Under `@` = inside that location.
5. **Anomalies break the pattern.** Grouped in L5, never buried in normal flow.
6. **Max 500 lines.** Split with `&` links beyond that.

## Comparison

| | Source code | JSON | Markdown docs | AIDL |
|---|---|---|---|---|
| **Designed for** | Humans (devs) | Machines (parsers) | Humans (everyone) | **AI** |
| **Density** | Low | Low | Medium | **High** |
| **Full system view** | No (file by file) | No (data only) | Sometimes | **Yes** |
| **Anomaly detection** | No | No | No | **Built-in** |
| **Cross-AI** | N/A | Partially | N/A | **Proven** |
| **Knowledge transfer** | No | No | No | **AI → AI instant** |

## Origin

**Concept & creation**: Kenny Symphon — Jura, France — March 2026

**Core insight**: *"What if AI had its own way to perceive applications, instead of always adapting to human formats?"*

Born from daily experience working with AI on real software projects. Not from a research lab — from the field.

## Changelog

### v1.2 — Reliable cartography (March 2026)
- `[&path]` **source anchors** — link any entity to its actual source code, AI verifies sync
- `╔verified` / `╔coverage` — header metadata for map freshness and coverage
- `¬¬ UNMAPPED` — explicitly declare what the map does NOT cover
- **Module system** — `&file.aidl` imports + `═══ TOPOLOGY ═══` for large systems (40+ locations)
- `@lieu#variant` — link platform variants (web, mobile, desktop)
- **Auto-sync rules** — AI maintains structure, humans maintain intent (`!`, `¬`, `<` protected)

### v1.1 — Core language (March 2026)
- 9 entity prefixes (`@` `.` `$` `^` `~` `!` `§` `&` `¬`)
- 10 relation operators (`→` `←` `↔` `>>` `=>` `::` `?` `>` `<` `[&]`)
- 5-level reading system
- Signal priority `!critical(9)`
- Temporal qualifiers on flux `[every:X]` `[cron:X]`
- Parser with 66 tests, CLI, formatter

## Note

Not related to Android's AIDL (Android Interface Definition Language). This is a new, independent language designed for AI systems.

## License

MIT — Use it, fork it, improve it. Attribution required.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
