-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Create policies (allowing public access for now to match schedules pattern, 
-- but ideally should be authenticated only. Using public for consistency with previous request)
CREATE POLICY "Public tasks access" ON tasks
  FOR ALL USING (true);

-- Grant access to anon and authenticated roles
GRANT ALL ON tasks TO anon, authenticated, service_role;
