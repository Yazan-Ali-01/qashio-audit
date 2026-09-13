# Patch set — Qashio ERP API

Each file fixes findings from `findings.json` and cites them inline.
Framework confirmed from the published spec, not assumed: the 400 body
`{ message: string[], error, statusCode }` is the NestJS `ValidationPipe`
shape, `/api/docs` is the standard `@nestjs/swagger` mount, and the generated
doc URLs expose controller method names (`erptransactioncontroller_findall`).

| File | Findings |
|---|---|
| `src/common/money.ts` | QF-11 |
| `src/common/enums.ts` | QF-07 |
| `src/common/pagination.ts` | QF-04, QF-13 |
| `src/common/envelope.interceptor.ts` | QF-08 |
| `src/common/api-errors.decorator.ts` | QF-09 |
| `src/transactions/dto/query-transactions.dto.ts` | QF-03, QF-13, QF-20 |
| `src/transactions/transaction.response.ts` | QF-01, QF-02, QF-06, QF-10, QF-12 |
| `src/transactions/transactions.controller.ts` | QF-19, QF-21 |
| `src/main.ts` | QF-13 |

Not addressed here: QF-05 (line items not reconciling to the header), QF-15
(`/company/summary` has no `asOf`) and QF-17 (declines not exposed) are product
decisions, not code defects. They need an owner to state the intended
behaviour before anything is written.

## One deliberate deviation

These patches break the wire contract, so they ship as `v2` with `v1` frozen and
a published sunset date — not as a compatibility layer inside one version.

Two versions, each with exactly one correct path, is not the same thing as one
version with fallbacks. A dual-mode serializer that emits `billingAmount` only
when a flag is set is precisely the kind of branch that survives a decade and
makes the next fix harder. Customer ERP integrations are running against v1
today; silently changing the meaning of a field that becomes a ledger entry is
not acceptable, and neither is carrying both shapes forever. A dated sunset is
the only mechanism that ends.

## Verification status

`dedupeSegments`, the cursor codec and `parseEnum` are pure functions and are
unit-tested in `verify.mjs` — run it. The rest is decorator and framework
wiring that cannot be meaningfully tested outside a running Nest app with a
database, and is presented as a reviewed proposal rather than as verified code.

That distinction is the point of the exercise. The parts asserted as working
have been run.
