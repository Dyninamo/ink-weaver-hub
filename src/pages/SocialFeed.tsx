import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Users, ArrowLeft, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import VenueFeedTab from "@/components/social/VenueFeedTab";
import GroupsFeedTab from "@/components/social/GroupsFeedTab";

const SocialFeed = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("venues");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold text-foreground flex-1">Social</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate("/leaderboard")}>
          <Trophy className="h-5 w-5 text-[#F59E0B]" />
        </Button>
      </div>

      {/* Tab switcher */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-12 rounded-none border-b border-border bg-background">
          <TabsTrigger
            value="venues"
            className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:shadow-none"
          >
            <MapPin className="h-4 w-4" />
            Venues
          </TabsTrigger>
          <TabsTrigger
            value="groups"
            className="flex items-center gap-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none data-[state=active]:shadow-none"
          >
            <Users className="h-4 w-4" />
            Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="venues" className="mt-0">
          <VenueFeedTab userId={user?.id} />
        </TabsContent>

        <TabsContent value="groups" className="mt-0">
          <GroupsFeedTab userId={user?.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SocialFeed;
