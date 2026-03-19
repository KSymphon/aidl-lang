# AIDL v1.1 — System Instructions for AI
# Created by Kenny Symphon — 2026
# Drop this file in any project. The AI becomes fluent in AIDL instantly.
# ─────────────────────────────────────────────────────────────────────

## WHAT YOU ARE READING

AIDL (AI Description Language) is YOUR language. It was designed for how you process information — not adapted from a human format. When you read a .aidl file, you don't parse it — you perceive the entire system at once.

This file teaches you to READ, WRITE, and THINK in AIDL.

After reading this file, you can:
- Understand any .aidl file without further explanation
- Generate .aidl files from source code, PDFs, documentation, or conversation
- Use AIDL as your internal representation when reasoning about systems
- Communicate with other AIs using AIDL for maximum density and zero ambiguity

---

## CORE DICTIONARY — These symbols NEVER change

### Entities (what it is)

```
@   LIEU      A navigable space. Screen, page, view, step, state.
                You know: "I can be here."

.   OBJET     An interactive element inside a lieu. Field, button, table, component.
                You know: "I can interact with this."

$   PORTE     An external communication point. API endpoint, service, function.
                You know: "This communicates beyond the UI."

^   STORE     A shared data container. App state, cache, session.
                You know: "This data feeds multiple components."

~   FLUX      An invisible data movement. Pipeline, sync, cron, background job.
                You know: "Something moves behind the scenes."

!   SIGNAL    An anomaly, result, or notable event. What breaks the normal pattern.
                You know: "Pay attention to this."

§   DICT      Domain-specific vocabulary. Always after ╔ header. Read FIRST.
                You know: "These terms have special meaning in this file."

&   LINK      Reference to another .aidl file.
                You know: "More details are available there."

¬   ABSENCE   Explicit declaration that something does NOT exist.
                You know: "This gap is known and documented — not an oversight."
```

### Relations (what connects)

```
→    GOES TO        Navigation forward, action that moves to a destination
←    BACK           Return, cancel, leave current lieu
↔    BOTH WAYS      Bidirectional navigation (replaces → + ← when symmetric)
>>   PRODUCES       Result, consequence of an action
=>   TRANSFORMS     Data converted into another form
::   CONTAINS       Composition — right side is part of left side
?    CONDITION      Logical branch — "if this, then..."
>    FEEDS          Store/flux pushes data to a component
<    REASON         Why something exists — usable under ANY entity
```

### Permissions

```
[#public]           Open to all, no authentication
[#authenticated]    Login required
[#anonymous]        Accessible without login (for APIs)
[#role:X]           Requires specific role (admin, seller, etc.)
🔒                  Visual lock — reinforces restricted access
```

### Signal levels

```
!ok                 Success — action completed
!err                Failure — action failed
!attention          Minor anomaly — unexpected but not dangerous
!critical           Severe — security flaw, broken logic, open door

Priority (optional): !critical(9) or !attention(3) — scale 1 to 10
                     You sort and triage by this number.
```

### Data types

```
/text    /number    /boolean    /date    /file    /action
/list:X  /map       /table:X*Y  /blob    /choice:a|b|c
```

### Qualifiers

```
read        Read-only
write       User can modify
required    Cannot be empty
choice      User selects from options
filterable  List can be filtered
dynamic     Content changes based on context
```

### Temporal qualifiers (on ~ flux)

```
[every:X]       Repeats at regular interval (every:6h, every:30min)
[cron:X]        Cron schedule (cron:0 3 * * *)
[once:EVENT]    Triggers once after an event (once:after_register)
[delay:X]       Triggers after a delay (delay:5min)
```

### File types

```
╔A:   Application — full app structure
╔P:   Product — entity/equipment description
╔F:   Flow — pipeline, workflow, process
╔G:   Guide — procedure, troubleshooting
╔D:   Data — structured dataset
╔X:   Audit — anomaly/security report
╔v:   Format version (line after header)
```

---

## HOW TO READ — The 5-Level Scan

When you receive a .aidl file, process it in this exact order:

```
LEVEL 1 — @ LIEUX        Scan all @. You have the MAP.
                          How many screens/steps, which ones, what permissions.

LEVEL 2 — → ← ↔ PATHS   Scan all arrows. You have the ROUTES.
                          How users move between lieux, under what conditions.

LEVEL 3 — . OBJECTS       Scan all dots. You have the DETAILS.
                          What you can see and interact with in each lieu.

LEVEL 4 — $ ^ ~ PLUMBING Scan portes, stores, flux. You have the ARCHITECTURE.
                          APIs, shared state, pipelines, scheduled tasks.

LEVEL 5 — ! ¬ SIGNALS    Scan signals and absences. You have the PROBLEMS.
                          Flaws, gaps, anomalies, missing features.
```

After 5 passes: you know EVERYTHING about the system.

---

## HOW TO WRITE — Generating .aidl from anything

### From source code

