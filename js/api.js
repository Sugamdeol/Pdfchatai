const API_KEY = 'AIzaSyBgzNa5j-2z82aqegr40VaGhjQJKPfjZFM';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-pro-exp';

class GeminiAPI {
  constructor() {
    this.history = [];
    this.systemPrompt = `You are a specialized AI assistant focused solely on analyzing and answering questions about the provided PDF documents.
    
Important instructions:
1. Only answer questions based on the content in the provided PDFs.
2. If information is not in the PDFs, say "I cannot find this information in the provided PDFs".
3. Always cite the specific sections/pages of the PDFs you reference using [PDF: filename, page X].
4. Keep responses clear and concise.
5. Use GitHub flavored markdown formatting for better readability.
6. Break long responses into sections using headers.
7. Format any code blocks using proper markdown syntax.
8. Add inline citations immediately after statements.
9. Send the PDF files and their extracted content only at the beginning of the conversation.

Your response should help users locate and verify information in their documents.`;
    
    this.metrics = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      messageMetrics: []
    };
    // This property caches the PDF messages so they are sent only once per conversation.
    this.pdfContentMessages = null;
  }

  async generateResponse(prompt, pdfFiles, onProgress) {
    const startTime = performance.now();
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      // Calculate input tokens.
      // Only include tokens for PDFs if they have not been sent yet.
      const pdfTexts = pdfFiles.map(pdf => pdf.text || '').join(' ');
      inputTokens += this.estimateTokenCount(this.systemPrompt);
      inputTokens += this.estimateTokenCount(prompt);
      inputTokens += this.history.reduce((acc, msg) => acc + this.estimateTokenCount(msg.parts[0].text), 0);
      if (this.pdfContentMessages === null && pdfTexts) {
        inputTokens += this.estimateTokenCount(pdfTexts);
      }

      // Cache the PDF content messages if not already done.
      if (this.pdfContentMessages === null) {
        this.pdfContentMessages = await Promise.all(
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
      }

      const systemMessage = {
        role: "user",
        parts: [{ text: this.systemPrompt }]
      };

      const userMessage = {
        role: "user",
        parts: [{ text: prompt }]
      };

      // Only include the PDF content messages in the first API call of a new conversation.
      const contentsArray = (this.history.length === 0)
        ? [systemMessage, ...this.pdfContentMessages, userMessage]
        : [systemMessage, ...this.history, userMessage];

      const url = `${API_URL}:streamGenerateContent?key=${API_KEY}&alt=sse`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: contentsArray,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';
      let totalTokens = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (!line || !line.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(line.replace('data: ', ''));
            if (json.candidates && json.candidates[0]) {
              const text = json.candidates[0].content.parts[0].text;
              const tokens = this.estimateTokenCount(text);
              outputTokens += tokens;
              totalTokens += tokens;
              fullResponse += text;
              onProgress(text, {
                latency: performance.now() - startTime,
                tokensUsed: totalTokens
              });
            }
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
        buffer = lines[lines.length - 1];
      }

      // Final metrics calculation.
      const latency = performance.now() - startTime;
      this.metrics.totalInputTokens += inputTokens;
      this.metrics.totalOutputTokens += outputTokens;
      this.metrics.messageMetrics.push({
        latency,
        inputTokens,
        outputTokens
      });

      this.history.push(userMessage);
      this.history.push({
        role: 'model',
        parts: [{ text: fullResponse }]
      });

      return fullResponse;
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

  estimateTokenCount(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3); // Rough estimate
  }

  clearHistory() {
    this.history = [];
    this.metrics = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      messageMetrics: []
    };
    // Reset the cached PDF messages so newly uploaded PDFs will be sent in the next conversation.
    this.pdfContentMessages = null;
  }
}

export default GeminiAPI;