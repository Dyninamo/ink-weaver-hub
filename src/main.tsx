import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalEventHooks, installLifecycleLogger } from "./services/eventLogger";
import { installGlobalClickLogger } from "./services/clickLogger";
import { installInvokeLogger } from "./services/invokeLogger";
import { installAuthRefreshGuard } from "./lib/authRefreshGuard";

installGlobalEventHooks();
installLifecycleLogger();
installGlobalClickLogger();
installInvokeLogger();
installAuthRefreshGuard();

createRoot(document.getElementById("root")!).render(<App />);
