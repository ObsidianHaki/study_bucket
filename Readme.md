# Smart Desktop Organizer

An AI-powered Python application that logically organizes files into structured folders with clean filenames.

## Recommended LLM APIs

### Free / Free Tier

| API | Free Tier | Python SDK | Best For |
|---|---|---|---|
| **Google Gemini** | 15 RPM free | `google-generativeai` | Great free tier, multimodal |
| **Groq** | Free tier (fast inference) | `groq` | Speed, runs Llama/Mixtral |
| **Ollama** | Fully free (local) | `ollama` | Privacy, no API key needed |
| **HuggingFace** | Free inference API | `huggingface_hub` | Open-source models |

### Paid (Best Quality)

| API | Pricing | Python SDK | Best For |
|---|---|---|---|
| **Anthropic (Claude)** | Pay per token | `anthropic` | Reasoning, long context |
| **OpenAI (GPT-4)** | Pay per token | `openai` | General purpose, ecosystem |
| **Mistral** | Pay per token | `mistral` | European alternative, fast |

## Python Libraries

| Purpose | Library |
|---|---|
| CLI interface | `argparse` or `click` |
| GUI (optional) | `tkinter` or `customtkinter` |
| File metadata | `os`, `pathlib`, `shutil` |
| Date extraction | `datetime`, `exifread` (for photos) |
| Duplicate detection | `hashlib` |
| File watching | `watchdog` |
| Config | `json` or `yaml` |

## Project Structure

```
file-organizer/
├── main.py              # Entry point
├── organizer.py         # Core logic (scan, categorize, move)
├── renamer.py           # Filename cleaning logic
├── duplicates.py        # Hash-based duplicate finder
├── config.json          # User rules & folder mappings
└── move_log.json        # Undo log
```

## Features

- **Organize by file type** — Group files into `Documents/`, `Images/`, `Videos/`, `Code/`, `Archives/`
- **Smart renaming** — Clean up messy filenames automatically
- **AI categorization** — Use an LLM to categorize files by content/name
- **Date-based sub-folders** — Organize by creation/modification date
- **Duplicate detection** — Find duplicates using hash comparison
- **Dry-run mode** — Preview changes before applying
- **Undo support** — Log every move for reversal
- **Watch mode** — Continuously monitor and auto-organize new files
