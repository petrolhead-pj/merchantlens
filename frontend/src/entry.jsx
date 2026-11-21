import React from "react";
import { createRoot } from "react-dom/client";
if (location.search === "?seed") {
  import("./main.jsx");
} else {
  const { default: Exhibition } = await import("./Exhibition.jsx");
  createRoot(document.getElementById("root")).render(<Exhibition />);
}
