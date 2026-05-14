import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalEventHooks, installLifecycleLogger } from "./services/eventLogger";
import { installGlobalClickLogger } from "./services/clickLogger";
import { installInvokeLogger } from "./services/invokeLogger";

installGlobalEventHooks();
installLifecycleLogger();
installGlobalClickLogger();
installInvokeLogger();

createRoot(document.getElementById("root")!).render(<App />);
