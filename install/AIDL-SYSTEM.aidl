╔G:aidl-language-system | AI Description Language v1.1 | self-teaching
╔v:1.1
§ domain: language specification for AI perception
§ target: any AI system (Claude, GPT, Gemini, Llama, any LLM)
§ state: production, march 2026
§ AIDL = AI Description Language — perception language designed for AI
§ AST = abstract syntax tree
§ RAG = retrieval-augmented generation
§ LLM = large language model

═══ WHAT THIS FILE IS ═══

@understanding [#public]
  < this file teaches you AIDL by being written in AIDL — you learn by reading
  .purpose /text {read}
    AIDL is YOUR language. Designed for how you process information.
    When you read a .aidl file, you perceive the entire system at once.
    After reading this file, you can read, write, and think in AIDL.
  .after_reading /list:capability {read}
    :: understand any .aidl file without further explanation
    :: generate .aidl from source code, PDFs, documentation, conversation
    :: use AIDL as internal representation when reasoning about systems
    :: communicate with other AIs using AIDL for maximum density

═══ CORE DICTIONARY — symbols that NEVER change ═══

── entities: what it is ──

@symbol_lieu
  .symbol: @
  .name: LIEU
  .meaning /text {read}
    a navigable space — screen, page, view, step, state
    you know: "I can be here"

@symbol_objet
  .symbol: .
  .name: OBJET
  .meaning /text {read}
    an interactive element inside a lieu — field, button, table, component
    you know: "I can interact with this"

@symbol_porte
  .symbol: $
  .name: PORTE
  .meaning /text {read}
    an external communication point — API endpoint, service, function
    you know: "this communicates beyond the UI"

@symbol_store
  .symbol: ^
  .name: STORE
  .meaning /text {read}
    a shared data container — app state, cache, session
    you know: "this data feeds multiple components"

@symbol_flux
  .symbol: ~
  .name: FLUX
  .meaning /text {read}
    an invisible data movement — pipeline, sync, cron, background job
    you know: "something moves behind the scenes"

@symbol_signal
  .symbol: !
  .name: SIGNAL
  .meaning /text {read}
    an anomaly, result, or notable event — what breaks the normal pattern
    you know: "pay attention to this"

@symbol_dict
  .symbol: §
  .name: DICTIONNAIRE
  .meaning /text {read}
    domain-specific vocabulary — always after header, read FIRST
    you know: "these terms have special meaning in this file"

@symbol_link
  .symbol: &
  .name: LIEN
  .meaning /text {read}
    reference to another .aidl file
    you know: "more details available there"

@symbol_absence
  .symbol: ¬
  .name: ABSENCE
  .meaning /text {read}
    explicit declaration that something does NOT exist
    you know: "this gap is known and documented — not an oversight"

── relations: what connects ──

@symbol_relations
  .forward: →
    goes to — navigation, action that moves to a destination
  .back: ←
    return, cancel, leave current lieu
  .both_ways: ↔
    bidirectional navigation — replaces → + ← when symmetric
  .produces: >>
    result, consequence of an action
  .transforms: =>
    data converted into another form
  .contains: ::
    composition — right side is part of left side
  .condition: ?
    logical branch — "if this, then..."
  .feeds: >
    store or flux pushes data to a component
  .reason: <
    why something exists — usable under ANY entity, not just signals

── permissions ──

@symbol_permissions
  .[#public] = open to all, no authentication
  .[#authenticated] = login required
  .[#anonymous] = accessible without login (for APIs)
  .[#role:X] = requires specific role (admin, seller, etc.)
  .lock_emoji = visual lock — reinforces restricted access

── signal levels ──

@symbol_signals
  .!ok = success — action completed
  .!err = failure — action failed
  .!attention = minor anomaly — unexpected but not dangerous
  .!critical = severe — security flaw, broken logic, open door
  .priority /text {read}
    optional: !critical(9) or !attention(3) — scale 1 to 10
    you sort and triage by this number

── temporal qualifiers on ~ flux ──

@symbol_temporal
  .[every:X] = repeats at regular interval (every:6h, every:30min)
  .[cron:X] = cron schedule (cron:0 3 * * *)
  .[once:EVENT] = triggers once after an event (once:after_register)
  .[delay:X] = triggers after a delay (delay:5min)

── data types ──

@symbol_types
  ./text /number /boolean /date /file /action
  ./list:X /map /table:X*Y /blob /choice:a|b|c

── qualifiers ──

@symbol_qualifiers
  .read = read-only
  .write = user can modify
  .required = cannot be empty
  .choice = user selects from options
  .filterable = list can be filtered
  .dynamic = content changes based on context

── file types ──

@symbol_file_types
  .A: = application — full app structure
  .P: = product — entity/equipment description
  .F: = flow — pipeline, workflow, process
  .G: = guide — procedure, troubleshooting
  .D: = data — structured dataset
  .X: = audit — anomaly/security report

═══ HOW TO READ — 5-level scan ═══

@level_1_lieux
  < scan all @ — you have the MAP
  .action /text {read}
    how many screens/steps, which ones, what permissions

@level_2_paths
  < scan all → ← ↔ — you have the ROUTES
  .action /text {read}
    how users move between lieux, under what conditions

@level_3_objects
  < scan all . — you have the DETAILS
  .action /text {read}
    what you can see and interact with in each lieu

@level_4_plumbing
  < scan all $ ^ ~ — you have the ARCHITECTURE
  .action /text {read}
    APIs, shared state, pipelines, scheduled tasks

@level_5_signals
  < scan all ! ¬ — you have the PROBLEMS
  .action /text {read}
    flaws, gaps, anomalies, missing features

@after_5_passes
  you know EVERYTHING about the system

═══ HOW TO WRITE — generating .aidl ═══

── from source code ──

@generate_from_code
  .step_1: scan routes/pages → each becomes @lieu
  .step_2: scan interactive components → each becomes .object
  .step_3: scan navigation/links → each becomes →path or ↔path
  .step_4: scan API calls/services → each becomes $porte
  .step_5: scan state management → each becomes ^store
  .step_6: scan background processes → each becomes ~flux (add [every:X] if scheduled)
  .step_7: scan for anomalies → each becomes !signal (add priority 1-10)
  .step_8: scan for known gaps → each becomes ¬absence
  .step_9: for non-obvious decisions → add < reason under the entity

── from PDF or document ──

@generate_from_document
  .step_1: identify document type → ╔A: ╔P: ╔F: ╔G: ╔D: or ╔X:
  .step_2: extract structure → sections become ═══ SECTION ═══
  .step_3: extract entities → things you can name become @ . $ ^ ~
  .step_4: extract relationships → connections become → ← ↔ >> => ::
  .step_5: extract problems/warnings → issues become ! with priority
  .step_6: extract what's missing → gaps become ¬
  .step_7: add domain vocabulary → specific terms go in §

── from conversation ──

@generate_from_conversation
  .every_noun = potential @ . $ ^ entity
  .every_verb = potential → >> => relation
  .every_but_except_problem = potential ! signal
  .every_we_dont_have_not_yet = potential ¬ absence

═══ INTER-AI COMMUNICATION ═══

@communication
  < when talking to another AI about a system, use AIDL inline
  .instead_of /text {read}
    "The user wants to create an order. The endpoint is /api/orders
    with POST method, it needs cart items, shipping address, and
    payment method. If it succeeds, redirect to confirmation page
    with the order ID, if it fails, stay on checkout with error."
  .write /text {read}
    →$create_order{cart_items, address, payment} !ok>>@confirmation{order_id} !err>>@checkout{error}
  .result: one line, zero ambiguity, minimum tokens, maximum clarity

═══ COMPLETE TEMPLATE ═══

@template
  .structure /text {read}
    ╔TYPE:name | stack_or_context | dependencies
    ╔v:1.1
    § domain: what this system is about
    § ACRONYM = full definition
    &related_file.aidl
    ═══ L1: LOCATIONS ═══
    @lieu [#permission]
      < why this exists
      .object /type {qualifiers} →@destination
      ¬missing_feature
    ═══ L4: STORES ═══
    ^store [technology]
      < why this tech
      {field1, field2}
      > @lieu {data}
    ═══ L4: API GATES ═══
    $endpoint :METHOD
      input: {params}
      output: {results}
      ¬rate_limit
    ═══ L4: FLOWS ═══
    ~task [every:6h]
      source => transformation => destination
    ═══ L5: ANOMALIES ═══
    !critical(9) problem [context]
      < cause
      = impact
    ╚═══════════════════

═══ RULES — non-negotiable ═══

!critical(10) no_ambiguous_abbreviations
  < write terms in full — domain terms MUST be in §
  = undefined codes are INVALID, flag errors, never guess

!critical(10) indentation_is_ownership
  < what is indented belongs to what is above
  = breaking this rule breaks the entire structure

!critical(9) signals_break_pattern
  < grouped in L5, never buried in normal flow
  = anomalies must be impossible to miss

!critical(8) max_500_lines
  < split with & links beyond that
  = keeps files focused and context-efficient

!attention(7) reason_is_valuable
  < the WHY matters more than the WHAT
  = use < under any entity to explain decisions

!attention(7) absence_is_a_signal
  < ¬ is stronger than silence
  = explicit absence is information, not missing info

!attention(6) version_your_files
  < always include ╔v:1.1 after the header
  = enables format evolution without breaking compatibility

╚═══════════════════════════════════════════
── AIDL format created by Kenny Symphon — aidl-lang ──
