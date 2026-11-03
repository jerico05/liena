import {
  UserRole,
  UserStatus,
  ProviderStatus,
  ServiceStatus,
} from '@prisma/client';
import { prisma } from './src/lib/prisma';

const suffix = crypto.randomUUID().slice(0, 8);
const email = `provider-test-${suffix}@example.test`;
const slug = `prestataire-test-${suffix}`;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, slug: true },
    });

    if (!category) {
      throw new Error('Aucune catégorie active trouvée dans la base locale.');
    }

    const user = await tx.user.create({
      data: {
        firstName: 'Prestataire',
        lastName: 'Test',
        email,
        passwordHash: '$2b$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        roles: [UserRole.PROVIDER],
        status: UserStatus.ACTIVE,
      },
    });

    const providerProfile = await tx.providerProfile.create({
      data: {
        userId: user.id,
        businessName: 'Prestataire Test Liena',
        slug,
        description: 'Profil créé pour tester la route publique des prestataires.',
        status: ProviderStatus.VERIFIED,
        verifiedAt: new Date(),
        countryCode: 'TG',
        city: 'Lomé',
        neighborhood: 'Test',
        timeZone: 'Africa/Lome',
      },
    });

    const service = await tx.service.create({
      data: {
        providerProfileId: providerProfile.id,
        categoryId: category.id,
        title: 'Service test prestataire',
        slug: `service-test-${suffix}`,
        description: 'Service publié pour tester la route publique du prestataire.',
        pricingType: 'FIXED',
        price: '12000.00',
        currency: 'XOF',
        status: ServiceStatus.PUBLISHED,
        countryCode: 'TG',
        city: 'Lomé',
        neighborhood: 'Test',
        isRemote: false,
      },
    });

    return {
      email,
      slug,
      userId: user.id,
      providerProfileId: providerProfile.id,
      serviceId: service.id,
      categoryId: category.id,
      categoryName: category.name,
      categorySlug: category.slug,
      postmanUrl: `/api/v1/providers/${slug}`,
    };
  });

  console.log(
    JSON.stringify(
      {
        email: result.email,
        providerSlug: result.slug,
        postmanUrl: result.postmanUrl,
        userId: result.userId,
        providerProfileId: result.providerProfileId,
        serviceId: result.serviceId,
        categoryId: result.categoryId,
        categoryName: result.categoryName,
        categorySlug: result.categorySlug,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('ERREUR:', error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
