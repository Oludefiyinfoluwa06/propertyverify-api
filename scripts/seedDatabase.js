const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('../models/User');
const Property = require('../models/Property');
const Verification = require('../models/Verification');

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('🔗 Connected to MongoDB');

    await User.deleteMany({});
    await Property.deleteMany({});
    await Verification.deleteMany({});
    console.log('🧹 Cleared existing data');

    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    const admin = new User({
      name: process.env.ADMIN_NAME,
      phone: process.env.ADMIN_PHONE,
      email: process.env.ADMIN_EMAIL,
      password: hash,
      role: 'admin',
      isVerified: true,
    });
    await admin.save();
    console.log('👑 Admin created');

    console.log('✅ Seed data created');
  } catch (err) {
    console.error('❌ Error seeding:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB connection closed');
  }
}

if (require.main === module) seedDatabase();
module.exports = seedDatabase;
