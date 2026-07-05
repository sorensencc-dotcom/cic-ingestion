import { LedgerEvent } from 'src/core/ledger/LedgerEvent.js';
import { RouteState } from 'src/learning/state/RouteState.js';
import { RouteOutcome } from 'src/learning/reward/RouteOutcome.js';

export interface LedgerEventConsumer {
  consumeEvents(
    since: number,
    limit: number
  ): RouteState[];
  extractOutcome(event: LedgerEvent): RouteOutcome;
}
