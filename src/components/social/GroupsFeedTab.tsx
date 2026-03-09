import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GroupsFeedTabProps {
  userId?: string;
}

const GroupsFeedTab = ({ userId }: GroupsFeedTabProps) => {
  if (!userId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-muted-foreground">Sign in to see group activity</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <h3 className="font-medium text-lg mb-2 text-foreground">No groups yet</h3>
      <p className="text-muted-foreground text-sm max-w-xs">
        Create a group to share sessions with your fishing mates. Or wait for an invite.
      </p>
      <Button className="mt-6" onClick={() => {}}>
        Create a Group
      </Button>
    </div>
  );
};

export default GroupsFeedTab;
