import { LedgerEvent } from '../../cic-os/src/core/ledger/LedgerEvent';
import { RouteState } from '../../cic-os/src/learning/state/RouteState';
import { RouteOutcome } from '../../cic-os/src/learning/reward/RouteOutcome';

export interface LedgerEventConsumer {
  consumeEvents(
    since: number,
    limit: number
  ): RouteState[];
  extractOutcome(event: LedgerEvent): RouteOutcome;
}
