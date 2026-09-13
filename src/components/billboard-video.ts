"use client";
/* Video elements and textures are imperative browser/Three resources. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Creative, Slot, slotWidth } from "@/lib/registry";
import { videoCrop } from "@/lib/media";
import { BUILDINGS } from "@/lib/scene-layout";

// Only nearby visible screens acquire a decoder. Directory cards use posters.
const decoders = new Set<symbol>();
export function useBillboardVideo(
  slot: Slot,
  creative: Creative | undefined,
  paused: boolean,
  reduced: boolean,
) {
  const token = useRef(Symbol(slot.id));
  const [eligible, setEligible] = useState(false);
  const [playing, setPlaying] = useState<{
    texture: THREE.VideoTexture;
    src: string;
  } | null>(null);
  const sample = useRef(0);
  const src = creative?.mode === "video" ? creative.image : "";
  const probes = useMemo(
    () => ({
      point: new THREE.Vector3(),
      projected: new THREE.Vector3(),
      hit: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      ray: new THREE.Ray(),
      boxes: BUILDINGS.map(
        (b) =>
          new THREE.Box3(
            new THREE.Vector3(b.x - b.w / 2, 0, b.z - b.d / 2),
            new THREE.Vector3(b.x + b.w / 2, b.h, b.z + b.d / 2),
          ),
      ),
    }),
    [],
  );
  useFrame(({ camera }, delta) => {
    if (!src) return;
    sample.current += delta;
    if (sample.current < 0.5) return;
    sample.current = 0;
    const limit = matchMedia("(pointer: coarse)").matches ? 2 : 3;
    let visible = false;
    if (
      !paused &&
      !reduced &&
      !document.hidden &&
      (decoders.has(token.current) || decoders.size < limit)
    ) {
      for (const s of slot.segments) {
        probes.point.set(...s.position);
        probes.direction.subVectors(camera.position, probes.point);
        if (
          probes.direction.x * Math.sin(s.rotation) +
            probes.direction.z * Math.cos(s.rotation) <=
          0
        )
          continue;
        const distance = probes.direction.length();
        probes.projected.copy(probes.point).project(camera);
        if (
          Math.abs(probes.projected.x) > 1.2 ||
          Math.abs(probes.projected.y) > 1.2 ||
          probes.projected.z > 1 ||
          (Math.max(slotWidth(slot), s.height) / distance) * 900 < 140
        )
          continue;
        probes.ray.set(camera.position, probes.direction.negate().normalize());
        if (
          probes.boxes.some(
            (box) =>
              probes.ray.intersectBox(box, probes.hit) &&
              camera.position.distanceTo(probes.hit) < distance - 0.5,
          )
        )
          continue;
        visible = true;
        break;
      }
    }
    setEligible((old) => (old === visible ? old : visible));
  });
  useEffect(() => {
    if (!src || !eligible || paused || reduced) return;
    const key = token.current;
    const limit = matchMedia("(pointer: coarse)").matches ? 2 : 3;
    if (decoders.size >= limit) return;
    decoders.add(key);
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "auto";
    let texture: THREE.VideoTexture | null = null,
      disposed = false;
    const loaded = () => {
      if (disposed) return;
      texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      setPlaying({ texture, src });
    };
    video.addEventListener("loadeddata", loaded, { once: true });
    const pause = () => {
      if (document.hidden) video.pause();
      else if (!disposed) void video.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", pause);
    video.src = src;
    void video.play().catch(() => {});
    return () => {
      disposed = true;
      decoders.delete(key);
      document.removeEventListener("visibilitychange", pause);
      video.removeEventListener("loadeddata", loaded);
      video.pause();
      video.removeAttribute("src");
      video.load();
      setPlaying(null);
      texture?.dispose();
    };
  }, [src, eligible, paused, reduced]);
  const texture =
    eligible && !paused && !reduced && playing?.src === src
      ? playing.texture
      : null;
  useEffect(() => {
    if (!texture) return;
    const video = texture.image as HTMLVideoElement;
    const crop = videoCrop(
      video.videoWidth / video.videoHeight,
      slotWidth(slot) / slot.segments[0].height,
      creative?.cropX,
      creative?.cropY,
    );
    texture.repeat.set(crop.repeatX, crop.repeatY);
    texture.offset.set(crop.offsetX, crop.offsetY);
  }, [texture, slot, creative?.cropX, creative?.cropY]);
  return texture;
}
