const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.socialAccount.updateMany({
    where: { status: 'active' },
    data: {
      destinations: [{ name: 'Personal Profile (Timeline)', url: 'https://www.facebook.com/' }]
    }
  });
  console.log('Fixed');
}

main().catch(console.error).finally(() => prisma.$disconnect());
