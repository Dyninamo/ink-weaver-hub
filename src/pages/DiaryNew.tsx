import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const DiaryNew = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-gradient-water text-white py-6 px-4 shadow-medium">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/diary")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">New Session</h1>
              <p className="text-sm text-white/80">Start a fishing session</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-8 text-center">
        <Card className="p-12">
          <BookOpen className="w-10 h-10 mx-auto mb-4 text-primary opacity-60" />
          <h2 className="text-xl font-semibold mb-2">New session form coming soon</h2>
          <p className="text-muted-foreground mb-6">
            The new event-based session logger is being built. Check back shortly.
          </p>
          <Button variant="outline" onClick={() => navigate("/diary")}>
            Back to Diary
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default DiaryNew;
