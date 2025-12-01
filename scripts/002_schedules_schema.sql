-- Criando schema para sistema de cronogramas
-- Tabela de cronogramas
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de atividades do cronograma
CREATE TABLE IF NOT EXISTS public.schedule_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.schedules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Domingo, 6 = Sábado
  start_time TIME,
  end_time TIME,
  completed_dates TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_activities ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para schedules
CREATE POLICY "Users can view their own schedules"
  ON public.schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own schedules"
  ON public.schedules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own schedules"
  ON public.schedules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own schedules"
  ON public.schedules FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para schedule_activities
CREATE POLICY "Users can view activities from their schedules"
  ON public.schedule_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_activities.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create activities in their schedules"
  ON public.schedule_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_activities.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update activities in their schedules"
  ON public.schedule_activities FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_activities.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete activities from their schedules"
  ON public.schedule_activities FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.schedules
      WHERE schedules.id = schedule_activities.schedule_id
      AND schedules.user_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_activities_schedule_id ON public.schedule_activities(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_activities_day_of_week ON public.schedule_activities(day_of_week);
