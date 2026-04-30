import { Link } from "react-router-dom";
import ManagerLayout from "@/manager/ManagerLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ManagerNoAccess() {
  return (
    <ManagerLayout>
      <Card className="p-8 max-w-xl mx-auto text-center">
        <h1 className="text-2xl font-semibold tracking-tight">No manager access yet</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Your account isn't linked to any fishery venues. If you manage a fishery and would like access,
          email Nick to get set up.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild>
            <a href="mailto:nick.dyne@gmail.com?subject=Manager%20portal%20access">Email Nick</a>
          </Button>
          <Button asChild variant="outline">
            <Link to="/diary/new">Back to angler app</Link>
          </Button>
        </div>
      </Card>
    </ManagerLayout>
  );
}
