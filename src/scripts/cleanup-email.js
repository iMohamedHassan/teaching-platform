require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const users = db.collection('users');

  try {
    await users.dropIndex('email_1');
    console.log('dropped email_1 index');
  } catch (error) {
    console.log('email_1 index not found or already removed');
  }

  const result = await users.updateMany({}, { $unset: { email: '' } });
  console.log('removed email fields:', result.modifiedCount);

  const indexes = await users.indexes();
  console.log('current indexes', indexes.map((i) => i.key));

  await mongoose.disconnect();
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
