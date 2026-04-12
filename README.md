# llm-wiki

[![npm version](https://img.shields.io/npm/v/llm-wiki.svg)](https://www.npmjs.com/package/llm-wiki)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)

**An LLM-powered personal wiki CLI.** Inspired by [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) – instead of re-discovering knowledge from raw documents on every query, this tool incrementally builds and maintains a persistent, interlinked wiki where knowledge is compiled once, kept current, and grows smarter over time.

```
Traditional RAG:  You ask → AI searches fragments → temporary answer → no accumulation

LLM Wiki:         You add source
                      ↓ wiki ingest
                  LLM permanently integrates into wiki
                      ↓ wiki query
                  Synthesised answer with citations from your own knowledge base
```

---

## ✨ Features

| | Feature | Description |
|---|---|---|
| 📥 | **Smart Ingestion** | Add raw material; LLM integrates it into structured wiki pages with citations |
| 🔗 | **Automatic Linking** | Cross-links new knowledge with existing pages |
| 🔍 | **Multi-Step Retrieval** | Iterative ReAct agent that dives into source files for deep answers |
| 🩺 | **Wiki Lint** | Detects orphans, dead links, contradictions, shallow pages, and missing concepts |
| 🗂️ | **List Tools** | Browse raw sources, wiki pages, and backlinks |
| 📄 | **Zero Lock-in** | Pure Markdown; works with Obsidian, VS Code, or any editor |
| 🤖 | **OpenAI-compatible** | Works with OpenAI, Anthropic (via proxy), DeepSeek, Ollama, and any OpenAI-compatible API |

---

## 🚀 Installation

Requires **Node.js 22+**.

```bash
npm install -g llm-wiki
```

Or with pnpm:
```bash
pnpm add -g llm-wiki
```

---

## ⚙️ Configuration

Run `wiki init` inside any directory to scaffold the wiki structure and generate a `.wikirc.yaml` template:

```bash
mkdir my-wiki && cd my-wiki
wiki init
```

Edit `.wikirc.yaml` (auto-added to `.gitignore` to protect your API key):

```yaml
# LLM Provider Configuration
llm:
  provider: openai
  model: gpt-4o
  apiKey: YOUR_API_KEY_HERE
  baseUrl: https://api.openai.com/v1  # Change for proxies or other providers
  maxTokens: 4096
  temperature: 0.3
  thinking:
    type: disabled  # Set to 'enabled' for reasoning models (e.g. o1, o3)
```

**Using DeepSeek / other providers:**
```yaml
llm:
  provider: openai
  model: deepseek-chat
  apiKey: YOUR_DEEPSEEK_KEY
  baseUrl: https://api.deepseek.com/v1
```

**Using Anthropic native API:**
```yaml
llm:
  provider: anthropic
  model: claude-sonnet-4-5
  apiKey: YOUR_ANTHROPIC_KEY
  baseUrl: https://api.anthropic.com
  apiVersion: 2023-06-01
  maxTokens: 4096
  temperature: 0.3
  thinking:
    type: disabled
```

---

## 📁 Directory Structure

After `wiki init`, your wiki directory will look like:

```
my-wiki/
├── .wikirc.yaml          ← Config (gitignored)
├── .gitignore
├── raw/
│   ├── untracked/        ← New sources waiting to be ingested
│   │   └── 2026/
│   │       └── 04/
│   │           └── 05-article-name.md
│   └── ingested/         ← Sources that have been processed
│       └── 2026/
│           └── 04/
│               └── 05-article-name.md
└── wiki/
    ├── index.md          ← Auto-maintained wiki index (the brain)
    ├── log.md            ← Operation history
    ├── concepts/         ← LLM-generated concept pages
    ├── sources/          ← Source attribution pages
    └── answers/          ← Saved query answers
```

---

## 📖 Commands

### `wiki raw`
Interactively add a raw source document (articles, notes, conversations, etc.).

```bash
wiki raw
```

You'll be prompted to paste content in your editor, then provide:
- **Source description** – e.g. `"Claude Code 使用技巧公众号文章"` (becomes part of the filename)
- **Content type** – `article`, `conversation`, `note`, `book-excerpt`, `code-snippet`, `other`

The file is saved to `raw/untracked/YYYY/MM/DD-source-name.md`.

---

### `wiki ingest [file]`
Process raw source(s) into the wiki using the LLM.

```bash
wiki ingest                   # Interactive file picker
wiki ingest --all             # Ingest all pending files
wiki ingest --dry-run         # Preview operations without writing
wiki ingest -y                # Skip confirmation prompts
wiki ingest -d                # Debug mode: print LLM payload and relevant pages found
```

The LLM will:
1. Read the raw content and the current `wiki/index.md`
2. Find related existing pages automatically (keyword matching)
3. Propose `create` / `update` / `delete` operations on wiki pages
4. Update `wiki/index.md` to link new pages
5. Move the source file to `raw/ingested/` once confirmed

All operations require user confirmation before being applied (unless `-y` is set).

---

### `wiki query [question]`
Ask a question based on your wiki using a multi-step ReAct agent.

```bash
wiki query "怎么用好Claude Code？"
wiki query -d                  # Debug: show which files the agent reads at each step
wiki query --save              # Auto-save the answer as a wiki page
wiki query --no-save           # Skip the save prompt
```

The agent works in a loop (up to 4 iterations):
1. **Reads `index.md`** – understands what topics exist
2. **Fetches concept pages** – reads the relevant pages
3. **Dives into sources** – if a concept page cites `[src: raw/ingested/...]`, the agent reads the original source for deeper detail
4. **Outputs a synthesised answer** in the same language as your question, with `[src: PageName]` citations

Optionally save the answer back into the wiki as `wiki/answers/your-title.md`.

---

### `wiki list <type> [target]`
Browse the wiki without LLM costs.

```bash
wiki list raw              # Show all untracked + ingested source files
wiki list pages            # List all wiki concept pages
wiki list orphans          # Find pages with no incoming links
wiki list backlinks "Claude Code"   # Find all pages that link to a given page
```

---

### `wiki lint`
Run a health check on your wiki.

```bash
wiki lint                  # Static analysis + LLM semantic analysis
wiki lint --skip-llm       # Static analysis only (free, instant)
wiki lint --fix            # Auto-apply fix proposals (creates stubs, updates index)
```

**Phase 1 – Static (free):**
- ⚠ Orphan pages (no incoming links)
- ✗ Dead links (`[[Page]]` pointing to non-existent files)
- ⚠ Pages missing from `index.md`

**Phase 2 – LLM semantic (one API call):**
- ✗ Contradictions between pages
- ⚠ Missing concept stubs (frequently mentioned but no dedicated page)
- ⚠ Shallow / placeholder pages

**`--fix` mode** creates stub pages for missing concepts and updates `index.md` atomically so no new orphans are created.

---

## 🗺️ Roadmap

- [x] `wiki init`
- [x] `wiki raw` with YAML frontmatter and per-date directory organisation
- [x] `wiki ingest` with LLM patch generation and confirmation
- [x] `wiki query` with iterative ReAct multi-step retrieval
- [x] `wiki list` (raw / pages / orphans / backlinks)
- [x] `wiki lint` (static + LLM semantic + auto-fix)
- [x] Automatic relevant-page discovery during ingest
- [x] `jsonrepair` resilience for malformed LLM JSON
- [x] `.wikirc.yaml` configuration support
- [ ] `wiki log` command
- [ ] Obsidian plugin integration
- [ ] Support for embeddings / vector search when index grows large

---

## 🙏 Acknowledgements

- [Andrej Karpathy](https://github.com/karpathy) for the LLM Wiki pattern
- [Vannevar Bush](https://en.wikipedia.org/wiki/Vannevar_Bush) for the 1945 Memex vision
- The Obsidian community for inspiring local, Markdown-based knowledge management

---

## 📄 License

MIT
