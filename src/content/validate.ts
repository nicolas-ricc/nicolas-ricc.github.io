import { ZONE_IDS } from "../map/zones";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

export function validateContent(data: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(data)) return ["raíz: no es un objeto"];
  if (!isStr(data.id) || !(ZONE_IDS as readonly string[]).includes(data.id)) errs.push(`id: debe ser uno de ${ZONE_IDS.join(", ")}`);
  if (!isStr(data.titulo)) errs.push("titulo: falta o no es string");
  if (data.descripcion !== undefined && !isStr(data.descripcion)) errs.push("descripcion: no es string");
  if (data.pdf !== undefined && !isStr(data.pdf)) errs.push("pdf: no es string");
  if (data.proyectos !== undefined) {
    if (!Array.isArray(data.proyectos)) errs.push("proyectos: no es array");
    else data.proyectos.forEach((pr, i) => {
      const p = `proyectos[${i}]`;
      if (!isObj(pr)) { errs.push(`${p}: no es un objeto`); return; }
      if (!isStr(pr.nombre)) errs.push(`${p}.nombre: falta o no es string`);
      if (pr.url !== undefined && !isStr(pr.url)) errs.push(`${p}.url: no es string`);
      if (pr.repo !== undefined && !isStr(pr.repo)) errs.push(`${p}.repo: no es string`);
    });
  }
  if (data.articulos !== undefined) {
    if (!Array.isArray(data.articulos)) errs.push("articulos: no es array");
    else data.articulos.forEach((ar, i) => {
      const p = `articulos[${i}]`;
      if (!isObj(ar)) { errs.push(`${p}: no es un objeto`); return; }
      if (!isStr(ar.titulo)) errs.push(`${p}.titulo: falta o no es string`);
      if (!isStr(ar.url)) errs.push(`${p}.url: falta o no es string`);
      if (ar.descripcion !== undefined && !isStr(ar.descripcion)) errs.push(`${p}.descripcion: no es string`);
    });
  }
  if (!Array.isArray(data.secciones)) { errs.push("secciones: falta o no es array"); return errs; }
  data.secciones.forEach((sec, i) => {
    const p = `secciones[${i}]`;
    if (!isObj(sec)) { errs.push(`${p}: no es un objeto`); return; }
    if (!isStr(sec.subtitulo)) errs.push(`${p}.subtitulo: falta o no es string`);
    if (!Array.isArray(sec.items)) { errs.push(`${p}.items: falta o no es array`); return; }
    sec.items.forEach((item, j) => {
      const q = `${p}.items[${j}]`;
      if (!isObj(item)) { errs.push(`${q}: no es un objeto`); return; }
      if (!isStr(item.titulo)) errs.push(`${q}.titulo: falta o no es string`);
      if (item.descripcion !== undefined && !isStr(item.descripcion)) errs.push(`${q}.descripcion: no es string`);
      if (!Array.isArray(item.links)) { errs.push(`${q}.links: falta o no es array`); return; }
      item.links.forEach((link, k) => {
        const r = `${q}.links[${k}]`;
        if (!isObj(link)) { errs.push(`${r}: no es un objeto`); return; }
        if (!isStr(link.label)) errs.push(`${r}.label: falta o no es string`);
        if (!isStr(link.url)) errs.push(`${r}.url: falta o no es string`);
      });
    });
  });
  return errs;
}
