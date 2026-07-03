import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("tool_result", async (event, ctx) => {
    // Only check after write or edit operations
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return;
    }

    // Only check TypeScript files
    const filePath = event.input.path as string;
    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
      return;
    }

    // Project-local config - only runs in this directory
    const tsconfigPath = path.join(ctx.cwd, "tsconfig.json");

    // Prefer the project-local tsc; fall back to bunx (fetches typescript on
    // demand) when deps are not installed. The previous version hardcoded
    // node_modules/.bin/tsc and crashed pi with ENOENT when deps were missing,
    // because spawn emits an 'error' event on a missing bin and there was no
    // error listener — the rejection became an uncaughtException.
    const localTsc = path.join(ctx.cwd, "node_modules", ".bin", "tsc");
    const useBunx = !existsSync(localTsc);
    const cmd = useBunx ? "bunx" : localTsc;
    const args = useBunx
      ? ["tsc", "--noEmit", "--project", tsconfigPath]
      : ["--noEmit", "--project", tsconfigPath];

    const result = await new Promise<{ success: boolean; output: string }>(
      (resolve) => {
        const child = spawn(cmd, args, {
          cwd: ctx.cwd,
          stdio: ["pipe", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        let settled = false;
        const done = (r: { success: boolean; output: string }) => {
          if (settled) return;
          settled = true;
          resolve(r);
        };

        // Handle spawn failures (ENOENT, EACCES) so they never bubble up as
        // uncaughtException and kill pi.
        child.on("error", (err) => {
          done({ success: false, output: `tsc failed to start: ${err.message}` });
        });

        child.stdout.on("data", (data) => {
          stdout += data.toString();
        });

        child.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        child.on("close", (code) => {
          done({ success: code === 0, output: stderr || stdout });
        });

        setTimeout(() => {
          child.kill();
          done({ success: false, output: "Type check timed out" });
        }, 10000);
      },
    );

    if (!result.success && result.output.trim()) {
      // Show errors in UI
      if (ctx.hasUI) {
        ctx.ui.notify(
          `TypeScript errors found in ${path.basename(filePath)}`,
          "error",
        );
      }

      // Inject error details into conversation
      pi.sendMessage(
        {
          customType: "typescript-error",
          content: `⚠️ TypeScript type errors in \`${filePath}\`:\n\n\`\`\`\n${result.output}\n\`\`\``,
          display: true,
          details: {
            file: filePath,
            errors: result.output,
          },
        },
        { triggerTurn: false }, // Don't trigger turn, just inform
      );
    } else if (ctx.hasUI) {
      // Optional: show success notification (commented out to reduce noise)
      // ctx.ui.notify(`✓ No type errors in ${path.basename(filePath)}`, "success");
    }
  });
}