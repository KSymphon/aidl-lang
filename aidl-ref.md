# AIDL Quick Reference v1.2 — for AI context

AIDL (AI Description Language) describes systems in a format optimized for AI comprehension.
When you see a `.aidl` file, read it using the 5-level scan below. You will understand the entire system in one pass.

## Symbols

| Symbol | Name | Meaning |
|--------|------|---------|
| `@` | LIEU | A navigable space (screen, page, view, step) |
| `.` | OBJET | An interactive element inside a lieu (field, button, component) |
| `$` | PORTE | An external communication point (API endpoint, service) |
| `^` | STORE | A shared data container (app state, cache) |
| `~` | FLUX | An invisible data movement (pipeline, sync, background job) |
| `!` | SIGNAL | An anomaly or notable event |
| `§` | DICT | File-specific vocabulary (read this first) |
| `&` | LINK | Reference to another .aidl file |
| `¬` | ABSENCE | Explicit declaration that something does NOT exist (known gap, not an oversight) |
| `¬¬` | UNMAPPED | Section listing what the map deliberately does NOT cover |
| `[&path]` | SOURCE ANCHOR | Link to actual source code — AI can verify sync |
| `→` | GOES TO | Navigation forward |
| `←` | BACK | Navigation backward |
| `↔` | BOTH WAYS | Bidirectional navigation (replaces `→` + `←` when symmetric) |
| `>>` | PRODUCES | Result or consequence |
| `=>` | TRANSFORMS | Data conversion |
| `::` | CONTAINS | Composition |
| `?` | CONDITION | Logical branch |
| `>` | FEEDS | Store pushes data to a component |
| `<` | REASON | Why something exists (usable under any entity, not just signals) |

## Permissions

`[#public]` open to all | `[#authenticated]` login required | `[#role:X]` specific role | lock emoji = restricted

## Signal levels

`!ok` success | `!err` failure | `!attention` minor anomaly | `!critical` severe anomaly

Optional priority: `!critical(9)` or `!attention(3)` — scale 1 (low) to 10 (urgent). AI sorts by priority.

## Temporal qualifiers on flux

`[every:X]` repeats at interval | `[cron:X]` cron schedule | `[once:EVENT]` triggers once after event | `[delay:X]` triggers after delay

## File types

`A:` app | `P:` product | `F:` flow/pipeline | `G:` guide | `D:` dataset | `X:` audit

## 5-level reading order

1. **@ LIEUX** — scan all `@` to get the map (how many screens, which ones, permissions)
2. **PATHS** — scan `→` `←` `↔` to get the routes (how users move between lieux)
3. **. OBJECTS** — scan `.` to get details (what you see and interact with in each lieu)
4. **PLUMBING** — scan `$` `^` `~` to get the invisible architecture (APIs, state, pipelines)
5. **! SIGNALS** — scan `!` to get the problems (security flaws, anomalies, missing features)

After these 5 passes, you know everything about the system.

## File structure

```
╔TYPE:name | stack | dependencies
╔v:1.2
╔verified:2026-03-20
╔coverage:90%
╔source:src/
§ key = definition
§ key: definition
&other_file.aidl

═══ SECTION TITLE ═══

@lieu_name [#permission] [&src/pages/lieu/]
  < why this lieu exists (optional, on any entity)
  .object_name /type {qualifiers}
    →$api_endpoint {data}
      !ok >> @success_page {result}
      !err >> @error_page {message}
  ↔@other_lieu

^store_name [technology]
  < why this technology was chosen
  {field1, field2, field3}
  > @lieu {consumed_data}

$endpoint_name :METHOD
  input: {param1, param2}
  output: {result1, result2}
  chain: step1 >> step2 >> step3
  ¬rate_limit
  ¬input_validation

~scheduled_task [every:6h]
  source => transformation => destination

!critical(9) urgent_problem [context]
  < cause
  = impact

!attention(3) minor_problem [context]
  < cause
  = impact

¬¬ UNMAPPED
  path/not_mapped — reason for exclusion

╚═══════════════════
```

## Cartography — keeping the map true

- `[&path]` on any entity links it to source code — AI verifies the file exists
- `╔verified:DATE` in header — when the map was last validated
- `╔coverage:X%` in header — honest estimate of what the map covers
- `¬¬ UNMAPPED` section — explicitly lists what is NOT mapped (not forgotten, excluded)
- `@lieu#variant` — links platform variants (`@checkout#web`, `@checkout#mobile`)
- Module system: `&file.aidl` imports + `═══ TOPOLOGY ═══` section for graph overview

## Qualifiers

`read` | `write` | `required` | `choice` | `filterable` | `dynamic`

## Data types

`/text` | `/number` | `/boolean` | `/date` | `/file` | `/action` | `/list:X` | `/map` | `/table:X*Y` | `/blob` | `/choice:a|b|c`

## How to generate a .aidl file

1. Identify routes/pages → each becomes `@lieu`
2. Identify interactive components → each becomes `.object`
3. Identify navigations → each becomes `→path` or `↔path`
4. Identify API calls → each becomes `$porte`
5. Identify state management → each becomes `^store`
6. Identify background data flows → each becomes `~flux` (add temporal qualifiers if scheduled)
7. Identify anomalies → each becomes `!signal` (add priority 1-10 if multiple)
8. Identify known gaps → each becomes `¬absence`
9. For every non-obvious decision, add `< reason` under the entity

## Rules

- No ambiguous abbreviations — write terms in full. Domain terms MUST be declared in `§`
- Indentation defines ownership — what is indented belongs to what is above
- Signals (`!`) must break the visual pattern — grouped at end of section
- Max 500 lines per file — split with `&` links beyond that
- `< reason` is always optional but always valuable — the WHY matters more than the WHAT
- `¬` is stronger than silence — explicit absence is a signal, not just missing info
- `[&path]` anchors are optional but critical for map reliability — AI should verify them
- Never remove `!` anomalies or `¬` absences written by humans — only the author can clear them
