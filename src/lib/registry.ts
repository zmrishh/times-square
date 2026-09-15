export type Vec3 = [number, number, number];
export type Segment = {
  position: Vec3;
  rotation: number;
  width: number;
  height: number;
};
export type Slot = {
  id: string;
  name: string;
  location: string;
  tier: "Small" | "Standard" | "Premium";
  opening: number;
  segments: Segment[];
  camera: Vec3;
  look: Vec3;
  art: number;
};
const slot = (
  n: number,
  name: string,
  location: string,
  tier: Slot["tier"],
  position: Vec3,
  rotation: number,
  width: number,
  height: number,
  camera: Vec3,
  art: number,
): Slot => ({
  id: `tsq-${String(n).padStart(3, "0")}`,
  name,
  location,
  tier,
  opening: tier === "Premium" ? 5000 : tier === "Standard" ? 2500 : 1000,
  segments: [{ position, rotation, width, height }],
  camera,
  look: position,
  art,
});
export const SLOTS: Slot[] = [
  slot(
    1,
    "The crown",
    "One Times Square · W43rd",
    "Premium",
    [0, 52, 67.4],
    Math.PI,
    12,
    18,
    [0, 1.72, 8],
    0,
  ),
  slot(
    2,
    "The tower",
    "One Times Square · W43rd",
    "Premium",
    [0, 33, 67.4],
    Math.PI,
    12,
    17,
    [0, 1.72, 16],
    1,
  ),
  slot(
    3,
    "The welcome",
    "One Times Square · W43rd",
    "Standard",
    [0, 17, 67.4],
    Math.PI,
    12,
    12,
    [1, 1.72, 34],
    2,
  ),
  slot(
    4,
    "Broadway panorama",
    "Marriott Marquis · W46th",
    "Premium",
    [-31, 22, -21],
    Math.PI / 2,
    42,
    14,
    [8, 1.72, -12],
    3,
  ),
  slot(
    5,
    "The marquee",
    "Marriott Marquis · W45th",
    "Standard",
    [-31, 10, 7],
    Math.PI / 2,
    17,
    7,
    [2, 1.72, 3],
    4,
  ),
  slot(
    6,
    "Astor wide",
    "One Astor Plaza · W44th",
    "Premium",
    [-30, 26, 39],
    Math.PI / 2,
    30,
    14,
    [4, 1.72, 28],
    5,
  ),
  slot(
    7,
    "The corner",
    "1540 Broadway · W45th",
    "Premium",
    [29, 25, -7],
    -Math.PI / 2,
    24,
    18,
    [-8, 1.72, -27],
    6,
  ),
  slot(
    8,
    "Broadway vertical",
    "1540 Broadway · W46th",
    "Standard",
    [29, 47, -17],
    -Math.PI / 2,
    11,
    20,
    [-7, 1.72, -27],
    7,
  ),
  slot(
    9,
    "The daily",
    "1530 Broadway · W45th",
    "Standard",
    [29, 14, 25],
    -Math.PI / 2,
    20,
    10,
    [-2, 1.72, 8],
    8,
  ),
  slot(
    10,
    "Seventh story",
    "1500 Broadway · W43rd",
    "Standard",
    [30, 28, 59],
    -Math.PI / 2,
    18,
    20,
    [7, 1.72, 34],
    9,
  ),
  slot(
    11,
    "The ribbon",
    "Two Times Square · W47th",
    "Premium",
    [0, 25, -92],
    0,
    20.4,
    12,
    [0, 1.72, -45],
    10,
  ),
  slot(
    12,
    "Above the steps",
    "Two Times Square · W47th",
    "Standard",
    [0, 42, -92],
    0,
    19,
    16,
    [3, 1.72, -46],
    11,
  ),
  slot(
    13,
    "The little big idea",
    "1560 Broadway · W46th",
    "Small",
    [31, 10, -51],
    -Math.PI / 2,
    10,
    7,
    [4, 1.72, -44],
    12,
  ),
  slot(
    14,
    "Westside portrait",
    "Marquis north · W46th",
    "Small",
    [-32, 39, -46],
    Math.PI / 2,
    9,
    13,
    [-2, 1.72, -39],
    13,
  ),
  slot(
    15,
    "Forty-second",
    "1472 Broadway · W42nd",
    "Small",
    [29, 13, 91],
    -Math.PI / 2,
    11,
    8,
    [9, 1.72, 84],
    14,
  ),
];
SLOTS[10].segments.push({
  position: [10.2, 25, -102],
  rotation: Math.PI / 2,
  width: 20,
  height: 12,
});
// Preserve all first-edition IDs, dimensions and creative assignments. Move
// their side planes with the buildings, leaving their safe camera positions intact.
for (const s of SLOTS) {
  if (Math.abs(s.segments[0].position[0]) > 20) {
    for (const p of s.segments) p.position[0] -= Math.sign(p.position[0]) * 6;
  }
}
SLOTS[3].segments[0].position[0] = -24.7;
SLOTS[4].segments[0].position[0] = -24.7;
SLOTS[13].segments[0].position[0] = -24.7;
SLOTS[5].segments[0].position[2] = 43;
// Authored clusters: coordinates are explicit, never randomized or counted per mesh.
const west = Math.PI / 2,
  east = -Math.PI / 2,
  south = Math.PI;
