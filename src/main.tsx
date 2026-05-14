import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalEventHooks } from "./services/eventLogger";

installGlobalEventHooks();

createRoot(document.getElementById("root")!).render(<App />);
