/**
 * Fixes QF-07 — enum values do not round-trip, and fail inconsistently.
 *
 * Today: request `transactionCategory=card_loading` returns `"Purchase"`.
 * Request `approvalStatus=pending` returns `"Pending"`.
 * But `transactionStatus=draft` returns `"draft"`.
 * The overview docs list the same category enum a third way: `CARD_LOADING`.
 *
 * Three of four break on round-trip and one works, so the failure is not
 * learnable from a single test. That is worse than uniform failure.
 *
 * Canonical wire format is lower_snake_case, everywhere, in both directions.
 * Input is matched case-insensitively so existing callers sending `Pending`
 * or `CARD_LOADING` keep working.
 */
import { BadRequestException } from '@nestjs/common';

export enum TransactionCategory {
  CardLoading = 'card_loading',
  Purchase = 'purchase',
  CardUnloading = 'card_unloading',
  Deposit = 'deposit',
  Reversal = 'reversal',
  AccountVerification = 'account_verification',
  BalanceInquiry = 'balance_inquiry',
  CashWithdrawal = 'cash_withdrawal',
  Refund = 'refund',
  ForcedDebit = 'forced_debit', // docs write this "FORCED DEBIT", with a space
  Aft = 'aft',
  AccountLoading = 'account_loading',
  Cashback = 'cashback',
  AccountUnloading = 'account_unloading',
  AccountTransfer = 'account_transfer',
}

export enum ApprovalStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export enum ErpSyncStatus {
  Pending = 'pending',
  Synced = 'synced',
  Failed = 'failed',
  Excluded = 'excluded',
}

/** `FORCED DEBIT` -> `forced_debit`; `Pending` -> `pending`; `CARD_LOADING` -> `card_loading` */
const canonical = (raw: string) => raw.trim().toLowerCase().replace(/[\s-]+/g, '_');

export function parseEnum<T extends Record<string, string>>(
  e: T,
  field: string,
  raw: string,
): T[keyof T] {
  const key = canonical(raw);
  const match = Object.values(e).find((v) => v === key);
  if (!match) {
    throw new BadRequestException(
      `${field} must be one of: ${Object.values(e).join(', ')} (received "${raw}")`,
    );
  }
  return match as T[keyof T];
}
