export type AuctionWindow = {
  startsAt: string;
  endsAt: string;
  serverNow: string;
  closed: boolean;
};

export function auctionRemaining(auction: AuctionWindow | undefined, elapsed = 0) {
  if (!auction || auction.closed) return 0;
  return Math.max(0, Date.parse(auction.endsAt) - Date.parse(auction.serverNow) - elapsed);
}

export function countdownParts(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return [Math.floor(seconds / 86400), Math.floor(seconds / 3600) % 24,
    Math.floor(seconds / 60) % 60, seconds % 60];
}
