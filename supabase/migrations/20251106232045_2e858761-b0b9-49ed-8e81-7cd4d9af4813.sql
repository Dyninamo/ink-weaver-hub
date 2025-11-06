-- Create user_profiles table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  mobile_number TEXT,
  mobile_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- Trigger to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (new.id);
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create venue_metadata table
CREATE TABLE public.venue_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  latitude FLOAT NOT NULL,
  longitude FLOAT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.venue_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view venues"
ON public.venue_metadata
FOR SELECT
USING (true);

-- Create fishing_reports table
CREATE TABLE public.fishing_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue TEXT NOT NULL,
  report_date DATE NOT NULL,
  report_text TEXT,
  rod_average FLOAT,
  methods TEXT[],
  flies TEXT[],
  weather TEXT[],
  best_spots TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fishing_reports_venue_date ON public.fishing_reports(venue, report_date DESC);

ALTER TABLE public.fishing_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fishing reports"
ON public.fishing_reports
FOR SELECT
USING (true);

-- Create queries table
CREATE TABLE public.queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  venue TEXT NOT NULL,
  query_date DATE NOT NULL,
  advice_text TEXT,
  recommended_locations JSONB,
  weather_data JSONB,
  map_image_url TEXT,
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_queries_user_created ON public.queries(user_id, created_at DESC);

ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own queries"
ON public.queries
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queries"
ON public.queries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queries"
ON public.queries
FOR UPDATE
USING (auth.uid() = user_id);

-- Create verification_codes table
CREATE TABLE public.verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  mobile_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_verification_codes_lookup ON public.verification_codes(user_id, mobile_number, verified);

ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own verification codes"
ON public.verification_codes
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);