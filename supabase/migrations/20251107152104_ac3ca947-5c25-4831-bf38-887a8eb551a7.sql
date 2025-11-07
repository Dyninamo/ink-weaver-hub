-- Create shared_reports table
CREATE TABLE public.shared_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_id UUID REFERENCES public.queries(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  short_url TEXT,
  created_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for shared_reports
CREATE INDEX idx_shared_reports_token ON public.shared_reports(share_token);
CREATE INDEX idx_shared_reports_query ON public.shared_reports(query_id);

-- Create share_views table
CREATE TABLE public.share_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_report_id UUID REFERENCES public.shared_reports(id) ON DELETE CASCADE NOT NULL,
  viewer_email TEXT,
  viewer_ip TEXT,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for share_views
CREATE INDEX idx_share_views_report ON public.share_views(shared_report_id);

-- Enable RLS on both tables
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_views ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_reports
CREATE POLICY "Users can view own shares"
  ON public.shared_reports FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create shares"
  ON public.shared_reports FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Anyone can view by token"
  ON public.shared_reports FOR SELECT
  USING (true);

-- RLS Policy for share_views
CREATE POLICY "View own share analytics"
  ON public.share_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.shared_reports sr
      WHERE sr.id = shared_report_id
      AND sr.created_by = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert share views"
  ON public.share_views FOR INSERT
  WITH CHECK (true);