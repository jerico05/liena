import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set before seeding.");
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const categories = [
  "Plomberie",
  "Électricité",
  "Nettoyage",
  "Réparation et entretien",
  "Travaux et rénovation",
  "Beauté et bien-être",
  "Informatique",
  "Assistance et services à domicile",
];

async function seedCategories() {
  for (const [displayOrder, label] of categories.entries()) {
    await prisma.category.upsert({
      where: { label },
      create: { label, displayOrder },
      update: { displayOrder, isActive: true },
    });
  }
}

seedCategories()
  .catch((error: unknown) => {
    console.error("Category seed failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
