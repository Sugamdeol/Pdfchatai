# 📄 PDF Chat AI

Upload any PDF and **chat with it using AI**. Answers are grounded in your document with page-level citations, formatted in markdown with syntax highlighting.

🌐 **Live:** [pdfchatai-beta.vercel.app](https://pdfchatai-beta.vercel.app)

## ✨ Features

- 📤 Upload one or more PDFs and ask questions about them
- 💬 Conversational chat with full history
- 📑 Citations like `[PDF: filename, page X]` so you can verify answers
- 🎨 Markdown rendering + code syntax highlighting (highlight.js)
- 📊 Per-message token usage metrics
- 🔑 Bring your own Gemini API key

## 🛠️ Tech Stack

- **Vanilla JavaScript** (no framework, no build step)
- **Google Gemini API** (`gemini-2.0-pro-exp`) with inline PDF data
- **pdf.js** for text extraction · **highlight.js** for code blocks

## 🚀 Getting Started

```bash
git clone https://github.com/Sugamdeol/Pdfchatai.git
cd Pdfchatai
# serve with any static server
python -m http.server 8080
```

Open `http://localhost:8080`, paste your Gemini API key, upload a PDF, and start asking questions.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

Built with ❤️ by [Sugam Deol](https://github.com/Sugamdeol)
