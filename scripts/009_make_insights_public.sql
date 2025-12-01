-- Enable public access for Insights tables (Notebooks, Sources, Notes)
-- This allows the app to function without user authentication (No Login mode)

-- 1. Make user_id nullable in notebooks table
ALTER TABLE public.notebooks ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop the foreign key constraint to profiles/users if it exists
ALTER TABLE public.notebooks DROP CONSTRAINT IF EXISTS notebooks_user_id_fkey;

-- 3. Update RLS policies to allow public access for Notebooks
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
CREATE POLICY "Public view notebooks" ON public.notebooks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
CREATE POLICY "Public create notebooks" ON public.notebooks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
CREATE POLICY "Public update notebooks" ON public.notebooks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
CREATE POLICY "Public delete notebooks" ON public.notebooks FOR DELETE USING (true);

-- 4. Update RLS policies for Sources (allow access if notebook exists)
DROP POLICY IF EXISTS "Users can view sources from their notebooks" ON public.sources;
CREATE POLICY "Public view sources" ON public.sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create sources in their notebooks" ON public.sources;
CREATE POLICY "Public create sources" ON public.sources FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update sources in their notebooks" ON public.sources;
CREATE POLICY "Public update sources" ON public.sources FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete sources from their notebooks" ON public.sources;
CREATE POLICY "Public delete sources" ON public.sources FOR DELETE USING (true);

-- 5. Update RLS policies for Notes
DROP POLICY IF EXISTS "Users can view notes from their notebooks" ON public.notes;
CREATE POLICY "Public view notes" ON public.notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create notes in their notebooks" ON public.notes;
CREATE POLICY "Public create notes" ON public.notes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update notes in their notebooks" ON public.notes;
CREATE POLICY "Public update notes" ON public.notes FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Users can delete notes from their notebooks" ON public.notes;
CREATE POLICY "Public delete notes" ON public.notes FOR DELETE USING (true);

-- 6. Update RLS policies for Chat Histories
DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Public view chat histories" ON public.n8n_chat_histories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Public create chat histories" ON public.n8n_chat_histories FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Public delete chat histories" ON public.n8n_chat_histories FOR DELETE USING (true);
