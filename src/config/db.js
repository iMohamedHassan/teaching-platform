const mongoose = require('mongoose');
const cfg = require('./index');

module.exports = async function connectDB() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(cfg.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');
};
