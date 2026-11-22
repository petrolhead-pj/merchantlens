import React from "react";
import { createRoot } from "react-dom/client";
if (["/customer", "/merchant", "/analyst"].includes(location.pathname)) {
  const { default: Product } = await import("./Product.jsx");
  createRoot(document.getElementById("root")).render(<Product />);
} else if (location.pathname === "/exhibition") {
  const { default: Exhibition } = await import("./Exhibition.jsx");
  createRoot(document.getElementById("root")).render(<Exhibition />);
} else {
  import("./main.jsx");
}
