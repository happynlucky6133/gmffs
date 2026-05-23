"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { optionalString } from "@/lib/form";
import { submitCustomerPaymentProof } from "@/services/customer-payments";

const maxProofSize = 8 * 1024 * 1024;
const allowedProofTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function submitPaymentProof(
  companySlug: string,
  orderNumber: string,
  formData: FormData,
) {
  const proof = formData.get("proof");

  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Payment screenshot is required");
  }

  const extension = allowedProofTypes.get(proof.type);

  if (!extension) {
    throw new Error("Payment screenshot must be JPG, PNG, or WebP");
  }

  if (proof.size > maxProofSize) {
    throw new Error("Payment screenshot must be smaller than 8MB");
  }

  const proofUrl = await savePaymentProof(companySlug, proof, extension);
  await submitCustomerPaymentProof({
    companySlug,
    orderNumber,
    proofUrl,
    referenceNumber: optionalString(formData, "referenceNumber"),
  });

  revalidatePath(`/${companySlug}/orders/${orderNumber}`);
  revalidatePath(`/${companySlug}/track`);
}

async function savePaymentProof(
  companySlug: string,
  proof: File,
  extension: string,
) {
  const safeCompanySlug = companySlug.trim().replaceAll(/[^a-z0-9-]/gi, "-");
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "payment-proofs",
    safeCompanySlug,
  );
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;

  await mkdir(uploadDir, { recursive: true });
  await writeFile(
    path.join(uploadDir, filename),
    Buffer.from(await proof.arrayBuffer()),
  );

  return `/uploads/payment-proofs/${safeCompanySlug}/${filename}`;
}
