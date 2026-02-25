-- Add Academic year 2024-25 to Triathlon Past Winners.
-- Run this in your database (e.g. Neon SQL Editor or psql).
-- Does not modify 2025-26 winners; this inserts a new record that appears after them.
--
-- Winners:
--   Overall: Friedman Foxes
--   Sports: Friedman Foxes
--   Cultural: Hamel Hawks
--   Academic: Hamel Hawks

INSERT INTO triathlon_past_winners (
  announced_at,
  label,
  academic_first_place_team_id,
  academic_first_place_name,
  cultural_first_place_team_id,
  cultural_first_place_name,
  sports_first_place_team_id,
  sports_first_place_name,
  overall_first_place_team_id,
  overall_first_place_name,
  announced_by
)
SELECT
  '2025-06-01 00:00:00'::timestamp,
  'Academic year 2024-25',
  NULL,
  'Hamel Hawks',
  NULL,
  'Hamel Hawks',
  NULL,
  'Friedman Foxes',
  NULL,
  'Friedman Foxes',
  (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM triathlon_past_winners WHERE label = 'Academic year 2024-25'
);
