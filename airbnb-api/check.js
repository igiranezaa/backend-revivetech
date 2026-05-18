import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findUnique({where: {email: 'fifingabire25@gmail.com'}}).then(console.log).finally(() => prisma.$disconnect());
