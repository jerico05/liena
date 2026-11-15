import { prisma } from "../../config/database";

export async function listActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
    select: { id: true, label: true, displayOrder: true },
  });
}
