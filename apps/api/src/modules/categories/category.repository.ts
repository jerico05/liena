import { prisma } from "../../config/database";

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ position: "asc" }, { name: "asc" }],
    select: { id: true, parentId: true, name: true, slug: true, description: true, iconUrl: true, position: true },
  });
}
