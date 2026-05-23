import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PaymentMethodType,
  PrismaClient,
  Role,
} from "../src/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://freshstack_admin:freshstack_dev_2026@localhost:5432/freshstack";

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

const seedPassword = "Admin@12345";

const companies = [
  { name: "GM Company", slug: "gm" },
  { name: "YC Company", slug: "yc" },
] as const;

const users = [
  {
    email: "admin@freshstack.cc",
    name: "Platform Admin",
    password: seedPassword,
    role: Role.platform_admin,
    companySlug: null,
  },
  {
    email: "admin@gm.freshstack.cc",
    name: "GM Admin",
    password: seedPassword,
    role: Role.company_admin,
    companySlug: "gm",
  },
  {
    email: "admin@yc.freshstack.cc",
    name: "YC Admin",
    password: seedPassword,
    role: Role.company_admin,
    companySlug: "yc",
  },
] as const;

const paymentMethods = [
  {
    type: PaymentMethodType.touch_n_go,
    name: "Touch n Go",
    enabled: true,
  },
  {
    type: PaymentMethodType.bank_transfer,
    name: "Bank Transfer",
    enabled: true,
  },
  {
    type: PaymentMethodType.cash_on_delivery,
    name: "Cash on Delivery",
    enabled: false,
  },
  {
    type: PaymentMethodType.payment_link,
    name: "Payment Link",
    enabled: false,
  },
] as const;

const inventoryLocations = [
  {
    code: "MAIN",
    name: "Main Cold Room",
  },
] as const;

const gmFruitProducts = [
  {
    code: "FRUIT-MANGO",
    name: "Mango Cup",
    description: "Fresh cut mango cup.",
    imageUrl: "/products/fruit1.jpeg",
  },
  {
    code: "FRUIT-DRAGON-BLUEBERRY",
    name: "Dragon Fruit Blueberry Cup",
    description: "Red dragon fruit with blueberries.",
    imageUrl: "/products/fruit2.jpeg",
  },
  {
    code: "FRUIT-GREEN-KIWI",
    name: "Green Kiwi Cup",
    description: "Fresh sliced green kiwi.",
    imageUrl: "/products/fruit3.jpeg",
  },
  {
    code: "FRUIT-MANGO-BLUEBERRY",
    name: "Mango Blueberry Cup",
    description: "Fresh mango with blueberries.",
    imageUrl: "/products/fruit4.jpeg",
  },
  {
    code: "FRUIT-MELON-TOMATO",
    name: "Melon Tomato Cup",
    description: "Fresh melon with cherry tomatoes.",
    imageUrl: "/products/fruit5.jpeg",
  },
  {
    code: "FRUIT-GOLDEN-KIWI",
    name: "Golden Kiwi Cup",
    description: "Fresh sliced golden kiwi.",
    imageUrl: "/products/fruit6.jpeg",
  },
  {
    code: "FRUIT-ORANGE",
    name: "Orange Cup",
    description: "Fresh orange slices.",
    imageUrl: "/products/fruit7.jpeg",
  },
  {
    code: "FRUIT-HONEYDEW",
    name: "Honeydew Cup",
    description: "Fresh honeydew cubes.",
    imageUrl: "/products/fruit8.jpeg",
  },
].map((fruit, index) => ({
  ...fruit,
  displayOrder: (index + 1) * 10,
}));

async function main() {
  const password = await bcrypt.hash(seedPassword, 10);

  for (const company of companies) {
    await prisma.company.upsert({
      where: { slug: company.slug },
      update: { name: company.name },
      create: company,
    });
  }

  for (const user of users) {
    const savedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        password,
        isActive: true,
      },
      create: {
        email: user.email,
        name: user.name,
        password,
      },
    });

    if (!user.companySlug) {
      continue;
    }

    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: user.companySlug },
    });

    await prisma.companyUser.upsert({
      where: {
        companyId_userId: {
          companyId: company.id,
          userId: savedUser.id,
        },
      },
      update: { role: user.role },
      create: {
        companyId: company.id,
        userId: savedUser.id,
        role: user.role,
      },
    });
  }

  for (const companySeed of companies) {
    const company = await prisma.company.findUniqueOrThrow({
      where: { slug: companySeed.slug },
    });

    for (const paymentMethod of paymentMethods) {
      await prisma.paymentMethod.upsert({
        where: {
          companyId_type: {
            companyId: company.id,
            type: paymentMethod.type,
          },
        },
        update: {
          name: paymentMethod.name,
          enabled: paymentMethod.enabled,
        },
        create: {
          companyId: company.id,
          type: paymentMethod.type,
          name: paymentMethod.name,
          enabled: paymentMethod.enabled,
        },
      });
    }

    for (const location of inventoryLocations) {
      await prisma.inventoryLocation.upsert({
        where: {
          companyId_code: {
            companyId: company.id,
            code: location.code,
          },
        },
        update: {
          name: location.name,
          isActive: true,
        },
        create: {
          companyId: company.id,
          code: location.code,
          name: location.name,
        },
      });
    }

    if (company.slug === "gm") {
      for (const fruit of gmFruitProducts) {
        const existingProduct = await prisma.product.findFirst({
          where: {
            companyId: company.id,
            name: fruit.name,
          },
        });

        const product = existingProduct
          ? await prisma.product.update({
              where: { id: existingProduct.id },
              data: {
                description: fruit.description,
                imageUrl: fruit.imageUrl,
                displayOrder: fruit.displayOrder,
                isActive: true,
              },
            })
          : await prisma.product.create({
              data: {
                companyId: company.id,
                name: fruit.name,
                description: fruit.description,
                imageUrl: fruit.imageUrl,
                displayOrder: fruit.displayOrder,
              },
            });

        await prisma.sku.upsert({
          where: {
            companyId_code: {
              companyId: company.id,
              code: fruit.code,
            },
          },
          update: {
            productId: product.id,
            name: fruit.name,
            unit: "cup",
            price: "8.00",
            isActive: true,
          },
          create: {
            companyId: company.id,
            productId: product.id,
            code: fruit.code,
            name: fruit.name,
            unit: "cup",
            price: "8.00",
          },
        });
      }
    }
  }

  const seededUsers = await prisma.user.findMany({
    where: {
      email: {
        in: users.map((user) => user.email),
      },
    },
    include: {
      companies: {
        include: {
          company: true,
        },
      },
    },
    orderBy: { email: "asc" },
  });

  console.log("Seed complete:");
  for (const user of seededUsers) {
    const memberships = user.companies.map(
      (membership) => `${membership.company.slug}:${membership.role}`,
    );

    console.log(
      `${user.email}\t${user.name}\t${memberships.join(", ") || "platform"}`,
    );
  }
}

main()
  .catch((error) => {
    console.error("Seed failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
