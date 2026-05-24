import { sqlQuery } from "@/lib/sql";

export type AdminCompany = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string;
  orderStatus: string;
  paymentStatus: string;
  allocationStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  createdAt: Date;
  items: string[];
};

export type AdminDashboard = {
  ordersToday: number;
  pendingPaymentOrders: number;
  pendingPaymentTotal: string;
  allocationFailedOrders: number;
  openProductionTasks: number;
  activeDeliveries: number;
  recentOrders: AdminOrderRow[];
  paymentQueue: AdminOrderRow[];
  productionQueue: AdminOrderRow[];
  deliveryQueue: Array<{
    id: string;
    orderId: string;
    orderNumber: string;
    customerName: string;
    status: string;
    scheduledAt: Date | null;
  }>;
};

export type AdminSelectOption = {
  id: string;
  label: string;
};

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  sourceChannel: string;
  deliveryAddress: string;
  requestedTimeSlot: string | null;
  subtotal: string;
  deliveryFee: string;
  total: string;
  orderStatus: string;
  paymentStatus: string;
  allocationStatus: string;
  fulfillmentStatus: string;
  deliveryStatus: string;
  notes: string | null;
  createdAt: Date;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  items: Array<{
    id: string;
    skuCode: string;
    skuName: string;
    productName: string;
    quantity: string;
    unitPrice: string;
    lineTotal: string;
  }>;
  reservations: Array<{
    id: string;
    locationCode: string;
    skuCode: string;
    quantity: string;
    status: string;
  }>;
  allocationAttempts: Array<{
    id: string;
    createdAt: Date;
    locationCode: string | null;
    status: string;
    reason: string | null;
  }>;
  deliveries: Array<{
    id: string;
    provider: string;
    locationCode: string | null;
    quoteAmount: string | null;
    status: string;
    latestEventType: string | null;
    latestEventNotes: string | null;
  }>;
};

export type AdminPaymentMethod = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
};

export type AdminPaymentRow = {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  methodName: string;
  amount: string;
  status: string;
  proofUrl: string | null;
  referenceNumber: string | null;
  events: Array<{
    id: string;
    type: string;
    notes: string | null;
  }>;
};

const DEFAULT_COMPANY_SLUG = process.env.DEFAULT_COMPANY_SLUG ?? "gm";

