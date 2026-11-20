require('dotenv').config();

const mongoose = require('mongoose');
const dns = require('node:dns');

const Admin = require('./models/Admin');
const User = require('./models/User');



const MONGO_URI = process.env.MONGO_URI;

const seedData = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is not defined in .env');
    }

    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);

    console.log('MongoDB Connected Successfully');

    // =====================================
    // 1. CREATE ADMIN
    // Email: admin@sliit.lk
    // Password: Admin@123
    // =====================================

    let admin = await Admin.findOne({
      email: 'admin@sliit.lk'
    });

    if (!admin) {
      admin = new Admin({
        name: 'SLIIT Event',
        email: 'admin@sliit.lk',
        password: 'Admin@123',
        role: 'superadmin'
      });

      await admin.save();

      console.log('Admin user created successfully');
    } else {
      console.log('Admin user already exists');
    }

    // =====================================
    // 2. CREATE PRESIDENT
    // Email: suma@sliit.lk
    // Password: Suma@123
    // =====================================

    let president = await User.findOne({
      email: 'suma@sliit.lk'
    });

    if (!president) {
      president = new User({
        name: 'SLIIT President',
        email: 'suma@sliit.lk',
        password: 'Suma@123',
        studentId: 'ITPRES001',
        role: 'president',
        status: 'active'
      });

      await president.save();

      console.log('President user created successfully');
    } else {
      console.log('President user already exists');
    }

    // =====================================
    // 3. CREATE STUDENT
    // Email: user@sliit.lk
    // Password: User@123
    // =====================================

    let student = await User.findOne({
      email: 'user@sliit.lk'
    });

    if (!student) {
      student = new User({
        name: 'Suma Perera',
        email: 'user@sliit.lk',
        password: 'User@123',
        studentId: 'ITSTU001',
        role: 'student',
        status: 'active'
      });

      await student.save();

      console.log('Student user created successfully');
    } else {
      console.log('Student user already exists');
    }

    console.log('\n================================');
    console.log('Data seeding completed!');
    console.log('================================');

    console.log('\nSeeded Login Details:');
    console.log('Admin: admin@sliit.lk / Admin@123');
    console.log('President: suma@sliit.lk / Suma@123');
    console.log('Student: user@sliit.lk / User@123');

  } catch (error) {
    console.error('Error with data seeding:', error);
    process.exitCode = 1;

  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('MongoDB connection closed');
    }
  }
};

seedData();
