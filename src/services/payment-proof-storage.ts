import { randomUUID } from "node:crypto";
import { getCloudflareContextSafe } from "@/lib/cloudflare";

const maxProofSize = 8 * 1024 * 1024;
const allowedProofTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export async function savePaymentProof(companySlug: string, proof: File) {
  if (proof.size === 0) {
    throw new Error("Payment screenshot is required");
  }

  const extension = allowedProofTypes.get(proof.type);

  if (!extension) {
    throw new Error("Payment screenshot must be JPG, PNG, or WebP");
  }

  if (proof.size > maxProofSize) {
    throw new Error("Payment screenshot must be smaller than 8MB");
  }

  const safeCompanySlug = companySlug.trim().replaceAll(/[^a-z0-9-]/gi, "-");
  const filename = `${Date.now()}-${randomUUID()}.${extension}`;
  const key = `${safeCompanySlug}/${filename}`;
  const bytes = await proof.arrayBuffer();
  const cloudflare = await getCloudflareContextSafe();

  if (cloudflare?.env?.PAYMENT_PROOFS) {
    await cloudflare.env.PAYMENT_PROOFS.put(key, bytes, {
      httpMetadata: { contentType: proof.type },
    });

    return `/payment-proofs/${key}`;
  }

  // Fallback to local filesystem (development only)
  const { mkdir, writeFile } = await import("node:fs/promises");
  const { default: nodePath } = await import("node:path");
  const uploadDir = nodePath.join(
    process.cwd(),
    "public",
    "uploads",
    "payment-proofs",
    safeCompanySlug,
  );

  await mkdir(uploadDir, { recursive: true });
  await writeFile(nodePath.join(uploadDir, filename), Buffer.from(bytes));

  return `/uploads/payment-proofs/${key}`;
}

export async function getPaymentProof(key: string) {
  const cloudflare = await getCloudflareContextSafe();
  const object = await cloudflare?.env?.PAYMENT_PROOFS?.get(key);

  if (!object?.body) {
    return null;
  }

  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=300",
    },
  });
}
