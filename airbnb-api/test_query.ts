import 'dotenv/config';
import prisma from './src/config/prisma.js';

async function test() {
  try {
    const whereClause = {};
    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          location: true,
          pricePerNight: true,
          rating: true,
          createdAt: true,
          hostId: true,
          status: true,
          guests: true,
          type: true,
          amenities: true,
          description: true,
          photos: {
            select: { id: true, url: true },
            take: 1,
          },
          host: {
            select: {
              name: true,
            },
          },
          _count: {
            select: { bookings: true, reviews: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 10,
      }),
      prisma.listing.count({ where: whereClause }),
    ]);
    console.log('Success!', listings.length, 'listings, total:', total);
  } catch (err) {
    console.error('Error executing query:', err);
  }
}

test().finally(() => prisma.$disconnect());
