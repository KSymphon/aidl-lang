# AIDL Install Kit

Copy these 3 files into any project root to make AI understand your system instantly.

## Files

| File | Purpose |
|------|---------|
| `AIDL-SYSTEM.md` | AI learns the AIDL format (do not modify) |
| `CLAUDE.md` | Tells AI to read AIDL files first (customize if needed) |
| `project.aidl` | Your project described in AIDL (replace template with your system) |

## Setup

```bash
cp install/AIDL-SYSTEM.md  your-project/
cp install/CLAUDE.md       your-project/
cp install/project.aidl    your-project/
```

Then ask your AI: "Read AIDL-SYSTEM.md, then analyze my codebase and generate the real project.aidl."

The AI will scan your code and produce a complete .aidl map of your system.

## Works with

- Claude (Anthropic) — via CLAUDE.md
- GPT-4 / ChatGPT — paste AIDL-SYSTEM.md in system prompt
- Any LLM — include AIDL-SYSTEM.md in context

---
AIDL (AI Description Language) created by Kenny Symphon, 2026