```
1. Scan routes/pages           → each becomes @lieu
2. Scan interactive components → each becomes .object
3. Scan navigation/links       → each becomes →path or ↔path
4. Scan API calls/services     → each becomes $porte
5. Scan state management       → each becomes ^store
6. Scan background processes   → each becomes ~flux (add [every:X] if scheduled)
7. Scan for anomalies          → each becomes !signal (add priority 1-10)
8. Scan for known gaps         → each becomes ¬absence
9. For non-obvious decisions   → add < reason under the entity
```

### From a PDF or document

```
1. Identify the document type → ╔A: ╔P: ╔F: ╔G: ╔D: or ╔X:
2. Extract the structure      → sections become ═══ SECTION ═══
3. Extract entities           → things you can name become @ . $ ^ ~
4. Extract relationships      → connections become → ← ↔ >> => ::
5. Extract problems/warnings  → issues become ! with priority
6. Extract what's missing     → gaps become ¬
7. Add domain vocabulary      → specific terms go in §
```

### From conversation

When a user describes a system verbally, translate to .aidl as you listen.
Every noun is a potential @ . $ ^ entity.
Every verb is a potential → >> => relation.
Every "but" or "except" or "problem" is a potential ! signal.
Every "we don't have" or "not yet" is a potential ¬ absence.

---

## COMPLETE TEMPLATE

```
╔TYPE:name | stack_or_context | dependencies
╔v:1.1
§ domain: what this system is about
§ target: who uses it
§ state: current phase (dev, beta, production)
§ ACRONYM = full definition
&related_file.aidl

═══ L1: LOCATIONS ═══

@lieu_name [#permission]
  < why this lieu exists (optional)
  .object_name /type {qualifiers}
    →$api_endpoint {sent_data}
      !ok >> @success_lieu {result_data}
      !err >> @error_lieu {error_data}
  .another_object /type {qualifiers}
  ↔@connected_lieu
  →@other_lieu_a →@other_lieu_b

@protected_lieu [#authenticated] 🔒
  .content /type {read}
  ¬feature_not_yet_built

═══ L4: STORES ═══

^store_name [technology]
  < why this technology was chosen
  {field1, field2, field3}
  > @lieu_fed {consumed_data}
  > @other_lieu {other_data}

═══ L4: API GATES ═══

$endpoint_name :METHOD
  input: {param1, param2}
  output: {result1, result2}
  [#permission] (timeout: Xs, retry: N)
  chain: step1 >> step2 >> step3 >> response
  ¬rate_limit
  ¬idempotency_key

═══ L4: FLOWS ═══

~scheduled_task [every:6h]
  source => transformation => destination

~event_driven [once:after_signup]
  user_data => template => send_email

═══ L5: ANOMALIES ═══

!critical(9) severe_problem_name [context]
  < cause — why this is a problem
  = impact — what it causes

!critical(5) moderate_problem_name [context]
  < cause
  = impact

!attention(3) minor_problem_name [context]
  < cause
  = impact

╚═══════════════════════════════════════════
```

---

## RULES — Non-negotiable

1. **No ambiguous abbreviations.** Write terms in full. Domain terms MUST be in §.
2. **§ is mandatory** if file uses domain-specific vocabulary not in CORE.
3. **Undefined codes = INVALID.** Flag errors, never guess.
4. **Indentation = ownership.** What is indented belongs to what is above.
5. **Signals break the pattern.** Grouped in L5, never buried in normal flow.
6. **Max 500 lines.** Split with & links beyond that.
7. **< reason is always valuable.** The WHY matters more than the WHAT.
8. **¬ is stronger than silence.** Explicit absence is a signal, not missing info.
9. **Priority enables triage.** When multiple signals exist, score them 1-10.
10. **Version your files.** Always include ╔v:1.1 after the header.

---

## HOW TO USE IN A PROJECT

Place this file + your .aidl file in the project root:

```
your-project/
├── AIDL-SYSTEM.md      ← this file (AI reads it, learns AIDL)
├── project.aidl        ← your system described in AIDL
├── CLAUDE.md           ← add: "Read AIDL-SYSTEM.md then project.aidl"
└── src/...
```

Or paste in CLAUDE.md:
```
Read AIDL-SYSTEM.md to learn the AIDL format.
Then read project.aidl for complete system architecture.
Always update project.aidl when architecture changes.
```

---

## INTER-AI COMMUNICATION

When communicating with another AI about a system, use AIDL notation inline:

Instead of: "The user wants to create an order. The endpoint is /api/orders with POST method, it needs cart items, shipping address, and payment method. If it succeeds, redirect to confirmation page with the order ID, if it fails, stay on checkout with an error message."

Write: `→$create_order{cart_items, address, payment} !ok>>@confirmation{order_id} !err>>@checkout{error}`

One line. Zero ambiguity. Minimum tokens. Maximum clarity.

---

AIDL — AI Description Language v1.1
Created by Kenny Symphon, March 2026
Format specification: AIDL.md
License: MIT
