# AIDL Install Kit

Copy these 3 files into any project root to make AI understand your system instantly.

## Files

| File | Purpose |
|------|---------|
| `AIDL-SYSTEM.aidl` | AI learns AIDL by reading AIDL (do not modify) |
| `CLAUDE.md` | Tells AI to read AIDL files first |
| `project.aidl` | Your project described in AIDL (replace template) |

## Setup

```bash
cp AIDL-SYSTEM.aidl  your-project/
cp CLAUDE.md         your-project/
cp project.aidl      your-project/
```

Then ask your AI: "Analyze my codebase and generate the real project.aidl."

## Works with

- Claude (Anthropic) — via CLAUDE.md
- GPT-4 / ChatGPT — paste AIDL-SYSTEM.aidl in system prompt
- Any LLM — include AIDL-SYSTEM.aidl in context

---
AIDL (AI Description Language) created by Kenny Symphon, 2026
