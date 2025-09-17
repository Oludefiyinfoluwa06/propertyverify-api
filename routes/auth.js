const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendSMS, sendEmail } = require('../utils/notifications');
const upload = require('../middleware/upload');

const router = express.Router();

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// Generate referral code
const generateReferralCode = (name) => {
  return name.toUpperCase().replace(/\s+/g, '').substr(0, 4) +
    Math.random().toString(36).substr(2, 4).toUpperCase();
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, email, password, role = 'user', referralCode } = req.body;

    if (!name || !phone || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }

    const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer._id;
        await User.findByIdAndUpdate(referrer._id, { $inc: { totalReferrals: 1 } });
      }
    }

    const user = new User({
      name,
      phone,
      email,
      password: hashedPassword,
      role,
      verificationCode,
      referralCode: generateReferralCode(name),
      referredBy
    });
    await user.save();

    await sendSMS(phone, `Your PropertyVerify code is: ${verificationCode}`);

    res.status(201).json({
      success: true,
      message: 'User registered. Verify your phone.',
      data: { user: user.toJSON(), token: generateToken(user._id) }
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Verify phone
router.post('/verify-phone', auth, async (req, res) => {
  try {
    const { verificationCode } = req.body;
    const user = await User.findById(req.user._id);

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }

    user.isVerified = true;
    user.verificationCode = undefined;
    await user.save();

    res.json({ success: true, message: 'Phone verified', data: { user: user.toJSON() } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Missing credentials' });
    }

    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    res.json({
      success: true,
      message: 'Login successful',
      data: { user: user.toJSON(), token: generateToken(user._id) }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

// Get current user
router.get('/me', auth, (req, res) => {
  res.json({ success: true, data: { user: req.user.toJSON() } });
});

// Update profile
router.put('/profile', auth, async (req, res) => {
  try {
    const allowed = ['name', 'profile', 'socialLinks'];
    const updates = {};
    allowed.forEach(field => { if (req.body[field]) updates[field] = req.body[field]; });

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true, runValidators: true });
    res.json({ success: true, message: 'Profile updated', data: { user: user.toJSON() } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Upload avatar
router.post('/avatar', auth, (req, res, next) => {
  req.uploadType = 'users';
  next();
}, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const avatarUrl = `/uploads/users/${req.file.filename}`;
    const user = await User.findByIdAndUpdate(req.user._id, { $set: { 'profile.avatar': avatarUrl } }, { new: true }).select('-password');

    res.json({ success: true, message: 'Avatar uploaded', data: { user: user.toJSON(), avatar: avatarUrl } });
  } catch (err) {
    console.error('Avatar upload error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Resend verification code
router.post('/resend-verification', auth, async (req, res) => {
  try {
    if (req.user.isVerified) {
      return res.status(400).json({ success: false, message: 'Already verified' });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await User.findByIdAndUpdate(req.user._id, { verificationCode });
    await sendSMS(req.user.phone, `Your PropertyVerify code is: ${verificationCode}`);

    res.json({ success: true, message: 'Code resent' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
