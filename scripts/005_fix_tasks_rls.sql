-- Fix RLS policies for tasks table to allow public access (matching schedules pattern)
-- This is necessary because the app allows usage without login

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public tasks access" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Create comprehensive public policies
CREATE POLICY "Public tasks select" ON tasks FOR SELECT USING (true);
CREATE POLICY "Public tasks insert" ON tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Public tasks update" ON tasks FOR UPDATE USING (true);
CREATE POLICY "Public tasks delete" ON tasks FOR DELETE USING (true);

-- Make user_id nullable if it isn't already (for anonymous tasks)
ALTER TABLE tasks ALTER COLUMN user_id DROP NOT NULL;
