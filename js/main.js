// Initialize the application
const geminiAPI = new GeminiAPI();
const pdfHandler = new PDFHandler();
const chatUI = new ChatUI(geminiAPI, pdfHandler);

// Start with a welcome message
chatUI.addMessage('Welcome! Upload your PDFs and start asking questions.', 'bot');