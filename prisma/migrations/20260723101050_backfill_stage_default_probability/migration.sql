-- Backfills default_probability for existing PipelineStage rows created
-- before this column existed (they got the column default of 0, not the
-- sensible per-key defaults DEFAULT_PIPELINE_STAGES now specifies). Only
-- touches rows matching the known default stage keys and still at 0 — a
-- tenant that already customized a stage's probability via the API keeps
-- their own value, and custom (non-default-key) stages are untouched.
UPDATE "pipeline_stages" SET "default_probability" = 10 WHERE "key" = 'new' AND "default_probability" = 0;
UPDATE "pipeline_stages" SET "default_probability" = 25 WHERE "key" = 'contacted' AND "default_probability" = 0;
UPDATE "pipeline_stages" SET "default_probability" = 50 WHERE "key" = 'qualified' AND "default_probability" = 0;
UPDATE "pipeline_stages" SET "default_probability" = 75 WHERE "key" = 'proposal' AND "default_probability" = 0;
UPDATE "pipeline_stages" SET "default_probability" = 100 WHERE "key" = 'closed_won' AND "default_probability" = 0;
