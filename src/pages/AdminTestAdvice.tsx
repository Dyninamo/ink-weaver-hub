import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TestCall {
  id: string;
  body: Record<string, unknown>;
}

const TEST_CALLS: TestCall[] = [
  {
    id: "A",
    body: {
      venue_name: "Grafham Water",
      target_date: "2026-04-15",
      debug: true,
      skip_ai: true,
      forecast_override: { temp: 9.0, wind_speed_mph: 12.0, precip_mm_3h: 5.0, pressure: 1018, humidity: 72, wind_dir: "SW" },
    },
  },
  {
    id: "B",
    body: {
      venue_name: "Pitsford Water",
      target_date: "2026-08-15",
      debug: true,
      skip_ai: true,
      forecast_override: { temp: 18.0, wind_speed_mph: 6.0, precip_mm_3h: 0.0, pressure: 1022, humidity: 65, wind_dir: "NE" },
    },
  },
  {
    id: "C",
    body: {
      venue_name: "Grafham Water",
      target_date: "2026-04-15",
      debug: true,
      skip_ai: true,
      forecast_override: { temp: 5.0, wind_speed_mph: 12.0, precip_mm_3h: 5.0, pressure: 1018, humidity: 72, wind_dir: "SW" },
    },
  },
  {
    id: "D",
    body: {
      venue_name: "Grafham Water",
      target_date: "2026-04-15",
      debug: true,
      skip_ai: true,
      forecast_override: { temp: 9.0, wind_speed_mph: 12.0, precip_mm_3h: 5.0, pressure: 990, humidity: 72, wind_dir: "SW" },
    },
  },
  {
    id: "E",
    body: {
      venue_name: "Grafham Water",
      target_date: "2026-08-15",
      debug: true,
      skip_ai: true,
      forecast_override: { temp: 18.0, wind_speed_mph: 8.0, precip_mm_3h: 0.0, pressure: 1020, humidity: 70, wind_dir: "W" },
    },
  },
];

