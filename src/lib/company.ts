import { prisma } from "@/lib/prisma";

const DEFAULT_COMPANY_SLUG = "gm";

export async function getActiveCompany() {
  return prisma.company.findUniqueOrThrow({
    where: { slug: DEFAULT_COMPANY_SLUG },
  });
}

