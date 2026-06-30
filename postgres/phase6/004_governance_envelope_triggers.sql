-- Phase 6: governance_envelope triggers — log all adaptive updates to audit_log

-- Trigger: hybrid_threshold updates
CREATE OR REPLACE FUNCTION log_threshold_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.hybrid_threshold != OLD.hybrid_threshold THEN
    INSERT INTO audit_log (
      proposal_id,
      event_type,
      severity,
      category,
      policy_metadata,
      details,
      occurred_at
    ) VALUES (
      NEW.proposal_id,
      'governance_threshold_update',
      'medium',
      'config',
      jsonb_build_object('cap_min', 0.20, 'cap_max', 0.40),
      jsonb_build_object(
        'old_threshold', OLD.hybrid_threshold,
        'new_threshold', NEW.hybrid_threshold,
        'lambda_weight', NEW.lambda_weight,
        'risk_score', NEW.risk_score
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_threshold_update ON governance_envelope;
CREATE TRIGGER trg_threshold_update
AFTER UPDATE OF hybrid_threshold
ON governance_envelope
FOR EACH ROW
EXECUTE FUNCTION log_threshold_update();

-- Trigger: lambda_weight updates
CREATE OR REPLACE FUNCTION log_lambda_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.lambda_weight != OLD.lambda_weight THEN
    INSERT INTO audit_log (
      proposal_id,
      event_type,
      severity,
      category,
      policy_metadata,
      details,
      occurred_at
    ) VALUES (
      NEW.proposal_id,
      'lambda_update',
      'medium',
      'config',
      jsonb_build_object('cap_min', 0.20, 'cap_max', 0.60),
      jsonb_build_object(
        'old_lambda', OLD.lambda_weight,
        'new_lambda', NEW.lambda_weight,
        'threshold', NEW.hybrid_threshold,
        'risk_score', NEW.risk_score
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lambda_update ON governance_envelope;
CREATE TRIGGER trg_lambda_update
AFTER UPDATE OF lambda_weight
ON governance_envelope
FOR EACH ROW
EXECUTE FUNCTION log_lambda_update();

-- Trigger: risk_score updates
CREATE OR REPLACE FUNCTION log_risk_score_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.risk_score != OLD.risk_score THEN
    INSERT INTO audit_log (
      proposal_id,
      event_type,
      severity,
      category,
      details,
      occurred_at
    ) VALUES (
      NEW.proposal_id,
      'lineage_event',
      CASE
        WHEN NEW.risk_score > 0.7 THEN 'high'
        WHEN NEW.risk_score > 0.5 THEN 'medium'
        ELSE 'low'
      END,
      'governance',
      jsonb_build_object(
        'old_risk_score', OLD.risk_score,
        'new_risk_score', NEW.risk_score,
        'lineage_depth', NEW.lineage_depth
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_risk_score_update ON governance_envelope;
CREATE TRIGGER trg_risk_score_update
AFTER UPDATE OF risk_score
ON governance_envelope
FOR EACH ROW
EXECUTE FUNCTION log_risk_score_update();
