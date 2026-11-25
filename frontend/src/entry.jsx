import "@fontsource-variable/instrument-sans";
import "./visual-foundation.css";
import React from "react";
import { createRoot } from "react-dom/client";

const params = new URLSearchParams(location.search);
if (location.pathname === "/phone") {
  const { PhoneCheckout } = await import("./Product.jsx");
  createRoot(document.getElementById("root")).render(<PhoneCheckout />);
} else if (["/customer", "/betting.html", "/merchant", "/analyst"].includes(location.pathname)) {
  const { default: Product } = await import("./Product.jsx");
  createRoot(document.getElementById("root")).render(<Product />);
} else if (["lab", "offline", "exhibition", "case"].some((name) => params.has(name))) {
  const { default: Exhibition } = await import("./Exhibition.jsx");
  createRoot(document.getElementById("root")).render(<Exhibition />);
} else {
  import("./main.jsx");
}
