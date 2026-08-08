import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';

import { UnprocessableEntity } from '../lib/errors.js';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/** Validate request parts against Zod schemas; stash parsed values on req.valid. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.valid = {};
    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(UnprocessableEntity('Validation failed', result.error.flatten()));
      }
      req.valid[part] = result.data;
    }
    next();
  };
}

/** Typed accessor for validated body/query/params. */
export const vbody = <T>(req: Request): T => req.valid?.body as T;
export const vquery = <T>(req: Request): T => req.valid?.query as T;
export const vparams = <T>(req: Request): T => req.valid?.params as T;
