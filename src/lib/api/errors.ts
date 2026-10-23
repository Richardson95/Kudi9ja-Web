import type { ApiErrorBody } from '../../types/api';

/** Why a request never came back. Each reads differently, because the
 *  customer's next move differs and the sentence on screen is the only record
 *  of a request that never reached the server. */
export type NetworkFailure = 'timeout' | 'unreachable' | 'dropped' | 'notTheApp';

const OFFLINE_MESSAGES: Record<NetworkFailure, string> = {
  timeout: 'Kudi9ja took too long to answer. Nothing was sent — try again.',
  unreachable: 'We could not reach Kudi9ja. Check your connection and try again.',
  dropped: 'The connection dropped before Kudi9ja finished. Try again.',
  notTheApp: 'Kudi9ja is starting up. Give it a moment and try again.',
};

/** A request the server refused, or one that never arrived. */
export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown>;
  readonly status?: number;

  constructor(code: string, message: string, details: Record<string, unknown> = {}, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
    this.status = status;
  }

  static offline(why: NetworkFailure, detail?: string): ApiError {
    return new ApiError('NETWORK', OFFLINE_MESSAGES[why], { why, ...(detail ? { detail } : {}) });
  }

  static fromBody(body: ApiErrorBody, status: number): ApiError {
    const message =
      typeof body.message === 'string' && body.message.trim() ? body.message : 'Something went wrong. Please try again.';
    return new ApiError(body.code || 'UNKNOWN', message, body.details ?? {}, status);
  }

  /** The session is gone and the customer has to sign in again. */
  get isAuthFailure(): boolean {
    return this.code === 'UNAUTHENTICATED' || this.code === 'TOKEN_EXPIRED' || this.code === 'TOKEN_INVALID';
  }

  /** Field-level messages from a validation failure, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const fields = this.details.fields;
    if (fields && typeof fields === 'object') {
      return Object.fromEntries(Object.entries(fields as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
    }
    return {};
  }
}

/** A message safe to put in front of a customer, whatever was thrown. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please try again.';
}
