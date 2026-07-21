ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS original_filename VARCHAR(500);
