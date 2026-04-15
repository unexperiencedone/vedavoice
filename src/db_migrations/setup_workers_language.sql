-- Migration: Add preferred language to workers table
-- Description: Stores the worker's preferred language for SMS notifications.
-- Default: 'en' (English)

ALTER TABLE workers 
ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

-- Optional: Update existing workers to match supervisor's common language if known
-- UPDATE workers SET language = 'hi' WHERE ...;
