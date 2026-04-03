import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SessionCardData {
  displayName: string;
  venueName: string;
  sessionDate: string;
  nFish: number;
  speciesBreakdown?: string;
  topFly1?: string;
  topFly2?: string;
  method?: string;
  tempC?: number;
  wind?: string;
  weather?: string;
}

export function useShareLink() {
  const { toast } = useToast();

  async function shareSession(sessionId: string, cardData: SessionCardData) {
    try {
      const { data, error } = await supabase.functions.invoke('create-share-link', {
        body: {
          type: 'session',
          session_id: sessionId,
          card_snapshot: {
            display_name: cardData.displayName,
            venue_name: cardData.venueName,
            session_date: cardData.sessionDate,
            n_fish: cardData.nFish,
            species_breakdown: cardData.speciesBreakdown,
            top_fly_1: cardData.topFly1,
            top_fly_2: cardData.topFly2,
            method: cardData.method,
            conditions_temp_c: cardData.tempC,
            conditions_wind: cardData.wind,
            conditions_weather: cardData.weather,
          },
        },
      });

      if (error) throw error;
      const url = data.url;

      if (navigator.share) {
        await navigator.share({
          title: `${cardData.displayName} caught ${cardData.nFish} at ${cardData.venueName}`,
          text: "Check out this fishing session on It's Catching!",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Link copied', description: 'Share link copied to clipboard' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Share failed', description: err.message, variant: 'destructive' });
      }
    }
  }

  async function shareGroupInvite(groupId: string, groupName: string) {
    try {
      const { data, error } = await supabase.functions.invoke('create-share-link', {
        body: { type: 'group_invite', group_id: groupId },
      });

      if (error) throw error;
      const url = data.url;

      if (navigator.share) {
        await navigator.share({
          title: `Join ${groupName} on It's Catching!`,
          text: "You've been invited to a fishing group.",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: 'Invite link copied', description: 'Share it with your mates' });
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        toast({ title: 'Share failed', description: err.message, variant: 'destructive' });
      }
    }
  }

  return { shareSession, shareGroupInvite };
}