function toNumber(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function normalizeItems(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export async function getAdminCompany(): Promise<AdminCompany> {
  const result = await sqlQuery<AdminCompany>(
    `SELECT id, name, slug, domain
       FROM companies
      WHERE slug = $1
        AND status = 'active'
      LIMIT 1`,
    [DEFAULT_COMPANY_SLUG],
  );

  const company = result.rows[0];
  if (!company) {
    throw new Error("Active company is not configured");
  }

  return company;
}

async function getOrderRows(
  companyId: string,
  whereClause = "",
  values: unknown[] = [],
  limit = 50,
): Promise<AdminOrderRow[]> {
  const result = await sqlQuery<AdminOrderRow & { items: unknown }>(
    `SELECT
        o.id,
        o."orderNumber" AS "orderNumber",
        c.name AS "customerName",
        o.total::text AS total,
        o."orderStatus" AS "orderStatus",
        o."paymentStatus" AS "paymentStatus",
        o."allocationStatus" AS "allocationStatus",
        o."fulfillmentStatus" AS "fulfillmentStatus",
        o."deliveryStatus" AS "deliveryStatus",
        o."createdAt" AS "createdAt",
        COALESCE(
          array_agg(s.code ORDER BY s.code) FILTER (WHERE s.id IS NOT NULL),
          ARRAY[]::text[]
        ) AS items
       FROM orders o
       JOIN customers c ON c.id = o."customerId"
       LEFT JOIN order_items oi ON oi."orderId" = o.id
       LEFT JOIN skus s ON s.id = oi."skuId"
      WHERE o."companyId" = $1
        ${whereClause}
      GROUP BY o.id, c.name
      ORDER BY o."createdAt" DESC
      LIMIT $${values.length + 2}`,
    [companyId, ...values, limit],
  );

  return result.rows.map((row) => ({
    ...row,
    items: normalizeItems(row.items),
  }));
}

export async function getAdminDashboard(
  companyId: string,
): Promise<AdminDashboard> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [
    counts,
    recentOrders,
    paymentQueue,
    productionQueue,
    deliveryQueue,
  ] = await Promise.all([
    sqlQuery<{
      ordersToday: string;
      pendingPaymentOrders: string;
      pendingPaymentTotal: string | null;
      allocationFailedOrders: string;
      openProductionTasks: string;
      activeDeliveries: string;
    }>(
      `SELECT
        COUNT(*) FILTER (WHERE o."createdAt" >= $2)::text AS "ordersToday",
        COUNT(*) FILTER (WHERE o."paymentStatus" = 'awaiting_confirmation')::text
          AS "pendingPaymentOrders",
        COALESCE(
          SUM(o.total) FILTER (WHERE o."paymentStatus" = 'awaiting_confirmation'),
          0
        )::text AS "pendingPaymentTotal",
        COUNT(*) FILTER (WHERE o."allocationStatus" = 'failed')::text
          AS "allocationFailedOrders",
        (
          SELECT COUNT(*)::text
            FROM production_tasks pt
           WHERE pt."companyId" = $1
             AND pt.status IN ('pending', 'in_progress')
        ) AS "openProductionTasks",
        (
          SELECT COUNT(*)::text
            FROM deliveries d
           WHERE d."companyId" = $1
             AND d.status IN ('booked', 'picked_up')
        ) AS "activeDeliveries"
       FROM orders o
      WHERE o."companyId" = $1`,
      [companyId, today],
    ),
    getOrderRows(companyId, "", [], 8),
    getOrderRows(
      companyId,
      `AND o."paymentStatus" = $2`,
      ["awaiting_confirmation"],
      5,
    ),
    getOrderRows(companyId, `AND o."allocationStatus" = $2`, ["failed"], 5),
    sqlQuery<{
      id: string;
      orderId: string;
      orderNumber: string;
      customerName: string;
      status: string;
      scheduledAt: Date | null;
    }>(
      `SELECT
        d.id,
        d."orderId" AS "orderId",
        o."orderNumber" AS "orderNumber",
        c.name AS "customerName",
        d.status,
        d."scheduledAt" AS "scheduledAt"
       FROM deliveries d
       JOIN orders o ON o.id = d."orderId"
       JOIN customers c ON c.id = o."customerId"
      WHERE d."companyId" = $1
        AND d.status IN ('pending_quote', 'quoted', 'booked', 'picked_up')
      ORDER BY d."createdAt" ASC
      LIMIT 5`,
      [companyId],
    ),
  ]);

  const metrics = counts.rows[0];

  return {
    ordersToday: toNumber(metrics?.ordersToday),
    pendingPaymentOrders: toNumber(metrics?.pendingPaymentOrders),
    pendingPaymentTotal: metrics?.pendingPaymentTotal ?? "0.00",
    allocationFailedOrders: toNumber(metrics?.allocationFailedOrders),
    openProductionTasks: toNumber(metrics?.openProductionTasks),
    activeDeliveries: toNumber(metrics?.activeDeliveries),
    recentOrders,
    paymentQueue,
    productionQueue,
    deliveryQueue: deliveryQueue.rows,
  };
}

export async function getAdminOrders(companyId: string) {
  const [orders, customers, skus] = await Promise.all([
    getOrderRows(companyId, "", [], 50),
    sqlQuery<AdminSelectOption>(
      `SELECT id, CONCAT(name, COALESCE(' - ' || phone, '')) AS label
         FROM customers
        WHERE "companyId" = $1
        ORDER BY name ASC`,
      [companyId],
    ),
    sqlQuery<AdminSelectOption>(
      `SELECT s.id, CONCAT(p.name, ' / ', s.code, ' / ', s.name) AS label
         FROM skus s
         JOIN products p ON p.id = s."productId"
        WHERE s."companyId" = $1
          AND s."isActive" = true
        ORDER BY p.name ASC, s.code ASC`,
      [companyId],
    ),
  ]);

  return {
    orders,
    customers: customers.rows,
    skus: skus.rows,
  };
}

export async function getAdminOrderDetail(
  companyId: string,
  orderId: string,
): Promise<AdminOrderDetail | null> {
  const [orderResult, items, reservations, attempts, deliveries] =
    await Promise.all([
      sqlQuery<{
        id: string;
        orderNumber: string;
        sourceChannel: string;
        deliveryAddress: string;
        requestedTimeSlot: string | null;
        subtotal: string;
        deliveryFee: string;
        total: string;
        orderStatus: string;
        paymentStatus: string;
        allocationStatus: string;
        fulfillmentStatus: string;
        deliveryStatus: string;
        notes: string | null;
        createdAt: Date;
        customerName: string;
        customerPhone: string | null;
        customerEmail: string | null;
        customerAddress: string | null;
      }>(
        `SELECT
          o.id,
          o."orderNumber" AS "orderNumber",
          o."sourceChannel" AS "sourceChannel",
          o."deliveryAddress" AS "deliveryAddress",
          o."requestedTimeSlot" AS "requestedTimeSlot",
          o.subtotal::text,
          o."deliveryFee"::text AS "deliveryFee",
          o.total::text,
          o."orderStatus" AS "orderStatus",
          o."paymentStatus" AS "paymentStatus",
          o."allocationStatus" AS "allocationStatus",
          o."fulfillmentStatus" AS "fulfillmentStatus",
          o."deliveryStatus" AS "deliveryStatus",
          o.notes,
          o."createdAt" AS "createdAt",
          c.name AS "customerName",
          c.phone AS "customerPhone",
          c.email AS "customerEmail",
          c.address AS "customerAddress"
         FROM orders o
         JOIN customers c ON c.id = o."customerId"
        WHERE o.id = $1
          AND o."companyId" = $2
        LIMIT 1`,
        [orderId, companyId],
      ),
      sqlQuery<AdminOrderDetail["items"][number]>(
        `SELECT
          oi.id,
          s.code AS "skuCode",
          s.name AS "skuName",
          p.name AS "productName",
          oi.quantity::text,
          oi."unitPrice"::text AS "unitPrice",
          oi."lineTotal"::text AS "lineTotal"
         FROM order_items oi
         JOIN skus s ON s.id = oi."skuId"
         JOIN products p ON p.id = s."productId"
         JOIN orders o ON o.id = oi."orderId"
        WHERE oi."orderId" = $1
          AND o."companyId" = $2
        ORDER BY oi."createdAt" ASC`,
        [orderId, companyId],
      ),
      sqlQuery<AdminOrderDetail["reservations"][number]>(
        `SELECT
          r.id,
          l.code AS "locationCode",
          s.code AS "skuCode",
          r.quantity::text,
          r.status
         FROM inventory_reservations r
         JOIN inventory_locations l ON l.id = r."locationId"
         JOIN skus s ON s.id = r."skuId"
        WHERE r."orderId" = $1
          AND r."companyId" = $2
        ORDER BY r."createdAt" DESC`,
        [orderId, companyId],
      ),
      sqlQuery<AdminOrderDetail["allocationAttempts"][number]>(
        `SELECT
          a.id,
          a."createdAt" AS "createdAt",
          l.code AS "locationCode",
          a.status,
          a.reason
         FROM allocation_attempts a
         LEFT JOIN inventory_locations l ON l.id = a."locationId"
        WHERE a."orderId" = $1
          AND a."companyId" = $2
        ORDER BY a."createdAt" DESC
        LIMIT 5`,
        [orderId, companyId],
      ),
      sqlQuery<AdminOrderDetail["deliveries"][number]>(
        `SELECT
          d.id,
          d.provider,
          l.code AS "locationCode",
          d."quoteAmount"::text AS "quoteAmount",
          d.status,
          e.type AS "latestEventType",
          e.notes AS "latestEventNotes"
         FROM deliveries d
         LEFT JOIN inventory_locations l ON l.id = d."locationId"
         LEFT JOIN LATERAL (
           SELECT type, notes
             FROM delivery_events
            WHERE "deliveryId" = d.id
            ORDER BY "createdAt" DESC
            LIMIT 1
         ) e ON true
        WHERE d."orderId" = $1
          AND d."companyId" = $2
        ORDER BY d."createdAt" DESC`,
        [orderId, companyId],
      ),
    ]);

  const row = orderResult.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    orderNumber: row.orderNumber,
    sourceChannel: row.sourceChannel,
    deliveryAddress: row.deliveryAddress,
    requestedTimeSlot: row.requestedTimeSlot,
    subtotal: row.subtotal,
    deliveryFee: row.deliveryFee,
    total: row.total,
    orderStatus: row.orderStatus,
    paymentStatus: row.paymentStatus,
    allocationStatus: row.allocationStatus,
    fulfillmentStatus: row.fulfillmentStatus,
    deliveryStatus: row.deliveryStatus,
    notes: row.notes,
    createdAt: row.createdAt,
    customer: {
      name: row.customerName,
      phone: row.customerPhone,
      email: row.customerEmail,
      address: row.customerAddress,
    },
    items: items.rows,
    reservations: reservations.rows,
    allocationAttempts: attempts.rows,
    deliveries: deliveries.rows,
  };
}

