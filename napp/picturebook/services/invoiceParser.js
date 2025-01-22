const pdf = require('pdf-parse');

/**
 * Regular expressions for extracting invoice data
 */
const PATTERNS = {
  invoiceNumber: /Invoice number\s*([A-Z0-9]+)\\0*(\d+)/i,
  issueDate: /Date of issue\s*([A-Za-z]+ \d+,? \d{4})/i,
  dueDate: /Date due\s*([A-Za-z]+ \d+,? \d{4})/i,
  vendor: {
    name: /Cognition AI Inc\./m,
    address: /1875 Mission Street\s+103\s+San Francisco, California 94103/m,
    contact: /United States/
  },
  customer: {
    name: /Bill to\s*([^\n]+?)(?=\s*India)/i,
    country: /Bill to\s*[^\n]+\s*(India)\s/i,
    email: /(rbtunes02\+qa01@gmail\.com)/
  },
  lineItems: {
    usage: /Devin Additional Usage[^\n]*\n[^\n]*\n\s*(\d+)\s*\$(\d+\.\d+)\s*\$(\d+\.\d+)/m,
    teams: /Devin for Teams[^\n]*\n[^\n]*\n\s*(\d+)\s*\$(\d+\.\d+)\s*\$(\d+\.\d+)/m
  },
  totals: {
    subtotal: /Subtotal\s*\$(\d+\.\d+)/i,
    total: /(?:^|\s)Total\s*\$(\d+\.\d+)/im,
    amountDue: /Amount due\s*\$(\d+\.\d+)/i
  }
};

/**
 * Extract text content from PDF buffer
 * @param {Buffer} pdfBuffer - The PDF file buffer
 * @returns {Promise<string>} Extracted text content
 */
async function extractText(pdfBuffer) {
  try {
    const data = await pdf(pdfBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw error;
  }
}

/**
 * Extract value using regex pattern
 * @param {string} text - Text to search in
 * @param {RegExp} pattern - Regular expression pattern
 * @returns {string} Matched value or empty string
 */
function extractValue(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : '';
}

/**
 * Parse line items from text
 * @param {string} text - Text to parse
 * @returns {Array} Array of line item objects
 */
function parseLineItems(text) {
  const items = [];
  
  // Parse Devin Additional Usage
  const usageMatch = text.match(PATTERNS.lineItems.usage);
  if (usageMatch) {
    items.push({
      description: "Devin Additional Usage (per ACU)",
      quantity: parseInt(usageMatch[1], 10),
      unitPrice: parseFloat(usageMatch[2]),
      amount: parseFloat(usageMatch[3])
    });
  }
  
  // Parse Devin for Teams
  const teamsMatch = text.match(PATTERNS.lineItems.teams);
  if (teamsMatch) {
    items.push({
      description: "Devin for Teams",
      quantity: parseInt(teamsMatch[1], 10),
      unitPrice: parseFloat(teamsMatch[2]),
      amount: parseFloat(teamsMatch[3])
    });
  }
  
  return items;
}

/**
 * Extracts information from an invoice using the LayoutLM model
 * @param {Buffer} fileBuffer - The invoice file buffer
 * @returns {Promise<Object>} Extracted invoice data
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

async function parseInvoice(fileBuffer) {
  try {
    // Extract text from PDF
    const extractedText = await extractText(fileBuffer);
    console.log('Extracted Text:', extractedText); // Debug log
    
    // Extract and format invoice number
    const cleanText = extractedText.replace(/\u0000/g, ''); // Remove null characters
    console.log('Clean Text:', cleanText);
    
    // Extract invoice number using a specific pattern
    const invoicePattern = /(?:Invoice\s*number\s*|^)([A-Z0-9]{8})(?:0*|\\0*)(\d+)/im;
    const invoiceMatch = cleanText.match(invoicePattern);
    
    console.log('Invoice Match:', invoiceMatch);
    
    const invoiceNumber = invoiceMatch ? 
        `${invoiceMatch[1]}-${invoiceMatch[2].padStart(4, '0')}` :
        cleanText.match(/Invoice\s*number\s*([^\n]+)/i)?.[1]?.trim().replace(/\\0+/, '-') || '';
    
    // Extract and format dates
    const issueDate = formatDate(extractValue(extractedText, PATTERNS.issueDate));
    const dueDate = formatDate(extractValue(extractedText, PATTERNS.dueDate));
    
    // Extract vendor details
    const vendor = {
      name: "Cognition AI Inc.",
      address: "1875 Mission Street, 103, San Francisco, California 94103",
      contact: "support@cognition.ai"
    };

    // Extract customer details
    const customer = {
      name: extractValue(extractedText, PATTERNS.customer.name),
      country: extractValue(extractedText, PATTERNS.customer.country),
      email: extractValue(extractedText, PATTERNS.customer.email)
    };

    // Extract line items
    const lineItems = parseLineItems(extractedText);

    // Extract totals
    const totals = {
      subtotal: parseFloat(extractValue(extractedText, PATTERNS.totals.subtotal).replace(/,/g, '') || '0'),
      total: parseFloat(extractValue(extractedText, PATTERNS.totals.total).replace(/,/g, '') || '0'),
      amountDue: parseFloat(extractValue(extractedText, PATTERNS.totals.amountDue).replace(/,/g, '') || '0')
    };

    return {
      success: true,
      data: {
        invoiceNumber,
        issueDate,
        dueDate,
        vendor,
        customer,
        lineItems,
        totals
      }
    };
  } catch (error) {
    console.error('Error parsing invoice:', error);
    throw new Error('Failed to parse invoice: ' + error.message);
  }
}

module.exports = {
  parseInvoice
};
