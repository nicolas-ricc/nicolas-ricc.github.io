import { ZONE_IDS, type ZoneId } from "../map/zones";

const PDF_ZONE: ZoneId = "cv";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function validateContent(data: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(data)) return ["root: not an object"];
  if (!isStr(data.id) || !(ZONE_IDS as readonly string[]).includes(data.id)) errs.push(`id: must be one of ${ZONE_IDS.join(", ")}`);
  if (!isStr(data.titulo)) errs.push("titulo: missing or not a string");
  if (data.descripcion !== undefined && !isStr(data.descripcion)) errs.push("descripcion: not a string");
  if (data.pdf !== undefined && !isStr(data.pdf)) errs.push("pdf: not a string");
  if (data.pdf !== undefined && data.id !== PDF_ZONE) errs.push("pdf: only the cv zone may declare one");
  if (data.proyectos !== undefined) {
    if (!Array.isArray(data.proyectos)) errs.push("proyectos: not an array");
    else data.proyectos.forEach((pr, i) => {
      const p = `proyectos[${i}]`;
      if (!isObj(pr)) { errs.push(`${p}: not an object`); return; }
      if (!isStr(pr.nombre)) errs.push(`${p}.nombre: missing or not a string`);
      if (pr.url !== undefined && !isStr(pr.url)) errs.push(`${p}.url: not a string`);
      if (pr.repo !== undefined && !isStr(pr.repo)) errs.push(`${p}.repo: not a string`);
    });
  }
  if (data.articulos !== undefined) {
    if (!Array.isArray(data.articulos)) errs.push("articulos: not an array");
    else data.articulos.forEach((ar, i) => {
      const p = `articulos[${i}]`;
      if (!isObj(ar)) { errs.push(`${p}: not an object`); return; }
      if (!isStr(ar.titulo)) errs.push(`${p}.titulo: missing or not a string`);
      if (!isStr(ar.url)) errs.push(`${p}.url: missing or not a string`);
      if (ar.descripcion !== undefined && !isStr(ar.descripcion)) errs.push(`${p}.descripcion: not a string`);
    });
  }
  if (!Array.isArray(data.secciones)) { errs.push("secciones: missing or not an array"); return errs; }
  data.secciones.forEach((sec, i) => {
    const p = `secciones[${i}]`;
    if (!isObj(sec)) { errs.push(`${p}: not an object`); return; }
    if (!isStr(sec.subtitulo)) errs.push(`${p}.subtitulo: missing or not a string`);
    if (!Array.isArray(sec.items)) { errs.push(`${p}.items: missing or not an array`); return; }
    sec.items.forEach((item, j) => {
      const q = `${p}.items[${j}]`;
      if (!isObj(item)) { errs.push(`${q}: not an object`); return; }
      if (!isStr(item.titulo)) errs.push(`${q}.titulo: missing or not a string`);
      if (item.descripcion !== undefined && !isStr(item.descripcion)) errs.push(`${q}.descripcion: not a string`);
      if (!Array.isArray(item.links)) { errs.push(`${q}.links: missing or not an array`); return; }
      item.links.forEach((link, k) => {
        const r = `${q}.links[${k}]`;
        if (!isObj(link)) { errs.push(`${r}: not an object`); return; }
        if (!isStr(link.label)) errs.push(`${r}.label: missing or not a string`);
        if (!isStr(link.url)) errs.push(`${r}.url: missing or not a string`);
      });
    });
  });
  return errs;
}
