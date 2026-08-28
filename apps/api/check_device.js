const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const device = await prisma.device.findUnique({
    where: { deviceToken: 'ql_dev_9f771683e8874bb729f0acd5cf63d5df320a76b9b0d6f2d4' },
    include: { user: true }
  });
  console.log("DEVICE USER EMAIL:", device?.user?.email);
}
main().finally(() => prisma.$disconnect());
