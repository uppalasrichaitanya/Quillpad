import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";

/** Build-time render: the page ships as real HTML, then React hydrates it. */
export function render() {
  return renderToString(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
