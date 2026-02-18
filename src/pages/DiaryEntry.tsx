import { useNavigate } from "react-router-dom";
import { ArrowLeft, Fish } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DiaryEntry = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/diary")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Session Details</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8 text-center">
        <Card className="p-12">
          <Fish className="w-10 h-10 mx-auto mb-4 text-primary opacity-60" />
          <h2 className="text-xl font-semibold mb-2">Coming soon</h2>
          <p className="text-muted-foreground mb-6">
            Session detail view is being rebuilt for the new event-based diary.
          </p>
          <Button variant="outline" onClick={() => navigate("/diary")}>
            Back to Diary
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default DiaryEntry;
