const mongoose = require('mongoose');

const verificationSchema = new mongoose.Schema({
  property: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'rejected', 'disputed'], default: 'pending' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  documents: [{
    name: String,
    url: String,
    type: String,
    status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    aiAnalysis: { authenticity: Number, confidence: Number, issues: [String] }
  }],
  verification: {
    landRegistry: { status: String, reference: String, verifiedAt: Date },
    ownership: { verified: Boolean, issues: [String] },
    legal: { status: String, issues: [String] },
    physical: {
      inspected: Boolean,
      inspectionDate: Date,
      inspector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      report: String
    }
  },
  score: {
    overall: { type: Number, min: 0, max: 100, default: 0 },
    breakdown: { documentation: Number, ownership: Number, legal: Number, physical: Number }
  },
  certificate: { id: String, url: String, issuedAt: Date, expiresAt: Date },
  payment: {
    amount: Number,
    status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    reference: String,
    paidAt: Date
  },
  notes: [String],
  timeline: [{
    action: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    details: String
  }]
}, { timestamps: true });

module.exports = mongoose.model('Verification', verificationSchema);
