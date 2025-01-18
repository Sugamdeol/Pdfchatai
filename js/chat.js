class ChatUI {
  constructor(geminiAPI, pdfHandler) {
    this.geminiAPI = geminiAPI;
    this.pdfHandler = pdfHandler;
    this.messagesContainer = document.getElementById('chatMessages');
    this.userInput = document.getElementById('userInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.newChatBtn = document.getElementById('newChatBtn');
    this.pdfUpload = document.getElementById('pdfUpload');
    this.pdfList = document.getElementById('pdfList');

    // Initialize markdown renderer
    this.md = window.markdownit({
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(str, { language: lang }).value;
          } catch (__) {}
        }
        return ''; // use external default escaping
      }
    });

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    this.newChatBtn.addEventListener('click', () => this.startNewChat());
    this.pdfUpload.addEventListener('change', (e) => this.handlePDFUpload(e));
  }

  async sendMessage() {
    const message = this.userInput.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    this.userInput.value = '';

    try {
      const pdfs = this.pdfHandler.getAllPDFs();
      if (pdfs.length === 0) {
        this.addMessage('Please upload at least one PDF file first.', 'bot');
        return;
      }

      const response = await this.geminiAPI.generateResponse(message, pdfs);
      this.addMessage(response, 'bot');
    } catch (error) {
      console.error('Error:', error);
      this.addMessage('Sorry, there was an error generating the response.', 'bot');
    }
  }

  addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    if (sender === 'bot') {
      // Render markdown for bot messages
      const renderedHtml = this.md.render(text);
      messageDiv.innerHTML = renderedHtml;

      // Add click handlers for citations
      const citations = messageDiv.querySelectorAll('code');
      citations.forEach(citation => {
        if (citation.textContent.startsWith('[PDF:')) {
          citation.classList.add('citation');
          citation.addEventListener('click', () => {
            const match = citation.textContent.match(/\[PDF: (.*?), page (\d+)\]/);
            if (match) {
              const [_, filename, page] = match;
              this.highlightPDFSource(filename, parseInt(page));
            }
          });
        }
      });
    } else {
      messageDiv.textContent = text;
    }

    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

    // Syntax highlight any code blocks
    messageDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });
  }

  highlightPDFSource(filename, page) {
    // Implementation will depend on your PDF viewer component
    // For now, just show an alert
    alert(`Referenced content can be found in ${filename} on page ${page}`);

    // TODO: Implement actual PDF highlighting
    // Could open a modal with the PDF viewer focused on that page
    // Or highlight the relevant PDF in the sidebar
  }

  async handlePDFUpload(event) {
    const files = event.target.files;
    for (const file of files) {
      try {
        const filename = await this.pdfHandler.readPDF(file);
        this.addPDFToList(filename);
      } catch (error) {
        console.error('Error uploading PDF:', error);
      }
    }
    event.target.value = '';
  }

  addPDFToList(filename) {
    const pdfItem = document.createElement('div');
    pdfItem.className = 'pdf-item';
    pdfItem.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      ${filename}
    `;
    this.pdfList.appendChild(pdfItem);
  }

  startNewChat() {
    this.geminiAPI.clearHistory();
    this.messagesContainer.innerHTML = '';
    this.addMessage('Start a new conversation about your PDFs!', 'bot');
  }
}