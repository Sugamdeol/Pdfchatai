class PDFHandler {
  constructor() {
    this.pdfs = new Map();
  }

  async readPDF(file) {
    try {
      // Store the original file instead of extracting text
      this.pdfs.set(file.name, {
        file: file
      });

      return file.name;
    } catch (error) {
      console.error('Error reading PDF:', error);
      throw error;
    }
  }

  getAllPDFs() {
    return Array.from(this.pdfs.values());
  }

  clearPDFs() {
    this.pdfs.clear();
  }
}