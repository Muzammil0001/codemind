# CodeMind AI

> Next-generation AI coding agent for VS Code with deep codebase intelligence, multi-agent architecture, and advanced safety controls

[![VS Code](https://img.shields.io/badge/VS%20Code-Extension-blue)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 🚀 Features

### 🤖 **Free AI Models Only**
- **Groq** (LLaMA 3.1 70B, Mixtral) - Ultra-fast inference
- **DeepSeek** - Code-specialized models
- **Google Gemini** Flash 2.0 - Massive context windows
- **OpenAI** GPT-4o Mini - Free tier
- **Claude** Haiku - Free tier
- **Local LLMs** - Ollama & LM Studio support

### 🧠 **Deep Codebase Intelligence**
- AST parsing for 40+ languages
- Dependency graph analysis
- Framework detection (React, Next.js, Vue, etc.)
- Database schema understanding
- Coding style learning
- Real-time codebase mapping

### 🛡️ **Advanced Safety System**
- **Always asks permission** for destructive actions
- 4-option approval system:
  - ✓ Allow Once
  - ✓✓ Always Allow
  - ? Always Ask
  - ✗ Deny
- Permission memory (revocable anytime)
- Risk level classification
- Automatic safety checks

### ⚡ **Ultra-Fast Performance**
- Parallel task execution
- Streaming AI responses
- Preloaded embeddings
- Intelligent caching
- Turbo Mode for rapid generation

### 🎨 **Customizable UI**
- Modern React-based panel
- Dark/Light/Custom themes
- Draggable layout
- Real-time metrics
- Agent activity logs

### 🤝 **Multi-Agent Architecture**
- **Planner Agent** - Creates execution plans
- **Coder Agent** - Writes and edits code
- **Reviewer Agent** - Reviews for quality & security
- **Test Agent** - Generates tests
- **Documentation Agent** - Creates docs
- **Image-to-Code Agent** - Converts UI to code

### 💡 **Real-Time Suggestions**
- Smart autocompletions
- Context-aware refactoring
- Security warnings
- Performance advice
- Import suggestions
- Bug explanations

## 📦 Installation

### From VS Code Marketplace
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "CodeMind AI"
4. Click Install

### From Source
```bash
git clone https://github.com/yourusername/codemind-ai.git
cd codemind-ai
npm install
npm run build
```

Then press F5 to launch the extension in development mode.

## ⚙️ Configuration

### API Keys (Free Tier)

Get free API keys from:
- **Groq**: https://console.groq.com
- **DeepSeek**: https://platform.deepseek.com
- **Gemini**: https://makersuite.google.com/app/apikey
- **OpenAI**: https://platform.openai.com (free tier)
- **Anthropic**: https://console.anthropic.com (free tier)

Configure in VS Code settings:

```json
{
  "codemind.groqApiKey": "your-groq-key",
  "codemind.deepseekApiKey": "your-deepseek-key",
  "codemind.geminiApiKey": "your-gemini-key",
  "codemind.primaryModel": "groq-llama-3.1-70b"
}
```

### Local LLMs

For offline usage with Ollama:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1

# Enable in settings
{
  "codemind.enableLocalModels": true,
  "codemind.ollamaUrl": "http://localhost:11434"
}
```

## 🎯 Usage

### Quick Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Open Panel | `Ctrl+Shift+M` / `Cmd+Shift+M` | Open CodeMind AI panel |
| Generate Code | `Ctrl+Shift+G` / `Cmd+Shift+G` | Generate code from prompt |
| Explain Code | `Ctrl+Shift+E` / `Cmd+Shift+E` | Explain selected code |
| Refactor Code | - | Refactor selected code |
| Generate Tests | - | Generate unit tests |
| Generate Docs | - | Add documentation |

### Examples

#### Generate Code
1. Press `Ctrl+Shift+G`
2. Enter: "Create a React component for a user profile card"
3. Code appears at cursor

#### Explain Code
1. Select code
2. Press `Ctrl+Shift+E`
3. Get instant explanation

#### Refactor Code
1. Select code
2. Run command: `CodeMind: Refactor Code`
3. Describe refactoring
4. Code is refactored

## 🛡️ Safety Features

### Actions Requiring Approval

- Delete file
- Rename/move file
- Overwrite large files
- Create/remove folders
- Run terminal commands
- Install dependencies
- Edit environment variables
- Database migrations
- Modify authentication
- Update framework files
- Changes > 30 lines

### Permission Levels

- **Strict** - Always ask (recommended)
- **Moderate** - Auto-approve safe actions
- **Relaxed** - Auto-approve most actions

### Managing Permissions

```
Command Palette → CodeMind: Clear Permission Memory
```

## 🚀 Performance

### Benchmarks

| Operation | Time |
|-----------|------|
| Extension activation | < 500ms |
| Codebase analysis (1000 files) | < 5s |
| AI response (first token) | < 100ms |
| Diff generation | < 50ms |
| Permission check | < 10ms |

### Turbo Mode

Enable for 2-3x faster code generation:

```json
{
  "codemind.turboMode": true
}
```

## 🎨 UI Customization

### Themes

```json
{
  "codemind.theme": "dark" // or "light", "auto", "custom"
}
```

### Layout

Drag and resize panels in the CodeMind UI.

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## 📝 License

MIT License - see [LICENSE](LICENSE)

## 🙏 Acknowledgments

- Built with free AI models from Groq, DeepSeek, Google, OpenAI, and Anthropic
- Powered by tree-sitter for AST parsing
- UI built with React and VS Code Webview API

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/codemind-ai/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/codemind-ai/discussions)
- **Docs**: [Full Documentation](https://codemind-ai.dev)

---

**Made with ❤️ for developers who want the best AI coding assistant without paying for API costs**
