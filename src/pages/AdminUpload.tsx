import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Database, MapPin, Tag, CheckCircle, AlertCircle, Loader2, FlaskConical, Calculator } from "lucide-react";

type Status = { state: "idle" | "loading" | "done" | "error"; message: string };

function StatusBadge({ status }: { status: Status }) {
  if (status.state === "idle") return null;
  const icon = status.state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" />
    : status.state === "done" ? <CheckCircle className="h-4 w-4 text-primary" />
    : <AlertCircle className="h-4 w-4 text-destructive" />;
  return (
    <div className={`mt-3 flex items-center gap-2 text-sm ${status.state === "error" ? "text-destructive" : status.state === "done" ? "text-primary" : "text-muted-foreground"}`}>
      {icon}
      <span className="whitespace-pre-wrap">{status.message}</span>
    </div>
  );
}

// ── Section 1: Fishing Reports ──
function FishingReportsSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      const batchSize = 25;
      const totalBatches = Math.ceil(records.length / batchSize);
      let totalInserted = 0, totalFailed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Uploading batch ${i + 1}/${totalBatches}... (${totalInserted} inserted, ${totalFailed} failed)` });

        const { data, error } = await supabase.functions.invoke("upload-fishing-reports", {
          body: { reports: batch },
        });

        if (error) throw new Error(error.message);
        totalInserted += data.inserted ?? 0;
        totalFailed += data.failed ?? 0;
      }

      setStatus({ state: "done", message: `Done! ${totalInserted} inserted, ${totalFailed} failed out of ${records.length} records.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" /> Upload Fishing Reports</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Calls upload-fishing-reports edge function in batches of 25</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 2: Basic Advice ──
function BasicAdviceSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      let totalInserted = 0, totalFailed = 0;
      const batchSize = 25;
      const totalBatches = Math.ceil(records.length / batchSize);

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Upserting batch ${i + 1}/${totalBatches}... (${totalInserted} inserted, ${totalFailed} failed)` });

        const { data, error } = await supabase.functions.invoke("upload-basic-advice", {
          body: { records: batch },
        });

        if (error) throw new Error(error.message);
        totalInserted += data.inserted ?? 0;
        totalFailed += data.failed ?? 0;
      }

      setStatus({ state: "done", message: `Done! ${totalInserted} upserted, ${totalFailed} failed out of ${records.length} records.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" /> Upload Basic Advice</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Calls upload-basic-advice edge function in batches of 25 records</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 3: Venue Metadata ──
const VENUES = [
  { name: "Grafham Water", latitude: 52.2965, longitude: -0.3134, description: "Major Anglian Water trout fishery, 1570 acres" },
  { name: "Rutland Water", latitude: 52.6661, longitude: -0.6371, description: "Largest reservoir in England, 3100 acres" },
  { name: "Pitsford Water", latitude: 52.3167, longitude: -0.9167, description: "Anglian Water trout fishery, 800 acres" },
  { name: "Ravensthorpe Reservoir", latitude: 52.3456, longitude: -0.8789, description: "Intimate Anglian Water fishery, 130 acres" },
  { name: "Clywedog Reservoir", latitude: 52.4647, longitude: -3.6117, description: "Welsh reservoir near Llanidloes, 615 acres" },
];

