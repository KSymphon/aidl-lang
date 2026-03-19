# Contributing to AIDL

AIDL is an open language. Contributions are welcome.

## How to contribute

### Reporting issues
- Found a case where AIDL doesn't capture something important? Open an issue.
- Parser bug? Open an issue with the `.aidl` file that triggers it.

### Adding examples
The best way to help AIDL grow is to translate real-world applications into `.aidl` and share them:
1. Fork the repo
2. Add your `.aidl` file to `examples/`
3. Include a brief description of the app and what stack it uses
4. Submit a PR

### Proposing new symbols
A new symbol can be added to AIDL **only if**:
- It brings meaning that **no existing symbol** can express
- It respects the **density principle** (maximum meaning per token)
- It creates **zero ambiguity** with existing symbols
- It works across **all file types** (app, product, flow, guide, data, audit)

To propose: open an issue titled `[Symbol proposal] <symbol> = <meaning>` with 3 real examples.

### Improving the parser
The parser is in `parser/src/`. TypeScript, built with tsx.
- Validation rules → `validator.ts`
- Pattern detection → `parser.ts`
- Output formatting → `formatter.ts`
- All PRs must include test `.aidl` files

## Rules
- **Terms are always in clear language.** No cryptic abbreviations.
- **A symbol can never be removed.** It can be deprecated with `~symbol~`.
- **AIDL is language-agnostic.** The symbols are universal; terms can be in any human language.
- **`AIDL.md` is the source of truth.** Changes must be reflected there first.

## Code of conduct
Be constructive. AIDL was born from a real need — someone working with AI every day who felt something was missing. Contributions that improve the language for real-world use are prioritized.

## Creator

AIDL was created by Kenny Symphon in March 2026.
