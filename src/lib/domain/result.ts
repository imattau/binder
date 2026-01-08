import type { AppError } from './errors';

export type Result<T> = 
  | { ok: true; value: T }
  | { ok: false; error: AppError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T>(error: AppError): Result<T> => ({ ok: false, error });
