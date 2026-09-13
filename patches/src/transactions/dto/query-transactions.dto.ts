/**
 * Fixes QF-03 — the only endpoint whose records mutate is the only one without
 *               delta-sync filters.
 * Fixes QF-20 — boolean filters declared as strings.
 * Supports QF-13 — one pagination convention, inherited from CursorPageQuery.
 *
 * QF-03 in full: chart-of-accounts, suppliers, tax-rates and bank-accounts all
 * accept updatedAtFrom/updatedAtTo. That is master data; it barely changes.
 * Transactions accept clearedAtFrom/To and transactionTimeFrom/To — both
 * timestamps of when the *money* moved — but neither updatedAt filter, even
 * though the response returns updatedAt *and* modifiedDate.
 *
 * So the four endpoints that rarely change support incremental sync, and the
 * one that changes hourly (approvals complete, receipts attach, memos and
 * segments are edited, erpSyncStatus advances) forces a full re-scan.
 */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsISO4217CurrencyCode, IsISO8601, IsOptional, IsString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { CursorPageQuery } from '../../common/pagination';
import { ApprovalStatus, ErpSyncStatus, TransactionCategory, parseEnum } from '../../common/enums';

/** `?excludeFromSync=false` arrives as the string "false", which is truthy. */
const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    const v = String(value).toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
    return value; // let @IsBoolean produce the 400
  });

export class QueryTransactionsDto extends CursorPageQuery {
  @ApiPropertyOptional({
    description:
      'Returns transactions modified at or after this instant. This is the delta-sync filter: ' +
      'transaction records mutate after settlement as approvals complete and receipts attach, ' +
      'so clearedAt and transactionTime cannot detect those changes.',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAtFrom?: string;

  @ApiPropertyOptional({ example: '2026-09-13T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601({ strict: true })
  updatedAtTo?: string;

  @ApiPropertyOptional({ enum: TransactionCategory })
  @IsOptional()
  @Transform(({ value }) => parseEnum(TransactionCategory, 'transactionCategory', value))
  transactionCategory?: TransactionCategory;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @Transform(({ value }) => parseEnum(ApprovalStatus, 'approvalStatus', value))
  approvalStatus?: ApprovalStatus;

  @ApiPropertyOptional({ enum: ErpSyncStatus })
  @IsOptional()
  @Transform(({ value }) => parseEnum(ErpSyncStatus, 'erpSyncStatus', value))
  erpSyncStatus?: ErpSyncStatus;

  @ApiPropertyOptional({ description: 'Immutable public transaction reference.', example: 'CTp7y9e4iyfmu6kx' })
  @IsOptional()
  @IsString()
  qashioId?: string;

  @ApiPropertyOptional({ example: 'CTp7y9e4iyfmu6kx' })
  @IsOptional()
  @IsString()
  parentQashioId?: string;

  @ApiPropertyOptional({ type: Boolean, example: false })
  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  excludeFromSync?: boolean;

  @ApiPropertyOptional({ example: 'holder@example.com' })
  @IsOptional()
  @IsEmail()
  cardHolderEmail?: string;

  @ApiPropertyOptional({ example: 'AED', description: 'Card account currency.' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  billingCurrency?: string;

  @ApiPropertyOptional({ example: 'USD', description: 'Currency the transaction was made in.' })
  @IsOptional()
  @IsISO4217CurrencyCode()
  transactionCurrency?: string;

  @ApiPropertyOptional({ example: '0002' })
  @IsOptional()
  @IsString()
  @Type(() => String)
  cardLastFour?: string;
}