const add = (
  n: number,
  name: string,
  location: string,
  p: Vec3,
  r: number,
  w: number,
  h: number,
  camera: Vec3,
  art: number,
  tier: Slot["tier"] = "Standard",
) => SLOTS.push(slot(n, name, location, tier, p, r, w, h, camera, art));
// One Times Square: a continuous central stack framed by two advertising piers.
add(
  16,
  "The city line",
  "One Times Square · lower ticker",
  [0, 7, 67.2],
  south,
  25,
  4,
  [0, 1.72, 43],
  15,
  "Small",
);
add(
  17,
  "East tower portrait",
  "One Times Square · east pier",
  [10, 21, 67.2],
  south,
  6,
  23,
  [6, 1.72, 40],
  16,
);
add(
  18,
  "East tower panel",
  "One Times Square · east pier upper",
  [10, 40, 67.2],
  south,
  6,
  12,
  [6, 1.72, 26],
  17,
);
add(
  19,
  "West tower portrait",
  "One Times Square · west pier",
  [-10, 21, 67.2],
  south,
  6,
  23,
  [-6, 1.72, 40],
  18,
);
add(
  20,
  "West tower panel",
  "One Times Square · west pier upper",
  [-10, 40, 67.2],
  south,
  6,
  12,
  [-6, 1.72, 26],
  19,
);
add(
  21,
  "The rooftop edition",
  "One Times Square · rooftop",
  [0, 73, 67.2],
  south,
  12,
  8,
  [0, 1.72, 8],
  20,
  "Premium",
);
// Marquis: broad panorama, asymmetrical portraits and a low theatre marquee.
add(
  22,
  "Marquis newsline",
  "Marriott Marquis · lower ribbon",
  [-24.7, 9, -24],
  west,
  38,
  6,
  [3, 1.72, -24],
  21,
  "Small",
);
add(
  23,
  "Marquis studio",
  "Marriott Marquis · middle gallery",
  [-24.7, 37, -15],
  west,
  26,
  11,
  [3, 1.72, -13],
  22,
);
add(
  24,
  "Marquis tall tale",
  "Marriott Marquis · south portrait",
  [-24.7, 43, 7],
  west,
  13,
  26,
  [3, 1.72, 0],
  23,
  "Premium",
);
add(
  25,
  "Marquis color field",
  "Marriott Marquis · upper gallery",
  [-24.7, 53, -33],
  west,
  17,
  17,
  [2, 1.72, -25],
  24,
);
add(
  26,
  "Marquis skyline",
  "Marriott Marquis · upper wide",
  [-24.7, 52, -12],
  west,
  22,
  13,
  [5, 1.72, -13],
  25,
);
add(
  27,
  "Marquis north mast",
  "Marriott Marquis · north portrait",
  [-24.7, 56, -47],
  west,
  9,
  17,
  [1, 1.72, -38],
  26,
);
add(
  28,
  "Marquis opening night",
  "Marriott Marquis · street marquee",
  [-24.5, 4.8, 7],
  west,
  20,
  2.3,
  [0, 1.72, 7],
  27,
  "Small",
);
add(
  29,
  "Marquis north welcome",
  "Marriott Marquis · north return",
  [-41, 12, -56.2],
  south,
  27,
  12,
  [-10, 1.72, -78],
  28,
);
add(
  30,
  "Marquis north feature",
  "Marriott Marquis · north return upper",
  [-41, 31, -56.2],
  south,
  27,
  23,
  [-10, 1.72, -80],
  29,
  "Premium",
);
// Astor: seven new screens around its original flagship, including a corner.
add(
  31,
  "Astor street edition",
  "One Astor Plaza · street ribbon",
  [-24.2, 8, 43],
  west,
  28,
  5,
  [0, 1.72, 39],
  30,
  "Small",
);
add(
  32,
  "Astor gallery",
  "One Astor Plaza · lower gallery",
  [-24.2, 14, 43],
  west,
  28,
  5,
  [1, 1.72, 36],
  31,
);
add(
  33,
  "Astor portrait",
  "One Astor Plaza · upper south",
  [-24.2, 48, 50],
  west,
  13,
  25,
  [0, 1.72, 30],
  32,
);
add(
  34,
  "Astor companion",
  "One Astor Plaza · upper north",
  [-24.2, 43, 34],
  west,
  15,
  15,
  [0, 1.72, 23],
  33,
);
add(
  35,
  "Astor roofline",
  "One Astor Plaza · upper ribbon",
  [-24.2, 66, 43],
  west,
  28,
  7,
  [2, 1.72, 20],
  34,
);
add(
  36,
  "Astor corner journal",
  "One Astor Plaza · north corner",
  [-33, 22, 26.2],
  south,
  16,
  19,
  [-5, 1.72, 7],
  35,
  "Premium",
);
add(
  37,
  "Astor north portrait",
  "One Astor Plaza · north high",
  [-40, 46, 26.2],
  south,
  24,
  24,
  [-8, 1.72, 3],
  36,
);
// 1540 Broadway: two perpendicular advertising elevations.
add(
  38,
  "Broadway first light",
  "1540 Broadway · street ribbon",
  [23.2, 6, -10],
  east,
  24,
  5,
  [-5, 1.72, -10],
  37,
  "Small",
);
add(
  39,
  "Broadway dispatch",
  "1540 Broadway · ticker",
  [23.2, 12, -10],
  east,
  32,
  3,
  [-5, 1.72, -13],
  38,
  "Small",
);
add(
  40,
  "Broadway twin portrait",
  "1540 Broadway · upper south",
  [23.2, 46, 1],
  east,
  12,
  19,
  [-4, 1.72, -12],
  39,
);
add(
  41,
  "Broadway masthead",
  "1540 Broadway · upper wide",
  [23.2, 65, -10],
  east,
  31,
  10,
  [-5, 1.72, -24],
  40,
  "Premium",
);
add(
  42,
  "Broadway north marquee",
  "1540 Broadway · north face",
  [38, 10, -31.3],
  south,
  25,
  8,
  [8, 1.72, -52],
  41,
);
add(
  43,
  "Broadway north feature",
  "1540 Broadway · north face middle",
  [38, 29, -31.3],
  south,
  25,
  26,
  [3, 1.72, -57],
  42,
  "Premium",
);
add(
  44,
  "Broadway north gallery",
  "1540 Broadway · north face upper",
  [38, 52, -31.3],
  south,
  25,
  16,
  [0, 1.72, -59],
  43,
);
// 1530 and 1500 provide successive layers down the eastern canyon.
add(
  45,
  "Daily street club",
  "1530 Broadway · street",
  [23.2, 6, 29],
  east,
  22,
  4,
  [-3, 1.72, 23],
  44,
  "Small",
);
add(
  46,
  "Daily portrait",
  "1530 Broadway · upper north",
  [23.2, 33, 23],
  east,
  10,
  22,
  [-3, 1.72, 17],
  45,
);
add(
  47,
  "Daily color study",
  "1530 Broadway · upper south",
  [23.2, 30, 36],
  east,
  12,
  16,
  [-3, 1.72, 24],
  46,
);
add(
  48,
  "Daily roof band",
  "1530 Broadway · upper ribbon",
  [23.2, 46, 29],
  east,
  23,
  5,
  [-3, 1.72, 12],
  47,
);
add(
  49,
  "Daily north cover",
  "1530 Broadway · north return",
  [37, 25, 14.7],
  south,
  24,
  29,
  [5, 1.72, 0],
  48,
  "Premium",
);
add(
  50,
  "Seventh avenue marquee",
  "1500 Broadway · street",
  [24.2, 7, 63],
  east,
  28,
  5,
  [1, 1.72, 55],
  49,
  "Small",
);
add(
  51,
  "Seventh avenue ticker",
  "1500 Broadway · lower ribbon",
  [24.2, 14, 63],
  east,
  28,
  4,
  [1, 1.72, 45],
  50,
  "Small",
);
add(
  52,
  "Seventh upper story",
  "1500 Broadway · upper wide",
  [24.2, 49, 63],
  east,
  28,
  17,
  [0, 1.72, 37],
  51,
);
add(
  53,
  "Seventh north portrait",
  "1500 Broadway · north face",
  [40, 24, 46.2],
  south,
  26,
  31,
  [5, 1.72, 27],
  52,
  "Premium",
);
add(
  54,
  "Seventh north loft",
  "1500 Broadway · north upper",
  [40, 50, 46.2],
  south,
  26,
  17,
  [3, 1.72, 21],
  53,
);
// North-facing visitor composition: a six-level landmark and its flank buildings.
add(
  55,
  "Steps street edition",
  "Two Times Square · base",
  [0, 7, -92],
  0,
  19,
  5,
  [3, 1.72, -51],
  54,
  "Small",
);
add(
  56,
  "Steps live line",
  "Two Times Square · lower ticker",
  [0, 14, -92],
  0,
  19,
  3,
  [3, 1.72, -51],
  55,
  "Small",
);
add(
  57,
  "Steps sky gallery",
  "Two Times Square · upper stack",
  [0, 58, -92],
  0,
  19,
  12,
  [3, 1.72, -46],
  56,
);
add(
  58,
  "Steps rooftop",
  "Two Times Square · crown",
  [0, 69, -92],
  0,
  18,
  7,
  [3, 1.72, -43],
  57,
  "Premium",
);
add(
  59,
  "Steps east portrait",
  "Two Times Square · east flank",
  [10.8, 45, -104],
  west,
  20,
  23,
  [20, 1.72, -78],
  58,
);
add(
  60,
  "Steps west portrait",
  "Two Times Square · west flank",
  [-10.8, 31, -104],
  east,
  21,
  28,
  [-20, 1.72, -78],
  59,
);
add(
  61,
  "Duffy east panorama",
  "1560 Broadway · middle gallery",
  [24.7, 24, -55],
  east,
  31,
  16,
  [-3, 1.72, -44],
  60,
  "Premium",
);
add(
  62,
  "Duffy east portrait",
  "1560 Broadway · upper north",
  [24.7, 47, -63],
  east,
  14,
  26,
  [-2, 1.72, -45],
  61,
);
add(
  63,
  "Duffy east studio",
  "1560 Broadway · upper south",
  [24.7, 42, -45],
  east,
  17,
  16,
  [-2, 1.72, -46],
  62,
);
add(
  64,
  "Duffy east roofline",
  "1560 Broadway · upper ribbon",
  [24.7, 62, -47],
  east,
  18,
  7,
  [-2, 1.72, -46],
  63,
);
add(
  65,
  "Duffy east corner",
  "1560 Broadway · south return",
  [38, 24, -36.2],
  0,
  25,
  27,
  [8, 1.72, -12],
  64,
  "Premium",
);
add(
  66,
  "Duffy west panorama",
  "Duffy west · lower gallery",
  [-24.2, 19, -83],
  west,
  32,
  21,
  [-3, 1.72, -54],
  65,
  "Premium",
);
add(
  67,
  "Duffy west portrait",
  "Duffy west · upper south",
  [-24.2, 43, -74],
  west,
  14,
  23,
  [-3, 1.72, -53],
  66,
);
add(
  68,
  "Duffy west studio",
  "Duffy west · upper north",
  [-24.2, 39, -92],
  west,
  17,
  15,
  [-4, 1.72, -56],
  67,
);
add(
  69,
  "Duffy west corner",
  "Duffy west · south return",
  [-39, 24, -63.2],
  0,
  27,
  30,
  [-8, 1.72, -43],
  68,
  "Premium",
);
add(
  70,
  "Theatre street",
  "Theatre district · lower west",
  [-23.2, 11, 89],
  west,
  34,
  10,
  [-3, 1.72, 64],
  69,
);
add(
  71,
  "Theatre portrait",
  "Theatre district · west high",
  [-23.2, 34, 80],
  west,
  15,
  31,
  [-3, 1.72, 60],
  70,
);
add(
  72,
  "Theatre color room",
  "Theatre district · west south",
  [-23.2, 31, 99],
  west,
  19,
  24,
  [-18, 1.72, 78],
  71,
);
// This connected return is part of slot 36, not extra inventory. Local-U order
// meets exactly at the corner and uses one texture at a constant pixels/metre.
SLOTS[34].segments[0].position[1] = 70;
SLOTS[34].segments[0].height = 6;
SLOTS[36].segments[0].position[1] = 44;
SLOTS[36].segments[0].height = 18;
SLOTS[35].segments = [
  { position: [-24.2, 60, 30.2], rotation: west, width: 8, height: 10 },
  { position: [-33, 60, 26.2], rotation: south, width: 17.6, height: 10 },
];
SLOTS[35].look = [-28, 60, 26.2];
// Final sightline pass: use cross-street gaps for return-wall viewing positions.
SLOTS[14].segments[0].position[0] = 24.2;
SLOTS[14].camera = [18, 1.72, 84];
SLOTS[24].segments[0].width = 16;
SLOTS[45].segments[0].height = 20;
SLOTS[63].segments[0].width = 16;
for (const n of [29, 30]) SLOTS[n - 1].camera = [-18, 1.72, -60];
SLOTS[36].camera = [-18, 1.72, 24];
for (const n of [53, 54]) SLOTS[n - 1].camera = [18, 1.72, 44.5];
SLOTS[64].camera = [18, 1.72, -34];
SLOTS[68].camera = [-18, 1.72, -60];
for (const n of [70, 71]) SLOTS[n - 1].camera = [-18, 1.72, 68];
// Three head-on north-star displays replace concealed return-wall placements.
for (const [n, y, h, title] of [
  [42, 13, 14, "North star marquee"],
  [43, 34, 23, "North star feature"],
  [44, 58, 20, "North star gallery"],
] as const) {
  const s = SLOTS[n - 1];
  s.name = title;
  s.location = "Seventh Avenue · beside the red steps";
  s.segments = [
    { position: [23.7, y, -106], rotation: east, width: 31, height: h },
  ];
  s.camera = [8, 1.72, -60];
  s.look = s.segments[0].position;
}
export const slotWidth = (slot: Slot) =>
  slot.segments.reduce((sum, s) => sum + s.width, 0);
