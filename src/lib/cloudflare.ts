type CloudflareContext = {
  env?: {
    PAYMENT_PROOFS?: {
      put: (
        key: string,
        value: ArrayBuffer,
        options?: { httpMetadata?: { contentType?: string } },
      ) => Promise<unknown>;
      get: (key: string) => Promise<{
        body: ReadableStream | null;
        httpMetadata?: { contentType?: string };
      } | null>;
    };
  };
};

export async function getCloudflareContextSafe() {
  try {
    const cloudflare = await import("@opennextjs/cloudflare");
    return cloudflare.getCloudflareContext() as CloudflareContext;
  } catch {
    return null;
  }
}
