import React from "react";
import { createRoot } from "react-dom/client";
if (["/customer", "/merchant", "/analyst"].includes(location.pathname)) {
  const { default: Product } = await import("./Product.jsx");
  createRoot(document.getElementById("root")).render(<Product />);
} else {
  import("./main.jsx");
}
