import { notFound } from "next/navigation";
import { DemoOrderForm } from "@/components/customer/DemoOrderForm";

export const dynamic = "force-dynamic";

type CustomerOrderPageProps = {
  params: Promise<{
    companySlug: string;
  }>;
};

export default async function CustomerOrderPage({
  params,
}: CustomerOrderPageProps) {
  const { companySlug } = await params;
  if (companySlug !== "gm") notFound();

  return <DemoOrderForm />;
}
