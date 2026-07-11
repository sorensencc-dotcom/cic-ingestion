export interface Proposal {
  proposal_id: string;
  source_entry_id: string;
  profile: string;
  lane: string;
  orchestration_cost: number;
  created_at: string;
  version: string;
}

export interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export class ProposalValidator {
  validate(proposal: Proposal): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!proposal.proposal_id) errors.push('Missing proposal_id');
    if (!proposal.source_entry_id) errors.push('Missing source_entry_id');
    if (!proposal.profile) errors.push('Missing profile');
    if (!proposal.lane) errors.push('Missing lane');

    // Check constraints
    if (proposal.orchestration_cost < 0) {
      errors.push('Negative cost not allowed');
    }
    if (proposal.orchestration_cost > 1.0) {
      warnings.push('High cost detected (>$1.00)');
    }

    // Check profile validity
    const validProfiles = [
      'filesystem',
      'api:familysearch',
      'api:generic',
      'images',
      'pdf',
    ];
    if (!validProfiles.includes(proposal.profile)) {
      errors.push(`Invalid profile: ${proposal.profile}`);
    }

    // Check lane validity
    const validLanes = ['fast', 'deep', 'quarantine'];
    if (!validLanes.includes(proposal.lane)) {
      errors.push(`Invalid lane: ${proposal.lane}`);
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings,
    };
  }
}
