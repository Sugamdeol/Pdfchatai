import GeminiAPI from './api.js';
import PDFHandler from './pdfHandler.js';
import ChatUI from './chat.js';

// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Initialize the application
const geminiAPI = new GeminiAPI();
const pdfHandler = new PDFHandler();
const chatUI = new ChatUI(geminiAPI, pdfHandler);

// Start with a welcome message
chatUI.startNewChat();