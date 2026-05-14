// Admin debug surface for app_events. Hardcoded UID allowlist.
// Per prompt 145 §4.
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const ALLOWED_UIDS = new Set<string>([
  "43928498-a5f6-486c-a6ad-3e0b958d505d", // nick.dyne@gmail.com
  // Add Alun's UUID here when known.
]);

interface EventRow {
  id: number;
  client_time: string;
  server_time: string;
  route: string | null;
  event_type: string;
  payload: any;
  session_id: string | null;
}

export default function AdminEvents() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("");
  const [viewingEmail, setViewingEmail] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("");

  useEffect(() => {
    if (!user) { nav("/auth"); return; }
    if (!ALLOWED_UIDS.has(user.id)) { nav("/dashboard"); return; }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, filterType]);

  async function load() {
    setLoading(true);
    setStatusMsg("");
    try {
      const trimmedEmail = viewingEmail.trim();
      if (trimmedEmail) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { setRows([]); setStatusMsg("not signed in"); return; }
        const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
        const params = new URLSearchParams({ user_email: trimmedEmail, limit: "500" });
        if (filterType) params.set("event_type", filterType);
        const resp = await fetch(
          `${SUPABASE_URL}/functions/v1/admin-dump-app-events?${params.toString()}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!resp.ok) {
          const err = await resp.text();
          // eslint-disable-next-line no-console
          console.warn("admin-dump-app-events failed", resp.status, err);
          setRows([]);
          setStatusMsg(`error ${resp.status}: ${err.slice(0, 200)}`);
          return;
        }
        const json = await resp.json();
        const fetched = (json.rows ?? []) as EventRow[];
        setRows(fetched);
        setStatusMsg(`Viewing: ${trimmedEmail} — ${fetched.length} events`);
      } else {
        let q = supabase.from("app_events" as any).select("*").order("server_time", { ascending: false }).limit(200);
        if (filterType) q = q.eq("event_type", filterType);
        const { data } = await q;
        setRows((data as unknown as EventRow[]) ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!user || !ALLOWED_UIDS.has(user.id)) return null;

  const types = Array.from(new Set(rows.map((r) => r.event_type))).sort();

  return (
    <div className="min-h-screen p-4 max-w-screen-lg mx-auto">
      <h1 className="text-xl font-semibold mb-3">Recent app events</h1>
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <input
          type="email"
          placeholder="user email (admin) — blank = self"
          value={viewingEmail}
          onChange={(e) => setViewingEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void load(); }}
          className="border rounded p-1 text-sm bg-background min-w-[16rem]"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border rounded p-1 text-sm bg-background"
        >
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <Button size="sm" variant="outline" onClick={load}>Refresh</Button>
        <span className="text-xs text-muted-foreground">{rows.length} rows</span>
        {statusMsg && <span className="text-xs text-muted-foreground">· {statusMsg}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left p-1.5 w-32">Server time</th>
              <th className="text-left p-1.5 w-28">Route</th>
              <th className="text-left p-1.5 w-44">Type</th>
              <th className="text-left p-1.5">Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="p-3 text-center">Loading…</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b align-top">
                <td className="p-1.5 font-mono">{new Date(r.server_time).toLocaleString()}</td>
                <td className="p-1.5 font-mono">{r.route ?? ""}</td>
                <td className="p-1.5 font-mono">{r.event_type}</td>
                <td className="p-1.5 font-mono">
                  <pre className="whitespace-pre-wrap text-[11px]">{r.payload ? JSON.stringify(r.payload, null, 2) : ""}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
