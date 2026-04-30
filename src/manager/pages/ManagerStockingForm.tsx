import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useVenueBySlug } from "@/manager/hooks/useVenueBySlug";
import ManagerLayout from "@/manager/ManagerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPECIES_OPTIONS, speciesLabel } from "@/manager/utils/slug";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const SUPPLIER_RATE_LB = 2.2;

const formSchema = z.object({
  date_stocked: z.string().min(1, "Required"),
  species: z.string().min(1, "Required"),
  quantity: z.coerce.number().int().positive("Must be > 0"),
  avg_weight_lb: z.coerce.number().positive("Must be > 0"),
  supplier_name: z.string().min(1, "Required"),
  ea_permit_ref: z.string().optional().nullable(),
  cost_total: z.coerce.number().nonnegative().optional().nullable(),
  distribution_summary: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

const today = format(new Date(), "yyyy-MM-dd");

export default function ManagerStockingForm() {
  const { slug, id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { venue, isLoading, notFound, scope } = useVenueBySlug(slug);
  const [loadingEvent, setLoadingEvent] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pastSummaries, setPastSummaries] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date_stocked: today,
      species: "rainbow",
      quantity: 0 as unknown as number,
      avg_weight_lb: 0 as unknown as number,
      supplier_name: "",
      ea_permit_ref: "",
      cost_total: null,
      distribution_summary: "",
      notes: "",
    },
  });

  const quantity = watch("quantity");
  const avgWeight = watch("avg_weight_lb");
  const dateStocked = watch("date_stocked");
  const species = watch("species");
  const distSummary = watch("distribution_summary");

  const estimate = useMemo(() => {
    const q = Number(quantity || 0);
    const w = Number(avgWeight || 0);
    return q > 0 && w > 0 ? q * w * SUPPLIER_RATE_LB : 0;
  }, [quantity, avgWeight]);

  // Load past distribution summaries to populate dropdown
  useEffect(() => {
    if (!venue) return;
    (async () => {
      const { data } = await supabase
        .from("stocking_events")
        .select("distribution_summary")
        .eq("venue_id", venue.venue_id)
        .not("distribution_summary", "is", null);
      const set = new Set<string>();
      (data ?? []).forEach((r: any) => {
        if (r.distribution_summary) set.add(r.distribution_summary as string);
      });
      setPastSummaries(Array.from(set));
    })();
  }, [venue]);

  // Load event for edit
  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      setLoadingEvent(true);
      const { data, error } = await supabase
        .from("stocking_events")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error || !data) {
        toast.error("Couldn't load event");
        navigate(`/manager/${slug}`);
        return;
      }
      reset({
        date_stocked: data.date_stocked,
        species: data.species,
        quantity: Number(data.quantity),
        avg_weight_lb: Number(data.avg_weight_lb),
        supplier_name: data.supplier_name ?? "",
        ea_permit_ref: data.ea_permit_ref ?? "",
        cost_total: data.cost_total != null ? Number(data.cost_total) : null,
        distribution_summary: data.distribution_summary ?? "",
        notes: data.notes ?? "",
      });
      setLoadingEvent(false);
    })();
  }, [isEdit, id, reset, navigate, slug]);

  if (isLoading || loadingEvent) {
    return (
      <ManagerLayout currentVenue={venue ?? undefined}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  if (notFound || !venue) {
    return (
      <ManagerLayout>
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Venue not found.</p>
        </Card>
      </ManagerLayout>
    );
  }

  const grant = scope.grantsByVenue[venue.venue_id];
  const canWrite = grant?.scope_type === "venue";

  if (!canWrite) {
    return (
      <ManagerLayout currentVenue={venue}>
        <Card className="p-6 text-center max-w-xl mx-auto">
          <h2 className="font-semibold">Read-only access</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need venue-level access to log stocking events. Contact your group owner.
          </p>
          <Button variant="outline" className="mt-4" asChild>
            <Link to={`/manager/${slug}`}>Back</Link>
          </Button>
        </Card>
      </ManagerLayout>
    );
  }

  const submit = async (values: FormValues, mode: "save" | "another") => {
    if (values.date_stocked > today) {
      toast.error("Date can't be in the future");
      return;
    }
    setSaving(true);
    const cost_estimate = Number((values.quantity * values.avg_weight_lb * SUPPLIER_RATE_LB).toFixed(2));
    const payload = {
      venue_id: venue.venue_id,
      date_stocked: values.date_stocked,
      species: values.species,
      quantity: values.quantity,
      avg_weight_lb: values.avg_weight_lb,
      supplier_name: values.supplier_name || null,
      ea_permit_ref: values.ea_permit_ref || null,
      cost_total: values.cost_total ?? null,
      cost_estimate,
      distribution_summary: values.distribution_summary || null,
      notes: values.notes || null,
      created_by: grant.manager_id,
      triploid: values.species.startsWith("triploid_"),
    };

    if (isEdit && id) {
      const { error } = await supabase.from("stocking_events").update(payload).eq("id", id);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Stocking event updated");
      navigate(`/manager/${slug}`);
    } else {
      const { error } = await supabase.from("stocking_events").insert(payload);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
      toast.success("Stocking event saved");
      if (mode === "another") {
        reset({
          date_stocked: today,
          species: "rainbow",
          quantity: 0 as unknown as number,
          avg_weight_lb: 0 as unknown as number,
          supplier_name: payload.supplier_name ?? "",
          ea_permit_ref: payload.ea_permit_ref ?? "",
          cost_total: null,
          distribution_summary: "",
          notes: "",
        });
        setSaving(false);
      } else {
        navigate(`/manager/${slug}`);
      }
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !id) return;
    setDeleting(true);
    const { error } = await supabase.from("stocking_events").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      setDeleting(false);
      return;
    }
    toast.success("Stocking event deleted");
    navigate(`/manager/${slug}`);
  };

  return (
    <ManagerLayout currentVenue={venue}>
      <nav className="text-xs text-muted-foreground mb-3">
        <Link to="/manager" className="hover:text-foreground">Manager</Link>
        <span className="mx-1.5">»</span>
        <Link to={`/manager/${slug}`} className="hover:text-foreground">{venue.name}</Link>
        <span className="mx-1.5">»</span>
        <span className="text-foreground">{isEdit ? "Edit stocking event" : "Log stocking event"}</span>
      </nav>

      <Card className="p-5 max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">
          {isEdit ? "Edit stocking event" : "Log a stocking event"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{venue.name}</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit((v) => submit(v, "save"))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Date stocked" error={errors.date_stocked?.message}>
              <Input type="date" max={today} {...register("date_stocked")} />
            </Field>

            <Field label="Species" error={errors.species?.message}>
              <Select value={species} onValueChange={(v) => setValue("species", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SPECIES_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{speciesLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Quantity" error={errors.quantity?.message}>
              <Input type="number" min={1} step={1} inputMode="numeric" {...register("quantity")} />
            </Field>

            <Field label="Avg weight (lb)" error={errors.avg_weight_lb?.message}>
              <Input type="number" min={0.1} step={0.1} inputMode="decimal" {...register("avg_weight_lb")} />
            </Field>

            <Field label="Supplier" error={errors.supplier_name?.message}>
              <Input placeholder="e.g. Kilnsey Park" {...register("supplier_name")} />
            </Field>

            <Field label="EA SP1 permit ref (optional)">
              <Input placeholder="SP1/…/…" {...register("ea_permit_ref")} />
            </Field>

            <Field label="Total cost (£) (optional)">
              <Input type="number" min={0} step="0.01" inputMode="decimal" {...register("cost_total")} />
            </Field>

            <Field label="Stocking points (optional)">
              <Select
                value={distSummary || "__none"}
                onValueChange={(v) => setValue("distribution_summary", v === "__none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Whole reservoir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— Not specified —</SelectItem>
                  <SelectItem value="Whole reservoir">Whole reservoir</SelectItem>
                  {pastSummaries
                    .filter((p) => p !== "Whole reservoir")
                    .map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes (optional)">
            <Textarea rows={2} {...register("notes")} />
          </Field>

          {/* Estimate block */}
          <div className="rounded-lg p-4" style={{ backgroundColor: "hsl(75 25% 92%)" }}>
            <div className="text-2xl font-semibold tracking-tight" style={{ color: "hsl(75 25% 25%)" }}>
              {estimate > 0 ? `£${Math.round(estimate).toLocaleString()}` : "—"}
            </div>
            <div className="text-xs mt-1" style={{ color: "hsl(75 15% 35%)" }}>
              {Number(quantity || 0).toLocaleString()} fish × {Number(avgWeight || 0)} lb × £{SUPPLIER_RATE_LB}/lb (estimate)
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Update" : "Save stocking event"}
            </Button>
            {!isEdit && (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={handleSubmit((v) => submit(v, "another"))}
              >
                Save & log another
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={() => navigate(`/manager/${slug}`)}>
              Cancel
            </Button>

            {isEdit && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" className="text-destructive ml-auto">
                    <Trash2 className="w-4 h-4 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this stocking event?</AlertDialogTitle>
                    <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </form>
      </Card>
    </ManagerLayout>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}
