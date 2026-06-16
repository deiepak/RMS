const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, '../../uploads/tv');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });
const router = express.Router();

// GET /api/tv/content - list all tv media
router.get('/content', async (req, res) => {
  try {
    const media = await db('tv_content').orderBy('display_order', 'asc').orderBy('id', 'asc');
    res.json(media);
  } catch (err) {
    console.error('Fetch TV content error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/tv/content - upload new tv media (Admin only)
router.post('/content', verifyToken, requireRole(['admin']), upload.single('media'), async (req, res) => {
  try {
    const { type, duration_seconds, occurrences_per_hour, display_order } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const file_url = `/uploads/tv/${req.file.filename}`;

    const [id] = await db('tv_content').insert({
      type: type || 'photo',
      file_url,
      duration_seconds: duration_seconds ? parseInt(duration_seconds) : 0,
      occurrences_per_hour: occurrences_per_hour ? parseInt(occurrences_per_hour) : 1,
      display_order: display_order ? parseInt(display_order) : 0
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('tv:content_updated');
    }

    res.status(201).json({ id, file_url, message: 'Media uploaded successfully.' });
  } catch (err) {
    console.error('TV content upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/tv/upload-chunk - chunked upload to bypass cloudflare proxy size limits
router.post('/upload-chunk', verifyToken, requireRole(['admin']), upload.single('chunk'), async (req, res) => {
  try {
    const { uploadId, chunkIndex, totalChunks, type, occurrences_per_hour, display_order, duration_seconds, fileName } = req.body;
    
    if (!req.file) return res.status(400).json({ error: 'No chunk uploaded' });

    const chunkPath = req.file.path;
    const finalDir = path.join(__dirname, '../../uploads/tv');
    const tempFilePath = path.join(finalDir, `${uploadId}.tmp`);

    // Append this chunk to the temp file
    fs.appendFileSync(tempFilePath, fs.readFileSync(chunkPath));
    fs.unlinkSync(chunkPath); // Clean up the temp chunk from disk

    // If it's the last chunk, finalize and insert to DB
    if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
      const ext = path.extname(fileName);
      const finalFileName = `${uploadId}${ext}`;
      const finalPath = path.join(finalDir, finalFileName);
      
      fs.renameSync(tempFilePath, finalPath);
      
      const file_url = `/uploads/tv/${finalFileName}`;
      const [id] = await db('tv_content').insert({
        type: type || 'photo',
        file_url,
        duration_seconds: duration_seconds ? parseInt(duration_seconds) : 0,
        occurrences_per_hour: occurrences_per_hour ? parseInt(occurrences_per_hour) : 1,
        display_order: display_order ? parseInt(display_order) : 0
      });
      
      const io = req.app.get('io');
      if (io) {
        io.emit('tv:content_updated');
      }
      
      return res.status(201).json({ id, file_url, message: 'Upload completed' });
    } else {
      return res.json({ message: `Chunk ${chunkIndex} received` });
    }
  } catch (err) {
    console.error('TV chunk upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/tv/content/:id - delete tv media (Admin only)
router.delete('/content/:id', verifyToken, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const item = await db('tv_content').where({ id }).first();
    if (!item) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    // Try to delete the actual file
    try {
      const filePath = path.join(__dirname, '../../', item.file_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error('Failed to delete tv media file:', e);
    }

    await db('tv_content').where({ id }).del();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('tv:content_updated');
    }

    res.json({ message: 'Media deleted successfully.' });
  } catch (err) {
    console.error('Delete TV content error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
