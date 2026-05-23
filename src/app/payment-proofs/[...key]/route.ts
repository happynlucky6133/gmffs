import { notFound } from "next/navigation";
import { getPaymentProof } from "@/services/payment-proof-storage";

export const dynamic = "force-dynamic";

type PaymentProofRouteProps = {
  params: Promise<{
    key: string[];
  }>;
};

export async function GET(_request: Request, { params }: PaymentProofRouteProps) {
  const { key } = await params;
  const response = await getPaymentProof(key.join("/"));

  if (!response) {
    notFound();
  }

  return response;
}
