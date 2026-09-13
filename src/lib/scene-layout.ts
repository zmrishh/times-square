import type { Vec3 } from "./registry";

export type Building = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  name: string;
  style: number;
};
// Authored street canyon, in metres. The side facades are six metres closer
// than the first edition; the pedestrian centreline and landmark locations stay put.
export const BUILDINGS: Building[] = [
  { x: 0, z: 81, w: 13, d: 26, h: 69, name: "ONE TIMES SQUARE", style: 2 },
  { x: -10, z: 81, w: 7, d: 26, h: 47, name: "ONE TIMES WEST PIER", style: 0 },
  { x: 10, z: 81, w: 7, d: 26, h: 47, name: "ONE TIMES EAST PIER", style: 0 },
  { x: -42, z: -17, w: 33, d: 77, h: 90, name: "MARRIOTT MARQUIS", style: 1 },
  { x: -41, z: 43, w: 32, d: 32, h: 105, name: "ONE ASTOR PLAZA", style: 0 },
  { x: 38, z: -11, w: 28, d: 39, h: 99, name: "1540 BROADWAY", style: 2 },
  { x: 37, z: 29, w: 26, d: 27, h: 49, name: "1530 BROADWAY", style: 1 },
  { x: 40, z: 63, w: 30, d: 32, h: 72, name: "1500 BROADWAY", style: 0 },
  { x: 38, z: -55, w: 25, d: 36, h: 66, name: "1560 BROADWAY", style: 0 },
  { x: 0, z: -107, w: 20, d: 28, h: 73, name: "TWO TIMES SQUARE", style: 2 },
  { x: -39, z: -83, w: 28, d: 38, h: 63, name: "DUFFY WEST", style: 2 },
  { x: 39, z: 103, w: 28, d: 37, h: 52, name: "FORTY SECOND", style: 1 },
  { x: -39, z: 90, w: 30, d: 40, h: 63, name: "THEATRE DISTRICT", style: 2 },
  { x: 41, z: -106, w: 33, d: 34, h: 85, name: "SEVENTH AVENUE", style: 1 },
];
export function canWalk(x: number, z: number) {
  if (x < -24 || x > 23 || z < -88 || z > 115) return false;
  if (
    BUILDINGS.some(
      (b) =>
        x > b.x - b.w / 2 - 0.65 &&
        x < b.x + b.w / 2 + 0.65 &&
        z > b.z - b.d / 2 - 0.65 &&
        z < b.z + b.d / 2 + 0.65,
    )
  )
    return false;
  if (Math.abs(x) < 7 && z < -63 && z > -84) return false;
  // Statue plinth; street furniture stays outside the viewing positions.
  return !(Math.abs(x) < 2 && Math.abs(z + 58) < 2);
}
export const REVIEW_VIEWS: { name: string; position: Vec3; look: Vec3 }[] = [
  { name: "opening", position: [-4, 1.72, -49], look: [0, 24, 68] },
  { name: "central", position: [1, 1.72, 34], look: [0, 17, 67.4] },
  { name: "steps", position: [3, 1.72, -46], look: [0, 15, -92] },
];
