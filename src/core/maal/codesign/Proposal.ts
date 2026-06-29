/**
 * Phase 4: Proposal — DSL wrapper + factory.
 */

import { Proposal, ProposalDelta } from './ProposalTypes';

export class ProposalBuilder {
  private proposal: Partial<Proposal> = {};

  withId(id: string): this {
    this.proposal.proposalId = id;
    return this;
  }

  fromSPL(spid: string): this {
    this.proposal.submittedBy = spid;
    return this;
  }

  addDelta(delta: ProposalDelta): this {
    if (!this.proposal.deltas) this.proposal.deltas = [];
    this.proposal.deltas.push(delta);
    return this;
  }

  withRationale(reason: string): this {
    this.proposal.rationale = reason;
    return this;
  }

  build(): Proposal {
    if (!this.proposal.proposalId || !this.proposal.submittedBy || !this.proposal.deltas) {
      throw new Error('Incomplete proposal');
    }
    return {
      proposalId: this.proposal.proposalId,
      submittedBy: this.proposal.submittedBy,
      deltas: this.proposal.deltas,
      rationale: this.proposal.rationale || '',
      submittedAt: Date.now(),
    };
  }
}
