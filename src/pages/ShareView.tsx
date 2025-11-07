import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Lock, User, Calendar, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FishingMap from '@/components/FishingMap';

interface SharedReport {
  venue: string;
  query_date: string;
  advice_text: string;
  weather_data: any;
  recommended_locations?: any[];
  recommended_locations_count?: number;
  map_image_url?: string;
}

export default function ShareView() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<SharedReport | null>(null);
  const [creator, setCreator] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      fetchSharedReport();
    }
  }, [token, user]);

  const fetchSharedReport = async () => {
    try {
      setLoading(true);
      setError(null);

      const includeFullContent = !!user;
      
      // Get auth token if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error: functionError } = await supabase.functions.invoke('get-shared-report', {
        body: { 
          token,
          includeFullContent 
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`,
        } : undefined,
      });

      if (functionError) throw functionError;

      if (data.error) {
        setError(data.error);
        return;
      }

      setReport(data.query);
      setCreator(data.shareInfo.created_by);
    } catch (err: any) {
      console.error('Error fetching shared report:', err);
      setError(err.message || 'Failed to load shared report');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToMyReports = async () => {
    if (!user || !report) return;

    try {
      setSaving(true);

      const { error: insertError } = await supabase
        .from('queries')
        .insert({
          user_id: user.id,
          venue: report.venue,
          query_date: report.query_date,
          advice_text: report.advice_text,
          weather_data: report.weather_data,
          recommended_locations: report.recommended_locations,
          map_image_url: report.map_image_url,
        });

      if (insertError) throw insertError;

      toast({
        title: 'Report saved',
        description: 'This report has been added to your account',
      });

      navigate('/dashboard');
    } catch (err: any) {
      console.error('Error saving report:', err);
      toast({
        title: 'Failed to save',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center text-destructive">Unable to Load Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button onClick={() => navigate('/')} className="w-full">
              Return Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!report) return null;

  const isLoggedIn = !!user;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              🎣 Fishing Intelligence Advisor
            </h1>
            {!isLoggedIn && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate(`/auth?redirect=/share/${token}`)}>
                  Log In
                </Button>
                <Button size="sm" onClick={() => navigate(`/auth?redirect=/share/${token}`)}>
                  Sign Up Free
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl flex items-center gap-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  {report.venue}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(report.query_date).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    Shared by: {creator.split('@')[0]}
                  </span>
                </div>
              </div>
              {isLoggedIn && (
                <Button onClick={handleSaveToMyReports} disabled={saving} size="sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save to My Reports
                </Button>
              )}
            </div>

            {/* Weather */}
            {report.weather_data && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-sm">
                  🌡️ {Math.round(report.weather_data.temp)}°C
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  💨 {report.weather_data.wind_direction} {Math.round(report.weather_data.wind_speed)} mph
                </Badge>
                <Badge variant="secondary" className="text-sm">
                  {report.weather_data.description || 'Unknown'}
                </Badge>
                {report.weather_data.pressure && (
                  <Badge variant="secondary" className="text-sm">
                    🎚️ {report.weather_data.pressure} hPa
                  </Badge>
                )}
              </div>
            )}
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Advice Section */}
            <div className="relative">
              <h3 className="text-lg font-semibold mb-3">Fishing Advice</h3>
              <div className={`prose prose-sm max-w-none ${!isLoggedIn ? 'blur-sm select-none' : ''}`}>
                <p className="whitespace-pre-wrap text-foreground">
                  {report.advice_text}
                </p>
              </div>
              
              {!isLoggedIn && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg">
                  <Card className="max-w-sm mx-4 shadow-lg">
                    <CardContent className="pt-6 text-center space-y-4">
                      <Lock className="h-12 w-12 mx-auto text-primary" />
                      <h3 className="text-xl font-semibold">Sign Up to View Full Report</h3>
                      <p className="text-sm text-muted-foreground">
                        Get complete fishing advice, interactive maps, and detailed recommendations
                      </p>
                      <div className="flex flex-col gap-2">
                        <Button onClick={() => navigate(`/auth?redirect=/share/${token}`)} className="w-full">
                          Sign Up Free
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => navigate(`/auth?redirect=/share/${token}`)}
                          className="w-full"
                        >
                          Log In
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            {/* Map Section */}
            <div className="relative">
              <h3 className="text-lg font-semibold mb-3">Recommended Locations</h3>
              <div className={`rounded-lg overflow-hidden border border-border ${!isLoggedIn ? 'blur-md' : ''}`}>
                {isLoggedIn && report.recommended_locations ? (
                  <FishingMap venueName={report.venue} locations={report.recommended_locations} />
                ) : (
                  <div className="aspect-video bg-muted flex flex-col items-center justify-center gap-3">
                    <MapPin className="h-16 w-16 text-muted-foreground/50" />
                    {!isLoggedIn && report.recommended_locations_count && (
                      <p className="text-sm text-muted-foreground">
                        {report.recommended_locations_count} recommended spots available
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Recommended Spots */}
            {isLoggedIn && report.recommended_locations && Array.isArray(report.recommended_locations) && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Top Spots</h3>
                <div className="grid gap-3">
                  {report.recommended_locations.map((location: any, idx: number) => (
                    <Card key={idx}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{location.name}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {location.description}
                            </p>
                          </div>
                          <Badge variant="secondary">#{idx + 1}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-muted-foreground">
          <p>Powered by Fishing Intelligence Advisor</p>
        </div>
      </main>
    </div>
  );
}
