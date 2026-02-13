import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Database, MapPin, Tag, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

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

// ── Main Page ──
export default function AdminUpload() {
  return (
    <div className="min-h-screen bg-background p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Upload</h1>
        <p className="text-sm text-muted-foreground">Temporary admin tool — not linked from navigation</p>
      </div>
      <FishingReportsSection />
      <BasicAdviceSection />
      <VenueMetadataSection />
      <ReferenceDataSection />
    </div>
  );
}
