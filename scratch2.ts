import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const env = fs.readFileSync('.env.production', 'utf-8');
for (const line of env.split('\n')) {
  if (line && !line.startsWith('#')) {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
      process.env[key] = value.join('=').trim().replace(/^"|"$/g, '');
    }
  }
}

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.taskTemplate.findMany({
    where: {
      title: { contains: "aspi", mode: "insensitive" }
    },
    include: {
      recurrenceRule: true,
    }
  });

  console.log(JSON.stringify(templates, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
