const express = require('express');
const Verification = require('../models/Verification');
const Property = require('../models/Property');
const { auth, agentOrAdmin, adminOnly } = require('../middleware/auth');
const { processPayment } = require('../utils/payments');
const { sendSMS, sendEmail } = require('../utils/notifications');

const router = express.Router();

// 📌 Request Property Verification
router.post('/request', auth, async (req, res) => {
  try {
    const { propertyId, priority = 'medium' } = req.body;

    const property = await Property.findById(propertyId);
    if (!property) return res.status(404).json({ success: false, message: 'Property not found' });

    const existing = await Verification.findOne({
      property: propertyId,
      status: { $in: ['pending', 'in-progress'] }
    });
    if (existing) return res.status(400).json({ success: false, message: 'Verification already in progress' });

    const fees = { low: 25000, medium: 50000, high: 75000, urgent: 100000 };
    const amount = fees[priority] || fees.medium;

    const verification = new Verification({
      property: propertyId,
      requestedBy: req.user._id,
      priority,
      payment: { amount, status: 'pending' },
      timeline: [{
        action: 'Verification requested',
        user: req.user._id,
        details: `${priority} priority verification requested`
      }]
    });
    await verification.save();

    res.status(201).json({
      success: true,
      message: 'Verification request created',
      data: {
        verification,
        paymentAmount: amount,
        paymentInstructions: 'Proceed to payment to start verification'
      }
    });
  } catch (err) {
    console.error('Verification request error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Process Payment
router.post('/:id/payment', auth, async (req, res) => {
  try {
    const { paymentReference } = req.body;
    const verification = await Verification.findById(req.params.id);
    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });

    if (verification.requestedBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const paymentResult = await processPayment(paymentReference, verification.payment.amount);
    if (!paymentResult.success) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }

    verification.payment.status = 'paid';
    verification.payment.reference = paymentReference;
    verification.payment.paidAt = new Date();
    verification.status = 'pending';
    verification.timeline.push({
      action: 'Payment confirmed',
      user: req.user._id,
      details: `Payment of ₦${verification.payment.amount.toLocaleString()} confirmed`
    });
    await verification.save();

    if (process.env.ADMIN_PHONE) {
      await sendSMS(process.env.ADMIN_PHONE, `New verification payment confirmed. ID: ${verification._id}`);
    }

    res.json({ success: true, message: 'Payment confirmed', data: { verification } });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Get Current User's Verifications
router.get('/my-verifications', auth, async (req, res) => {
  try {
    const verifications = await Verification.find({ requestedBy: req.user._id })
      .populate('property', 'title address price')
      .populate('assignedTo', 'name profile.company')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: { verifications } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Get Single Verification
router.get('/:id', auth, async (req, res) => {
  try {
    const verification = await Verification.findById(req.params.id)
      .populate('property')
      .populate('requestedBy', 'name email phone')
      .populate('assignedTo', 'name profile.company')
      .populate('timeline.user', 'name');

    if (!verification) return res.status(404).json({ success: false, message: 'Verification not found' });

    const hasAccess =
      verification.requestedBy._id.toString() === req.user._id.toString() ||
      verification.assignedTo?.toString() === req.user._id.toString() ||
      req.user.role === 'admin';

    if (!hasAccess) return res.status(403).json({ success: false, message: 'Not authorized' });

    res.json({ success: true, data: { verification } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Assign Verification (Admin)
router.post('/:id/assign', auth, adminOnly, async (req, res) => {
  try {
    const { agentId } = req.body;
    const verification = await Verification.findById(req.params.id);
    if (!verification) return res.status(404).json({ success: false, message: 'Not found' });

    verification.assignedTo = agentId;
    verification.status = 'in-progress';
    verification.timeline.push({ action: 'Assigned to agent', user: req.user._id, details: `Assigned to agent ${agentId}` });
    await verification.save();

    res.json({ success: true, message: 'Assigned successfully', data: { verification } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Update Verification Status (Agent/Admin)
router.put('/:id/status', auth, agentOrAdmin, async (req, res) => {
  try {
    const { status, notes, score } = req.body;
    const verification = await Verification.findById(req.params.id);
    if (!verification) return res.status(404).json({ success: false, message: 'Not found' });

    const canUpdate = verification.assignedTo?.toString() === req.user._id.toString() || req.user.role === 'admin';
    if (!canUpdate) return res.status(403).json({ success: false, message: 'Not authorized' });

    verification.status = status;
    if (notes) verification.notes.push(notes);
    if (score) verification.score.overall = score;

    verification.timeline.push({
      action: `Status updated to ${status}`,
      user: req.user._id,
      details: notes || 'Status updated'
    });

    if (status === 'completed' && score) {
      await Property.findByIdAndUpdate(verification.property, {
        'verification.status': 'verified',
        'verification.score': score,
        'verification.lastVerified': new Date(),
        'verification.verifiedBy': req.user._id
      });
    }

    await verification.save();
    res.json({ success: true, message: 'Status updated', data: { verification } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// 📌 Get All Verifications (Admin/Agent)
router.get('/', auth, agentOrAdmin, async (req, res) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (req.user.role === 'agent') filter.assignedTo = req.user._id;

    const skip = (page - 1) * limit;
    const verifications = await Verification.find(filter)
      .populate('property', 'title address')
      .populate('requestedBy', 'name email')
      .populate('assignedTo', 'name profile.company')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Verification.countDocuments(filter);

    res.json({
      success: true,
      data: {
        verifications,
        pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
