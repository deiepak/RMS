const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

// All social routes require admin access
router.use(verifyToken);
router.use(requireRole(['admin']));

// --- Configs ---
router.get('/configs', async (req, res) => {
  try {
    const configs = await db('social_configs');
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/configs', async (req, res) => {
  try {
    const { platform, config_key, config_value } = req.body;
    
    const existing = await db('social_configs')
      .where({ platform, config_key })
      .first();

    if (existing) {
      await db('social_configs')
        .where({ id: existing.id })
        .update({ config_value });
      return res.json({ id: existing.id, platform, config_key, config_value });
    }

    const [id] = await db('social_configs').insert({
      platform,
      config_key,
      config_value
    });
    
    res.status(201).json({ id, platform, config_key, config_value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Posts ---
router.get('/posts', async (req, res) => {
  try {
    const posts = await db('social_posts').orderBy('created_at', 'desc');
    // Parse JSON fields if necessary depending on DB dialect
    const formatted = posts.map(p => ({
      ...p,
      platforms_selected: typeof p.platforms_selected === 'string' ? JSON.parse(p.platforms_selected) : p.platforms_selected,
      external_post_ids: typeof p.external_post_ids === 'string' ? JSON.parse(p.external_post_ids) : p.external_post_ids,
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/posts', async (req, res) => {
  try {
    const { content, media_url, platforms_selected, status, scheduled_for } = req.body;
    
    const platformsJson = JSON.stringify(platforms_selected || []);

    const [id] = await db('social_posts').insert({
      content,
      media_url,
      platforms_selected: platformsJson,
      status: status || 'draft',
      scheduled_for: scheduled_for || null
    });
    
    const newPost = await db('social_posts').where({ id }).first();
    res.status(201).json({
        ...newPost,
        platforms_selected: platforms_selected || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, media_url, platforms_selected, status, scheduled_for } = req.body;
    
    const updateData = {
      content,
      media_url,
      status: status || 'draft',
      scheduled_for: scheduled_for || null
    };

    if (platforms_selected) {
      updateData.platforms_selected = JSON.stringify(platforms_selected);
    }

    await db('social_posts').where({ id }).update(updateData);
    
    const updatedPost = await db('social_posts').where({ id }).first();
    res.json({
        ...updatedPost,
        platforms_selected: platforms_selected || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db('social_posts').where({ id }).del();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Messages ---
router.get('/messages', async (req, res) => {
  try {
    const messages = await db('social_messages').orderBy('created_at', 'desc');
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/messages', async (req, res) => {
  try {
    const { platform, receiver_id, message_content, media_url } = req.body;
    
    // In a real scenario, here we would call the Facebook/WhatsApp API to actually send the message.
    // For this implementation, we log the outgoing message.
    
    const [id] = await db('social_messages').insert({
      platform,
      sender_id: 'SYSTEM', // Our system
      receiver_id,
      message_content,
      media_url,
      direction: 'outgoing',
      status: 'read'
    });
    
    const newMsg = await db('social_messages').where({ id }).first();
    res.status(201).json(newMsg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
