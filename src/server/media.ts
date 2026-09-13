import sharp from "sharp";
import {
  BufferSource,
  BufferTarget,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  EncodedAudioPacketSource,
  Input,
  MP4,
  Mp4OutputFormat,
  Output,
} from "mediabunny";
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from "../lib/media";

export async function prepareImage(buffer: Buffer) {
  const signature =
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ||
    (buffer.toString("ascii", 0, 4) === "RIFF" &&
      buffer.toString("ascii", 8, 12) === "WEBP");
  if (!signature)
    throw new Error("Unsupported image. Use a static PNG, JPEG or WebP.");
  const image = sharp(buffer, {
    limitInputPixels: 16_000_000,
    animated: false,
    failOn: "warning",
  });
  const m = await image.metadata();
  if (
    !["png", "jpeg", "webp"].includes(m.format || "") ||
    (m.pages || 1) > 1 ||
    !m.width ||
    !m.height ||
    Math.min(m.width, m.height) < 64 ||
    Math.max(m.width, m.height) > 6000
  )
    throw new Error(
      "Unsupported image. Use a static PNG, JPEG or WebP, 64–6000 px, at most 16 megapixels.",
    );
  return image
    .rotate()
    .resize({
      width: 2048,
      height: 2048,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 90 })
    .toBuffer();
}

/** Repackage bounded H.264/AAC tracks, omitting source metadata. */
export async function prepareVideo(buffer: Buffer) {
  if (!buffer.length || buffer.length > MAX_VIDEO_BYTES)
    throw new Error("Upload a video up to 50 MB.");
  const input = new Input({ source: new BufferSource(buffer), formats: [MP4] });
  let output: Output | undefined;
  try {
    const tracks = await input.getVideoTracks();
    if (tracks.length !== 1)
      throw new Error(
        "Unsupported video. Upload one H.264 video track in an MP4.",
      );
    const track = tracks[0];
    const [
      codec,
      width,
      height,
      codedWidth,
      codedHeight,
      start,
      duration,
      rotation,
      config,
    ] = await Promise.all([
      track.getCodec(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      track.getCodedWidth(),
      track.getCodedHeight(),
      track.getFirstTimestamp(),
      track.computeDuration(),
      track.getRotation(),
      track.getDecoderConfig(),
    ]);
    if (
      codec !== "avc" ||
      !config ||
      !config.description ||
      !/^avc1\.(42|4d|64)/i.test(config.codec)
    )
      throw new Error(
        "Unsupported video. Export an MP4 using H.264, 8-bit color.",
      );
    if (
      ![width, height, codedWidth, codedHeight].every(
        (n) => Number.isFinite(n) && n >= 64 && n <= 1920,
      ) ||
      width * height > 2_073_600 ||
      codedWidth * codedHeight > 2_073_600
    )
      throw new Error(
        "Unsupported video dimensions. Use 64–1920 px per side, up to 1080p area.",
      );
    if (
      !Number.isFinite(start) ||
      Math.abs(start) > 1 ||
      !Number.isFinite(duration) ||
      duration - start <= 0 ||
      duration - start > MAX_VIDEO_SECONDS + 0.01
    )
      throw new Error("Upload a video between 0 and 30 seconds.");
    const source = new EncodedVideoPacketSource("avc");
    const target = new BufferTarget();
    output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
    output.addVideoTrack(source, { rotation });
    const audioTracks=await input.getAudioTracks();
    if(audioTracks.length>1) throw new Error('Unsupported video. Use at most one AAC audio track.');
    const audioTrack=audioTracks[0];
    let audioSource:EncodedAudioPacketSource|undefined;
    let audioConfig:Awaited<ReturnType<typeof audioTrack.getDecoderConfig>>|undefined;
    if(audioTrack) {
      audioConfig=await audioTrack.getDecoderConfig();
      const channels=await audioTrack.getNumberOfChannels(),rate=await audioTrack.getSampleRate();
      if(await audioTrack.getCodec()!=='aac'||!audioConfig||audioConfig.codec!=='mp4a.40.2'||channels<1||channels>2||rate<8000||rate>48000)
        throw new Error('Unsupported video audio. Export AAC-LC mono or stereo, up to 48 kHz.');
      audioSource=new EncodedAudioPacketSource('aac');
      output.addAudioTrack(audioSource);
    }
    await output.start();
    let count = 0,
      bytes = 0;
    for await (const packet of new EncodedPacketSink(track).packets()) {
      count++;
      bytes += packet.data.byteLength;
      if (
        count > 1800 ||
        bytes > MAX_VIDEO_BYTES ||
        !packet.data.length ||
        !Number.isFinite(packet.timestamp) ||
        !Number.isFinite(packet.duration) ||
        packet.duration < 0 ||
        packet.timestamp - start < -0.1 ||
        packet.timestamp + packet.duration - start > MAX_VIDEO_SECONDS + 0.05
      )
        throw new Error(
          "Unsupported video. Use a complete MP4 up to 30 seconds and 60 fps.",
        );
      await source.add(
        packet.clone({ timestamp: Math.max(0, packet.timestamp - start) }),
        count === 1 ? { decoderConfig: config } : undefined,
      );
    }
    if (count < 2 || count / (duration - start) > 61)
      throw new Error("Unsupported video. Use a moving MP4 up to 60 fps.");
    source.close();
    if(audioSource && audioTrack && audioConfig) {
      let audioCount=0,audioBytes=0;
      for await(const packet of new EncodedPacketSink(audioTrack).packets()) {
        audioCount++;audioBytes+=packet.data.length;
        if(audioCount>1600||audioBytes>5_000_000||!Number.isFinite(packet.timestamp)||!Number.isFinite(packet.duration)||packet.duration<0||packet.timestamp-start < -1 || packet.timestamp+packet.duration-start>MAX_VIDEO_SECONDS+0.15)
          throw new Error('Unsupported video audio. Use a complete AAC track up to 30 seconds.');
        await audioSource.add(packet.clone({timestamp:Math.max(0,packet.timestamp-start)}),audioCount===1?{decoderConfig:audioConfig}:undefined);
      }
      audioSource.close();
    }
    await output.finalize();
    const bytesOut = Buffer.from(target.buffer!);
    if (bytesOut.length > MAX_VIDEO_BYTES)
      throw new Error("Upload a video up to 50 MB after processing.");
    return { bytes: bytesOut, width, height, duration: duration - start };
  } catch (e) {
    await output?.cancel().catch(() => {});
    if (
      e instanceof Error &&
      /^(Unsupported video|Upload a video)/.test(e.message)
    )
      throw e;
    throw new Error("Unsupported video. Use a complete, playable H.264 MP4.");
  } finally {
    input.dispose();
  }
}
