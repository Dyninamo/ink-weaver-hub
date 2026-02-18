import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Database, ArrowLeft, Download } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TableInfo {
  table_name: string;
  row_count: number | null;
  columns?: { column_name: string; data_type: string }[];
  latest_date?: string | null;
  error?: string;
}

interface AuditResult {
  tables: TableInfo[];
  queried_at: string;
}

type SectionKey = 'core' | 'reference' | 'model' | 'infrastructure' | 'taxonomy' | 'other';

function categorize(name: string): SectionKey {
  if (['fishing_reports', 'basic_advice', 'queries', 'diary_entries', 'diary_fish', 'diary_as_reports (view)'].includes(name)) return 'core';
  if (name.startsWith('ref_') || name === 'reference_data') return 'reference';
  if (['prediction_params', 'venue_profiles', 'venue_correlations', 'venue_metadata'].includes(name)) return 'model';
  if (['user_profiles', 'verification_codes', 'shared_reports', 'share_views'].includes(name)) return 'infrastructure';
  if (['fly_types', 'water_types', 'regions', 'fly_species', 'species_hatch_calendar', 'fly_monthly_availability', 'fly_species_link'].includes(name)) return 'taxonomy';
  return 'other';
}

const sectionLabels: Record<SectionKey, string> = {
  core: 'Core Data',
  reference: 'Reference / Terminology',
  model: 'Model / Prediction',
  taxonomy: 'Fly Taxonomy',
  infrastructure: 'Infrastructure',
  other: 'Other',
};

const sectionOrder: SectionKey[] = ['core', 'reference', 'taxonomy', 'model', 'infrastructure', 'other'];

export default function AdminDbStatus() {
  const [data, setData] = useState<AuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke('db-audit');
      if (fnErr) throw fnErr;
      setData(result as AuditResult);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, []);

  const totalRows = data?.tables.reduce((sum, t) => sum + (t.row_count ?? 0), 0) ?? 0;

  const handleExport = () => {
    if (!data) return;
    const exportData = data.tables.map(t => ({
      table_name: t.table_name,
      row_count: t.row_count ?? 0,
      columns: (t.columns || []).map(c => ({ name: c.column_name, type: c.data_type })),
    }));
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supabase_db_status_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const grouped = data?.tables.reduce<Record<SectionKey, TableInfo[]>>((acc, t) => {
    const cat = categorize(t.table_name);
    (acc[cat] ??= []).push(t);
    return acc;
  }, {} as Record<SectionKey, TableInfo[]>);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin/upload">
          <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Database className="h-6 w-6" /> DB Status
        </h1>
        <div className="ml-auto flex gap-2">
          {data && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          )}
          <Button onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {data ? 'Refresh' : 'Load'}
          </Button>
        </div>
      </div>

      {data && (
        <Card className="mb-6">
          <CardContent className="py-4 flex flex-wrap gap-6 text-sm">
            <span><strong>{data.tables.length}</strong> tables</span>
            <span><strong>{totalRows.toLocaleString()}</strong> total rows</span>
            <span>Refreshed: {new Date(data.queried_at).toLocaleString()}</span>
          </CardContent>
        </Card>
      )}

      {error && <p className="text-destructive mb-4">{error}</p>}

      {grouped && sectionOrder.map(section => {
        const tables = grouped[section];
        if (!tables?.length) return null;
        const isInfra = section === 'infrastructure';

        return (
          <Card key={section} className="mb-6">
            <CardHeader className="py-3">
              <CardTitle className="text-lg">{sectionLabels[section]}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    <TableHead className="text-right w-24">Rows</TableHead>
                    {!isInfra && <TableHead>Columns</TableHead>}
                    {!isInfra && <TableHead className="w-44">Latest Record</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map(t => (
                    <TableRow key={t.table_name}>
                      <TableCell className="font-mono text-xs">{t.table_name}</TableCell>
                      <TableCell className="text-right">
                        {t.error ? <Badge variant="destructive">err</Badge> : (t.row_count ?? 0).toLocaleString()}
                      </TableCell>
                      {!isInfra && (
                        <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                          {t.columns?.map(c => c.column_name).join(', ') || '—'}
                        </TableCell>
                      )}
                      {!isInfra && (
                        <TableCell className="text-xs text-muted-foreground">
                          {t.latest_date ? new Date(t.latest_date).toLocaleDateString() : '—'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
