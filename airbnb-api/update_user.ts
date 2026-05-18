import 'dotenv/config';
import prisma from './src/config/prisma.js';

async function update() {
  const user = await prisma.user.update({
    where: { email: 'fifingabire25@gmail.com' },
    data: { role: 'ADMIN', roles: { set: ['ADMIN'] }, isSuperAdmin: true }
  });
  console.log('Updated user:', user);
}

update().finally(() => prisma.$disconnect());
