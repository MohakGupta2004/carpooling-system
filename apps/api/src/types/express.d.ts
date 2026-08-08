import 'express';

declare global {
  namespace Express {
    interface AuthUser {
      id: string;
      organizationId: string;
      email: string;
    }
    interface Request {
      user?: AuthUser;
      /** validated payloads populated by validate() middleware */
      valid?: { body?: unknown; query?: unknown; params?: unknown };
    }
  }
}

export {};
