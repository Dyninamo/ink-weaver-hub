import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateToken(length = 8): string {
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => CHARS[b % CHARS.length]).join('');
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('profile_id, display_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { type, session_id, group_id, card_snapshot } = body;

    if (!type || !['session', 'group_invite'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid type. Must be "session" or "group_invite"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let token: string;
    let snapshot = card_snapshot;

    if (type === 'session') {
      if (!session_id || !card_snapshot) {
        return new Response(
          JSON.stringify({ error: 'session_id and card_snapshot required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      token = generateToken(8);
    } else {
      // group_invite
      if (!group_id) {
        return new Response(
          JSON.stringify({ error: 'group_id required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch group info for snapshot
      const { data: group } = await supabase
        .from('social_groups')
        .select('group_name, invite_code')
        .eq('group_id', group_id)
        .single();

      if (!group) {
        return new Response(
          JSON.stringify({ error: 'Group not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate invite_code if group doesn't have one
      let inviteCode = group.invite_code;
      if (!inviteCode) {
        const hex = generateToken(4).toLowerCase();
        inviteCode = `${slugify(group.group_name)}-${hex}`;
        await supabase
          .from('social_groups')
          .update({ invite_code: inviteCode })
          .eq('group_id', group_id);
      }

      // Count members
      const { count } = await supabase
        .from('group_memberships')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group_id)
        .eq('status', 'active');

      token = inviteCode;
      snapshot = {
        group_name: group.group_name,
        member_count: count || 0,
        inviter_name: profile.display_name,
      };
    }

    // Insert share link (retry once on token collision)
    let inserted = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error: insertError } = await supabase
        .from('share_links')
        .insert({
          token,
          type,
          profile_id: profile.profile_id,
          session_id: type === 'session' ? session_id : null,
          group_id: type === 'group_invite' ? group_id : null,
          card_snapshot: snapshot,
        });

      if (!insertError) {
        inserted = true;
        break;
      }

      console.error('Insert error (attempt ' + attempt + '):', insertError);

      // Token collision — regenerate (session only; group uses invite_code)
      if (type === 'session') {
        token = generateToken(10);
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to create share link' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!inserted) {
      return new Response(
        JSON.stringify({ error: 'Failed to create share link' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prefix = type === 'session' ? 's' : 'g';
    const url = `https://itscatching.uk/${prefix}/${token}`;

    return new Response(
      JSON.stringify({ url, token }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Unexpected error in create-share-link:', err);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
