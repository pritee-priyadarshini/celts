// routes/media.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const fs = require('fs');

// Save to ./uploads by default (ensure folder exists)
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});

const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } }); // up to 20MB

router.post('/upload/audio', protect, restrictTo(['student']), upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  // Return local URL (for dev). In prod you should upload to S3 and return signed URL.
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({ message: 'uploaded', url: fileUrl, path: req.file.path });
});

module.exports = router;
