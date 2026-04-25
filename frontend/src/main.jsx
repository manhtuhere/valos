import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// Apply saved theme before first paint to avoid flash
document.documentElement.setAttribute(
  "data-theme",
  localStorage.getItem("valos-theme") === "light" ? "light" : "dark"
);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
