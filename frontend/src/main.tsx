import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Root } from "./app/Root";
import "../../brand/theme/roomset.css";
import "./styles/app.css";
import "./landing/landing.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
