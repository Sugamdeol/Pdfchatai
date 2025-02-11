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

    // Initialize markdown renderer with GitHub flavored markdown.
    this.md = window.markdownit({
      html: true,
      linkify: true,
      typographer: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' + 
                   hljs.highlight(str, { language: lang }).value + 
                   '</code></pre>';
          } catch (__) {}
        }
        // Use external default escaping
        return '<pre class="hljs"><code>' + this.md.utils.escapeHtml(str) + '</code></pre>';
      }
    });

    // Add metrics display
    this.metricsContainer = document.createElement('div');
    this.metricsContainer.className = 'metrics-container';
    this.messagesContainer.parentNode.insertBefore(this.metricsContainer, this.messagesContainer);

    this.currentChatId = null;
    this.chats = {};
    this.loadChatsFromStorage();
    this.setupPDFPreview();

    this.setupEventListeners();
    // Add delete chat button to chat list items
    this.updateChatList();
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

    // Store user message
    this.addMessage(message, 'user');
    this.userInput.value = '';
    this.sendBtn.disabled = true;

    try {
      const pdfs = this.pdfHandler.getAllPDFs();
      if (pdfs.length === 0) {
        this.addMessage('Please upload at least one PDF file first.', 'bot');
        return;
      }

      const streamContainer = this.createStreamingMessage();
      let accumulatedText = '';

      await this.geminiAPI.generateResponse(message, pdfs, (text) => {
        accumulatedText += text;
        this.updateStreamingMessage(streamContainer, accumulatedText);
      });

      // Store both user and AI messages in chat history
      if (this.currentChatId) {
        const chat = this.chats[this.currentChatId];
        if (!chat.messages) chat.messages = [];
        // Store AI message in chat history
        chat.messages.push({ text: accumulatedText, sender: 'bot' });
        this.saveChatsToStorage();
      }

      // Finalize streaming message display
      this.finalizeStreamingMessage(streamContainer, accumulatedText);

      // Update chat title if it's the first message
      if (this.currentChatId && this.chats[this.currentChatId].messages.length === 2) { // Changed from 1 to 2 since we now store both messages
        this.chats[this.currentChatId].title = message.slice(0, 30) + (message.length > 30 ? '...' : '');
        this.updateChatList();
      }

      const currentMetrics = this.geminiAPI.metrics.messageMetrics.slice(-1)[0];
      this.updateMetrics(currentMetrics);
    } catch (error) {
      console.error('Error:', error);
      this.addMessage('Sorry, there was an error generating the response.', 'bot');
    } finally {
      this.sendBtn.disabled = false;
    }
  }

  createStreamingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot streaming';
    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    return messageDiv;
  }

  updateStreamingMessage(container, text) {
    // Render markdown for the accumulated text
    const renderedHtml = this.md.render(text);
    container.innerHTML = renderedHtml;
    
    // Syntax highlight any code blocks
    container.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });

    // Ensure scroll follows the new content
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  finalizeStreamingMessage(container, text) {
    // Remove streaming class
    container.classList.remove('streaming');
    
    // Final render with all citations and formatting
    const renderedHtml = this.md.render(text);
    container.innerHTML = renderedHtml;

    // Add click handlers for citations
    const citations = container.querySelectorAll('code');
    citations.forEach(citation => {
      if (citation.textContent.startsWith('[PDF:')) {
        citation.classList.add('citation');
        citation.addEventListener('click', () => {
          const match = citation.textContent.match(/\[PDF: (.*?), page (\d+)\]/);
          if (match) {
            const [_, filename, page] = match;
            this.highlightPDFSource(filename, parseInt(page), '');
          }
        });
      }
    });

    // Final syntax highlighting
    container.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });

    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    if (sender === 'bot') {
      const renderedHtml = this.md.render(text);
      messageDiv.innerHTML = renderedHtml;

      const citations = messageDiv.querySelectorAll('code');
      citations.forEach(citation => {
        if (citation.textContent.startsWith('[PDF:')) {
          citation.classList.add('citation');
          citation.addEventListener('click', () => {
            const match = citation.textContent.match(/\[PDF: (.*?), page (\d+)\]/);
            if (match) {
              const [_, filename, page] = match;
              this.highlightPDFSource(filename, parseInt(page), '');
            }
          });
        }
      });
    } else {
      messageDiv.textContent = text;
    }

    this.messagesContainer.appendChild(messageDiv);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;

    messageDiv.querySelectorAll('pre code').forEach((block) => {
      hljs.highlightBlock(block);
    });

    // Store message in chat history
    if (this.currentChatId) {
      const chat = this.chats[this.currentChatId];
      chat.messages.push({ text, sender });
      this.saveChatsToStorage();
    }
  }

  setupPDFPreview() {
    this.pdfPreviewContainer = document.createElement('div');
    this.pdfPreviewContainer.className = 'pdf-preview-container';
    this.pdfPreviewContainer.innerHTML = `
      <div class="pdf-preview-header">
        <h2>PDF Preview</h2>
        <button class="close-preview-btn">×</button>
      </div>
      <div class="pdf-preview-content"></div>
    `;
    document.body.appendChild(this.pdfPreviewContainer);

    const closeBtn = this.pdfPreviewContainer.querySelector('.close-preview-btn');
    closeBtn.addEventListener('click', () => {
      this.pdfPreviewContainer.classList.remove('active');
    });
  }

  loadChatsFromStorage() {
    const chats = JSON.parse(localStorage.getItem('chats') || '{}');
    this.chats = chats;
  }

  saveChatsToStorage() {
    localStorage.setItem('chats', JSON.stringify(this.chats));
  }

  updateChatList() {
    const chatList = document.createElement('div');
    chatList.className = 'chat-list';
    chatList.innerHTML = '<h2>Recent Chats</h2>';

    Object.entries(this.chats).forEach(([chatId, chat]) => {
      const chatItem = document.createElement('div');
      chatItem.className = `chat-list-item ${chatId === this.currentChatId ? 'active' : ''}`;
      
      // Create chat title and delete button container
      const chatContent = document.createElement('div');
      chatContent.className = 'chat-item-content';
      chatContent.textContent = chat.title || 'Untitled Chat';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-chat-btn';
      deleteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      `;
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteChat(chatId);
      });

      chatItem.appendChild(chatContent);
      chatItem.appendChild(deleteBtn);
      
      chatContent.addEventListener('click', () => this.loadChat(chatId));
      chatList.appendChild(chatItem);
    });

    const existingChatList = document.querySelector('.chat-list');
    if (existingChatList) {
      existingChatList.replaceWith(chatList);
    } else {
      document.querySelector('.sidebar').insertBefore(chatList, document.querySelector('.upload-section'));
    }
  }

  deleteChat(chatId) {
    if (confirm('Are you sure you want to delete this chat?')) {
      delete this.chats[chatId];
      this.saveChatsToStorage();
      
      // If the deleted chat was the current chat, start a new one
      if (chatId === this.currentChatId) {
        this.startNewChat();
      } else {
        this.updateChatList();
      }
    }
  }

  startNewChat() {
    const chatId = Date.now().toString();
    this.chats[chatId] = {
      title: 'New Chat',
      messages: [], // Will store both user and AI messages
      pdfs: [],
      metrics: {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        messageMetrics: []
      }
    };
    this.currentChatId = chatId;
    this.saveChatsToStorage();
    this.geminiAPI.clearHistory();
    this.messagesContainer.innerHTML = '';
    this.updateChatList();
  }

  async highlightPDFSource(filename, page, text) {
    const pdf = Array.from(this.pdfHandler.pdfs.values()).find(p => p.file.name === filename);
    if (!pdf) return;

    const pdfDoc = await pdfjsLib.getDocument(await pdf.file.arrayBuffer()).promise;
    const pdfPage = await pdfDoc.getPage(page);
    
    // Calculate scale to fit width while maintaining aspect ratio
    const containerWidth = this.pdfPreviewContainer.clientWidth - 40; // Account for padding
    const viewport = pdfPage.getViewport({ scale: 1.0 });
    const scale = containerWidth / viewport.width;
    const scaledViewport = pdfPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.className = 'pdf-preview-canvas';
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    const context = canvas.getContext('2d');
    await pdfPage.render({
      canvasContext: context,
      viewport: scaledViewport
    }).promise;

    const textContent = await pdfPage.getTextContent();
    const textLayer = document.createElement('div');
    textLayer.className = 'pdf-text-layer';
    textLayer.style.width = `${scaledViewport.width}px`;
    textLayer.style.height = `${scaledViewport.height}px`;
    textLayer.style.position = 'absolute';
    textLayer.style.left = '0';
    textLayer.style.top = '0';

    const previewContent = this.pdfPreviewContainer.querySelector('.pdf-preview-content');
    previewContent.innerHTML = '';
  
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayer);
    previewContent.appendChild(wrapper);

    // Enhanced text rendering with better positioning
    pdfjsLib.renderTextLayer({
      textContent: textContent,
      container: textLayer,
      viewport: scaledViewport,
      textDivs: []
    });

    // Add zoom controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'pdf-zoom-controls';
    zoomControls.innerHTML = `
      <button class="zoom-in">+</button>
      <button class="zoom-out">-</button>
      <button class="zoom-fit">Fit</button>
    `;
    previewContent.insertBefore(zoomControls, wrapper);

    let currentScale = scale;
    zoomControls.querySelector('.zoom-in').onclick = () => {
      currentScale *= 1.2;
      updateScale();
    };
    zoomControls.querySelector('.zoom-out').onclick = () => {
      currentScale *= 0.8;
      updateScale();
    };
    zoomControls.querySelector('.zoom-fit').onclick = () => {
      currentScale = scale;
      updateScale();
    };

    const updateScale = async () => {
      const newViewport = pdfPage.getViewport({ scale: currentScale });
      canvas.width = newViewport.width;
      canvas.height = newViewport.height;
      textLayer.style.width = `${newViewport.width}px`;
      textLayer.style.height = `${newViewport.height}px`;

      await pdfPage.render({
        canvasContext: context,
        viewport: newViewport
      }).promise;

      pdfjsLib.renderTextLayer({
        textContent: textContent,
        container: textLayer,
        viewport: newViewport,
        textDivs: []
      });
    };

    // Highlight matching text with better accuracy
    const searchText = text.toLowerCase();
    let foundMatch = false;
    textContent.items.forEach((item, index) => {
      if (item.str.toLowerCase().includes(searchText)) {
        foundMatch = true;
        const textDiv = textLayer.children[index];
        if (textDiv) {
          textDiv.classList.add('highlighted-text');
          // Scroll the highlighted text into view
          textDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    });

    if (!foundMatch && text) {
      // Try fuzzy matching if exact match not found
      textContent.items.forEach((item, index) => {
        if (this.fuzzyMatch(item.str.toLowerCase(), searchText)) {
          const textDiv = textLayer.children[index];
          if (textDiv) {
            textDiv.classList.add('highlighted-text');
            textDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    }

    this.pdfPreviewContainer.classList.add('active');
  }

  fuzzyMatch(text, search) {
    const searchLen = search.length;
    const textLen = text.length;
    if (searchLen > textLen) return false;
    if (searchLen === textLen) return search === text;
  
    next_char:
    for (let i = 0, j = 0; i < searchLen; i++) {
      const searchChar = search.charCodeAt(i);
      while (j < textLen) {
        if (text.charCodeAt(j++) === searchChar) {
          continue next_char;
        }
      }
      return false;
    }
    return true;
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
      <span class="pdf-name">${filename}</span>
      <button class="delete-pdf-btn" aria-label="Delete PDF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    const deleteBtn = pdfItem.querySelector('.delete-pdf-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.pdfHandler.deletePDF(filename)) {
        pdfItem.remove();
      }
    });

    this.pdfList.appendChild(pdfItem);
  }

  updateMetrics(currentMetrics) {
    const totalSeconds = (currentMetrics.latency / 1000).toFixed(1);
    this.metricsContainer.innerHTML = `
      <div class="metrics">
        <div class="metric-group">
          <span class="metric-label">Response Time:</span>
          <span class="metric-value">${totalSeconds}s</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">Input Tokens:</span>
          <span class="metric-value">${currentMetrics.inputTokens}</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">Output Tokens:</span>
          <span class="metric-value">${currentMetrics.outputTokens}</span>
        </div>
        <div class="metric-group">
          <span class="metric-label">Total Tokens:</span>
          <span class="metric-value">${this.geminiAPI.metrics.totalInputTokens + this.geminiAPI.metrics.totalOutputTokens}</span>
        </div>
      </div>
    `;

    if (this.currentChatId) {
      const chat = this.chats[this.currentChatId];
      chat.metrics = this.geminiAPI.metrics;
      this.saveChatsToStorage();
    }
  }

  loadChat(chatId) {
    this.currentChatId = chatId;
    this.geminiAPI.clearHistory();
    this.messagesContainer.innerHTML = '';
    
    const chat = this.chats[chatId];
    if (chat.messages) {
      chat.messages.forEach(msg => {
        this.addMessage(msg.text, msg.sender);
        // Also update the API's history to maintain conversation context
        this.geminiAPI.history.push({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });
    }
    
    if (chat.metrics) {
      this.updateMetrics(chat.metrics.messageMetrics[chat.metrics.messageMetrics.length - 1] || {});
    }
    this.updateChatList();
  }

}

export default ChatUI;