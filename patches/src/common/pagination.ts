/**
 * Fixes QF-04 — offset pagination over a mutating collection.
 * Fixes QF-13 — `limit` on the ERP group, `pageSize` on the card group.
 *
 * Offset pagination assumes a stable collection. At the documented 30 req/min
 * and 500 rows/page, a 100k-transaction company needs ~200 sequential requests,
 * roughly seven minutes, during which inserts shift the offset window and rows
 * are silently skipped or duplicated.
 *
 * Keyset pagination on (updatedAt, id). The cursor is opaque to the client so
 * the underlying key can change without breaking callers.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export interface CursorKey {
  updatedAt: string;
  id: string;
}

export const encodeCursor = (k: CursorKey): string =>
  Buffer.from(JSON.stringify(k), 'utf8').toString('base64url');

export const decodeCursor = (raw: string): CursorKey => {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed.updatedAt || !parsed.id) throw new Error('incomplete');
    return parsed;
  } catch {
    throw new BadRequestException('cursor is not a valid pagination cursor');
  }
};

export class CursorPageQuery {
  @ApiPropertyOptional({
    description: 'Opaque cursor from the previous response. Omit for the first page.',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 100, maximum: 500, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit = 100;
}

export class CursorPage<T> {
  @ApiProperty({ isArray: true })
  data!: T[];

  @ApiProperty({
    nullable: true,
    description: 'Pass as `cursor` to fetch the next page. Null when exhausted.',
  })
  nextCursor!: string | null;
}
