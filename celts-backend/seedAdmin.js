// seedAdmin.js
require('dotenv').config();
const connectDB = require('./config/mongoDB');
const User = require('./models/User');
const bcrypt = require('bcryptjs');

(async () => {
  await connectDB();
  const email = 'admin@celts.local';
  const found = await User.findOne({ email });
  if (found) {
    console.log('Admin already exists:', email);
    process.exit(0);
  }
  const hashed = await bcrypt.hash('Admin@123', 10);
  const admin = await User.create({ name: 'Admin', email, password: hashed, role: 'admin' });
  console.log('Admin created:', admin.email, 'password: Admin@123');
  process.exit(0);
})();
