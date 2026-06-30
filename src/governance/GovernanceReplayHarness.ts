import { Pool } from 'pg';

export interface GovernanceTimelineEvent {
  event_id: string;
  event_type: string;
  occurred_at: Date;
  metadata: any;
}

export interface GovernanceReplayResult {
  proposal_id: string;
  events: GovernanceTimelineEvent[];
  total_events: number;
  lineage_depth: number;
}

export class GovernanceReplayHarness {
  constructor(private readonly pool: Pool) {}

  async replayProposal(proposalId: string): Promise<GovernanceReplayResult | null> {
    const { rows: events } = await this.pool.query(
      `SELECT event_id, event_type, occurred_at, metadata
       FROM lineage_events
       WHERE proposal_id = $1
       ORDER BY occurred_at ASC`,
      [proposalId]
    );

    if (!events.length) {
      return null;
    }

    const timeline: GovernanceTimelineEvent[] = events.map(e => ({
      event_id: e.event_id,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      metadata: e.metadata
    }));

    return {
      proposal_id: proposalId,
      events: timeline,
      total_events: timeline.length,
      lineage_depth: timeline.length
    };
  }

  async replayChainFrom(eventId: string): Promise<GovernanceTimelineEvent[]> {
    const { rows } = await this.pool.query(
      `WITH RECURSIVE chain AS (
         SELECT le.to_event_id
         FROM lineage_edges le
         WHERE le.from_event_id = $1
         UNION ALL
         SELECT le2.to_event_id
         FROM lineage_edges le2
         JOIN chain c ON le2.from_event_id = c.to_event_id
       )
       SELECT e.event_id, e.event_type, e.occurred_at, e.metadata
       FROM lineage_events e
       WHERE e.event_id IN (
         SELECT $1::UUID
         UNION
         SELECT to_event_id FROM chain
       )
       ORDER BY occurred_at ASC`,
      [eventId]
    );

    return rows.map(e => ({
      event_id: e.event_id,
      event_type: e.event_type,
      occurred_at: e.occurred_at,
      metadata: e.metadata
    }));
  }

  async replayTimelineRange(
    startDate: Date,
    endDate: Date
  ): Promise<Map<string, GovernanceTimelineEvent[]>> {
    const { rows } = await this.pool.query(
      `SELECT proposal_id, event_id, event_type, occurred_at, metadata
       FROM lineage_events
       WHERE occurred_at >= $1 AND occurred_at <= $2
       ORDER BY proposal_id, occurred_at ASC`,
      [startDate, endDate]
    );

    const timelines = new Map<string, GovernanceTimelineEvent[]>();

    for (const row of rows) {
      if (!timelines.has(row.proposal_id)) {
        timelines.set(row.proposal_id, []);
      }

      timelines.get(row.proposal_id)!.push({
        event_id: row.event_id,
        event_type: row.event_type,
        occurred_at: row.occurred_at,
        metadata: row.metadata
      });
    }

    return timelines;
  }
}
