import { MapPin } from "lucide-react";

interface VenueFeedTabProps {
  userId?: string;
}

const VenueFeedTab = ({ userId }: VenueFeedTabProps) => {
  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-muted-foreground">Sign in to see venue updates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <MapPin className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="font-medium text-lg mb-2 text-foreground">No venue updates yet</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        Log a session at any venue and you'll automatically join its community. Daily fishing reports will appear here.
      </p>
    </div>
  );
};

export default VenueFeedTab;
