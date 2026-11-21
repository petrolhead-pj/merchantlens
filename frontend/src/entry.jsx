import React from "react";
import { createRoot } from "react-dom/client";
if (["/customer", "/merchant", "/analyst"].includes(location.pathname)) {
  const { default: Product } = await import("./Product.jsx");
  createRoot(document.getElementById("root")).render(<Product />);
} else if (location.search === "?seed") {
  import("./main.jsx");
} else {
  const { default: Exhibition } = await import("./Exhibition.jsx");
  createRoot(document.getElementById("root")).render(<Exhibition />);
}
