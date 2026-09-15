import { ENTRANCE_AUDIO_BOOTSTRAP } from "@/lib/entrance-audio-bootstrap";

/** Server-rendered before the app: playback never waits for scene hydration. */
export function EntranceMusic() {
  return (
    <>
      <audio
        id="paper-entrance-music"
        src="/audio/good-morning-new-yorkers.mp3"
        preload="auto"
        hidden
      />
      {/* First-party, parser-executed startup code: deliberately independent
          of the Next/React bundles and their hydration schedule. */}
      <script dangerouslySetInnerHTML={{ __html: ENTRANCE_AUDIO_BOOTSTRAP }} />
    </>
  );
}
