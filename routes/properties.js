const express = require('express');
const Property = require('../models/Property');
const User = require('../models/User');
const { auth, agentOrAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// Get all properties
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 20, state, city, propertyType,
      minPrice, maxPrice, bedrooms, bathrooms, verified,
      search, sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    const filter = { isActive: true };
    if (state) filter.state = state;
    if (city) filter.city = new RegExp(city, 'i');
    if (propertyType) filter.propertyType = propertyType;
    if (bedrooms) filter.bedrooms = parseInt(bedrooms);
    if (bathrooms) filter.bathrooms = parseInt(bathrooms);
    if (verified === 'true') filter['verification.status'] = 'verified';

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseInt(minPrice);
      if (maxPrice) filter.price.$lte = parseInt(maxPrice);
    }

    if (search) {
      filter.$or = [
        { title: new RegExp(search, 'i') },
        { description: new RegExp(search, 'i') },
        { address: new RegExp(search, 'i') }
      ];
    }

    // Support filtering by agent id
    if (req.query.agent) {
      filter.agent = req.query.agent;
    }

    const skip = (page - 1) * limit;
    const properties = await Property.find(filter)
      .populate('agent', 'name profile.company profile.rating profile.location')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Property.countDocuments(filter);

    res.json({
      success: true,
      data: {
        properties,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Create property
router.post('/', auth, agentOrAdmin, async (req, res) => {
  try {
    const property = new Property({ ...req.body, agent: req.user._id });
    await property.save();
    await User.findByIdAndUpdate(req.user._id, { $inc: { 'profile.propertiesHandled': 1 } });

    await property.populate('agent', 'name profile.company');
    res.status(201).json({ success: true, message: 'Property created', data: { property } });
  } catch (err) {
    console.log({ err });
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Get properties belonging to current user (agent)
router.get('/my', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const properties = await Property.find({ agent: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Property.countDocuments({ agent: req.user._id });

    res.json({ success: true, data: { properties, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } } });
  } catch (err) {
    console.log({ err });
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Get single property
router.get('/:id', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id).populate('agent', 'name profile email phone');
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    await Property.findByIdAndUpdate(req.params.id, { $inc: { 'analytics.views': 1 } });
    res.json({ success: true, data: { property } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Upload images
router.post('/:id/images', auth, agentOrAdmin, (req, res, next) => {
  req.uploadType = 'properties';
  next();
}, upload.array('images', 10), async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    if (property.agent.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const imageUrls = req.files.map(file => `/uploads/properties/${file.filename}`);
    property.images = [...property.images, ...imageUrls];
    await property.save();

    res.json({ success: true, message: 'Images uploaded', data: { images: imageUrls } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete a single image from a property
router.delete('/:id/images', auth, agentOrAdmin, async (req, res) => {
  try {
    const { filename, url } = req.body || {};
    if (!filename && !url) return res.status(400).json({ success: false, message: 'filename or url required' });

    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    if (property.agent.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Determine the stored path fragment for matching
    const target = filename ? filename : (typeof url === 'string' ? url.split('/').pop() : null);
    if (!target) return res.status(400).json({ success: false, message: 'Invalid filename/url' });

    const remaining = property.images.filter(img => !img.includes(target));
    if (remaining.length === property.images.length) {
      return res.status(404).json({ success: false, message: 'Image not found on property' });
    }

    // Attempt to unlink file from disk (best-effort)
    try {
      const path = require('path');
      const fs = require('fs');
      // images are stored as /uploads/properties/<filename>
      const uploadsDir = path.join(process.cwd(), 'uploads', 'properties');
      const filePath = path.join(uploadsDir, target);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (e) {
      // ignore unlink errors
      console.log('Failed to unlink image file', e.message || e);
    }

    property.images = remaining;
    await property.save();

    res.json({ success: true, message: 'Image removed', data: { images: property.images } });
  } catch (err) {
    console.log('Error deleting property image', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Update property
router.put('/:id', auth, agentOrAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    if (property.agent.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updated = await Property.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true })
      .populate('agent', 'name profile.company');

    res.json({ success: true, message: 'Property updated', data: { property: updated } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Delete property
router.delete('/:id', auth, agentOrAdmin, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    if (property.agent.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await Property.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Favorite
router.post('/:id/favorite', auth, async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    await Property.findByIdAndUpdate(req.params.id, { $inc: { 'analytics.favorites': 1 } });
    res.json({ success: true, message: 'Property favorited' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Share
router.post('/:id/share', async (req, res) => {
  try {
    const property = await Property.findById(req.params.id);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    await Property.findByIdAndUpdate(req.params.id, { $inc: { 'analytics.shares': 1 } });
    res.json({
      success: true,
      message: 'Share updated',
      data: {
        shareUrl: `${process.env.FRONTEND_URL}/property/${req.params.id}`,
        title: property.title,
        description: property.description.substring(0, 150) + '...'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
