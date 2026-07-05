export interface Proposal {
  proposal_id: string;
  submittedBy?: string;
  deltas?: any[];
  rationale?: string;
}

export class ProposalBuilder {
  private proposal: Proposal = { proposal_id: '' };

  withProposalId(id: string): this {
    this.proposal.proposal_id = id;
    return this;
  }

  withSubmittedBy(author: string): this {
    this.proposal.submittedBy = author;
    return this;
  }

  withDeltas(deltas: any[]): this {
    this.proposal.deltas = deltas;
    return this;
  }

  withRationale(rationale: string): this {
    this.proposal.rationale = rationale;
    return this;
  }

  build(): Proposal {
    return this.proposal;
  }
}
