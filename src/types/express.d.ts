import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      admin?: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        roles: UserRole[];
        sessionId: string;
      };
      csrfToken?: string;
    }
  }
}

export {};
