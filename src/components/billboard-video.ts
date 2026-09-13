"use client";
/* Video elements and textures are imperative browser/Three resources. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Creative, Slot, slotWidth } from "@/lib/registry";
import { videoCrop } from "@/lib/media";
import { BUILDINGS } from "@/lib/scene-layout";
import { billboardAudioContext,billboardDistance,proximityGain,AUDIO_RADIUS } from '@/lib/billboard-audio';

// Only nearby visible screens acquire a decoder. Directory cards use posters.
const decoders = new Map<symbol,{distance:number;release:()=>void}>();
export function useBillboardVideo(
  slot: Slot,
  creative: Creative | undefined,
  paused: boolean,
  reduced: boolean,
  sound: boolean,
) {
  const token = useRef(Symbol(slot.id));
  const [eligible, setEligible] = useState(false);
  const [playing, setPlaying] = useState<{
    texture: THREE.VideoTexture;
    src: string;
  } | null>(null);
  const sample = useRef(0);
  const resources=useRef<{video:HTMLVideoElement;source?:MediaElementAudioSourceNode;gain?:GainNode;pan?:StereoPannerNode;analyser?:AnalyserNode;wave?:Float32Array<ArrayBuffer>}|null>(null);
  const audible=useRef(false);
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
    const distance=billboardDistance(slot,[camera.position.x,camera.position.y,camera.position.z]);
    const media=resources.current,context=billboardAudioContext();
    if(media&&context) {
      if(!media.source) {
        media.source=context.createMediaElementSource(media.video);
        media.gain=context.createGain();media.gain.gain.value=0;
        media.pan=context.createStereoPanner();
        media.source.connect(media.gain).connect(media.pan);
        if(process.env.NODE_ENV!=='production') {media.analyser=context.createAnalyser();media.analyser.fftSize=256;media.wave=new Float32Array(256);media.pan.connect(media.analyser).connect(context.destination);}
        else media.pan.connect(context.destination);
        media.video.muted=false;
      }
      const gain=sound&&!paused&&!reduced&&!document.hidden&&audible.current ? proximityGain(distance) : 0;
      media.gain!.gain.setTargetAtTime(gain,context.currentTime,0.12);
      const s=slot.segments[0],dx=s.position[0]-camera.position.x,dz=s.position[2]-camera.position.z;
      const e=camera.matrixWorld.elements;
      media.pan!.pan.setTargetAtTime(Math.max(-0.8,Math.min(0.8,(dx*e[0]+dz*e[2])/Math.max(1,Math.hypot(dx,dz)))),context.currentTime,0.12);
      if(process.env.NODE_ENV!=='production') {media.video.dataset.audioGain=String(gain);media.video.dataset.audioDistance=String(distance);}
    }
    sample.current += delta;
    if (sample.current < 0.5) return;
    sample.current = 0;
    if(media?.analyser&&media.wave) {
      media.analyser.getFloatTimeDomainData(media.wave);
      media.video.dataset.audioRms=String(sound&&!document.hidden ? Math.sqrt(media.wave.reduce((sum,n)=>sum+n*n,0)/media.wave.length) : 0);
    }
    const limit = matchMedia("(pointer: coarse)").matches ? 2 : 3;
    const own=decoders.get(token.current);if(own)own.distance=distance;
    if(sound&&distance<AUDIO_RADIUS&&!own&&decoders.size>=limit) {
      const farthest=[...decoders.values()].sort((a,b)=>b.distance-a.distance)[0];
      if(farthest && farthest.distance>distance+2) farthest.release();
    }
    let visible = false;
    audible.current=false;
    if (
      !paused &&
      !reduced &&
      !document.hidden &&
      (decoders.has(token.current) || decoders.size < limit)
    ) {
      for (const s of slot.segments) {
        probes.point.set(...s.position);
        probes.direction.subVectors(camera.position, probes.point);
        const near=sound && distance<AUDIO_RADIUS;
        if (
          probes.direction.x * Math.sin(s.rotation) +
            probes.direction.z * Math.cos(s.rotation) <=
          0
        )
          continue;
        const screenDistance = probes.direction.length();
        probes.projected.copy(probes.point).project(camera);
        if (!near && (
          Math.abs(probes.projected.x) > 1.2 ||
          Math.abs(probes.projected.y) > 1.2 ||
          probes.projected.z > 1 ||
          (Math.max(slotWidth(slot), s.height) / screenDistance) * 900 < 140
        ))
          continue;
        probes.ray.set(camera.position, probes.direction.negate().normalize());
        if (
          probes.boxes.some(
            (box) =>
              probes.ray.intersectBox(box, probes.hit) &&
              camera.position.distanceTo(probes.hit) < screenDistance - 0.5,
          )
        )
          continue;
        visible = true;
        audible.current=true;
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
    decoders.set(key,{distance:Infinity,release:()=>setEligible(false)});
    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = "auto";
    resources.current={video};
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
      resources.current?.source?.disconnect();resources.current?.gain?.disconnect();resources.current?.pan?.disconnect();resources.current?.analyser?.disconnect();resources.current=null;
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
