"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./welcome-overlay.module.css";

const WELCOME_DURATION = 7000;

/** Mounted once when the scene is ready; panel and scene updates retain it. */
export function WelcomeOverlay({ onComplete }: { onComplete: () => void }) {
  const [finished, setFinished] = useState(false);
  const startedAt = useRef<number | null>(null);
  const completed = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const finish = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    window.clearTimeout(timer.current);
    setFinished(true);
    onComplete();
  }, [onComplete]);
  const start = useCallback(() => {
    if (completed.current) return;
    startedAt.current ??= performance.now();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(finish,
      Math.max(0, WELCOME_DURATION - (performance.now() - startedAt.current)));
  }, [finish]);

  useEffect(() => {
    // CSS animationstart anchors the normal sequence to the first painted
    // frame. Reduced motion has no animation event, so start its static hold
    // here. A stored deadline survives effect replay and preference changes.
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches || startedAt.current !== null) start();
    const changed = () => { if (motion.matches) start(); };
    motion.addEventListener("change", changed);
    return () => {
      window.clearTimeout(timer.current);
      motion.removeEventListener("change", changed);
    };
  }, [start]);

  if (finished) return null;
  return (
    <div className={styles.overlay} data-welcome-overlay aria-hidden="true"
      onAnimationStart={start} onAnimationEnd={finish}>
      <div className={styles.lettering}>
        <span className={styles.eyebrow}>Welcome to</span>
        <span className={styles.title}>
          <span>Times</span>{" "}<span>Square</span>
        </span>
      </div>
    </div>
  );
}
