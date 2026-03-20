Read `AIDL-SYSTEM.aidl` to learn the AIDL format, then read `project.aidl` for the system architecture.

## AIDL Auto-sync

After modifying architecture (routes, APIs, stores, permissions):
1. Update `project.aidl` to reflect the change
2. Update `╔verified` date to today
3. If a `[&path]` anchor points to a renamed/deleted file, fix it or flag it
4. If new routes/APIs/stores are added, add them to the map

Never remove `!` anomalies, `¬` absences, or `<` reasons written by humans — only the human author can clear them. AI maintains the structure, humans maintain the intent.

If the user asks "is the map up to date?", compare each `[&path]` anchor against the actual codebase and report discrepancies.