export async function getAdminPayments(companyId: string, status?: string) {
  const [paymentMethods, payableOrders, payments] = await Promise.all([
    sqlQuery<AdminPaymentMethod>(
      `SELECT id, name, type, enabled
         FROM payment_methods
        WHERE "companyId" = $1
        ORDER BY enabled DESC, name ASC`,
      [companyId],
    ),
    sqlQuery<AdminSelectOption>(
      `SELECT
        o.id,
        CONCAT(o."orderNumber", ' / ', c.name, ' / RM ', o.total::text) AS label
       FROM orders o
       JOIN customers c ON c.id = o."customerId"
      WHERE o."companyId" = $1
        AND o."paymentStatus" <> 'paid'
      ORDER BY o."createdAt" DESC
      LIMIT 50`,
      [companyId],
    ),
    sqlQuery<AdminPaymentRow & { events: unknown }>(
      `SELECT
        p.id,
        p."orderId" AS "orderId",
        o."orderNumber" AS "orderNumber",
        c.name AS "customerName",
        pm.name AS "methodName",
        p.amount::text,
        p.status,
        p."proofUrl" AS "proofUrl",
        p."referenceNumber" AS "referenceNumber",
        COALESCE(
          json_agg(
            json_build_object(
              'id', pe.id,
              'type', pe.type,
              'notes', pe.notes
            )
            ORDER BY pe."createdAt" DESC
          ) FILTER (WHERE pe.id IS NOT NULL),
          '[]'::json
        ) AS events
       FROM payments p
       JOIN orders o ON o.id = p."orderId"
       JOIN customers c ON c.id = o."customerId"
       JOIN payment_methods pm ON pm.id = p."paymentMethodId"
       LEFT JOIN payment_events pe ON pe."paymentId" = p.id
      WHERE p."companyId" = $1
        AND ($2::text IS NULL OR p.status = $2)
      GROUP BY p.id, o."orderNumber", c.name, pm.name
      ORDER BY p."createdAt" DESC
      LIMIT 100`,
      [companyId, status ?? null],
    ),
  ]);

  return {
    paymentMethods: paymentMethods.rows,
    payableOrders: payableOrders.rows,
    payments: payments.rows.map((payment) => ({
      ...payment,
      events: Array.isArray(payment.events) ? payment.events : [],
    })),
  };
}
