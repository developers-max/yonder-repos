-- Migration: Add remaining_chat_queries field to users table
-- Date: 2024-11-23
-- Description: 
--   Adds remaining_chat_queries column to users table with default value of 15
--   This enables tracking and limiting the number of chat queries each user can submit

-- ============================================================================
-- Add remaining_chat_queries column to users table
-- ============================================================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS remaining_chat_queries INTEGER NOT NULL DEFAULT 15;

-- Update existing users to have the default value
UPDATE users 
SET remaining_chat_queries = 15 
WHERE remaining_chat_queries IS NULL;