function VenueMetadataSection() {
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const seed = async () => {
    setStatus({ state: "loading", message: "Inserting venues..." });
    try {
      const { error } = await supabase.from("venue_metadata").upsert(VENUES, { onConflict: "name" });
      if (error) throw new Error(error.message);
      setStatus({ state: "done", message: `Done! ${VENUES.length} venues upserted.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> Seed Venue Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">Inserts {VENUES.length} venues: {VENUES.map(v => v.name).join(", ")}</p>
        <Button onClick={seed} disabled={status.state === "loading"}>Seed Venues</Button>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 4: Reference Data ──
const REFERENCE_DATA = [
  // Methods
  ...[["Buzzer",314],["Lure",321],["Nymph",262],["Washing Line",258],["Floating Line",221],["Blob",176],["Sinking Line",95],["Intermediate",87],["Booby",85],["Dry Fly",67]]
    .map(([value, usage_count]) => ({ category: "method", value: value as string, venue: null, usage_count: usage_count as number })),
  // Flies
  ...[["Shrimp",388],["Buzzer",314],["Snake",203],["Diawl Bach",182],["Blob",176],["Hares Ear",172],["Damsel",100],["Booby",85],["CDC",77],["Hopper",53],["Daddy",52],["Cormorant",39],["Pheasant Tail",16],["Bloodworm",15]]
    .map(([value, usage_count]) => ({ category: "fly", value: value as string, venue: null, usage_count: usage_count as number })),
  // Grafham spots
  ...[["Dam",196],["Lodge",99],["Seat",90],["Willows",77],["Gaynes",73],["G Buoy",70],["Harbour Arms",51],["Plummers",48],["Stumps",37]]
    .map(([value, usage_count]) => ({ category: "spot", value: value as string, venue: "Grafham Water", usage_count: usage_count as number })),
  // Rutland spots
  ...[["Normanton",112],["South Arm",66],["Sykes Lane",64],["North Arm",58],["Barnsdale",58]]
    .map(([value, usage_count]) => ({ category: "spot", value: value as string, venue: "Rutland Water", usage_count: usage_count as number })),
  // Lines
  ...[["Floating",200],["Intermediate",150],["Midge Tip",60],["Di-3",50],["Di-5",40],["Fast Sinking",30],["Di-7",20]]
    .map(([value, usage_count]) => ({ category: "line", value: value as string, venue: null, usage_count: usage_count as number })),
  // Retrieves
  ...[["Figure-of-eight",100],["Static",90],["Slow strip",80],["Fast strip",60],["Hang",50],["Roly-poly",40]]
    .map(([value, usage_count]) => ({ category: "retrieve", value: value as string, venue: null, usage_count: usage_count as number })),
  // Depths
  ...[["Surface",100],["Sub-surface",80],["Mid-water",70],["Deep",50],["On the drop",40]]
    .map(([value, usage_count]) => ({ category: "depth", value: value as string, venue: null, usage_count: usage_count as number })),
];

function ReferenceDataSection() {
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const seed = async () => {
    setStatus({ state: "loading", message: "Inserting reference data..." });
    try {
      const { error } = await supabase.from("reference_data").upsert(REFERENCE_DATA, {
        onConflict: "category,value,venue",
      });
      if (error) throw new Error(error.message);
      setStatus({ state: "done", message: `Done! ${REFERENCE_DATA.length} records upserted.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5" /> Seed Reference Data</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          {REFERENCE_DATA.length} records: methods, flies, spots (Grafham & Rutland), lines, retrieves, depths
        </p>
        <Button onClick={seed} disabled={status.state === "loading"}>Seed Reference Data</Button>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 5: Reference Data Upload (JSON → edge function) ──
const REF_UPLOAD_TABLES = [
  { value: "ref_flies", label: "Flies (ref_flies)", expectedRows: 556 },
  { value: "ref_rigs", label: "Rigs (ref_rigs)", expectedRows: 53 },
  { value: "ref_retrieves", label: "Retrieves (ref_retrieves)", expectedRows: 35 },
  { value: "ref_lines", label: "Lines (ref_lines)", expectedRows: 35 },
  { value: "ref_leaders", label: "Leaders (ref_leaders)", expectedRows: 25 },
  { value: "ref_tippets", label: "Tippets (ref_tippets)", expectedRows: 29 },
  { value: "ref_rods", label: "Rods (ref_rods)", expectedRows: 82 },
] as const;

function ReferenceDataUploadSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>(REF_UPLOAD_TABLES[0].value);
  const [replaceAll, setReplaceAll] = useState(true);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [progress, setProgress] = useState(0);
  const [tableCounts, setTableCounts] = useState<Record<string, number | string>>({});

  const loadCounts = async () => {
    const results: Record<string, number | string> = {};
    for (const t of REF_UPLOAD_TABLES) {
      const { count, error } = await (supabase.from as any)(t.value).select("*", { count: "exact", head: true });
      results[t.value] = error ? `Error` : (count ?? 0);
    }
    setTableCounts(results);
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });
    setProgress(0);

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      setStatus({ state: "loading", message: `Uploading ${records.length} rows to ${selectedTable}...` });

      const { data, error } = await supabase.functions.invoke("upload-reference-data", {
        body: { table: selectedTable, data: records, mode: replaceAll ? "replace" : "append" },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setProgress(100);
      setStatus({ state: "done", message: `${data.rows_inserted} rows inserted into ${selectedTable} (${replaceAll ? "replaced" : "appended"})` });
      loadCounts();
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" /> Reference Data Upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {REF_UPLOAD_TABLES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Replace all (clear table first)
        </label>
        {status.state === "loading" && (
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Current data</span>
            <Button variant="ghost" size="sm" onClick={loadCounts} className="text-xs h-6 px-2">Refresh counts</Button>
          </div>
          <div className="space-y-1 text-sm font-mono">
            {REF_UPLOAD_TABLES.map(t => (
              <div key={t.value} className="flex justify-between max-w-xs">
                <span>{t.value}:</span>
                <span className="text-muted-foreground">{tableCounts[t.value] ?? "—"} rows</span>
              </div>
            ))}
          </div>
        </div>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 6: Terminology Data (legacy) ──
const TERM_TABLES = [
  { value: "ref_flies", label: "ref_flies", conflict: "pattern_name" },
  { value: "ref_lines", label: "ref_lines", conflict: "line_type_code" },
  { value: "ref_retrieves", label: "ref_retrieves", conflict: "retrieve_name" },
  { value: "ref_rigs", label: "ref_rigs", conflict: "rig_name" },
  { value: "ref_hook_sizes", label: "ref_hook_sizes", conflict: "hook_size" },
  { value: "ref_colours", label: "ref_colours", conflict: "colour" },
  { value: "ref_depths", label: "ref_depths", conflict: "depth_label" },
  { value: "ref_lines_from_reports", label: "ref_lines_from_reports", conflict: "line_type" },
  { value: "fly_water_types", label: "fly_water_types", conflict: "pattern_name,water_type_id" },
  { value: "fish_types", label: "fish_types", conflict: "fish_type_id" },
  { value: "fish_species_game", label: "fish_species_game", conflict: "species_id" },
  { value: "angler_profiles", label: "angler_profiles", conflict: "id" },
  { value: "angler_type_weights", label: "angler_type_weights", conflict: "id" },
] as const;

function TerminologyUploadSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>(TERM_TABLES[0].value);
  const [clearFirst, setClearFirst] = useState(false);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [progress, setProgress] = useState(0);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });
    setProgress(0);

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      if (clearFirst) {
        setStatus({ state: "loading", message: `Clearing ${selectedTable}...` });
        const { error } = await supabase.functions.invoke("upload-terminology", {
          body: { table_name: selectedTable, records: [{ __clear: true }] },
        });
        // Use direct delete for clearing since edge function does upsert
        const { error: delError } = await (supabase.from as any)(selectedTable).delete().neq("id", 0);
        if (delError) throw new Error(`Clear failed: ${delError.message}`);
      }

      const batchSize = 50;
      const totalBatches = Math.ceil(records.length / batchSize);
      let totalInserted = 0, totalFailed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Uploading batch ${i + 1}/${totalBatches}...` });
        setProgress(Math.round(((i + 1) / totalBatches) * 100));

        const { data, error } = await supabase.functions.invoke("upload-terminology", {
          body: { table_name: selectedTable, records: batch },
        });

        if (error) {
          totalFailed += batch.length;
        } else if (data?.success === false) {
          totalFailed += batch.length;
        } else {
          totalInserted += data?.count ?? batch.length;
        }
      }

      setProgress(100);
      setStatus({
        state: totalFailed > 0 ? "error" : "done",
        message: `Successfully uploaded ${totalInserted} records to ${selectedTable}${totalFailed > 0 ? ` (${totalFailed} failed)` : ""}`,
      });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" /> Upload Terminology Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TERM_TABLES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Clear table first
        </label>
        {status.state === "loading" && (
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">Calls upload-terminology edge function in batches of 50</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

const ALL_VERIFY_TABLES = [
  ...TERM_TABLES.map(t => t.value),
  'ref_leaders', 'ref_tippets', 'ref_rods',
];

// ── Verify Tables ──
function VerifyTablesSection() {
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [counts, setCounts] = useState<Record<string, number | string>>({});

  const verify = async () => {
    setStatus({ state: "loading", message: "Querying tables..." });
    setCounts({});
    const results: Record<string, number | string> = {};

    for (const tName of ALL_VERIFY_TABLES) {
      const { count, error } = await (supabase.from as any)(tName).select("*", { count: "exact", head: true });
      results[tName] = error ? `Error: ${error.message}` : (count ?? 0);
    }

    setCounts(results);
    setStatus({ state: "done", message: "Table counts retrieved" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><CheckCircle className="h-5 w-5" /> Verify Tables</CardTitle>
      </CardHeader>
      <CardContent>
        <Button onClick={verify} disabled={status.state === "loading"}>Verify Tables</Button>
        {Object.keys(counts).length > 0 && (
          <div className="mt-3 space-y-1 text-sm font-mono">
            {ALL_VERIFY_TABLES.map(tName => (
              <div key={tName} className="flex justify-between max-w-xs">
                <span>{tName}:</span>
                <span className="text-muted-foreground">{counts[tName] ?? "—"} rows</span>
              </div>
            ))}
          </div>
        )}
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section: Venue Spots ──
function VenueSpotsSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      const batchSize = 50;
      const totalBatches = Math.ceil(records.length / batchSize);
      let totalUpserted = 0, totalFailed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Uploading batch ${i + 1}/${totalBatches}... (${totalUpserted} upserted)` });

        const { data, error } = await supabase.functions.invoke("upload-venue-spots", {
          body: { spots: batch },
        });

        if (error) throw new Error(error.message);
        totalUpserted += data.upserted ?? 0;
        totalFailed += data.failed ?? 0;
      }

      setStatus({ state: "done", message: `Done! ${totalUpserted} upserted, ${totalFailed} failed out of ${records.length} records.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><MapPin className="h-5 w-5" /> Upload Venue Spots</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Upserts into venue_spots (on conflict venue_name, spot_name)</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section 7: Prediction Model Configuration ──
const PREDICTION_TABLES = [
  { value: "prediction_params", label: "prediction_params" },
  { value: "venue_profiles", label: "venue_profiles" },
  { value: "venue_correlations", label: "venue_correlations" },
] as const;

function PredictionConfigSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>(PREDICTION_TABLES[0].value);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [preview, setPreview] = useState<any[] | null>(null);

  const handleFileChange = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setPreview(null);
    try {
      const text = await file.text();
      const records = JSON.parse(text);
      if (Array.isArray(records)) {
        setPreview(records.slice(0, 3));
      }
    } catch {
      setPreview(null);
    }
  };

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      const { data, error } = await supabase.functions.invoke("upload-prediction-config", {
        body: { table: selectedTable, data: records },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setStatus({ state: "done", message: data?.message ?? `Uploaded ${records.length} rows to ${selectedTable}` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" /> Prediction Model Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {PREDICTION_TABLES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input ref={fileRef} type="file" accept=".json" onChange={handleFileChange} className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        {preview && preview.length > 0 && (
          <div className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-40">
            <p className="text-muted-foreground mb-1">Preview (first {preview.length} rows):</p>
            <pre>{JSON.stringify(preview, null, 2)}</pre>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Calls upload-prediction-config edge function</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section: Taxonomy Data ──
const TAXONOMY_TABLES = [
  { value: "fly_types", label: "Fly Types (9 rows)" },
  { value: "water_types", label: "Water Types (10 rows)" },
  { value: "regions", label: "Regions (7 rows)" },
  { value: "fly_species", label: "Fly Species (49 rows)" },
  { value: "species_hatch_calendar", label: "Species Hatch Calendar (509 rows)" },
  { value: "fly_monthly_availability", label: "Fly Monthly Availability (1234 rows)" },
  { value: "fly_species_link", label: "Fly Species Link (663 rows)" },
] as const;

function TaxonomyUploadSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedTable, setSelectedTable] = useState<string>(TAXONOMY_TABLES[0].value);
  const [clearFirst, setClearFirst] = useState(true);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      setStatus({ state: "loading", message: `Uploading ${records.length} rows to ${selectedTable}...` });

      const { data, error } = await supabase.functions.invoke("upload-taxonomy", {
        body: { table: selectedTable, data: records, clear_first: clearFirst },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const inserted = data.inserted ?? 0;
      const failed = data.failed ?? 0;
      const errMsgs = data.errors?.length ? `\nErrors: ${data.errors.join('; ')}` : '';
      setStatus({ state: failed > 0 ? "error" : "done", message: `${inserted} inserted, ${failed} failed into ${selectedTable}.${errMsgs}` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" /> Upload Taxonomy Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {TAXONOMY_TABLES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={clearFirst} onChange={e => setClearFirst(e.target.checked)} className="h-4 w-4 rounded border-input" />
          Clear table first (default: checked)
        </label>
        <p className="text-xs text-muted-foreground">Calls upload-taxonomy edge function. Upload parent tables (fly_types, water_types, regions) before child tables.</p>
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section: Diary Sessions Upload ──
function DiarySessionsSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [progress, setProgress] = useState(0);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });
    setProgress(0);

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      const batchSize = 50;
      const totalBatches = Math.ceil(records.length / batchSize);
      let totalInserted = 0, totalFailed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Uploading batch ${i + 1}/${totalBatches}... (${totalInserted} inserted)` });
        setProgress(Math.round(((i + 1) / totalBatches) * 100));

        const { data, error } = await supabase.functions.invoke("upload-diary-sessions", {
          body: { sessions: batch },
        });

        if (error) { totalFailed += batch.length; continue; }
        totalInserted += data.inserted ?? 0;
        totalFailed += data.failed ?? 0;
      }

      setProgress(100);
      setStatus({ state: totalFailed > 0 ? "error" : "done", message: `Done! ${totalInserted} inserted, ${totalFailed} failed out of ${records.length} records.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" /> Upload Diary Sessions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <p className="text-xs text-muted-foreground">Upserts into fishing_sessions in batches of 50 (on conflict: id)</p>
        {status.state === "loading" && (
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Section: Diary Events Upload ──
function DiaryEventsSection() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ state: "idle", message: "" });
  const [progress, setProgress] = useState(0);

  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ state: "error", message: "Select a JSON file first" });
    setStatus({ state: "loading", message: "Reading file..." });
    setProgress(0);

    try {
      const text = await file.text();
      const records: any[] = JSON.parse(text);
      if (!Array.isArray(records)) throw new Error("JSON must be an array");

      const batchSize = 100;
      const totalBatches = Math.ceil(records.length / batchSize);
      let totalInserted = 0, totalFailed = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = records.slice(i * batchSize, (i + 1) * batchSize);
        setStatus({ state: "loading", message: `Uploading batch ${i + 1}/${totalBatches}... (${totalInserted} inserted)` });
        setProgress(Math.round(((i + 1) / totalBatches) * 100));

        const { data, error } = await supabase.functions.invoke("upload-diary-events", {
          body: { events: batch },
        });

        if (error) { totalFailed += batch.length; continue; }
        totalInserted += data.inserted ?? 0;
        totalFailed += data.failed ?? 0;
      }

      setProgress(100);
      setStatus({ state: totalFailed > 0 ? "error" : "done", message: `Done! ${totalInserted} inserted, ${totalFailed} failed out of ${records.length} records.` });
    } catch (err: any) {
      setStatus({ state: "error", message: err.message });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg"><Upload className="h-5 w-5" /> Upload Diary Events</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-3">
          <Input ref={fileRef} type="file" accept=".json" className="max-w-xs" />
          <Button onClick={upload} disabled={status.state === "loading"}>Upload</Button>
        </div>
        <p className="text-xs text-muted-foreground">Upserts into session_events in batches of 100 (on conflict: id)</p>
        {status.state === "loading" && (
          <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
            <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <StatusBadge status={status} />
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function AdminUpload() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin Upload</h1>
          <p className="text-sm text-muted-foreground">Temporary admin tool — not linked from navigation</p>
        </div>
        <a href="/admin/db-status" className="text-sm text-primary underline hover:no-underline">DB Status →</a>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <Link to="/admin/test-advice" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">AI Advice Test Runner</p>
                <p className="text-xs text-muted-foreground">Run automated tests against the advice pipeline</p>
              </div>
              <span className="ml-auto text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <Link to="/admin/recompute" className="flex items-center gap-3 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Calculator className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">Recompute Summaries</p>
                <p className="text-xs text-muted-foreground">Batch compute session summaries, angler stats, and venue stats</p>
              </div>
              <span className="ml-auto text-muted-foreground group-hover:text-primary transition-colors">→</span>
            </Link>
          </CardContent>
        </Card>
      </div>

      <DiarySessionsSection />
      <DiaryEventsSection />
      <FishingReportsSection />
      <VenueSpotsSection />
      <BasicAdviceSection />
      <VenueMetadataSection />
      <ReferenceDataSection />
      <ReferenceDataUploadSection />
      <TerminologyUploadSection />
      <TaxonomyUploadSection />
      <PredictionConfigSection />
      <VerifyTablesSection />
    </div>
  );
}
