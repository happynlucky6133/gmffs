"use server";

import { revalidatePath } from "next/cache";
import { getActiveCompany } from "@/lib/company";
import {
  optionalString,
  requiredPositiveNumber,
  requiredString,
} from "@/lib/form";
import {
  cancelProductionTask,
  completeProductionTask,
  createManualProductionTask,
  createProductionTasksForOrder,
  startProductionTask,
} from "@/services/production";

export async function createTasksForOrder(formData: FormData) {
  const company = await getActiveCompany();

  await createProductionTasksForOrder({
    companyId: company.id,
    orderId: requiredString(formData, "orderId"),
    locationId: requiredString(formData, "locationId"),
    notes: optionalString(formData, "notes"),
  });

  revalidateProductionPages();
}

export async function createManualTask(formData: FormData) {
  const company = await getActiveCompany();

  await createManualProductionTask({
    companyId: company.id,
    locationId: requiredString(formData, "locationId"),
    skuId: requiredString(formData, "skuId"),
    taskQuantity: requiredPositiveNumber(formData, "quantity"),
    notes: optionalString(formData, "notes"),
  });

  revalidateProductionPages();
}

export async function startTask(formData: FormData) {
  const company = await getActiveCompany();

  await startProductionTask(company.id, requiredString(formData, "id"));

  revalidateProductionPages();
}

export async function completeTask(formData: FormData) {
  const company = await getActiveCompany();

  const task = await completeProductionTask(
    company.id,
    requiredString(formData, "id"),
  );

  revalidateProductionPages(task.orderId);
}

export async function cancelTask(formData: FormData) {
  const company = await getActiveCompany();

  await cancelProductionTask(company.id, requiredString(formData, "id"));

  revalidateProductionPages();
}

function revalidateProductionPages(orderId?: string | null) {
  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/orders");

  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
  }
}
