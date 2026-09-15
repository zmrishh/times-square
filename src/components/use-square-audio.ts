"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setBillboardAudio, closeBillboardAudio } from "@/lib/billboard-audio";

const PREFERENCE = "paper-sound-muted";

export function useSquareAudio() {
  const [enabled, setEnabled] = useState(true);
  const preference = useRef(true);
  const musicRef = useRef<HTMLAudioElement>(null);
  const generation = useRef(0);
  const apply = useCallback(() => {
    const active = preference.current && !document.hidden;
    const music = musicRef.current;
    const current = generation.current;
    if (music) {
      music.muted = !active;
      if (!active) music.pause();
      else if (music.paused && !music.ended) {
        void music
          .play()
          .then(() => {
            if (
              current === generation.current &&
              (!preference.current || document.hidden)
            ) {
              music.muted = true;
              music.pause();
            }
          })
          .catch(() => {});
      }
    }
    void setBillboardAudio(active).catch(() => {});
  }, []);
  const toggle = useCallback(() => {
    preference.current = !preference.current;
    setEnabled(preference.current);
    try {
      localStorage.setItem(PREFERENCE, String(!preference.current));
    } catch {}
    window.dispatchEvent(new CustomEvent("paper-sound-preference", { detail: preference.current }));
    // Both resume calls run directly inside the user's gesture, including on
    // mobile browsers that require it for audible media playback.
    apply();
  }, [apply]);

  useEffect(() => {
    const activeGeneration = ++generation.current;
    musicRef.current = document.getElementById("paper-entrance-music") as HTMLAudioElement | null;
    try {
      preference.current = localStorage.getItem(PREFERENCE) !== "true";
    } catch {}
    // Synchronize a browser preference after hydration.
    setEnabled(preference.current);
    const syncPreference = (event: Event) => {
      preference.current = (event as CustomEvent<boolean>).detail;
      setEnabled(preference.current);
      apply();
    };
    // Autoplay blocking never changes the enabled preference. A gesture
    // resumes the same audio context as soon as the browser permits it.
    document.addEventListener("click", apply);
    document.addEventListener("keydown", apply);
    document.addEventListener("visibilitychange", apply);
    window.addEventListener("paper-sound-preference", syncPreference);
    apply();
    const music = musicRef.current;
    return () => {
      generation.current = activeGeneration + 1;
      music?.pause();
      document.removeEventListener("click", apply);
      document.removeEventListener("keydown", apply);
      document.removeEventListener("visibilitychange", apply);
      window.removeEventListener("paper-sound-preference", syncPreference);
      void closeBillboardAudio().catch(() => {});
    };
  }, [apply]);
  return { enabled, toggle };
}
