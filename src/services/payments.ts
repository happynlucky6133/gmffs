import { prisma } from "@/lib/prisma";
import {
  OrderStatus,
  PaymentEventType,
  PaymentStatus,
} from "@/generated/prisma/client";

type CreatePaymentInput = {
  companyId: string;
  orderId: string;
  paymentMethodId: string;
  amount: string;
  proofUrl?: string | null;
  referenceNumber?: string | null;
};

type PaymentTransitionInput = {
  companyId: string;
  paymentId: string;
  notes?: string | null;
};

async function addPaymentEvent(
  tx: TransactionClient,
  companyId: string,
  paymentId: string,
  type: PaymentEventType,
  notes?: string | null,
) {
  await tx.paymentEvent.create({
    data: {
      companyId,
      paymentId,
      type,
      notes,
    },
  });
}

export async function createManualPayment(input: CreatePaymentInput) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirstOrThrow({
      where: {
        id: input.orderId,
        companyId: input.companyId,
        orderStatus: {
          not: OrderStatus.cancelled,
        },
        paymentStatus: {
          notIn: [PaymentStatus.paid, PaymentStatus.refunded],
        },
      },
    });

    const paymentMethod = await tx.paymentMethod.findFirstOrThrow({
      where: {
        id: input.paymentMethodId,
        companyId: input.companyId,
        enabled: true,
      },
    });

    const payment = await tx.payment.create({
      data: {
        companyId: input.companyId,
        orderId: order.id,
        paymentMethodId: paymentMethod.id,
        amount: input.amount,
        status: PaymentStatus.awaiting_confirmation,
        proofUrl: input.proofUrl,
        referenceNumber: input.referenceNumber,
      },
    });

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.created,
      `Payment created via ${paymentMethod.name}`,
    );

    if (input.proofUrl || input.referenceNumber) {
      await addPaymentEvent(
        tx,
        input.companyId,
        payment.id,
        PaymentEventType.proof_submitted,
        "Proof or reference recorded",
      );
    }

    if (order.paymentStatus === PaymentStatus.unpaid) {
      await tx.order.update({
        where: { id: order.id, companyId: input.companyId },
        data: { paymentStatus: PaymentStatus.awaiting_confirmation },
      });
    }

    return payment;
  });
}

export async function updatePaymentProof(input: {
  companyId: string;
  paymentId: string;
  proofUrl?: string | null;
  referenceNumber?: string | null;
}) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.findFirstOrThrow({
      where: {
        id: input.paymentId,
        companyId: input.companyId,
        status: PaymentStatus.awaiting_confirmation,
      },
    });

    const payment = await tx.payment.update({
      where: { id: input.paymentId, companyId: input.companyId },
      data: {
        proofUrl: input.proofUrl,
        referenceNumber: input.referenceNumber,
      },
    });

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.proof_submitted,
      "Proof or reference updated",
    );

    return payment;
  });
}

export async function confirmPayment(input: PaymentTransitionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.findFirstOrThrow({
      where: {
        id: input.paymentId,
        companyId: input.companyId,
        status: PaymentStatus.awaiting_confirmation,
      },
    });

    const payment = await tx.payment.update({
      where: { id: input.paymentId, companyId: input.companyId },
      data: {
        status: PaymentStatus.paid,
        confirmedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId, companyId: input.companyId },
      data: { paymentStatus: PaymentStatus.paid },
    });

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.confirmed,
      input.notes,
    );

    return payment;
  });
}

export async function failPayment(input: PaymentTransitionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.findFirstOrThrow({
      where: {
        id: input.paymentId,
        companyId: input.companyId,
        status: PaymentStatus.awaiting_confirmation,
      },
    });

    const payment = await tx.payment.update({
      where: { id: input.paymentId, companyId: input.companyId },
      data: {
        status: PaymentStatus.failed,
        failedAt: new Date(),
      },
    });

    const paidPayment = await tx.payment.findFirst({
      where: {
        companyId: input.companyId,
        orderId: payment.orderId,
        status: PaymentStatus.paid,
      },
    });
    const awaitingPayment = await tx.payment.findFirst({
      where: {
        companyId: input.companyId,
        orderId: payment.orderId,
        status: PaymentStatus.awaiting_confirmation,
      },
    });

    if (!paidPayment) {
      await tx.order.update({
        where: { id: payment.orderId, companyId: input.companyId },
        data: {
          paymentStatus: awaitingPayment
            ? PaymentStatus.awaiting_confirmation
            : PaymentStatus.failed,
        },
      });
    }

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.failed,
      input.notes,
    );

    return payment;
  });
}

export async function markRefundRequired(input: PaymentTransitionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.findFirstOrThrow({
      where: {
        id: input.paymentId,
        companyId: input.companyId,
        status: PaymentStatus.paid,
      },
    });

    const payment = await tx.payment.update({
      where: { id: input.paymentId, companyId: input.companyId },
      data: { status: PaymentStatus.refund_required },
    });

    await tx.order.update({
      where: { id: payment.orderId, companyId: input.companyId },
      data: { paymentStatus: PaymentStatus.refund_required },
    });

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.refund_required,
      input.notes,
    );

    return payment;
  });
}

export async function markRefunded(input: PaymentTransitionInput) {
  return prisma.$transaction(async (tx) => {
    await tx.payment.findFirstOrThrow({
      where: {
        id: input.paymentId,
        companyId: input.companyId,
        status: PaymentStatus.refund_required,
      },
    });

    const payment = await tx.payment.update({
      where: { id: input.paymentId, companyId: input.companyId },
      data: {
        status: PaymentStatus.refunded,
        refundedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId, companyId: input.companyId },
      data: { paymentStatus: PaymentStatus.refunded },
    });

    await addPaymentEvent(
      tx,
      input.companyId,
      payment.id,
      PaymentEventType.refunded,
      input.notes,
    );

    return payment;
  });
}

type TransactionClient = Parameters<
  Parameters<typeof prisma.$transaction>[0]
>[0];