async function makeCall(call: TestCall): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-ai-advice-v2`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(call.body),
  });
  if (!res.ok) throw new Error(`Call ${call.id} failed: ${res.status}`);
  return res.json();
}

interface TestResult {
  id: string;
  name: string;
  group: string;
  pass: boolean;
  detail: string;
  actual?: unknown;
  expected?: string;
}

type ResponseMap = Map<string, unknown>;

interface TestDef {
  id: string;
  name: string;
  group: string;
  calls: string[];
  validate: (responses: ResponseMap) => TestResult;
}

const TESTS: TestDef[] = [
  // Group 1: Infrastructure
  {
    id: "1.1", name: "Debug block is returned", group: "Infrastructure", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const pass = a?.debug != null && (a?.debug as Record<string, unknown>)?.forecast_used != null;
      return { id: "1.1", name: "Debug block is returned", group: "Infrastructure", pass, detail: pass ? "debug block present with forecast_used" : "debug block missing" };
    },
  },
  {
    id: "1.2", name: "Forecast override source = 'override'", group: "Infrastructure", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const source = (a?.debug as Record<string, unknown>)?.forecast_used as Record<string, unknown>;
      const src = source?.source;
      return { id: "1.2", name: "Forecast override source = 'override'", group: "Infrastructure", pass: src === "override", detail: `source = "${src}"`, actual: src, expected: "override" };
    },
  },
  {
    id: "1.3", name: "Precip category: 5mm/3h -> Moderate", group: "Infrastructure", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const fu = ((a?.debug as Record<string, unknown>)?.forecast_used) as Record<string, unknown>;
      const catName = fu?.precip_cat_name;
      const catNum = fu?.precip_cat;
      return { id: "1.3", name: "Precip category: 5mm/3h -> Moderate", group: "Infrastructure", pass: catName === "Moderate" && catNum === 2, detail: `precip_cat=${catNum} (${catName})`, actual: catName, expected: "Moderate (cat 2)" };
    },
  },
  {
    id: "1.4", name: "Dry precip: 0mm/3h -> Dry", group: "Infrastructure", calls: ["B"],
    validate: (r) => {
      const b = r.get("B") as Record<string, unknown>;
      const fu = ((b?.debug as Record<string, unknown>)?.forecast_used) as Record<string, unknown>;
      const catName = fu?.precip_cat_name;
      const catNum = fu?.precip_cat;
      return { id: "1.4", name: "Dry precip: 0mm/3h -> Dry", group: "Infrastructure", pass: catName === "Dry" && catNum === 0, detail: `precip_cat=${catNum} (${catName})`, actual: catName, expected: "Dry (cat 0)" };
    },
  },
  {
    id: "1.5", name: "skip_ai returns test mode text", group: "Infrastructure", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const advice = (a?.advice as string) ?? "";
      const pass = advice.includes("test mode") || advice.includes("AI generation skipped");
      return { id: "1.5", name: "skip_ai returns test mode text", group: "Infrastructure", pass, detail: pass ? "AI skipped as expected" : `advice text: "${advice.substring(0, 80)}..."` };
    },
  },
  // Group 2: Params
  {
    id: "2.1", name: "Grafham params: w_temperature = 2.0", group: "Params", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const pu = ((a?.debug as Record<string, unknown>)?.params_used) as Record<string, unknown>;
      const wTemp = ((pu?.rod_average) as Record<string, unknown>)?.w_temperature;
      return { id: "2.1", name: "Grafham params: w_temperature = 2.0", group: "Params", pass: wTemp === 2.0, detail: `w_temperature = ${wTemp}`, actual: wTemp, expected: "2.0" };
    },
  },
  {
    id: "2.2", name: "Pitsford params: w_precipitation = 1.5", group: "Params", calls: ["B"],
    validate: (r) => {
      const b = r.get("B") as Record<string, unknown>;
      const pu = ((b?.debug as Record<string, unknown>)?.params_used) as Record<string, unknown>;
      const wPrecip = ((pu?.rod_average) as Record<string, unknown>)?.w_precipitation;
      return { id: "2.2", name: "Pitsford params: w_precipitation = 1.5", group: "Params", pass: wPrecip === 1.5, detail: `w_precipitation = ${wPrecip}`, actual: wPrecip, expected: "1.5" };
    },
  },
  // Group 3: Predictions
  {
    id: "3.1", name: "Grafham April rod_average in [5, 15]", group: "Predictions", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const pred = ((a?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted as number;
      const pass = pred != null && pred >= 5 && pred <= 15;
      return { id: "3.1", name: "Grafham April rod_average in [5, 15]", group: "Predictions", pass, detail: `predicted = ${pred}`, actual: pred, expected: "5-15" };
    },
  },
  {
    id: "3.2", name: "Pitsford August rod_average in [1, 6]", group: "Predictions", calls: ["B"],
    validate: (r) => {
      const b = r.get("B") as Record<string, unknown>;
      const pred = ((b?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted as number;
      const pass = pred != null && pred >= 1 && pred <= 6;
      return { id: "3.2", name: "Pitsford August rod_average in [1, 6]", group: "Predictions", pass, detail: `predicted = ${pred}`, actual: pred, expected: "1-6" };
    },
  },
  {
    id: "3.3", name: "Grafham April top flies include Buzzer", group: "Predictions", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const flies = ((a?.prediction as Record<string, unknown>)?.flies as Array<Record<string, unknown>>) ?? [];
      const flyNames = flies.map((f) => f.fly as string);
      const hasBuzzer = flyNames.some((n) => n?.toLowerCase().includes("buzzer"));
      return { id: "3.3", name: "Grafham April top flies include Buzzer", group: "Predictions", pass: hasBuzzer, detail: `top flies: ${flyNames.slice(0, 5).join(", ")}`, actual: flyNames.slice(0, 5).join(", "), expected: "includes Buzzer" };
    },
  },
  {
    id: "3.4", name: "Grafham has >= 15 candidates in window", group: "Predictions", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const total = (a?.debug as Record<string, unknown>)?.total_candidates_in_window as number;
      const pass = total != null && total >= 15;
      return { id: "3.4", name: "Grafham has >= 15 candidates in window", group: "Predictions", pass, detail: `total_candidates_in_window = ${total}`, actual: total, expected: ">= 15" };
    },
  },
  // Group 4: Sensitivity
  {
    id: "4.1", name: "Temp sensitivity: 9C != 5C rod_average", group: "Sensitivity", calls: ["A", "C"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const c = r.get("C") as Record<string, unknown>;
      const predA = ((a?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted;
      const predC = ((c?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted;
      const pass = predA != null && predC != null && predA !== predC;
      return { id: "4.1", name: "Temp sensitivity: 9C != 5C rod_average", group: "Sensitivity", pass, detail: `9C -> ${predA}, 5C -> ${predC}`, actual: `${predA} vs ${predC}`, expected: "different values" };
    },
  },
  {
    id: "4.2", name: "Pressure insensitivity (w_pressure=0)", group: "Sensitivity", calls: ["A", "D"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const d = r.get("D") as Record<string, unknown>;
      const predA = ((a?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted;
      const predD = ((d?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted;
      const pass = predA === predD;
      return { id: "4.2", name: "Pressure insensitivity (w_pressure=0)", group: "Sensitivity", pass, detail: `1018hPa -> ${predA}, 990hPa -> ${predD}`, actual: `${predA} vs ${predD}`, expected: "identical values" };
    },
  },
  // Group 5: Seasonal
  {
    id: "5.1", name: "Seasonal: April > August rod_average", group: "Seasonal", calls: ["A", "E"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const e = r.get("E") as Record<string, unknown>;
      const april = ((a?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted as number;
      const august = ((e?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted as number;
      const pass = april != null && august != null && april > august;
      return { id: "5.1", name: "Seasonal: April > August rod_average", group: "Seasonal", pass, detail: `April = ${april}, August = ${august}`, actual: `${april} > ${august}`, expected: "April > August" };
    },
  },
  // Group 6: Coherence
  {
    id: "6.1", name: "Response has all required fields", group: "Coherence", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const pred = a?.prediction as Record<string, unknown>;
      const checks: [string, boolean][] = [
        ["prediction", pred != null],
        ["prediction.rod_average", pred?.rod_average != null],
        ["prediction.rod_average.predicted", (pred?.rod_average as Record<string, unknown>)?.predicted != null],
        ["prediction.flies", Array.isArray(pred?.flies)],
        ["prediction.methods", Array.isArray(pred?.methods)],
        ["prediction.spots", Array.isArray(pred?.spots)],
        ["weather", a?.weather != null],
        ["confidence", a?.confidence != null],
        ["season", typeof a?.season === "string"],
        ["reportCount", typeof a?.reportCount === "number"],
      ];
      const failing = checks.filter(([, ok]) => !ok).map(([name]) => name);
      return { id: "6.1", name: "Response has all required fields", group: "Coherence", pass: failing.length === 0, detail: failing.length === 0 ? "all fields present" : `missing: ${failing.join(", ")}` };
    },
  },
  {
    id: "6.2", name: "rod_average > 0", group: "Coherence", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const pred = ((a?.prediction as Record<string, unknown>)?.rod_average as Record<string, unknown>)?.predicted;
      const pass = typeof pred === "number" && pred > 0;
      return { id: "6.2", name: "rod_average > 0", group: "Coherence", pass, detail: `predicted = ${pred} (${typeof pred})`, actual: pred, expected: "> 0" };
    },
  },
  {
    id: "6.3", name: "At least one fly in predictions", group: "Coherence", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const flies = ((a?.prediction as Record<string, unknown>)?.flies as unknown[]) ?? [];
      return { id: "6.3", name: "At least one fly in predictions", group: "Coherence", pass: flies.length > 0, detail: `${flies.length} flies returned`, actual: flies.length, expected: ">= 1" };
    },
  },
  {
    id: "6.4", name: "Debug candidates have distances, sorted ascending", group: "Coherence", calls: ["A"],
    validate: (r) => {
      const a = r.get("A") as Record<string, unknown>;
      const candidates = ((a?.debug as Record<string, unknown>)?.candidate_reports as Array<Record<string, unknown>>) ?? [];
      const hasDistances = candidates.length > 0 && candidates[0]?.distance != null;
      const isSorted = candidates.every((c, i) => i === 0 || (c.distance as number) >= (candidates[i - 1].distance as number));
      return { id: "6.4", name: "Debug candidates have distances, sorted ascending", group: "Coherence", pass: hasDistances && isSorted, detail: `${candidates.length} candidates, sorted=${isSorted}` };
    },
  },
];

const GROUP_ORDER = ["Infrastructure", "Params", "Predictions", "Sensitivity", "Seasonal", "Coherence"];

export default function AdminTestAdvice() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<TestResult[]>([]);
  const [rawResponses, setRawResponses] = useState<Map<string, unknown>>(new Map());
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [openRaw, setOpenRaw] = useState(false);
  const [openCalls, setOpenCalls] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const runTests = async () => {
    setRunning(true);
    setResults([]);
    setProgress(0);
    setError(null);
    setTimeTaken(null);
    const start = Date.now();

    try {
      // Make all 5 calls in parallel
      const callResults = await Promise.allSettled(TEST_CALLS.map(makeCall));
      const responseMap = new Map<string, unknown>();

      TEST_CALLS.forEach((call, i) => {
        const result = callResults[i];
        if (result.status === "fulfilled") {
          responseMap.set(call.id, result.value);
        } else {
          responseMap.set(call.id, { error: result.reason?.message ?? "Failed" });
        }
      });

      setRawResponses(responseMap);
      setProgress(50);

      // Run all tests
      const testResults: TestResult[] = TESTS.map((t) => {
        try {
          return t.validate(responseMap);
        } catch (e) {
          return { id: t.id, name: t.name, group: t.group, pass: false, detail: `Test threw: ${e}` };
        }
      });

      setResults(testResults);
      setProgress(100);
      setTimeTaken((Date.now() - start) / 1000);
    } catch (e) {
      setError(`Failed to run tests: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;

  const groupedResults = GROUP_ORDER.map((group) => ({
    group,
    items: results.filter((r) => r.group === group),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link to="/admin/upload" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Link>
          <h1 className="text-2xl font-bold text-foreground">AI Advice v2 — Test Runner</h1>
          <p className="text-muted-foreground mt-1">
            Validates the advice pipeline with 5 deterministic API calls and {TESTS.length} tests.
          </p>
        </div>

        {/* Run button + progress */}
        <div className="mb-6 flex items-center gap-4">
          <Button onClick={runTests} disabled={running} size="lg">
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running…
              </>
            ) : (
              "Run All Tests"
            )}
          </Button>
          {running && (
            <div className="flex-1">
              <Progress value={progress} className="h-2" />
            </div>
          )}
          {results.length > 0 && !running && (
            <span className="text-sm text-muted-foreground">
              Completed in {timeTaken?.toFixed(1)}s
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results table */}
        {results.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left w-8">Status</th>
                  <th className="px-3 py-2 text-left w-12">ID</th>
                  <th className="px-3 py-2 text-left">Test Name</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Actual</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">Expected</th>
                  <th className="px-3 py-2 text-left">Detail</th>
                </tr>
              </thead>
              <tbody>
              {groupedResults.map(({ group, items }) => (
                  <tbody key={group}>
                    <tr className="bg-muted/20">
                      <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {group}
                      </td>
                    </tr>
                    {items.map((result) => (
                      <tr
                        key={result.id}
                        className={`border-t border-border/50 ${result.pass ? "bg-green-500/5" : "bg-destructive/5"}`}
                      >
                        <td className="px-3 py-2">
                          {result.pass ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{result.id}</td>
                        <td className="px-3 py-2 font-medium">{result.name}</td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell">
                          {result.actual !== undefined ? String(result.actual) : "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-muted-foreground hidden md:table-cell">
                          {result.expected ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{result.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary card */}
        {results.length > 0 && (
          <div className="rounded-lg border border-border p-4 mb-6 flex flex-wrap gap-4 items-center">
            <div className="text-sm text-muted-foreground">
              Total: <span className="font-semibold text-foreground">{results.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-semibold text-green-600">{passed} passed</span>
            </div>
            {failed > 0 && (
              <div className="flex items-center gap-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-600">{failed} failed</span>
              </div>
            )}
            {failed === 0 && (
              <Badge variant="outline" className="border-green-500 text-green-600">All passing</Badge>
            )}
          </div>
        )}

        {/* Raw responses collapsible */}
        {rawResponses.size > 0 && (
          <Collapsible open={openRaw} onOpenChange={setOpenRaw}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="mb-3">
                {openRaw ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                Raw Responses ({rawResponses.size} calls)
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-3">
                {Array.from(rawResponses.entries()).map(([id, data]) => (
                  <Collapsible
                    key={id}
                    open={openCalls[id]}
                    onOpenChange={(v) => setOpenCalls((prev) => ({ ...prev, [id]: v }))}
                  >
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-start font-mono text-xs">
                        {openCalls[id] ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                        {`Call ${id} — ${String(TEST_CALLS.find((c) => c.id === id)?.body.venue_name ?? "")} ${String(TEST_CALLS.find((c) => c.id === id)?.body.target_date ?? "")}`}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-96 mt-1">
                        {JSON.stringify(data, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
