"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/company";
import { money, optionalString, requiredString } from "@/lib/form";
import { prisma } from "@/lib/prisma";

function requiredPrice(formData: FormData, key: string) {
  const value = Number(formData.get(key));

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${key} must be zero or greater`);
  }

  return money(value);
}

export async function createProduct(formData: FormData) {
  const company = await getActiveCompany();

  await prisma.product.create({
    data: {
      companyId: company.id,
      name: requiredString(formData, "name"),
      description: optionalString(formData, "description"),
    },
  });

  revalidatePath("/inventory");
}

export async function updateProduct(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await prisma.product.update({
    where: { id, companyId: company.id },
    data: {
      name: requiredString(formData, "name"),
      description: optionalString(formData, "description"),
    },
  });

  revalidatePath("/inventory");
}

export async function setProductActive(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");
  const isActive = formData.get("isActive") === "true";

  await prisma.product.update({
    where: { id, companyId: company.id },
    data: { isActive },
  });

  revalidatePath("/inventory");
}

export async function createSku(formData: FormData) {
  const company = await getActiveCompany();
  const productId = requiredString(formData, "productId");

  await prisma.product.findFirstOrThrow({
    where: {
      id: productId,
      companyId: company.id,
      isActive: true,
    },
  });

  await prisma.sku.create({
    data: {
      companyId: company.id,
      productId,
      code: requiredString(formData, "code"),
      name: requiredString(formData, "name"),
      unit: requiredString(formData, "unit"),
      price: requiredPrice(formData, "price"),
    },
  });

  revalidatePath("/inventory");
}

export async function updateSku(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");

  await prisma.sku.update({
    where: { id, companyId: company.id },
    data: {
      code: requiredString(formData, "code"),
      name: requiredString(formData, "name"),
      unit: requiredString(formData, "unit"),
      price: requiredPrice(formData, "price"),
    },
  });

  revalidatePath("/inventory");
}

export async function setSkuActive(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");
  const isActive = formData.get("isActive") === "true";

  await prisma.sku.update({
    where: { id, companyId: company.id },
    data: { isActive },
  });

  revalidatePath("/inventory");
}
