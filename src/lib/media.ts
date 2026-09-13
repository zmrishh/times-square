import { Slot, slotWidth } from "./registry";

export const MAX_MEDIA_BYTES = 4_000_000;
export const MAX_VIDEO_BYTES = 50_000_000;
export const MAX_VIDEO_SECONDS = 30;
export const MAX_POSTER_BYTES = 200_000;
export function placementFormat(slot: Slot) {
  const w = Math.round(slotWidth(slot) * 1000);
  const h = Math.round(slot.segments[0].height * 1000);
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const divisor = gcd(w, h);
  const scale = Math.min(1920 / Math.max(w, h), Math.sqrt(2_073_600 / (w * h)));
  return {
    label: `${w / divisor}:${h / divisor}`,
    width: Math.floor((w * scale) / 2) * 2,
    height: Math.floor((h * scale) / 2) * 2,
  };
}

/** UV crop shared by HTML/Three video: one image spans the whole wrap. */
export function videoCrop(
  sourceRatio: number,
  screenRatio: number,
  x = 50,
  y = 50,
) {
  const repeatX = Math.min(1, screenRatio / sourceRatio);
  const repeatY = Math.min(1, sourceRatio / screenRatio);
  return {
    repeatX,
    repeatY,
    offsetX: ((1 - repeatX) * x) / 100,
    offsetY: (1 - repeatY) * (1 - y / 100),
  };
}

export function byteRange(header: string | null, length: number) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return false;
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), length - 1) : length - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start > end ||
    start >= length
  )
    return false;
  return { start, end };
}
