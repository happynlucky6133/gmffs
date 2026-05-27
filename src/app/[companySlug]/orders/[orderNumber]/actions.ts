"use server";

import { revalidatePath } from "next/cache";
import { optionalString } from "@/lib/form";
import { submitCustomerPaymentProof } from "@/services/customer-payments";
import { savePaymentProof } from "@/services/payment-proof-storage";

export async function submitPaymentProof(
  companySlug: string,
  orderNumber: string,
  formData: FormData,
) {
  const proof = formData.get("proof");

  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Payment screenshot is required");
  }

  let proofUrl: string;
  try {
    proofUrl = await savePaymentProof(companySlug, proof);
  } catch (e) {
    throw new Error(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await submitCustomerPaymentProof({
      companySlug,
      orderNumber,
      proofUrl,
      referenceNumber: optionalString(formData, "referenceNumber"),
    });
  } catch (e) {
    throw new Error(`Payment record failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  revalidatePath(`/${companySlug}/orders/${orderNumber}`);
  revalidatePath(`/${companySlug}/track`);
}
