╔F:content-pipeline | sequential, 5 steps with validation gates
§ domain: content publishing platform data ingestion
§ OCR = optical character recognition
§ NLP = natural language processing
§ CDN = content delivery network

═══ OVERVIEW ═══

~main_flow
  ingest => extract => normalize => enrich => publish
  [sequential: each step validates before passing to next]
  [failure at any step = full stop, no skip]

═══ STEPS ═══

@step_1_ingest
  .input /file: pdf | docx | html | markdown {source: author}
  →deposit >> staging/incoming/
  ~no transformation: raw content preserved
  !ok: file readable, format recognized, size < 50MB
  !err: empty file, unknown format, oversized

@step_2_extract
  .input {reference: @step_1_ingest, validated file}
  →extraction >> structured content
    ~pdf => text parsing or OCR (scanned documents)
    ~docx => xml extraction
    ~html => DOM parsing, boilerplate removal
    ~markdown => frontmatter + body split
  .output /map :: title, body, metadata, images
  !ok: title present, body > 100 words
  !err: extraction failed, content too short

@step_3_normalize
  .input {reference: @step_2_extract, extracted content}
  →normalization >> uniform format
    ~encoding: UTF-8
    ~images: resize to max 1200px, convert to WebP
    ~links: validate, flag broken ones
    ~categories: map to taxonomy (8 sections, 45 tags)
  →assign >> unique content_id
  !ok: no duplicates, valid category, all links working
  !err: duplicate detected, unknown category, broken links

@step_4_enrich
  .input {reference: @step_3_normalize, normalized content}
  →enrichment >> enhanced content
    ~NLP: extract keywords, generate summary (200 words)
    ~related: find 3-5 related articles by embedding similarity
    ~SEO: generate meta title, meta description, slug
    ~reading_time: calculate based on word count
  !ok: summary generated, keywords > 5, SEO fields present
  !err: NLP service unavailable, insufficient content for summary

@step_5_publish
  .input {reference: @step_4_enrich, enriched content}
  →publish >> production database
    ~database: insert article record
    ~search_index: update full-text search
    ~CDN: purge cache for affected pages
    ~notifications: alert subscribers if matching tags
  →available >> public website
  !ok: article accessible, searchable, cache purged
  !err: database insert failed, index update failed

═══ ANOMALIES ═══

!critical step_2_ocr_quality [scanned PDFs]
  < some source PDFs are scanned images, not text
  = OCR produces approximate results, extracted content may contain errors

!attention no_rollback_mechanism
  < if step 5 partially fails (db ok but CDN purge fails), no automatic rollback
  = inconsistent state possible between database and CDN cache

!attention no_update_detection
  < if source author updates original document, pipeline doesn't detect it
  = published content may become stale without alerts

╚═══════════════════════════════════════════
── AIDL format created by Kenny Symphon — aidl-lang ──
