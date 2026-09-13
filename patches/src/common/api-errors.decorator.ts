/**
 * Fixes QF-09 — no authentication or rate-limit failures specified anywhere.
 *
 * Every endpoint requires `companyId` and `x-api-key`. The ERP group documents
 * 200 and 400. The card group documents only 200. No endpoint declares 401, 403
 * or 429, so a generated client gets typed handling for the one failure that
 * will not dominate production and none for the three that will.
 *
 * Applied once at the controller level. There is no per-route opt-out; every
 * authenticated endpoint has these three failure modes by construction.
 */
import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

export class ApiErrorBody {
  message!: string[];
  error!: string;
  statusCode!: number;
}

export const AuthenticatedEndpoint = () =>
  applyDecorators(
    ApiHeader({ name: 'x-api-key', required: true, description: 'API key issued by Qashio.' }),
    ApiHeader({ name: 'companyId', required: true, description: 'Company identifier.' }),
    ApiResponse({ status: 400, type: ApiErrorBody, description: 'Malformed request.' }),
    ApiResponse({ status: 401, type: ApiErrorBody, description: 'Missing or invalid API key.' }),
    ApiResponse({
      status: 403,
      type: ApiErrorBody,
      description: 'Key is valid but not authorised for the requested company.',
    }),
    ApiResponse({
      status: 429,
      type: ApiErrorBody,
      description: 'Rate limit exceeded. Retry after the number of seconds in `Retry-After`.',
      headers: {
        'Retry-After': { description: 'Seconds to wait before retrying.', schema: { type: 'integer' } },
      },
    }),
  );
