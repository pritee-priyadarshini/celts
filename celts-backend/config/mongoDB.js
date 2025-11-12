// config/mongoDB.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI not defined in .env');
    }
    await mongoose.connect(process.env.MONGO_URI, {
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    console.log('MongoDB Connected Successfully.');
  } catch (err) {
    console.error('MongoDB Connection Failed:', err.message);
    // Exit process with failure (non-zero)
    process.exit(1);
  }
};

module.exports = connectDB;
