import { getAdminCompany } from "@/services/admin-queries";

export async function getActiveCompany() {
  return getAdminCompany();
}
