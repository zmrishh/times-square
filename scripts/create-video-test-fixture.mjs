import { mkdir, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function ensureVideoFixture() {
  const file = 'artifacts/large-video-fixture.mp4';
  if ((await stat(file).catch(() => null))?.size > 4_500_000) return file;
  await mkdir('artifacts', { recursive: true });
  const result = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000',
    '-t', '6', '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
    '-b:v', '12M', '-minrate', '12M', '-maxrate', '12M', '-bufsize', '12M',
    '-x264-params', 'nal-hrd=cbr:filler=1', '-c:a', 'aac', '-b:a', '128k',
    '-ac', '2', '-map_metadata', '-1', '-movflags', '+faststart', file,
  ], { windowsHide: true, encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    throw new Error('Install FFmpeg (or set FFMPEG_PATH) to generate the isolated large-video test fixture. ' + (result.error?.message || result.stderr));
  }
  return file;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(await ensureVideoFixture());
}
