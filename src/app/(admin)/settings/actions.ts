"use server";

import { revalidatePath } from "next/cache";
import { PaymentMethodType } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import { optionalString, requiredString } from "@/lib/form";
import { prisma } from "@/lib/prisma";

export async function updateCompanySettings(formData: FormData) {
  const company = await getActiveCompany();

  await prisma.company.update({
    where: { id: company.id },
    data: {
      name: requiredString(formData, "name"),
      domain: optionalString(formData, "domain"),
    },
  });

  revalidateSettingsPages();
}

export async function createServiceArea(formData: FormData) {
  const company = await getActiveCompany();

  await prisma.serviceArea.create({
    data: {
      companyId: company.id,
      name: requiredString(formData, "name"),
      code: requiredString(formData, "code"),
      enabled: formData.get("enabled") !== "false",
    },
  });

  revalidateSettingsPages();
}

export async function updateServiceArea(formData: FormData) {
  const company = await getActiveCompany();

  await prisma.serviceArea.update({
    where: {
      id: requiredString(formData, "id"),
      companyId: company.id,
    },
    data: {
      name: requiredString(formData, "name"),
      code: requiredString(formData, "code"),
      enabled: formData.get("enabled") === "true",
    },
  });

  revalidateSettingsPages();
}

export async function updatePaymentMethodSettings(formData: FormData) {
  const company = await getActiveCompany();
  const settingsText = optionalString(formData, "settings");

  await prisma.paymentMethod.update({
    where: {
      id: requiredString(formData, "id"),
      companyId: company.id,
    },
    data: {
      name: requiredString(formData, "name"),
      enabled: formData.get("enabled") === "true",
      settings: parseSettings(settingsText),
    },
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

  await prisma.paymentMethod.upsert({
    where: {
      companyId_type: {
        companyId: company.id,
        type,
      },
    },
    update: {
      enabled: true,
    },
    create: {
      companyId: company.id,
      type,
      name: requiredString(formData, "name"),
      enabled: true,
    },
  });

  revalidateSettingsPages();
  revalidatePath("/payments");
}

function parseSettings(settingsText: string | null) {
  if (!settingsText) {
    return undefined;
  }

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
