import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Calculator, Play, PlayCircle, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface DryRunResult {
  total_completed: number;
  already_computed: number;
  needs_compute: number;
  by_venue: Record<string, number>;
}

interface BatchResult {
  success: boolean;
  processed: number;
  failed: number;
  remaining: number;
  total_fish: number;
  errors: { session_id: string; error_message: string }[];
  angler_stats_updated: number;
  venue_stats_updated: number;
}

interface BatchLog {
  batch: number;
  processed: number;
  totalFish: number;
  errors: number;
  remaining: number;
}

export default function AdminRecompute() {
  const [dryRun, setDryRun] = useState<DryRunResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [batchSize, setBatchSize] = useState(50);
  const [running, setRunning] = useState(false);
  const [runAll, setRunAll] = useState(false);
  const [logs, setLogs] = useState<BatchLog[]>([]);
  const [allErrors, setAllErrors] = useState<{ session_id: string; error_message: string }[]>([]);
  const [totals, setTotals] = useState({ processed: 0, fish: 0, anglerStats: 0, venueStats: 0 });
  const [progressPct, setProgressPct] = useState(0);

  const fetchDryRun = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("batch-recompute", {
        body: { dry_run: true },
      });
      if (error) throw error;
      setDryRun(data as DryRunResult);
    } catch (err: any) {
      console.error("Dry run failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDryRun(); }, [fetchDryRun]);

  const runBatch = async (): Promise<BatchResult | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("batch-recompute", {
        body: { batch_size: batchSize },
      });
      if (error) throw error;
      return data as BatchResult;
    } catch (err: any) {
      console.error("Batch failed:", err);
      return null;
    }
  };

  const handleRunBatch = async () => {
    setRunning(true);
    const result = await runBatch();
    if (result) {
      const batchNum = logs.length + 1;
      setLogs(prev => [...prev, { batch: batchNum, processed: result.processed, totalFish: result.total_fish, errors: result.failed, remaining: result.remaining }]);
      setAllErrors(prev => [...prev, ...result.errors]);
      setTotals(prev => ({
        processed: prev.processed + result.processed,
        fish: prev.fish + result.total_fish,
        anglerStats: result.angler_stats_updated,
        venueStats: result.venue_stats_updated,
      }));
      if (dryRun) {
        const total = dryRun.needs_compute;
        const done = total - result.remaining;
        setProgressPct(total > 0 ? Math.round((done / total) * 100) : 100);
      }
    }
    setRunning(false);
    if (!runAll) fetchDryRun();
  };

  const handleRunAll = async () => {
    setRunAll(true);
    setRunning(true);
    setLogs([]);
    setAllErrors([]);
    setTotals({ processed: 0, fish: 0, anglerStats: 0, venueStats: 0 });
    setProgressPct(0);

    let remaining = dryRun?.needs_compute ?? 0;
    let batchNum = 0;
    let cumProcessed = 0;
    let cumFish = 0;

    while (remaining > 0) {
      batchNum++;
      const result = await runBatch();
      if (!result) break;

      cumProcessed += result.processed;
      cumFish += result.total_fish;
      remaining = result.remaining;

      setLogs(prev => [...prev, { batch: batchNum, processed: result.processed, totalFish: result.total_fish, errors: result.failed, remaining }]);
      setAllErrors(prev => [...prev, ...result.errors]);
      setTotals({ processed: cumProcessed, fish: cumFish, anglerStats: result.angler_stats_updated, venueStats: result.venue_stats_updated });

      if (dryRun) {
        const total = dryRun.needs_compute;
        const done = total - remaining;
        setProgressPct(total > 0 ? Math.round((done / total) * 100) : 100);
      }

      if (remaining > 0) {
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    setRunning(false);
    setRunAll(false);
    fetchDryRun();
  };

  const isComplete = dryRun?.needs_compute === 0 && !loading;

  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/admin/upload" className="p-2 rounded-md hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="h-6 w-6" /> Session Summary Recompute
          </h1>
          <p className="text-sm text-muted-foreground">Batch compute summaries, angler stats, and venue stats</p>
        </div>
      </div>

      {/* Status Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking...
            </div>
          ) : dryRun ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{dryRun.needs_compute}</p>
                  <p className="text-xs text-muted-foreground">Need computing</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{dryRun.already_computed}</p>
                  <p className="text-xs text-muted-foreground">Already done</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{dryRun.total_completed}</p>
                  <p className="text-xs text-muted-foreground">Total completed</p>
                </div>
              </div>
              {Object.keys(dryRun.by_venue).length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">By venue:</p>
                  <div className="space-y-1 text-sm font-mono">
                    {Object.entries(dryRun.by_venue).sort((a, b) => b[1] - a[1]).map(([venue, count]) => (
                      <div key={venue} className="flex justify-between">
                        <span>{venue}</span>
                        <span className="text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {isComplete && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckCircle className="h-4 w-4" /> All sessions are up to date!
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-destructive">Failed to load status</p>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      {!isComplete && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Batch size:</label>
                <select
                  value={batchSize}
                  onChange={e => setBatchSize(Number(e.target.value))}
                  disabled={running}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {[25, 50, 100, 200].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <Button onClick={handleRunBatch} disabled={running || !dryRun || dryRun.needs_compute === 0}>
                {running && !runAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run Batch
              </Button>
              <Button onClick={handleRunAll} disabled={running || !dryRun || dryRun.needs_compute === 0} variant="default">
                {running && runAll ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                Run All
              </Button>
            </div>

            {/* Progress */}
            {(running || logs.length > 0) && (
              <div className="space-y-3">
                <Progress value={progressPct} className="h-3" />
                <p className="text-xs text-muted-foreground text-center">{progressPct}% complete</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Batch Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm font-mono max-h-60 overflow-y-auto">
              {logs.map(log => (
                <div key={log.batch} className="flex justify-between">
                  <span>Batch {log.batch}: {log.processed} processed, {log.totalFish} fish{log.errors > 0 ? `, ${log.errors} errors` : ''}</span>
                  <span className="text-muted-foreground">{log.remaining} remaining</span>
                </div>
              ))}
            </div>

            {/* Errors */}
            {allErrors.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
                  <AlertCircle className="h-4 w-4" /> {allErrors.length} errors
                </p>
                <div className="space-y-1 text-xs font-mono max-h-40 overflow-y-auto">
                  {allErrors.map((err, i) => (
                    <div key={i} className="text-destructive/80">
                      {err.session_id.slice(0, 8)}… — {err.error_message}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final Summary */}
            {!running && logs.length > 0 && (
              <div className="mt-4 border-t border-border pt-3 grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Total processed:</span> <strong>{totals.processed}</strong></div>
                <div><span className="text-muted-foreground">Total fish:</span> <strong>{totals.fish}</strong></div>
                <div><span className="text-muted-foreground">Angler stats updated:</span> <strong>{totals.anglerStats}</strong></div>
                <div><span className="text-muted-foreground">Venue stats updated:</span> <strong>{totals.venueStats}</strong></div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* After completion links */}
      {!running && logs.length > 0 && (
        <div className="flex gap-3">
          <Link to="/admin/db-status">
            <Button variant="outline">View DB Status</Button>
          </Link>
          <Button variant="ghost" onClick={() => { setLogs([]); setAllErrors([]); setTotals({ processed: 0, fish: 0, anglerStats: 0, venueStats: 0 }); setProgressPct(0); fetchDryRun(); }}>
            Reset
          </Button>
        </div>
      )}
    </div>
  );
}
