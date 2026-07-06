/**
 * Search types for TorqueQuery integration
 */

export interface SearchResult {
  id: string;
  score: number;
  source_type: 'memory_packet' | 'governance_decision' | 'policy_rail' | 'evidence_packet';
  source_id: string;
  matched_content: string;
  indexed_fields?: {
    phase_id?: string;
    agent_id?: string;
    timestamp?: number;
    confidence?: number;
    severity?: string;
    source_phase?: string;
    tags?: string[];
  };
  timestamp?: number;
  url_reference?: string;
}

export interface CounterfactualAnalysis {
  primary_match?: string | null;
  alternative_outcomes: Array<{
    decision_id: string;
    outcome: string;
    reasoning: string;
  }>;
  applicable_precedents: number;
  decision_details?: any;
}

export interface CICQueryResponse {
  query_id: string;
  query_text: string;
  matching_decisions: SearchResult[];
  counterfactual_analysis: CounterfactualAnalysis;
  took_ms: number;
}
