import { mkdir, copyFile } from "node:fs/promises";
import { dirname } from "node:path";
for (const path of [
  "cloud/handlers.mjs",
  "backend/exhibition.mjs",
  "frontend/src/review-policy.js",
  "frontend/src/case-data.js",
  "frontend/package.json",
]) {
  const dest = ".demo-package/" + path;
  await mkdir(dirname(dest), { recursive: true });
  await copyFile(path, dest);
}
await copyFile("cloud/package.json", ".demo-package/package.json");
