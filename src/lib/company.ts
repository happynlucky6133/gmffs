import { prisma } from "@/lib/prisma";

// Temporary Phase 1 company context. Replace this with session-based company
// access before exposing multiple companies in production.
const DEFAULT_COMPANY_SLUG = process.env.DEFAULT_COMPANY_SLUG ?? "gm";

export async function getActiveCompany() {
  return prisma.company.findUniqueOrThrow({
    where: { slug: DEFAULT_COMPANY_SLUG },
  });
}
