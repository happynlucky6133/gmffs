import { NextResponse } from "next/server";
import { createCustomerOrderSql } from "@/services/customer-orders-sql";

export const runtime = "nodejs";

type CustomerOrderRequest = {
  companySlug?: string;
  skuCode?: string;
  quantity?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  requestedTimeSlot?: string;
  notes?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomerOrderRequest;

    const order = await createCustomerOrderSql({
      companySlug: body.companySlug ?? "",
      skuCode: body.skuCode ?? "",
      quantity: Number(body.quantity),
      customerName: body.customerName ?? "",
      customerPhone: body.customerPhone ?? "",
      customerEmail: body.customerEmail,
      deliveryAddress: body.deliveryAddress ?? "",
      requestedTimeSlot: body.requestedTimeSlot,
      notes: body.notes,
    });

    return NextResponse.json(order);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create order";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
