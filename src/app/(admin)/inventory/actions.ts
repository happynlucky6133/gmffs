"use server";

import { revalidatePath } from "next/cache";
import { InventoryMovementType } from "@/generated/prisma/client";
import { getActiveCompany } from "@/lib/company";
import {
  money,
  optionalString,
  quantity,
  requiredNonNegativeNumber,
  requiredString,
} from "@/lib/form";
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

export async function createLocation(formData: FormData) {
  const company = await getActiveCompany();

  await prisma.inventoryLocation.create({
    data: {
      companyId: company.id,
      name: requiredString(formData, "name"),
      code: requiredString(formData, "code"),
      address: optionalString(formData, "address"),
    },
  });

  revalidatePath("/inventory");
}

export async function setLocationActive(formData: FormData) {
  const company = await getActiveCompany();
  const id = requiredString(formData, "id");
  const isActive = formData.get("isActive") === "true";

  await prisma.inventoryLocation.update({
    where: { id, companyId: company.id },
    data: { isActive },
  });

  revalidatePath("/inventory");
}

export async function adjustInventory(formData: FormData) {
  const company = await getActiveCompany();
  const locationId = requiredString(formData, "locationId");
  const skuId = requiredString(formData, "skuId");
  const onHand = requiredNonNegativeNumber(formData, "onHand");
  const reason = optionalString(formData, "reason") ?? "Manual stock adjustment";

  await prisma.$transaction(async (tx) => {
    await tx.inventoryLocation.findFirstOrThrow({
      where: {
        id: locationId,
        companyId: company.id,
      },
    });

    await tx.sku.findFirstOrThrow({
      where: {
        id: skuId,
        companyId: company.id,
      },
    });

    const existing = await tx.inventoryBalance.findUnique({
      where: {
        companyId_locationId_skuId: {
          companyId: company.id,
          locationId,
          skuId,
        },
      },
    });

    await tx.inventoryBalance.upsert({
      where: {
        companyId_locationId_skuId: {
          companyId: company.id,
          locationId,
          skuId,
        },
      },
      update: {
        onHand: quantity(onHand),
      },
      create: {
        companyId: company.id,
        locationId,
        skuId,
        onHand: quantity(onHand),
      },
    });

    const previous = existing ? Number(existing.onHand) : 0;
    const difference = onHand - previous;

    if (difference !== 0) {
      await tx.inventoryMovement.create({
        data: {
          companyId: company.id,
          locationId,
          skuId,
          type: InventoryMovementType.adjustment,
          quantity: quantity(difference),
          reason,
        },
      });
    }
  });

  revalidatePath("/inventory");
}
