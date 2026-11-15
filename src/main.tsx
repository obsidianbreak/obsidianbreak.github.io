import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { armAudioUnlock } from "./engine/sharedAudioContext";

armAudioUnlock();

// Keep the game from being interrupted: no pinch zoom, no text selection, no long press menus.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());
document.addEventListener("dblclick", (e) => e.preventDefault());
document.addEventListener(
  "touchmove",
  (e) => {
    const target = e.target as HTMLElement | null;
    if (e.touches.length > 1 || target?.closest?.(".board")) e.preventDefault();
  },
  { passive: false },
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
