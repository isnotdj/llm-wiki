# llm-wiki

> **🚧 PLACEHOLDER – NOT YET FUNCTIONAL 🚧**
>
> This is a **pre‑release placeholder**. There is **no working version yet**. The package is not installable or usable at this time.  
> This document describes the **planned** design and vision.  
> Please check back later for an actual release.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)

**An LLM‑powered personal wiki builder – planned CLI tool.**  
(No code has been published yet. This is just a placeholder.)

## ✨ Inspiration

This project is directly inspired by Andrej Karpathy's **"LLM Wiki"** pattern. In his [original gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f), he describes a fundamentally different approach to knowledge management compared to typical RAG:

> *Most RAG systems re‑discover knowledge from raw documents on every query. An LLM Wiki, instead, incrementally builds and maintains a persistent, interlinked wiki – knowledge is compiled once and then kept current, never re‑derived.*

This **planned** CLI tool intends to implement that vision. For now, only the idea exists – no working software.

## 🧠 Core Idea (as designed)

**Traditional RAG:** You ask → AI searches for fragments each time → temporary answer → no accumulation  
**LLM Wiki:** You add source → AI reads and **permanently integrates into the wiki** → wiki grows → next query gets a synthesised answer directly

In short: **let the LLM do all the boring work (summarising, cross‑referencing, maintaining consistency) while you do what matters most (curating sources, asking questions, thinking).**

## 🎯 Planned Features

- **📥 Smart Ingestion** – Add raw material; LLM automatically integrates it.
- **🔗 Automatic Linking** – Cross‑link new knowledge with existing pages.
- **📝 Versioned Wiki** – Plain Markdown, ready for Git.
- **💬 Contextual Query** – Ask questions based on the compiled wiki; save answers as new pages.
- **🔍 Health Check (Lint)** – Find contradictions, orphans, missing concepts.
- **🤖 Multiple LLM Support** – OpenAI, Anthropic, local Ollama.
- **📊 Zero lock‑in** – Just Markdown; use any editor.

## 🚀 (Future) Quick Start – Not Yet Available

```bash
# This does NOT work yet – placeholder only
npm install -g llm-wiki
wiki init
```

Do not attempt to install or run. The package is not published in a functional state.

## 📖 Command Overview (Planned)

| Command | Description |
|---------|-------------|
| `wiki init` | Initialise a wiki repository |
| `wiki raw` | Add a raw source (interactive) |
| `wiki ingest [file]` | Ingest raw source(s) into the wiki |
| `wiki query [question]` | Ask a question based on the wiki |
| `wiki lint` | Run health checks on the wiki |
| `wiki list raw|pages|orphans` | List items |
| `wiki log [n]` | Show operation log |

## ⚙️ Planned Configuration Example

`.wikirc.json` (future):

```json
{
  "wikiRoot": ".",
  "llm": {
    "provider": "openai",
    "model": "gpt-4-turbo",
    "apiKey": "sk-..."
  },
  "ingest": {
    "reviewChanges": true,
    "autoCommit": false
  }
}
```

## 🗺️ Project Status

- **Current status:** Placeholder / design phase. No working code.
- **Next steps:** Implementation will begin after the design is finalised.
- **Roadmap (future):**
  - [ ] Project scaffolding & basic CLI
  - [ ] `raw` command
  - [ ] `ingest` core functionality (LLM integration)
  - [ ] `query` command
  - [ ] `lint` command
  - [ ] Support for multiple LLM providers
  - [ ] Git auto‑commit
  - [ ] Obsidian plugin version

## 🤝 Contributing

**Not yet open for contributions** – the project does not exist in a runnable form yet. Once a minimal prototype is ready, a contribution guide will be added.

## 📄 License

MIT © [Your Name]

## 🙏 Acknowledgements

- [Andrej Karpathy](https://github.com/karpathy) for the LLM Wiki pattern
- [Vannevar Bush](https://en.wikipedia.org/wiki/Vannevar_Bush) for the 1945 Memex vision
- The Obsidian community for inspiring local, Markdown‑based knowledge management

---

**This is a placeholder for a planned tool. Nothing works yet. Please do not install.**  
If you are interested in the concept, read Karpathy's original gist and watch this space.