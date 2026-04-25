#!/usr/bin/env node
import { execSync } from "child_process";
import { createRequire } from "module";
import process from "process";

const require = createRequire(import.meta.url);

// macOS arm64 node-pty fixes (preserved from previous inline postinstall).
const macFixes = [
  "chmod +x node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper",
  "xattr -d com.apple.provenance node_modules/node-pty/prebuilds/darwin-arm64/spawn-helper",
  "xattr -d com.apple.provenance node_modules/node-pty/prebuilds/darwin-arm64/pty.node",
];
for (const cmd of macFixes) {
  try {
    execSync(cmd, { stdio: "ignore" });
  } catch {
    /* non-mac or files absent — ignore */
  }
}

// better-sqlite3 prebuilds ship for a specific NODE_MODULE_VERSION; if the
// user's runtime doesn't match, rebuild from source so the daemon boots
// cleanly regardless of which Node version is active.
try {
  require("better-sqlite3");
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  const mismatch =
    msg.includes("NODE_MODULE_VERSION") ||
    msg.includes("ERR_DLOPEN_FAILED") ||
    msg.includes("was compiled against a different Node.js version");
  if (mismatch) {
    const runtime = `Node ${process.version} (NODE_MODULE_VERSION ${process.versions.modules})`;
    console.warn(
      `[cabinet] better-sqlite3 prebuild does not match this runtime — ${runtime}. Rebuilding from source…`,
    );
    try {
      execSync("npm rebuild better-sqlite3 --build-from-source", {
        stdio: "inherit",
      });
      console.warn("[cabinet] better-sqlite3 rebuilt successfully.");
    } catch {
      console.warn(
        "[cabinet] Auto-rebuild failed. Run `npm rebuild better-sqlite3` manually before starting the daemon.",
      );
    }
  } else {
    console.warn(`[cabinet] better-sqlite3 smoke test warning: ${msg}`);
  }
}
