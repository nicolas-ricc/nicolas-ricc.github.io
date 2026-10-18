/**
 * Corre el arranque de una página del lab. Si rechaza (p. ej. `app.init` sin
 * WebGL), el host muestra el motivo en vez de quedar en blanco.
 */
export function runBoot(host: Pick<HTMLElement, "textContent">, prefix: string, boot: () => Promise<void>): Promise<void> {
  return boot().catch((err: unknown) => {
    console.error(`[${prefix}] no se pudo iniciar el renderer`, err);
    host.textContent = `No se pudo iniciar el renderer: ${err instanceof Error ? err.message : String(err)}`;
  });
}
