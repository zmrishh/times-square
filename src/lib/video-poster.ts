import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "./media";

/** Decode a real first frame before sending a video. The server validates again. */
export async function videoPoster(file: File): Promise<Blob> {
  if (file.size > MAX_VIDEO_BYTES)
    throw new Error("Upload a video up to 50 MB.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      const finish = (error?: Error) => {
        clearTimeout(timer);
        video.onloadeddata = null;
        video.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(
        () =>
          finish(
            new Error("Video preview timed out. Try a smaller H.264 MP4."),
          ),
        20000,
      );
      video.onloadeddata = () => finish();
      video.onerror = () =>
        finish(
          new Error(
            "This video cannot play in your browser. Export an H.264 MP4.",
          ),
        );
      video.src = url;
    });
    if (
      !Number.isFinite(video.duration) ||
      video.duration <= 0 ||
      video.duration > MAX_VIDEO_SECONDS + 0.01
    )
      throw new Error("Upload a video up to 30 seconds.");
    const w = video.videoWidth,
      h = video.videoHeight;
    if (
      !w ||
      !h ||
      Math.min(w, h) < 64 ||
      Math.max(w, h) > 1920 ||
      w * h > 2_073_600
    )
      throw new Error(
        "Use video dimensions of 64–1920 px per side, up to 1080p area.",
      );
    const scale = Math.min(
      1,
      Math.max(640 / Math.max(w, h), 64 / Math.min(w, h)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(64, Math.round(w * scale));
    canvas.height = Math.max(64, Math.round(h * scale));
    canvas
      .getContext("2d")!
      .drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("Unable to create video preview.")),
        "image/jpeg",
        0.8,
      ),
    );
  } finally {
    video.pause();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
