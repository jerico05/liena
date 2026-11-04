declare global {
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
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
