"use client";
import { useEffect, useState } from 'react';
import { auctionRemaining, countdownParts, type AuctionWindow } from '@/lib/auction-window';

export function useAuctionClosed(auction: AuctionWindow | undefined) {
  const [expiredDeadline, setExpiredDeadline] = useState('');
  useEffect(() => {
    if (!auction || auction.closed) return;
    const timer = setTimeout(() => setExpiredDeadline(auction.endsAt), auctionRemaining(auction));
    return () => clearTimeout(timer);
  }, [auction]);
  return !auction || auction.closed || expiredDeadline === auction.endsAt || auctionRemaining(auction) === 0;
}

export function AuctionCountdown({ auction }: { auction: AuctionWindow | undefined }) {
  const [tick, setTick] = useState<{ serverNow: string; remaining: number } | null>(null);
  useEffect(() => {
    if (!auction || auction.closed) return;
    const start = performance.now();
    const timer = setInterval(() => {
      const remaining = auctionRemaining(auction, performance.now() - start);
      setTick({ serverNow: auction.serverNow, remaining });
      if (!remaining) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [auction]);
  const remaining = tick?.serverNow === auction?.serverNow && !auction?.closed
    ? tick!.remaining : auctionRemaining(auction);
  const closed = Boolean(auction && remaining === 0);
  const parts = countdownParts(remaining);
  return <div className="auction-countdown" data-closed={closed}
    title={auction ? `Bidding ends ${new Date(auction.endsAt).toUTCString()}` : undefined}>
    <span className="auction-label">{closed ? 'Bidding has ended' : '7 days to make your mark'}</span>
    <span className="auction-time" role="timer" aria-label={auction ? (closed ? 'Bidding closed' : `${parts[0]} days, ${parts[1]} hours, ${parts[2]} minutes, ${parts[3]} seconds left to bid`) : 'Loading bidding deadline'}>
      {!auction ? 'Loading countdown…' : closed ? 'Winners stay forever' : parts.map((part, i) =>
        <span key={i}>{String(part).padStart(2, '0')}<small>{['d', 'h', 'm', 's'][i]}</small></span>)}
    </span>
    <span className="auction-caption">{closed ? 'The square is now part of their story.' : 'Highest bidder on each billboard stays forever.'}</span>
  </div>;
}
