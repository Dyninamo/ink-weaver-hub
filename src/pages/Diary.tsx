import { useNavigate } from "react-router-dom";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const Diary = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">My Diary</h1>
            <p className="text-sm text-white/80">Your fishing journal</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8 text-center">
        <Card className="p-12">
          <div className="w-20 h-20 mx-auto mb-6 bg-primary/10 rounded-full flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">New diary coming soon</h2>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            The diary is being upgraded to the new session-based model. Check back shortly.
          </p>
          <Button onClick={() => navigate("/diary/new")} className="bg-gradient-water text-white hover:opacity-90">
            <Plus className="w-4 h-4 mr-2" />
            Start a Session
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Diary;
