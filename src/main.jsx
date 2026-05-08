import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import "./index.css";
import App from "./App.jsx";
import { initMarked } from "./markedConfig.js";

initMarked(marked);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
