const API_KEY = 'AIzaSyBgzNa5j-2z82aqegr40VaGhjQJKPfjZFM';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

class GeminiAPI {
  constructor() {
    this.history = [];
    this.systemPrompt = `You are a specialized AI assistant focused solely on analyzing and answering questions about the provided PDF documents.
    
    Important instructions:
    1. Only answer questions based on the content in the provided PDFs
    2. If information is not in the PDFs, say "I cannot find this information in the provided PDFs"
    3. Always cite the specific sections/pages of the PDFs you reference using [PDF: filename, page X]
    4. Keep responses clear and concise
    5. Use markdown formatting for better readability
    6. Break long responses into sections using headers
    7. Format any code blocks using proper markdown syntax
    8. Add inline citations immediately after statements
    
    Your response should help users locate and verify information in their documents.`;
  }

  async generateResponse(prompt, pdfFiles) {
    try {
      // Convert PDFs to base64
      const pdfContents = await Promise.all(
        pdfFiles.map(async (pdf) => {
          const base64 = await this.fileToBase64(pdf.file);
          return {
            role: "user",
            parts: [{
              inline_data: {
                mime_type: "application/pdf",
                data: base64
              }
            }]
          };
        })
      );

      // Add system prompt
      const systemMessage = {
        role: "user",
        parts: [{
          text: this.systemPrompt
        }]
      };

      // Add the user's question with context
      const userMessage = {
        role: "user",
        parts: [{
          text: prompt
        }]
      };

      const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            systemMessage,
            ...this.history,
            ...pdfContents,
            userMessage
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 2048,
          },
        }),
      });

      const data = await response.json();
      
      if (data.candidates && data.candidates[0]) {
        const reply = data.candidates[0].content;
        this.history.push(userMessage);
        this.history.push({
          role: 'model',
          parts: [{ text: reply.parts[0].text }]
        });
        return reply.parts[0].text;
      }
      
      throw new Error('No response generated');
    } catch (error) {
      console.error('Error generating response:', error);
      throw error;
    }
  }

  async fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result
          .replace('data:', '')
          .replace(/^.+,/, '');
        resolve(base64String);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  clearHistory() {
    this.history = [];
  }
}