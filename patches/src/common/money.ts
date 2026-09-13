/**
 * Fixes QF-11 — monetary values serialized as bare JSON numbers.
 *
 * The spec types amounts as Decimal, then serializes them unquoted (102, 102.5,
 * 2.75). JSON has no decimal type, so every value typed Decimal server-side
 * arrives as an IEEE-754 double client-side. Any integrator summing a page of
 * transactions accumulates binary floating point error against a ledger.
 *
 * Money leaves this service as a string. Always. There is no numeric path.
 */
import { Transform } from 'class-transformer';

export type MoneyString = string;

/** Decimal columns arrive from TypeORM as string already; never let them become numbers. */
export const SerializeMoney = () =>
  Transform(({ value }) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value;
    // A number here means a Decimal column was mapped to float somewhere upstream.
    // Fail loudly rather than silently shipping a lossy value to a general ledger.
    throw new Error(
      `Monetary value reached serialization as ${typeof value}. ` +
        `Decimal columns must be mapped to string. Value: ${String(value)}`,
    );
  }, { toPlainOnly: true });
