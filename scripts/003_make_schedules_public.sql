-- Make user_id nullable to allow anonymous schedules
ALTER TABLE public.schedules ALTER COLUMN user_id DROP NOT NULL;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can create their own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can update their own schedules" ON public.schedules;
DROP POLICY IF EXISTS "Users can delete their own schedules" ON public.schedules;

-- Create permissive policies for schedules
CREATE POLICY "Anyone can view schedules" 
  ON public.schedules FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create schedules" 
  ON public.schedules FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update schedules" 
  ON public.schedules FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete schedules" 
  ON public.schedules FOR DELETE 
  USING (true);

-- Drop existing restrictive policies for activities
DROP POLICY IF EXISTS "Users can view activities from their schedules" ON public.schedule_activities;
DROP POLICY IF EXISTS "Users can create activities in their schedules" ON public.schedule_activities;
DROP POLICY IF EXISTS "Users can update activities in their schedules" ON public.schedule_activities;
DROP POLICY IF EXISTS "Users can delete activities from their schedules" ON public.schedule_activities;

-- Create permissive policies for activities
CREATE POLICY "Anyone can view activities" 
  ON public.schedule_activities FOR SELECT 
  USING (true);

CREATE POLICY "Anyone can create activities" 
  ON public.schedule_activities FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Anyone can update activities" 
  ON public.schedule_activities FOR UPDATE 
  USING (true);

CREATE POLICY "Anyone can delete activities" 
  ON public.schedule_activities FOR DELETE 
  USING (true);
