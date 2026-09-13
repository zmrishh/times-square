import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BufferSource, Input, MP4 } from "mediabunny";
import { prepareVideo, prepareImage } from "../src/server/media";
import { byteRange, placementFormat, videoCrop } from "../src/lib/media";
import { SLOTS, slotAspect } from "../src/lib/registry";
import { creativeSchema } from "../src/server/content";
import { EMPTY_CREATIVE } from "../src/lib/registry";

test("video processing preserves moving H.264 frames and removes audio and source tags", async () => {
  const prepared = await prepareVideo(
    await readFile("tests/fixtures/loop.mp4"),
  );
  assert.equal(prepared.width, 256);
  assert.equal(prepared.height, 128);
  assert.ok(Math.abs(prepared.duration - 1) < 0.1);
  const input = new Input({
    source: new BufferSource(prepared.bytes),
    formats: [MP4],
  });
  try {
    assert.equal((await input.getAudioTracks()).length, 0);
    assert.equal((await input.getVideoTracks()).length, 1);
    assert.equal((await input.getPrimaryVideoTrack())?.type, "video");
    assert.ok(
      !JSON.stringify(await input.getMetadataTags()).includes(
        "Private source metadata",
      ),
    );
    assert.ok(prepared.bytes.length > 1000);
  } finally {
    input.dispose();
  }
});
test("spoofed, truncated and oversized media are rejected", async () => {
  await assert.rejects(
    prepareVideo(Buffer.from("<svg><script>bad</script></svg>")),
    /Unsupported video/,
  );
  await assert.rejects(prepareVideo(Buffer.alloc(4_000_001)), /up to 4 MB/);
  await assert.rejects(
    prepareVideo((await readFile("tests/fixtures/loop.mp4")).subarray(0, 160)),
    /Unsupported video/,
  );
  await assert.rejects(
    prepareImage(await readFile("tests/fixtures/loop.mp4")),
    /Unsupported image/,
  );
});
test("every placement has a usable ratio and even, proportionate video dimensions", () => {
  for (const slot of SLOTS) {
    const f = placementFormat(slot);
    assert.ok(
      f.width >= 64 && f.height >= 64 && f.width <= 1920 && f.height <= 1920,
    );
    assert.equal(f.width % 2, 0);
    assert.ok(f.width * f.height <= 2_073_600);
    assert.equal(f.height % 2, 0);
    assert.ok(
      Math.abs(f.width / f.height - slotAspect(slot)) / slotAspect(slot) < 0.02,
    );
  }
  assert.equal(placementFormat(SLOTS[0]).label, "2:3");
});
test("video crop preserves scale across the complete wrap and follows HTML crop positions", () => {
  assert.deepEqual(videoCrop(2, 1, 0, 0), {
    repeatX: 0.5,
    repeatY: 1,
    offsetX: 0,
    offsetY: 0,
  });
  assert.deepEqual(videoCrop(1, 2, 50, 0), {
    repeatX: 1,
    repeatY: 0.5,
    offsetX: 0,
    offsetY: 0.5,
  });
  assert.deepEqual(videoCrop(1, 2, 50, 100), {
    repeatX: 1,
    repeatY: 0.5,
    offsetX: 0,
    offsetY: 0,
  });
  const wrap = SLOTS.find((s) => s.segments.length > 1)!;
  const crop = videoCrop(slotAspect(wrap), slotAspect(wrap));
  assert.equal(crop.repeatX, 1);
  assert.equal(crop.repeatY, 1);
});
test("private video responses support bounded ranges and reject invalid or multiple ranges", () => {
  assert.equal(byteRange(null, 100), null);
  assert.deepEqual(byteRange("bytes=0-9", 100), { start: 0, end: 9 });
  assert.deepEqual(byteRange("bytes=90-", 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange("bytes=-10", 100), { start: 90, end: 99 });
  assert.deepEqual(byteRange("bytes=90-200", 100), { start: 90, end: 99 });
  for (const bad of [
    "bytes=100-",
    "bytes=-0",
    "bytes=8-2",
    "bytes=0-1,3-4",
    "bytes=a-b",
    "bytes=-",
    "bytes=999999999999999999-",
  ])
    assert.equal(byteRange(bad, 100), false, bad);
});
test("new creatives default to full-screen images; legacy templates remain parseable", () => {
  assert.equal(EMPTY_CREATIVE.mode, "upload");
  assert.equal(EMPTY_CREATIVE.fit, "cover");
  const legacy = {
    ...EMPTY_CREATIVE,
    name: "Legacy",
    url: "https://legacy.example",
    mode: "template",
    headline: "Already purchased",
  };
  assert.ok(creativeSchema.safeParse(legacy).success);
});
