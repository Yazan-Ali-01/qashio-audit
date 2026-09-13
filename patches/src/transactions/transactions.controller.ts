/**
 * Fixes QF-19 — no lookup by the identifier the documentation designates public.
 * Fixes QF-21 — copy-paste response descriptions.
 *
 * QF-19: `qashioId` is documented as the immutable reference shown on the
 * dashboard, and `id` as internal and to be ignored — yet the detail route took
 * the internal UUID. Retrieving a record by the identifier a finance user can
 * actually see required a filtered collection call and unwrapping a
 * single-element array nested inside another array (QF-08).
 *
 * QF-21: the response description "Returns all ERP Suppliers" appears on
 * /erp-tax-rates, /erp-bank-accounts *and* /erp-transactions. "Returns a ERP
 * Supplier" appears on three detail endpoints. Individually trivial; together
 * they show the spec is generated but never reviewed, which is the same
 * mechanism that produced QF-08 and QF-09.
 */
import { Controller, Get, Param, Query, UseInterceptors } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedEndpoint } from '../common/api-errors.decorator';
import { EnvelopeShapeInterceptor } from '../common/envelope.interceptor';
import { CursorPage } from '../common/pagination';
import { QueryTransactionsDto } from './dto/query-transactions.dto';
import { TransactionResponse } from './transaction.response';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@AuthenticatedEndpoint()
@UseInterceptors(EnvelopeShapeInterceptor)
@Controller({ path: 'erp-transactions', version: '2' })
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiOperation({
    summary: 'List transactions',
    description:
      'Returns a cursor-paginated list of transactions for the company in the companyId header. ' +
      'For incremental sync, pass updatedAtFrom with the timestamp of your last successful poll; ' +
      'transaction records mutate after settlement, so clearedAt and transactionTime will not ' +
      'surface approval changes, receipt uploads or segment edits.',
  })
  @ApiOkResponse({ type: CursorPage<TransactionResponse>, description: 'A page of transactions.' })
  list(
    @Query() query: QueryTransactionsDto,
    @Query('companyId') companyId: string,
  ): Promise<CursorPage<TransactionResponse>> {
    return this.transactions.list(companyId, query);
  }

  @Get(':qashioId')
  @ApiOperation({
    summary: 'Get a transaction by its Qashio reference',
    description: 'Accepts the qashioId shown on the Qashio dashboard, not the internal UUID.',
  })
  @ApiOkResponse({ type: TransactionResponse, description: 'A single transaction.' })
  get(
    @Param('qashioId') qashioId: string,
    @Query('companyId') companyId: string,
  ): Promise<TransactionResponse> {
    return this.transactions.getByQashioId(companyId, qashioId);
  }
}
