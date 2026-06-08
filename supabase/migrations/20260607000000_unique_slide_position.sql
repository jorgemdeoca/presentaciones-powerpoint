-- Add unique constraint to prevent duplicate slide positions within the same presentation
ALTER TABLE slides ADD CONSTRAINT unique_presentation_position UNIQUE (presentation_id, position);
