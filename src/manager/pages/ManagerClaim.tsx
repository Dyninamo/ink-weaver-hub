import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ManagerLayout from "@/manager/ManagerLayout";
import { useManagerScope } from "@/manager/hooks/useManagerScope";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ManagerClaim() {
  const navigate = useNavigate();
  const scope = useManagerScope();

  if (scope.isLoading) {
    return (
      <ManagerLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout>
      <Card className="p-6 max-w-xl mx-auto">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to the Manager Portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You've been granted access to the following venues. Confirm to continue.
        </p>

        {scope.venues.length === 0 ? (
          <p className="mt-4 text-sm text-destructive">
            No venues are currently linked to your account. Contact Nick if this is unexpected.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border border border-border rounded-md">
            {scope.venues.map((v) => (
              <li key={v.venue_id} className="px-3 py-2 text-sm flex justify-between">
                <span className="font-medium">{v.name}</span>
                <span className="text-muted-foreground capitalize">{v.role}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={() => navigate("/manager")} disabled={!scope.venues.length}>
            Confirm & continue
          </Button>
        </div>
      </Card>
    </ManagerLayout>
  );
}
