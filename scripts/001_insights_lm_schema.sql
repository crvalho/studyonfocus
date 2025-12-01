-- ============================================================================
-- INSIGHTSLM DATABASE MIGRATION
-- This script creates the complete database schema for InsightsLM
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================================
-- CUSTOM TYPES
-- ============================================================================

DO $$ BEGIN
 CREATE TYPE source_type AS ENUM ('pdf', 'text', 'website', 'youtube', 'audio');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 email text NOT NULL,
 full_name text,
 avatar_url text,
 created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
 updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notebooks table
CREATE TABLE IF NOT EXISTS public.notebooks (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 title text NOT NULL,
 description text,
 color text DEFAULT 'gray',
 icon text DEFAULT '📝',
 generation_status text DEFAULT 'completed',
 audio_overview_generation_status text,
 audio_overview_url text,
 audio_url_expires_at timestamp with time zone,
 example_questions text[] DEFAULT '{}',
 created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
 updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create sources table
CREATE TABLE IF NOT EXISTS public.sources (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
 title text NOT NULL,
 type source_type NOT NULL,
 url text,
 file_path text,
 file_size bigint,
 display_name text,
 content text,
 summary text,
 processing_status text DEFAULT 'pending',
 metadata jsonb DEFAULT '{}',
 created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
 updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
 id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
 notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
 title text NOT NULL,
 content text NOT NULL,
 source_type text DEFAULT 'user',
 extracted_text text,
 created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
 updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create documents table for vector embeddings
CREATE TABLE IF NOT EXISTS public.documents (
 id bigserial PRIMARY KEY,
 content text,
 metadata jsonb,
 embedding vector(768)
);

-- Create chat histories table
CREATE TABLE IF NOT EXISTS public.n8n_chat_histories (
 id serial not null,
 session_id uuid not null,
 message jsonb not null,
 constraint n8n_chat_histories_pkey primary key (id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_notebooks_user_id ON public.notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_notebooks_updated_at ON public.notebooks(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_notebook_id ON public.sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_sources_type ON public.sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_processing_status ON public.sources(processing_status);
CREATE INDEX IF NOT EXISTS idx_notes_notebook_id ON public.notes(notebook_id);
CREATE INDEX IF NOT EXISTS idx_chat_histories_session_id ON public.n8n_chat_histories(session_id);
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON public.documents USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
 INSERT INTO public.profiles (id, email, full_name)
 VALUES (
 new.id,
 new.email,
 COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
 );
 RETURN new;
END;
$$;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
 new.updated_at = timezone('utc'::text, now());
 RETURN new;
END;
$$;

-- Function to check notebook ownership
CREATE OR REPLACE FUNCTION public.is_notebook_owner(notebook_id_param uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
 SELECT EXISTS (
 SELECT 1 
 FROM public.notebooks 
 WHERE id = notebook_id_param 
 AND user_id = auth.uid()
 );
$$;

-- Function to check notebook ownership for documents
CREATE OR REPLACE FUNCTION public.is_notebook_owner_for_document(doc_metadata jsonb)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
 SELECT EXISTS (
 SELECT 1 
 FROM public.notebooks 
 WHERE id = (doc_metadata->>'notebook_id')::uuid 
 AND user_id = auth.uid()
 );
$$;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_chat_histories ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
 ON public.profiles FOR SELECT
 USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
 ON public.profiles FOR UPDATE
 USING (auth.uid() = id);

-- Notebooks policies
DROP POLICY IF EXISTS "Users can view their own notebooks" ON public.notebooks;
CREATE POLICY "Users can view their own notebooks"
 ON public.notebooks FOR SELECT
 USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own notebooks" ON public.notebooks;
CREATE POLICY "Users can create their own notebooks"
 ON public.notebooks FOR INSERT
 WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notebooks" ON public.notebooks;
CREATE POLICY "Users can update their own notebooks"
 ON public.notebooks FOR UPDATE
 USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notebooks" ON public.notebooks;
CREATE POLICY "Users can delete their own notebooks"
 ON public.notebooks FOR DELETE
 USING (auth.uid() = user_id);

-- Sources policies
DROP POLICY IF EXISTS "Users can view sources from their notebooks" ON public.sources;
CREATE POLICY "Users can view sources from their notebooks"
 ON public.sources FOR SELECT
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = sources.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can create sources in their notebooks" ON public.sources;
CREATE POLICY "Users can create sources in their notebooks"
 ON public.sources FOR INSERT
 WITH CHECK (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = sources.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can update sources in their notebooks" ON public.sources;
CREATE POLICY "Users can update sources in their notebooks"
 ON public.sources FOR UPDATE
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = sources.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can delete sources from their notebooks" ON public.sources;
CREATE POLICY "Users can delete sources from their notebooks"
 ON public.sources FOR DELETE
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = sources.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

-- Notes policies
DROP POLICY IF EXISTS "Users can view notes from their notebooks" ON public.notes;
CREATE POLICY "Users can view notes from their notebooks"
 ON public.notes FOR SELECT
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = notes.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can create notes in their notebooks" ON public.notes;
CREATE POLICY "Users can create notes in their notebooks"
 ON public.notes FOR INSERT
 WITH CHECK (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = notes.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can update notes in their notebooks" ON public.notes;
CREATE POLICY "Users can update notes in their notebooks"
 ON public.notes FOR UPDATE
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = notes.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

DROP POLICY IF EXISTS "Users can delete notes from their notebooks" ON public.notes;
CREATE POLICY "Users can delete notes from their notebooks"
 ON public.notes FOR DELETE
 USING (
 EXISTS (
 SELECT 1 FROM public.notebooks 
 WHERE notebooks.id = notes.notebook_id 
 AND notebooks.user_id = auth.uid()
 )
 );

-- Documents policies
DROP POLICY IF EXISTS "Users can view documents from their notebooks" ON public.documents;
CREATE POLICY "Users can view documents from their notebooks"
 ON public.documents FOR SELECT
 USING (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can create documents in their notebooks" ON public.documents;
CREATE POLICY "Users can create documents in their notebooks"
 ON public.documents FOR INSERT
 WITH CHECK (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can update documents in their notebooks" ON public.documents;
CREATE POLICY "Users can update documents in their notebooks"
 ON public.documents FOR UPDATE
 USING (public.is_notebook_owner_for_document(metadata));

DROP POLICY IF EXISTS "Users can delete documents from their notebooks" ON public.documents;
CREATE POLICY "Users can delete documents from their notebooks"
 ON public.documents FOR DELETE
 USING (public.is_notebook_owner_for_document(metadata));

-- Chat histories policies
DROP POLICY IF EXISTS "Users can view chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can view chat histories from their notebooks"
 ON public.n8n_chat_histories FOR SELECT
 USING (public.is_notebook_owner(session_id::uuid));

DROP POLICY IF EXISTS "Users can create chat histories in their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can create chat histories in their notebooks"
 ON public.n8n_chat_histories FOR INSERT
 WITH CHECK (public.is_notebook_owner(session_id::uuid));

DROP POLICY IF EXISTS "Users can delete chat histories from their notebooks" ON public.n8n_chat_histories;
CREATE POLICY "Users can delete chat histories from their notebooks"
 ON public.n8n_chat_histories FOR DELETE
 USING (public.is_notebook_owner(session_id::uuid));

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_notebooks_updated_at ON public.notebooks;
DROP TRIGGER IF EXISTS update_sources_updated_at ON public.sources;
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER update_profiles_updated_at
 BEFORE UPDATE ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
 
CREATE TRIGGER update_notebooks_updated_at
 BEFORE UPDATE ON public.notebooks
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
 
CREATE TRIGGER update_sources_updated_at
 BEFORE UPDATE ON public.sources
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
 
CREATE TRIGGER update_notes_updated_at
 BEFORE UPDATE ON public.notes
 FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created
 AFTER INSERT ON auth.users
 FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
