# converter

A mod for [Claude Code](https://claude.com/claude-code): it converts PDF, Word, Excel and PowerPoint files to Markdown with [markitdown](https://github.com/microsoft/markitdown) before Claude reads them.

Reading the Markdown instead of the original spends fewer tokens and is easier to understand.

## How it works

- When Claude is about to read a `.pdf`, `.docx`, `.xlsx`, `.xls` or `.pptx`, the mod converts it and hands over the Markdown in its place.
- The conversion is saved next to the original, as `report.pdf.md`, and is reused as long as the original does not change.
- If the conversion fails, or finds no text (a scanned PDF), Claude reads the original. It is not retried until the file changes.
- Claude gets a note that it is reading a conversion, without the original's images or layout.

## Commands

| Command | What it does |
| --- | --- |
| `/converter` | The mod's status and how many documents it converted, reused or could not convert in the session. |
| `/converter off` | Pauses it: documents are read in their original format. |
| `/converter on` | Resumes it. |

## Requirements

- Python with the `py` launcher, the one Python installs on Windows.
- The `markitdown` package:

```bash
py -m pip install "markitdown[all]"
```

## Installation

At the prompt of a terminal session:

```
/plugin install converter --marketplace zrdqns/claude-code-converter
```

Answer `y` to add the marketplace and choose the scope (the user scope loads it in every session, including the desktop app's).

To try it from a local copy, without installing it:

```bash
claude --plugin-dir ./claude-code-converter
```

## Development

```bash
claude plugin validate .
claude plugin test .
```

The module is in [`hooks/register.ts`](hooks/register.ts), its state contract in [`types/index.d.ts`](types/index.d.ts) and the tests in [`tests/`](tests).

## License

[MIT](LICENSE)
