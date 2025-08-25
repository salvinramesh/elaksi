import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  console.log('Seeding…');

  // wipe (optional)
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productImage.deleteMany().catch(()=>{});
  await prisma.product.deleteMany();
  await prisma.collection.deleteMany();

  const bridal = await prisma.collection.create({ data: { name: 'Bridal', slug: 'bridal' } });
  const daily  = await prisma.collection.create({ data: { name: 'Daily Wear', slug: 'daily-wear' } });

  const products = [
    {
      name: 'Kundan Necklace Set',
      slug: 'kundan-necklace-set',
      description: 'Classic kundan set with earrings.',
      price: 249900, compareAt: 299900, inventory: 25,
      imageUrl: 'https://picsum.photos/seed/kundan/800/800',
      tagsCsv: 'kundan,necklace,set,bridal',
      collectionId: bridal.id,
      images: [
        { url: 'https://picsum.photos/seed/kundan1/800/800', position: 0 },
        { url: 'https://picsum.photos/seed/kundan2/800/800', position: 1 },
      ]
    },
    {
      name: 'Pearl Drop Earrings',
      slug: 'pearl-drop-earrings',
      description: 'Lightweight daily-wear pearl drops.',
      price: 99900, compareAt: 129900, inventory: 40,
      imageUrl: 'https://picsum.photos/seed/pearls/800/800',
      tagsCsv: 'pearls,earrings,daily',
      collectionId: daily.id,
      images: [
        { url: 'https://picsum.photos/seed/pearls1/800/800', position: 0 },
        { url: 'https://picsum.photos/seed/pearls2/800/800', position: 1 },
      ]
    },
    {
      name: 'Temple Pendant',
      slug: 'temple-pendant',
      description: 'Antique-finish temple pendant.',
      price: 149900, compareAt: 179900, inventory: 15,
      imageUrl: 'https://picsum.photos/seed/temple/800/800',
      tagsCsv: 'temple,pendant,antique',
      collectionId: daily.id,
      images: [
        { url: 'https://picsum.photos/seed/temple1/800/800', position: 0 },
        { url: 'https://picsum.photos/seed/temple2/800/800', position: 1 },
      ]
    }
  ];

  for (const p of products) {
    const { images, ...data } = p;
    const created = await prisma.product.create({ data });
    if (images?.length) {
      await prisma.productImage.createMany({
        data: images.map(img => ({ ...img, productId: created.id }))
      });
    }
  }

  console.log('Seed complete.');
}

run().finally(()=>prisma.$disconnect());
