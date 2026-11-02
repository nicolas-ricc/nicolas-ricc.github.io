/**
 * Runs the boot of a lab page. If it rejects (e.g. `app.init` without
 * WebGL), the host shows the reason instead of staying blank.
 */
export function runBoot(host: Pick<HTMLElement, "textContent">, prefix: string, boot: () => Promise<void>): Promise<void> {
  return boot().catch((err: unknown) => {
    console.error(`[${prefix}] could not start the renderer`, err);
    host.textContent = `Could not start the renderer: ${err instanceof Error ? err.message : String(err)}`;
  });
}
