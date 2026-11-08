-- Align the PostgreSQL enum with the existing Prisma UserRole model.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
