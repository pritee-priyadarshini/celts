// routes/root.js
const express = require('express');
const router = express.Router();
router.get('/', (req,res) => res.json({ message: 'CELTS Backend OK', timestamp: Date.now() }));
module.exports = router;
