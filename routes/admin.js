const express = require('express');
const User = require('../models/User');
const Property = require('../models/Property');
const Verification = require('../models/Verification');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// 📊 Admin Dashboard
router.get('/dashboard', auth, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalAgents = await User.countDocuments({ role: 'agent' });
    const totalProperties = await Property.countDocuments();
    const verifiedProperties = await Property.countDocuments({ 'verification.status': 'verified' });
    const pendingVerifications = await Verification.countDocuments({ status: 'pending' });
    const completedVerifications = await Verification.countDocuments({ status: 'completed' });

    const paidVerifications = await Verification.find({ 'payment.status': 'paid' });
    const totalRevenue = paidVerifications.reduce((sum, v) => sum + v.payment.amount, 0);

    const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('name email role createdAt');
    const recentProperties = await Property.find().sort({ createdAt: -1 }).limit(5).populate('agent', 'name');
    const recentVerifications = await Verification.find().sort({ createdAt: -1 }).limit(5).populate('property', 'title');

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalAgents,
          totalProperties,
          verifiedProperties,
          pendingVerifications,
          completedVerifications,
          totalRevenue
        },
        recent: {
          users: recentUsers,
          properties: recentProperties,
          verifications: recentVerifications
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching dashboard' });
  }
});

// 📋 Manage Users
router.get('/users', auth, adminOnly, async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (search) filter.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

    const skip = (page - 1) * limit;
    const users = await User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)).select('-password');
    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: {
        users,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error fetching users' });
  }
});

// 🔧 Update User Role/Status
router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { isVerified, role } = req.body;
    const update = {};
    if (typeof isVerified === 'boolean') update.isVerified = isVerified;
    if (role) update.role = role;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User updated', data: { user } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error updating user' });
  }
});

// 🏠 Manage Properties
router.get('/properties', auth, adminOnly, async (req, res) => {
  try {
    const { state, status, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (state) filter.state = state;
    if (status) filter['verification.status'] = status;

    const skip = (page - 1) * limit;
    const properties = await Property.find(filter)
      .populate('agent', 'name profile.company')
      .sort({ createdAt: -1 })
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
    res.status(500).json({ success: false, message: 'Server error fetching properties' });
  }
});

module.exports = router;
