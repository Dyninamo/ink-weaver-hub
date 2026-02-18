import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, ArrowLeft, FishSymbol } from "lucide-react";
import { toast } from "sonner";

interface RodSetup {
  id: string;
  name: string;
  rod_name: string | null;
  style: string | null;
  rig: string | null;
  line_type: string | null;
  retrieve: string | null;
  depth_zone: string | null;
  default_flies: any | null;
  usage_count: number;
  last_used_at: string | null;
}

const EMPTY_SETUP: Omit<RodSetup, 'id' | 'usage_count' | 'last_used_at'> = {
  name: '',
  rod_name: null,
  style: null,
  rig: null,
  line_type: null,
  retrieve: null,
  depth_zone: null,
  default_flies: null,
};

export default function DiarySetups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [setups, setSetups] = useState<RodSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<RodSetup | null>(null);
  const [form, setForm] = useState(EMPTY_SETUP);

  useEffect(() => {
    if (user) fetchSetups();
  }, [user]);

  async function fetchSetups() {
    setLoading(true);
    const { data, error } = await supabase
      .from('user_rod_setups')
      .select('*')
      .eq('user_id', user!.id)
      .order('usage_count', { ascending: false });
    if (error) {
      toast.error('Failed to load setups');
      console.error(error);
    } else {
      setSetups(data || []);
    }
    setLoading(false);
  }

  function openCreate() {
    setEditingSetup(null);
    setForm(EMPTY_SETUP);
    setDialogOpen(true);
  }

  function openEdit(setup: RodSetup) {
    setEditingSetup(setup);
    setForm({
      name: setup.name,
      rod_name: setup.rod_name,
      style: setup.style,
      rig: setup.rig,
      line_type: setup.line_type,
      retrieve: setup.retrieve,
      depth_zone: setup.depth_zone,
      default_flies: setup.default_flies,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Setup name is required');
      return;
    }

    if (editingSetup) {
      const { error } = await supabase
        .from('user_rod_setups')
        .update({ ...form })
        .eq('id', editingSetup.id);
      if (error) {
        toast.error('Failed to update setup');
        return;
      }
      toast.success('Setup updated');
    } else {
      const { error } = await supabase
        .from('user_rod_setups')
        .insert({ ...form, user_id: user!.id });
      if (error) {
        toast.error('Failed to create setup');
        return;
      }
      toast.success('Setup created');
    }

    setDialogOpen(false);
    fetchSetups();
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('user_rod_setups')
      .delete()
      .eq('id', id);
    if (error) {
      toast.error('Failed to delete setup');
      return;
    }
    toast.success('Setup deleted');
    fetchSetups();
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/diary')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Saved Setups</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Create named rod setups to quickly load your favourite configurations when starting a session.
        </p>

        {/* Create button */}
        <Button onClick={openCreate} className="w-full">
          <Plus className="h-4 w-4 mr-2" /> New Setup
        </Button>

        {/* Setup cards */}
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : setups.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <FishSymbol className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">No saved setups yet</p>
            <p className="text-sm text-muted-foreground/60">
              Create your first setup to speed up session starts
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {setups.map((setup) => (
              <Card key={setup.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <h3 className="font-medium">{setup.name}</h3>
                      <div className="text-sm text-muted-foreground space-y-0.5">
                        {setup.style && <p>Style: {setup.style}</p>}
                        {setup.rig && <p>Rig: {setup.rig}</p>}
                        {setup.line_type && <p>Line: {setup.line_type}</p>}
                        {setup.retrieve && <p>Retrieve: {setup.retrieve}</p>}
                        {setup.depth_zone && <p>Depth: {setup.depth_zone}</p>}
                      </div>
                      {setup.usage_count > 0 && (
                        <p className="text-xs text-muted-foreground/60">
                          Used {setup.usage_count} time{setup.usage_count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(setup)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(setup.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-[400px]">
            <DialogHeader>
              <DialogTitle>{editingSetup ? 'Edit Setup' : 'New Setup'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Setup Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g. Helios 6ft Floating Buzzer"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="rod_name">Rod</Label>
                <Input
                  id="rod_name"
                  placeholder="e.g. Sage Igniter 9ft 6wt"
                  value={form.rod_name || ''}
                  onChange={(e) => setForm({ ...form, rod_name: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="style">Style</Label>
                <Input
                  id="style"
                  placeholder="e.g. Buzzer, Lure, Nymph"
                  value={form.style || ''}
                  onChange={(e) => setForm({ ...form, style: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="rig">Rig</Label>
                <Input
                  id="rig"
                  placeholder="e.g. Washing Line - Floating Line"
                  value={form.rig || ''}
                  onChange={(e) => setForm({ ...form, rig: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="line_type">Line</Label>
                <Input
                  id="line_type"
                  placeholder="e.g. Floating, Intermediate, Di-5"
                  value={form.line_type || ''}
                  onChange={(e) => setForm({ ...form, line_type: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="retrieve">Retrieve</Label>
                <Input
                  id="retrieve"
                  placeholder="e.g. Figure-of-Eight Slow"
                  value={form.retrieve || ''}
                  onChange={(e) => setForm({ ...form, retrieve: e.target.value || null })}
                />
              </div>
              <div>
                <Label htmlFor="depth_zone">Depth Zone</Label>
                <Input
                  id="depth_zone"
                  placeholder="e.g. Upper, Mid, Deep"
                  value={form.depth_zone || ''}
                  onChange={(e) => setForm({ ...form, depth_zone: e.target.value || null })}
                />
              </div>
              <Button onClick={handleSave} className="w-full">
                {editingSetup ? 'Update Setup' : 'Create Setup'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
