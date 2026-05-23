import {
  CompanyStatus,
  PaymentMethodType,
  PaymentStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createManualPayment, updatePaymentProof } from "@/services/payments";

type SubmitCustomerPaymentProofInput = {
  companySlug: string;
  orderNumber: string;
  proofUrl: string;
  referenceNumber?: string | null;
};

export async function submitCustomerPaymentProof(
  input: SubmitCustomerPaymentProofInput,
) {
  const company = await prisma.company.findFirstOrThrow({
    where: {
      slug: input.companySlug,
      status: CompanyStatus.active,
    },
  });

  const order = await prisma.order.findFirstOrThrow({
    where: {
      companyId: company.id,
      orderNumber: input.orderNumber,
      paymentStatus: {
        notIn: [PaymentStatus.paid, PaymentStatus.refunded],
      },
    },
    include: {
      payments: {
        where: {
          status: PaymentStatus.awaiting_confirmation,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const paymentMethod = await prisma.paymentMethod.findFirstOrThrow({
    where: {
      companyId: company.id,
      enabled: true,
      type: PaymentMethodType.touch_n_go,
    },
  });

  const existingPayment = order.payments[0];

  if (existingPayment) {
    return updatePaymentProof({
      companyId: company.id,
      paymentId: existingPayment.id,
      proofUrl: input.proofUrl,
      referenceNumber: input.referenceNumber,
    });
  }

  return createManualPayment({
    companyId: company.id,
    orderId: order.id,
    paymentMethodId: paymentMethod.id,
    amount: order.total.toString(),
    proofUrl: input.proofUrl,
    referenceNumber: input.referenceNumber,
  });
}
