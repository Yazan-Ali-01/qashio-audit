/**
 * Fixes QF-01 — integration guidance mandates two fields the API never returns.
 * Fixes QF-02 — two undocumented amount fields with different values.
 * Fixes QF-06 — `segments` already contains custom segments; `customSegments`
 *               repeats them.
 * Fixes QF-10 — `feeCharges` carries no currency and no inclusion semantics.
 * Fixes QF-12 — redundant identity and state pairs.
 *
 * ============================================================================
 * THIS FILE IS A PROPOSAL. It describes what the response SHOULD look like.
 * It is NOT a description of Qashio's current schema. Do not read the field
 * names or semantics below as documentation of existing behaviour.
 * ============================================================================
 *
 * QF-01 is the headline. The overview's Integration-Critical Notes state, in
 * bold, that `billingCurrency` should be used for all integrations because it
 * represents the actual card account currency charged, and that `billingAmount`
 * is the amount initially authorized.
 *
 * Neither field appears in the published response example. `billingCurrency` is
 * at least an accepted query filter, so a card-account currency concept exists
 * server-side. `billingAmount` appears nowhere in the API surface at all: not
 * returned, not filterable, while `transactionAmount` and `vatAmount` both have
 * From/To range filters.
 *
 * The assignment of meaning below (billingAmount = charged to card account,
 * transactionAmount = merchant currency) is the mapping I am PROPOSING. Qashio
 * has not published semantics for `amount` vs `transactionAmount`, and I have
 * not inferred them. See open question QF-Q03.
 *
 * QF-02: what you get instead is `amount: 102` / `currency: "USD"` alongside
 * `transactionAmount: 102.5` / `transactionCurrency: "USD"`. Same currency,
 * different values, neither documented, no rule for which is authoritative.
 * That is the number that becomes a general ledger entry.
 *
 * Proposed resolution: two explicitly named money pairs, both always present,
 * with semantics stated in the schema rather than in a separate prose guide.
 */
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { MoneyString, SerializeMoney } from '../common/money';

export class Segment {
  @ApiProperty() name!: string;
  @ApiProperty() label!: string;
  @ApiPropertyOptional({ nullable: true }) code!: string | null;
  /** was `erp_internal_id` — snake_case inside otherwise camelCase objects (QF-21) */
  @ApiPropertyOptional({ nullable: true }) erpInternalId!: string | null;
  @ApiProperty({ description: 'True when this is a company-defined segment.' })
  isCustom!: boolean;
}

export class TransactionResponse {
  @ApiProperty({ description: 'Immutable public reference. Shown on the Qashio dashboard.' })
  qashioId!: string;

  @ApiProperty({ nullable: true, description: 'Public reference of the parent transaction, for reversals and refunds.' })
  parentQashioId!: string | null;

  /** QF-12: `id` was documented as "Internal to Qashio — Ignore for Integrations", yet
   *  `parentId` (a GUID referencing `id`) was the only documented reversal linkage.
   *  Integrators could not join reversals to purchases using public fields alone.
   *  The internal UUID is now excluded and `parentQashioId` is the linkage. */
  @Exclude() id!: string;
  @Exclude() parentId!: string | null;

  // ---- Money. QF-01, QF-02 ----
  @ApiProperty({ type: String, description: 'Amount in the currency the transaction was made in.' })
  @SerializeMoney()
  transactionAmount!: MoneyString;

  @ApiProperty({ example: 'USD' })
  transactionCurrency!: string;

  @ApiProperty({ type: String, description: 'Amount charged to the card account. Post this to the ledger.' })
  @SerializeMoney()
  billingAmount!: MoneyString;

  @ApiProperty({ example: 'AED', description: 'Card account currency. Post this to the ledger.' })
  billingCurrency!: string;

  @ApiProperty({ type: String, nullable: true, description: 'FX and cross-border fees. Additional to billingAmount, not included in it.' })
  @SerializeMoney()
  feeAmount!: MoneyString | null;

  /** QF-10: `feeCharges: 2.75` was returned with no currency and no inclusion rule.
   *  On cross-border spend this is the FX markup; getting it wrong misstates both
   *  expense and recoverable VAT. */
  @ApiProperty({ nullable: true, description: 'Currency of feeAmount. Always the card account currency.' })
  feeCurrency!: string | null;

  @ApiProperty({ type: String, nullable: true })
  @SerializeMoney()
  vatAmount!: MoneyString | null;

  // ---- Lifecycle. QF-12: one timestamp per event, one status per concept ----
  @ApiProperty({ description: 'When the transaction was authorised.' })
  transactionTime!: string;

  @ApiProperty({ nullable: true, description: 'When the transaction cleared. Null while still authorised.' })
  clearedAt!: string | null;

  @ApiProperty({ description: 'When this record was last modified. Use with updatedAtFrom for delta sync.' })
  updatedAt!: string;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected'] })
  approvalStatus!: string;

  @ApiProperty({ enum: ['pending', 'synced', 'failed', 'excluded'] })
  erpSyncStatus!: string;

  @ApiProperty({ description: 'Excluded from ERP sync by an admin or automation rule.' })
  excludeFromSync!: boolean;

  /** QF-06: the old `segments` array already contained entries labelled
   *  "CustomSegment-Vender" and "CustomSegment-Customer", and `customSegments`
   *  then repeated one of them. The field naming invited concatenating both,
   *  which double-counted every custom segment — duplicated GL dimensions on
   *  line-level allocation. One array now, with `isCustom` as the discriminator. */
  @ApiProperty({ type: Segment, isArray: true })
  @Transform(({ value }) => dedupeSegments(value), { toPlainOnly: true })
  segments!: Segment[];

  @ApiProperty({ type: String, isArray: true, description: 'Time-limited signed URLs. Expire 15 minutes after issue.' })
  receipts!: string[];
}

/** Belt and braces for QF-06: if both sources are ever merged upstream again,
 *  identity is (label, name, code) and the duplicate is dropped rather than doubled. */
export function dedupeSegments(segments: Segment[]): Segment[] {
  const seen = new Set<string>();
  return segments.filter((s) => {
    const key = `${s.label}\u0000${s.name}\u0000${s.code ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
