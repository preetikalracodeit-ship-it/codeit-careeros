import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App.jsx";
import "./styles.css";
import "./auth-google.css";
import "./workspace.css";
import "./landing.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" richColors />
    </BrowserRouter>
  </React.StrictMode>,
);
