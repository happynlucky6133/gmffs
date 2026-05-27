"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { PaymentMethodType } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { optionalString, requiredString } from "@/lib/form";
import { withSqlTransaction } from "@/lib/sql";

export async function updateCompanySettings(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE companies SET name = $1, domain = $2, "updatedAt" = NOW()
        WHERE id = $3`,
      [
        requiredString(formData, "name"),
        optionalString(formData, "domain"),
        company.id,
      ],
    );
  });
  revalidateSettingsPages();
}

export async function createServiceArea(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `INSERT INTO service_areas
        (id, "companyId", name, code, enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
      [
        randomUUID(),
        company.id,
        requiredString(formData, "name"),
        requiredString(formData, "code"),
        formData.get("enabled") !== "false",
      ],
    );
  });
  revalidateSettingsPages();
}

export async function updateServiceArea(formData: FormData) {
  const company = await getActiveCompany();
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE service_areas SET name = $1, code = $2, enabled = $3, "updatedAt" = NOW()
        WHERE id = $4 AND "companyId" = $5`,
      [
        requiredString(formData, "name"),
        requiredString(formData, "code"),
        formData.get("enabled") === "true",
        requiredString(formData, "id"),
        company.id,
      ],
    );
  });
  revalidateSettingsPages();
}

export async function updatePaymentMethodSettings(formData: FormData) {
  const company = await getActiveCompany();
  const settingsText = optionalString(formData, "settings");
  await withSqlTransaction(async (client) => {
    await client.query(
      `UPDATE payment_methods
          SET name = $1, enabled = $2, settings = $3, "updatedAt" = NOW()
        WHERE id = $4 AND "companyId" = $5`,
      [
        requiredString(formData, "name"),
        formData.get("enabled") === "true",
        parseSettings(settingsText),
        requiredString(formData, "id"),
        company.id,
      ],
    );
  });
  revalidateSettingsPages();
  revalidatePath("/payments");
}

export async function ensurePaymentMethod(formData: FormData) {
  const company = await getActiveCompany();
  const type = requiredString(formData, "type") as PaymentMethodType;
  if (!Object.values(PaymentMethodType).includes(type)) {
    throw new Error("Invalid payment method type");
  }
  await withSqlTransaction(async (client) => {
    await client.query(
      `INSERT INTO payment_methods
        (id, "companyId", type, name, enabled, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       ON CONFLICT ("companyId", type)
       DO UPDATE SET enabled = true, "updatedAt" = NOW()`,
      [randomUUID(), company.id, type, requiredString(formData, "name")],
    );
  });
  revalidateSettingsPages();
  revalidatePath("/payments");
}

function parseSettings(settingsText: string | null) {
  if (!settingsText) return undefined;
  try {
    return JSON.parse(settingsText);
  } catch {
    throw new Error("Payment method settings must be valid JSON");
  }
}

function revalidateSettingsPages() {
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}
