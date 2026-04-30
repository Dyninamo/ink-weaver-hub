import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useManagerScope, ManagerVenue } from "@/manager/hooks/useManagerScope";
import { slugify } from "@/manager/utils/slug";
import { ChevronDown, LogOut, ArrowLeftRight, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ManagerLayoutProps {
  children: ReactNode;
  currentVenue?: ManagerVenue | null;
}

export default function ManagerLayout({ children, currentVenue }: ManagerLayoutProps) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const scope = useManagerScope();

  const initial = (profile?.display_name || user?.email || "M").slice(0, 1).toUpperCase();

  const switchTo = (v: ManagerVenue) => {
    navigate(`/manager/${slugify(v.name)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link to="/manager" className="font-semibold text-foreground tracking-tight">
            it's catching. <span className="text-muted-foreground font-normal">manager</span>
          </Link>

          {currentVenue && scope.venues.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-md hover:bg-muted">
                <span className="truncate max-w-[40vw]">{currentVenue.name}</span>
                <ChevronDown className="w-4 h-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="max-h-72 overflow-y-auto">
                {scope.venues.map((v) => (
                  <DropdownMenuItem key={v.venue_id} onClick={() => switchTo(v)}>
                    {v.venue_id === currentVenue.venue_id && <Check className="w-3.5 h-3.5 mr-2" />}
                    <span className={v.venue_id === currentVenue.venue_id ? "" : "ml-[22px]"}>{v.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : currentVenue ? (
            <span className="text-sm font-medium truncate max-w-[40vw]">{currentVenue.name}</span>
          ) : (
            <span />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger className="w-9 h-9 rounded-full bg-primary text-primary-foreground font-semibold flex items-center justify-center text-sm hover:opacity-90">
              {initial}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate("/diary/new")}>
                <ArrowLeftRight className="w-4 h-4 mr-2" /> Switch to angler app
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
