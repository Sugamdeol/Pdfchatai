class PDFHandler {
  constructor() {
    this.pdfs = new Map();
  }

  async readPDF(file) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      
      let textContent = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textContent += content.items.map(item => item.str).join(' ');
      }

      this.pdfs.set(file.name, {
        file: file,
        text: textContent,
        uploadTime: new Date()
      });

      return file.name;
    } catch (error) {
      console.error('Error reading PDF:', error);
      throw error;
    }
  }

  deletePDF(filename) {
    if (this.pdfs.has(filename)) {
      this.pdfs.delete(filename);
      return true;
    }
    return false;
  }

  getAllPDFs() {
    return Array.from(this.pdfs.values());
  }

  clearPDFs() {
    this.pdfs.clear();
  }
}

export default PDFHandler;