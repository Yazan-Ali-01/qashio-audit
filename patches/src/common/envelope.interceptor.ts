/**
 * Fixes QF-08 — two different response envelope shapes across one API.
 *
 * The ERP group returns the envelope wrapped in an array:
 *   [{ page, totalPages, total, data: [...] }]
 * The card group returns it bare:
 *   { page, totalPages, total, data: [...] }
 *
 * A client must write `response[0].data` for one half of the API and
 * `response.data` for the other, with nothing in the path or tag to signal
 * which applies. The array wrapper around a single object is almost certainly
 * a `findAndCount` tuple leaking through a serializer, and it is now part of
 * the published contract.
 *
 * This interceptor asserts the shape rather than repairing it. Repairing would
 * hide the bug in the layer that produced it.
 */
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, map } from 'rxjs';

@Injectable()
export class EnvelopeShapeInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (Array.isArray(body)) {
          throw new InternalServerErrorException(
            'Collection handler returned an array at the top level. ' +
              'Return the envelope object directly — a findAndCount tuple has leaked.',
          );
        }
        return body;
      }),
    );
  }
}
