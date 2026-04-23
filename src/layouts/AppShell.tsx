import { ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveSession } from "@/hooks/useActiveSession";
import { Icon, type IconName } from "@/components/Icon";

interface AppShellProps {
  children: ReactNode;
}

interface AppShellHeaderProps {
  hasActiveSession: boolean;
  anglerInitial: string | null;
}

export function AppShellHeader({ hasActiveSession, anglerInitial }: AppShellHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className="app-shell-header">
      <div className="app-shell-header-left">
        <button
          type="button"
          className="app-shell-wordmark"
          onClick={() => navigate("/diary/new")}
          aria-label="Go to session"
        >
          it's catching.
        </button>
        {hasActiveSession && (
          <span className="app-shell-session-badge" aria-label="Session active">
            <span className="session-live-dot" aria-hidden="true" />
            <span className="app-shell-session-label">SESSION</span>
          </span>
        )}
      </div>
      {anglerInitial && (
        <button
          type="button"
          className="app-shell-profile-dot"
          onClick={() => navigate("/settings")}
          aria-label="Settings"
        >
          {anglerInitial}
        </button>
      )}
    </header>
  );
}

type TabDef = {
  key: string;
  label: string;
  icon: IconName;
  to: string;
  isActive: (pathname: string) => boolean;
};

const TABS: TabDef[] = [
  {
    key: "session",
    label: "Session",
    // Branded substitute for "rod" (asset not in /public/icons/ui yet)
    icon: "fly",
    to: "/diary/new",
    isActive: (p) => p === "/diary/new" || /^\/diary\/[^/]+$/.test(p) && p !== "/diary/new",
  },
  {
    key: "map",
    label: "Map",
    // Branded substitute for "location"
    icon: "venue",
    to: "/map",
    isActive: (p) => p === "/map" || p.startsWith("/venue/"),
  },
  {
    key: "timeline",
    label: "Timeline",
    icon: "clock",
    to: "/diary",
    isActive: (p) => p === "/diary",
  },
  {
    key: "queries",
    label: "Queries",
    icon: "insight",
    to: "/queries",
    isActive: (p) => p === "/queries" || p.startsWith("/queries/"),
  },
];

export function AppShellTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="app-shell-tabbar" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.isActive(pathname);
        return (
          <NavLink
            key={tab.key}
            to={tab.to}
            className={`app-shell-tab${active ? " is-active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon
              name={tab.icon}
              size={26}
              srcSize={tab.icon === "insight" ? 64 : 128}
              className="app-shell-tab-icon"
            />
            <span className="app-shell-tab-label">{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const { user, profile } = useAuth();
  const { active } = useActiveSession();

  const initialSource =
    profile?.display_name?.trim() ||
    user?.email ||
    "";
  const anglerInitial = initialSource ? initialSource.slice(0, 1).toUpperCase() : "A";

  // Don't flicker: only render the dot once auth has resolved a user.
  const showProfileDot = !!user;

  return (
    <div className="app-shell">
      <AppShellHeader
        hasActiveSession={active}
        anglerInitial={showProfileDot ? anglerInitial : null}
      />
      <main className="app-shell-main">{children}</main>
      <AppShellTabBar />
    </div>
  );
}
