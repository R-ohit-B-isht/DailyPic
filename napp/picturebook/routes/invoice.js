const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { parseInvoice } = require('../services/invoiceParser');

// POST /public/invoice/parse
router.post('/parse', upload.single('invoiceFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Check file type
    if (!req.file.mimetype.includes('pdf')) {
      return res.status(400).json({
        success: false,
        error: 'Only PDF files are supported'
      });
    }

    // Parse invoice using our service
    const result = await parseInvoice(req.file.buffer);
    res.json(result);
  } catch (error) {
    console.error('Error processing invoice:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process invoice'
    });
  }
});

module.exports = router;
