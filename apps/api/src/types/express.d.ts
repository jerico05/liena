declare global {
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
      user?: {
        yeriaSub: string;
        audience: string;
        issuer: string;
        expiresAt: number;
        issuedAt?: number;
        keyId?: string;
      };
    }

    interface Locals {
      requestId: string;
      admin?: {
        username: string;
        sessionId: string;
      };
    }
  }
}

export {};
