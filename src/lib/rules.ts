export const RULES = {
  version: "2026-09-v1",
  minimumIncrement: 500,
  percent: 25,
  preset: "quarter" as "quarter" | "double",
  maxTarget: 1000000,
  reservationMs: 10 * 60 * 1000,
  graceMs: 2 * 60 * 1000,
};
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
          : Math.max(
              RULES.minimumIncrement,
              Math.ceil((leader * RULES.percent) / 100 / 100) * 100,
            ));
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
