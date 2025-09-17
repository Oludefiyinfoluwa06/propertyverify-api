const mongoose = require('mongoose');

const propertySchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  address: { type: String, required: true },
  state: { type: String, required: true },
  city: { type: String, required: true },
  propertyType: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'NGN' },
  bedrooms: Number,
  bathrooms: Number,
  size: String,
  coordinates: { latitude: Number, longitude: Number },
  images: [String],
  documents: [{
    name: String,
    url: String,
    type: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  verification: {
    status: { type: String, default: 'pending' },
    score: { type: Number, min: 0, max: 100, default: 0 },
    lastVerified: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    certificate: { id: String, url: String, issuedAt: Date },
    aiAnalysis: {
      documentAuthenticity: Number,
      fraudProbability: Number,
      riskFactors: [String],
      confidence: Number
    }
  },
  analytics: {
    views: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    inquiries: { type: Number, default: 0 },
    favorites: { type: Number, default: 0 }
  },
  features: [String],
  isActive: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false }
}, { timestamps: true });

propertySchema.index({ "coordinates.latitude": 1, "coordinates.longitude": 1 });
propertySchema.index({ state: 1, city: 1 });
propertySchema.index({ propertyType: 1, price: 1 });

module.exports = mongoose.model('Property', propertySchema);
