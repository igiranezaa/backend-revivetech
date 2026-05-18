import 'dotenv/config';
import prisma from './src/config/prisma.js';
import jwt from 'jsonwebtoken';

async function testFetch() {
  try {
    const user = await prisma.user.findUnique({ where: { email: 'fifingabire25@gmail.com' } });
    if (!user) {
      console.error('User not found');
      return;
    }

    const secret = process.env.JWT_SECRET;
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, { expiresIn: '7d' });

    console.log('Generated token for', user.email);

    const res = await fetch('http://localhost:3000/api/v1/listings/admin?status=ACTIVE&limit=100', {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log('Fetch Status:', res.status);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Fetch Error:', err.message);
  }
}

testFetch().finally(() => prisma.$disconnect());