export const slotAspect = (slot: Slot) =>
  slotWidth(slot) / slot.segments[0].height;
export const HERO: { position: Vec3; look: Vec3 } = {
  position: [-4, 1.72, -49],
  look: [0, 24, 68],
};
export const HOUSE = [
  {
    name: "A place for\nbig ideas.",
    sub: "YOUR NEXT CHAPTER STARTS HERE",
    bg: "#ef4b2e",
    fg: "#fff4df",
    style: 0,
  },
  {
    name: "MAKE\nSOME\nNOISE.",
    sub: "SMALL BRAND. BIG CITY.",
    bg: "#b8ed54",
    fg: "#183b35",
    style: 1,
  },
  {
    name: "Hello,\nworld.",
    sub: "THE INTERNET HAS A NEW ADDRESS",
    bg: "#6c56d7",
    fg: "#fff5df",
    style: 2,
  },
  {
    name: "Good things deserve to be seen.",
    sub: "THIS COULD BE YOUR CORNER OF THE INTERNET",
    bg: "#faabce",
    fg: "#6e203c",
    style: 3,
  },
  {
    name: "TAKE YOUR\nPLACE.",
    sub: "IDEAS WELCOME",
    bg: "#f6bf3f",
    fg: "#203e56",
    style: 0,
  },
  {
    name: "A little more\nextraordinary.",
    sub: "A STAGE FOR THE INDEPENDENT",
    bg: "#236cde",
    fg: "#fff6db",
    style: 2,
  },
  {
    name: "LOOK\nUP.",
    sub: "SOMETHING GOOD IS COMING",
    bg: "#ff6436",
    fg: "#fff1d3",
    style: 1,
  },
  {
    name: "BIG\nLITTLE\nIDEAS",
    sub: "PAPER SQUARE",
    bg: "#fee162",
    fg: "#23343b",
    style: 0,
  },
  {
    name: "Out here.\nIn full color.",
    sub: "YOUR BRAND BELONGS HERE",
    bg: "#136b57",
    fg: "#eaf3b8",
    style: 3,
  },
  {
    name: "NEW\nYORK\nSTATE\nOF MIND",
    sub: "MEET YOUR NEXT FAVORITE",
    bg: "#f1a2d2",
    fg: "#3b2659",
    style: 1,
  },
  {
    name: "Meet me\nin the square.",
    sub: "A LITTLE TIMES SQUARE FOR THE INTERNET",
    bg: "#fd543e",
    fg: "#fff5dd",
    style: 2,
  },
  {
    name: "THE\nWORLD\nIS HERE.",
    sub: "AND THERE IS ROOM FOR YOU",
    bg: "#4152c8",
    fg: "#fce88d",
    style: 0,
  },
  {
    name: "oh, hey.",
    sub: "YOUR IDEA. UP HERE.",
    bg: "#f5b639",
    fg: "#492f35",
    style: 3,
  },
  {
    name: "THINK\nBIGGER.",
    sub: "START SMALL",
    bg: "#a9dccc",
    fg: "#134944",
    style: 1,
  },
  {
    name: "See you\naround.",
    sub: "EXPLORE SOMETHING NEW",
    bg: "#98c9ed",
    fg: "#163c63",
    style: 2,
  },
];
export type Creative = {
  name: string;
  url: string;
  tagline: string;
  description: string;
  category: string;
  social: string;
  mode: "template" | "upload" | "video";
  bg: string;
  fg: string;
  headline: string;
  subline: string;
  logo: string;
  image: string;
  poster?: string;
  fit: "contain" | "cover";
  cropX: number;
  cropY: number;
};
export const EMPTY_CREATIVE: Creative = {
  name: "",
  url: "",
  tagline: "",
  description: "",
  category: "Technology",
  social: "",
  mode: "upload",
  bg: "#f7f3e8",
  fg: "#fff7e7",
  headline: "",
  subline: "",
  logo: "",
  image: "",
  fit: "cover",
  cropX: 50,
  cropY: 50,
};
export type PublicSlot = {
  id: string;
  version: number;
  available: boolean;
  opening: number;
  total: number;
  brandId: string | null;
  creativeId: string | null;
  creative: Creative | null;
  reserved: boolean;
  history: {
    name: string;
    total: number;
    at: string;
    until: string | null;
    kind: string;
  }[];
};
export type Snapshot = {
  auction?: import('./auction-window').AuctionWindow;
  version: number;
  slots: PublicSlot[];
  directory: {
    id: string;
    creative: Creative;
    total: number;
    slots: string[];
    paidSlots: string[];
  }[];
  paused: boolean;
  preset: string;
  mode: string;
  name: string;
  support: string;
};
export const money = (c: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: c % 100 ? 2 : 0,
  }).format(c / 100);
