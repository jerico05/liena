import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set before seeding.");
}

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const categories = [
  {
    slug: "plomberie",
    name: "Plomberie",
    description: "Installation, dépannage et entretien de plomberie.",
  },
  {
    slug: "electricite",
    name: "Électricité",
    description: "Installation, dépannage et mise en sécurité électrique.",
  },
  {
    slug: "nettoyage",
    name: "Nettoyage",
    description: "Nettoyage de logements, locaux et espaces extérieurs.",
  },
  {
    slug: "reparation-entretien",
    name: "Réparation et entretien",
    description: "Réparation et entretien des équipements du quotidien.",
  },
  {
    slug: "travaux-renovation",
    name: "Travaux et rénovation",
    description: "Travaux d'aménagement, de construction et de rénovation.",
  },
  {
    slug: "beaute-bien-etre",
    name: "Beauté et bien-être",
    description: "Prestations de beauté, de soin et de bien-être.",
  },
  {
    slug: "informatique",
    name: "Informatique",
    description: "Installation, assistance et réparation informatique.",
  },
  {
    slug: "aide-services-domicile",
    name: "Assistance et services à domicile",
    description: "Aide et services pratiques à domicile.",
  },
];

async function seedCategories() {
  for (const [position, category] of categories.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: { ...category, position },
      update: { ...category, position },
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
