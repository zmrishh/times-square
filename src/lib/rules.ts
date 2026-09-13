export const RULES = {
  version: "2026-09-video-v2",
  minimumIncrement: 1000,
  percent: 0,
  preset: "quarter" as "quarter" | "double",
  maxTarget: 1000000,
  reservationMs: 10 * 60 * 1000,
  graceMs: 2 * 60 * 1000,
};
export const VIDEO_PREMIUM_PERCENT = 50;
export const videoPrice = (ranking: number) => ranking + Math.ceil(ranking / 2);
export function mediaPrice(base: ReturnType<typeof quoteAmount>, video: boolean, credit = 0) {
  if (!Number.isSafeInteger(credit) || credit < 0) throw new Error("Invalid video credit.");
  const videoFee = video ? Math.max(0, Math.ceil(base.target / 2) - credit) : 0;
  return { ...base, rankingDue: base.due, videoFee, videoCredit: credit, due: base.due + videoFee };
}
export function nextMinimum(
  leader: number,
  opening: number,
  preset = "quarter",
) {
  return leader === 0
    ? opening
    : leader +
        (preset === "double"
          ? leader
          : RULES.minimumIncrement);
}
export function quoteAmount(
  leader: number,
  existing: number,
  opening: number,
  target?: number,
  preset = "quarter",
) {
  const minimum = nextMinimum(leader, opening, preset);
  const ranking = target ?? minimum;
  if (
    !Number.isSafeInteger(ranking) ||
    ranking < minimum ||
    ranking > RULES.maxTarget
  )
    throw new Error(
      `Target must be between ${minimum / 100} and ${RULES.maxTarget / 100} USD.`,
    );
  if (!Number.isSafeInteger(existing) || existing < 0 || existing >= ranking)
    throw new Error("Invalid applied total.");
  return {
    minimum,
    target: ranking,
    due: ranking - existing,
    existing,
    rulesVersion: RULES.version,
    preset,
  };
}
