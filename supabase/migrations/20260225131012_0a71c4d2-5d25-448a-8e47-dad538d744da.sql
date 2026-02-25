
-- Rename 11 ref_ tables to drop the prefix
ALTER TABLE ref_flies RENAME TO flies;
ALTER TABLE ref_rigs RENAME TO rigs;
ALTER TABLE ref_retrieves RENAME TO retrieves;
ALTER TABLE ref_lines RENAME TO lines;
ALTER TABLE ref_leaders RENAME TO leaders;
ALTER TABLE ref_tippets RENAME TO tippets;
ALTER TABLE ref_rods RENAME TO rods;
ALTER TABLE ref_hook_sizes RENAME TO hook_sizes;
ALTER TABLE ref_colours RENAME TO colours;
ALTER TABLE ref_depths RENAME TO depths;
ALTER TABLE ref_lines_from_reports RENAME TO lines_from_reports;

-- Add missing column to flies (was ref_flies)
ALTER TABLE flies ADD COLUMN fly_type_id INTEGER REFERENCES fly_types(fly_type_id);

-- Fix regions columns to match master database
ALTER TABLE regions RENAME COLUMN description TO country;
ALTER TABLE regions ADD COLUMN sort_order INTEGER;
