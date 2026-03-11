const bcrypt = require('bcryptjs');

const pool = require('../config/db');

const DEMO_PASSWORD = 'Admin1234';
const DEMO_USERS = [
  {
    email: 'admin.center@school.local',
    role: 'admin',
    fullName: 'Admin Center',
    gender: 'male',
  },
  {
    email: 'nim.cheyseth.2824@rupp.edu.kh',
    role: 'admin',
    fullName: 'Admin Center 1',
    gender: 'male',
  },
  {
    email: 'thet.englang.2824@rupp.edu.kh',
    role: 'admin',
    fullName: 'Admin Center 2',
    gender: 'female',
  },
  {
    email: 'po.phearun.2824@rupp.edu.kh',
    role: 'admin',
    fullName: 'Admin Center 3',
    gender: 'male',
  },
];

async function syncDemoUsers() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const user of DEMO_USERS) {
    await pool.query(
      `
        INSERT INTO users (email, password_hash, role, full_name, gender)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          full_name = VALUES(full_name),
          gender = VALUES(gender)
      `,
      [user.email, passwordHash, user.role, user.fullName, user.gender]
    );
  }
}

module.exports = {
  syncDemoUsers,
};
