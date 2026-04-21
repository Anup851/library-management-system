import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const preventZoomHotkeys = (event: KeyboardEvent) => {
  const isZoomShortcut = ["+", "-", "=", "_", "0"].includes(event.key);
  if ((event.ctrlKey || event.metaKey) && isZoomShortcut) {
    event.preventDefault();
  }
};

const preventZoomWheel = (event: WheelEvent) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
  }
};

const preventTouchZoom = (event: TouchEvent) => {
  if (event.touches.length > 1) {
    event.preventDefault();
  }
};

window.addEventListener("keydown", preventZoomHotkeys);
window.addEventListener("wheel", preventZoomWheel, { passive: false });
window.addEventListener("touchstart", preventTouchZoom, { passive: false });
window.addEventListener("touchmove", preventTouchZoom, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);
