CREATE TYPE "user_role_new" AS ENUM ('CLIENT', 'PROVIDER', 'ADMIN', 'SUPER_ADMIN');
ALTER TABLE "users" ALTER COLUMN "roles" DROP DEFAULT;
ALTER TABLE "users"
    ALTER COLUMN "roles" TYPE "user_role_new"[]
    USING "roles"::TEXT[]::"user_role_new"[];
DROP TYPE "user_role";
ALTER TYPE "user_role_new" RENAME TO "user_role";
ALTER TABLE "users"
    ALTER COLUMN "roles" SET DEFAULT ARRAY['CLIENT']::"user_role"[];

CREATE TABLE "admin_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_sessions_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions"("token_hash");
CREATE INDEX "admin_sessions_user_id_expires_at_idx" ON "admin_sessions"("user_id", "expires_at");
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions"("expires_at");

CREATE TABLE "admin_invitations" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "invited_by_id" UUID,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "accepted_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_invitations_role_check" CHECK ("role" IN ('ADMIN', 'SUPER_ADMIN')),
    CONSTRAINT "admin_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id")
        REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_invitations_token_hash_key" ON "admin_invitations"("token_hash");
CREATE UNIQUE INDEX "admin_invitations_active_email_key"
    ON "admin_invitations"(lower("email"))
    WHERE "accepted_at" IS NULL AND "revoked_at" IS NULL;
CREATE INDEX "admin_invitations_email_accepted_at_revoked_at_expires_at_idx"
    ON "admin_invitations"("email", "accepted_at", "revoked_at", "expires_at");
CREATE INDEX "admin_invitations_invited_by_id_created_at_idx"
    ON "admin_invitations"("invited_by_id", "created_at");

CREATE TABLE "admin_password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_password_resets_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "admin_password_resets_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "admin_password_resets_token_hash_key" ON "admin_password_resets"("token_hash");
CREATE INDEX "admin_password_resets_user_id_used_at_expires_at_idx"
    ON "admin_password_resets"("user_id", "used_at", "expires_at");
CREATE INDEX "admin_password_resets_expires_at_idx" ON "admin_password_resets"("expires_at");
