const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: {
    type: String,
    required: true,
    unique: true,
    match: /^\+234[0-9]{10}$/
  },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'agent', 'admin'], default: 'user' },
  isVerified: { type: Boolean, default: false },
  verificationCode: String,
  profile: {
    avatar: String,
    company: String,
    location: String,
    bio: String,
    rating: { type: Number, min: 0, max: 5, default: 0 },
    totalReviews: { type: Number, default: 0 },
    propertiesHandled: { type: Number, default: 0 },
    joinDate: { type: Date, default: Date.now }
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium', 'enterprise'], default: 'free' },
    expiresAt: Date,
    isActive: { type: Boolean, default: false }
  },
  socialLinks: {
    facebook: String,
    twitter: String,
    linkedin: String,
    instagram: String
  },
  referralCode: { type: String, unique: true },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  totalReferrals: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.verificationCode;
  return user;
};

module.exports = mongoose.model('User', userSchema);
