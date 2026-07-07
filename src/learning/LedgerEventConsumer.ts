import { LedgerEvent } from '../core/ledger/LedgerEvent';
import { RouteState } from './state/RouteState';
import { RouteOutcome } from './reward/RouteOutcome';

export interface LedgerEventConsumer {
  consumeEvents(
    since: number,
    limit: number
  ): RouteState[];
  extractOutcome(event: LedgerEvent): RouteOutcome;
}
