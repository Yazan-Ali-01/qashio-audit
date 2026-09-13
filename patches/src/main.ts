/**
 * Fixes QF-13 — pagination parameter names differ between endpoint groups,
 *               and unknown query parameters are silently ignored.
 *
 * Today the ERP group takes `limit` and the card group takes `pageSize`.
 * Sending the wrong one does not error; it is ignored and the endpoint returns
 * its default page size. The bug surfaces as missing data rather than a failed
 * request, which is the worst possible failure mode for a sync job.
 *
 * `forbidNonWhitelisted` turns that silent truncation into a 400.
 */
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.Uri, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true, // QF-13: reject unknown params instead of ignoring them
      transform: true,
      transformOptions: { enableImplicitConversion: false }, // QF-20: explicit @Type only
      forbidUnknownValues: true,
    }),
  );

  await app.listen(3000);
}
void bootstrap();
