import type { Accent } from "../iso/accent";
import type { Solid } from "../iso/solids";
import { LAND } from "./city-plan";

export const SOUTH_BOUNDS = { x0: -Infinity, y0: 318, x1: LAND.x1, y1: 650 };
// #478 Task 6 fills this with the south avenues' street furniture.
export function southStreets(): { ground: Solid[]; solids: Solid[]; accents: Accent[] } { return { ground: [], solids: [], accents: [] }; }
