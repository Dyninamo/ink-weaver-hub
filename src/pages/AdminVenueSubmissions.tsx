import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Status = "pending" | "researched" | "merged" | "rejected";

interface Submission {
  id: string;
  user_id: string;
  venue_id: string;
  submitted_name: string;
  submitted_water_type: string;
  submitted_county: string | null;
  submitted_postcode: string | null;
  submitted_latitude: number | null;
  submitted_longitude: number | null;
  status: Status;
  admin_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<Status, string> = {
  pending: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  researched: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  merged: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function AdminVenueSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Status | "all">("pending");
  const [stats, setStats] = useState({ pending: 0, thisWeek: 0, allTime: 0 });

  // Inline action state
  const [mergeTarget, setMergeTarget] = useState<string | null>(null);
  const [mergeInput, setMergeInput] = useState("");
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    // Stats
    const [{ count: pending }, { count: allTime }] = await Promise.all([
      supabase.from("user_venue_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("user_venue_submissions").select("*", { count: "exact", head: true }),
    ]);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: thisWeek } = await supabase
      .from("user_venue_submissions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());

    setStats({ pending: pending ?? 0, thisWeek: thisWeek ?? 0, allTime: allTime ?? 0 });

    // Submissions
    let query = supabase
      .from("user_venue_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Failed to load submissions:", error);
      toast.error("Failed to load submissions");
    } else {
      setSubmissions((data as Submission[]) || []);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateStatus = async (id: string, status: Status, notes?: string) => {
    setActionLoading(id);
    const { error } = await supabase
      .from("user_venue_submissions")
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        admin_notes: notes || null,
      })
      .eq("id", id);

    if (error) {
      toast.error("Update failed: " + error.message);
    } else {
      toast.success(`Marked as ${status}`);
      setMergeTarget(null);
      setRejectTarget(null);
      setMergeInput("");
      setRejectReason("");
      loadData();
    }
    setActionLoading(null);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/upload">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Venue Submissions</h1>
      </div>

      {/* Admin nav */}
      <div className="flex flex-wrap gap-2 mb-6 text-sm">
        <Link to="/admin/upload" className="text-primary hover:underline">Upload</Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/admin/db-status" className="text-primary hover:underline">DB Status</Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/admin/test-advice" className="text-primary hover:underline">Test Advice</Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/admin/recompute" className="text-primary hover:underline">Recompute</Link>
        <span className="text-muted-foreground">·</span>
        <span className="font-semibold text-foreground">Venue Submissions</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Pending", value: stats.pending },
          { label: "This week", value: stats.thisWeek },
          { label: "All time", value: stats.allTime },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-3xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="mb-4">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Status | "all")}
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="researched">Researched</option>
          <option value="merged">Merged</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No submissions found</p>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Venue</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>County</TableHead>
                <TableHead>Postcode</TableHead>
                <TableHead>GPS</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.submitted_name}</TableCell>
                  <TableCell className="capitalize">{s.submitted_water_type}</TableCell>
                  <TableCell>{s.submitted_county || "—"}</TableCell>
                  <TableCell>{s.submitted_postcode || "—"}</TableCell>
                  <TableCell>
                    {s.submitted_latitude != null ? (
                      <span title={`${s.submitted_latitude}, ${s.submitted_longitude}`}>
                        <MapPin className="w-4 h-4 text-primary inline" />
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="whitespace-nowrap">{format(new Date(s.created_at), "dd MMM yyyy")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[s.status]}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {/* Inline merge form */}
                      {mergeTarget === s.id ? (
                        <div className="flex gap-1 items-center">
                          <Input
                            value={mergeInput}
                            onChange={(e) => setMergeInput(e.target.value)}
                            placeholder="venue_id"
                            className="h-7 text-xs w-32"
                          />
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-xs"
                            disabled={!mergeInput.trim() || actionLoading === s.id}
                            onClick={() => updateStatus(s.id, "merged", `Merge target: ${mergeInput.trim()}`)}
                          >
                            {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setMergeTarget(null)}>✕</Button>
                        </div>
                      ) : rejectTarget === s.id ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Reason (optional)"
                            className="h-7 text-xs"
                          />
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              disabled={actionLoading === s.id}
                              onClick={() => updateStatus(s.id, "rejected", rejectReason.trim())}
                            >
                              {actionLoading === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setRejectTarget(null)}>✕</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={actionLoading === s.id}
                            onClick={() => updateStatus(s.id, "researched")}
                          >
                            Research
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => { setMergeTarget(s.id); setRejectTarget(null); }}
                          >
                            Merge
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-destructive"
                            onClick={() => { setRejectTarget(s.id); setMergeTarget(null); }}
                          >
                            Reject
                          </Button>
                        </div>
                      )}
                      {s.admin_notes && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={s.admin_notes}>
                          📝 {s.admin_notes}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
