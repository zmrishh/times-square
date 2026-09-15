"use client";
/* R3F owns imperative Three objects. Mutating their transforms inside useFrame/effects
   is the intended API; these objects are not immutable React state. */
/* eslint-disable react-hooks/immutability */
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  HERO,
  PublicSlot,
  SLOTS,
  Slot,
  Vec3,
  Creative,
  slotWidth,
} from "@/lib/registry";
import { renderCreative } from "@/lib/creative-renderer";
import { useBillboardVideo } from "./billboard-video";
import { DEMO_BILLBOARDS } from '@/lib/demo-billboards';
import { BUILDINGS, canWalk, type Building } from "@/lib/scene-layout";

const INK = "#2e4961",
  PAPER = "#f0ecdf";
function facadeTexture(style: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = ["#e6e6df", "#eeebe0", "#f4efe3"][style];
  g.fillRect(0, 0, 256, 512);
  g.strokeStyle = "#607487";
  g.lineWidth = 0.8;
  for (let y = 8; y < 506; y += 22) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(256, y + 0.6);
    g.stroke();
    for (let x = 8; x < 254; x += style === 1 ? 17 : 26) {
      g.fillStyle = style === 0 ? "#d0d7d4" : "#e0e1d9";
      g.fillRect(x, y + 4, style === 1 ? 9 : 15, 13);
      g.strokeRect(x, y + 4, style === 1 ? 9 : 15, 13);
      g.beginPath();
      g.moveTo(x + 2, y + 15);
      g.lineTo(x + 8, y + 7);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function Cornices({ b }: { b: Building }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor(b.h / 9);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    for (let i = 0; i < count; i++)
      mesh.current!.setMatrixAt(i, m.makeTranslation(b.x, i * 9 + 3, b.z));
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [b.x, b.z, count]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[b.w + 0.35, 0.14, b.d + 0.35]} />
      <meshBasicMaterial color="#83929a" />
    </instancedMesh>
  );
}
const Block = memo(function Block({ b }: { b: Building }) {
  const tex = useMemo(() => facadeTexture(b.style), [b.style]);
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const uv = g.attributes.uv;
    for (let i = 0; i < 8; i++) uv.setX(i, (uv.getX(i) * b.d) / b.w);
    return g;
  }, [b.w, b.h, b.d]);
  useEffect(
    () => () => {
      tex.dispose();
      geo.dispose();
    },
    [tex, geo],
  );
  return (
    <group>
      <mesh
        geometry={geo}
        position={[b.x, b.h / 2, b.z]}
        onPointerOver={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <meshBasicMaterial map={tex} color={PAPER} />
        <Edges color={INK} threshold={25} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[b.x, b.h + 2 + i * 3, b.z]}>
          <boxGeometry
            args={[b.w * (0.85 - i * 0.15), 4, b.d * (0.85 - i * 0.15)]}
          />
          <meshBasicMaterial color={PAPER} />
          <Edges color={INK} />
        </mesh>
      ))}
      <Cornices b={b} />
      {b.style === 2 && (
        <mesh position={[b.x, b.h + 15, b.z]}>
          <boxGeometry args={[0.25, 12, 0.25]} />
          <meshBasicMaterial color={INK} />
        </mesh>
      )}
      {b.name === "ONE ASTOR PLAZA" && (
        <group>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[b.x + side * 10, b.h + 10, b.z]}
              rotation={[0, 0, side * 0.12]}
            >
              <boxGeometry args={[2, 18, 23]} />
              <meshBasicMaterial color="#cdd6d0" />
              <Edges color={INK} />
            </mesh>
          ))}
        </group>
      )}
      {b.name === "MARRIOTT MARQUIS" && (
        <group>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[b.x - 1, b.h / 2, b.z + side * 29]}>
              <boxGeometry args={[b.w, b.h + 4, 13]} />
              <meshBasicMaterial map={tex} />
              <Edges color={INK} />
            </mesh>
          ))}
          <mesh position={[-25.1, 76, -20]}>
            <boxGeometry args={[0.5, 24, 7]} />
            <meshBasicMaterial color="#c5d0c9" />
            <Edges color={INK} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => (
            <mesh key={i} position={[-25, 65 + i * 5.5, -20]}>
              <boxGeometry args={[1, 0.18, 21]} />
              <meshBasicMaterial color="#6f8490" />
            </mesh>
          ))}
        </group>
      )}
      {b.name === "1540 BROADWAY" && (
        <group>
          <mesh position={[b.x, b.h + 9, b.z]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[10, 10, 19]} />
            <meshBasicMaterial color="#dce2d7" />
            <Edges color={INK} />
          </mesh>
          <mesh position={[b.x - 8, b.h + 6, b.z - 5]}>
            <cylinderGeometry args={[0, 4, 17, 4]} />
            <meshBasicMaterial color={PAPER} />
            <Edges color={INK} />
          </mesh>
        </group>
      )}
    </group>
  );
});
function Billboard({
  slot,
  state,
  selected,
  preview,
  onSelect,
  onHover,
  reduced,
  paused,
  sound,
}: {
  slot: Slot;
  state?: PublicSlot;
  selected: boolean;
  preview?: Creative;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  reduced: boolean;
  paused: boolean;
  sound:boolean;
}) {
  const displayCreative=preview || state?.creative || (state?.available && !state.brandId ? DEMO_BILLBOARDS[slot.id] : undefined);
  const videoTexture = useBillboardVideo(slot, displayCreative, paused, reduced,sound);
  const [tex, setTex] = useState<THREE.CanvasTexture | null>(null);
  const [resolution, setResolution] = useState(512);
  const sampleAt = useRef(1);
  const probe = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, clock }, delta) => {
    sampleAt.current += delta;
    if (sampleAt.current > 1 && tex) {
      sampleAt.current = 0;
      let pixels = 0;
      for (const s of slot.segments) {
        probe.set(...s.position);
        const distance = probe.distanceTo(camera.position);
        probe.project(camera);
        if (Math.abs(probe.x) < 1.7 && Math.abs(probe.y) < 1.7 && probe.z < 1)
          pixels = Math.max(
            pixels,
            (Math.max(s.width, s.height) / distance) * 900,
          );
      }
      const next =
        selected || preview
          ? 1536
          : pixels > 340
            ? 1024
            : pixels > 120
              ? 512
              : 256;
      setResolution((r) => (r === next ? r : next));
    }
    // Only unsold single-surface ticker artwork moves. Whole texture repeat
    // preserves artwork scale; paid creatives and wraps are always stationary.
    if (
      tex &&
      !state?.creative &&
      !preview &&
      slot.segments.length === 1 &&
      slotWidth(slot) / slot.segments[0].height > 5
    )
      tex.offset.x = reduced || document.hidden ? 0 : clock.elapsedTime * 0.018;
  });
  const geometries = useMemo(() => {
    const width = slotWidth(slot);
    let offset = 0;
    return slot.segments.map((s) => {
      const g = new THREE.PlaneGeometry(s.width, s.height);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++)
        uv.setX(i, (offset + uv.getX(i) * s.width) / width);
      offset += s.width;
      return g;
    });
  }, [slot]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  useEffect(() => {
    let active = true;
    const c = document.createElement("canvas");
    const s = slot.segments[0];
    const width = slotWidth(slot);
    void renderCreative(
      c,
      displayCreative || null,
      slot.art,
      Math.max(1, Math.round(resolution * Math.min(1, width / s.height))),
      Math.max(1, Math.round(resolution * Math.min(1, s.height / width))),
    ).then(() => {
      if (active) {
        const texture = new THREE.CanvasTexture(c);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        texture.wrapS = THREE.RepeatWrapping;
        texture.userData.creative = displayCreative;
        setTex(texture);
      }
    });
    return () => {
      active = false;
    };
  }, [slot, displayCreative, resolution]);
  // Keep the current bitmap alive until the replacement material commits.
  useEffect(
    () => () => {
      tex?.dispose();
    },
    [tex],
  );
  return (
    <group>
      {slot.segments.map((s, i) => (
        <group key={i} position={s.position} rotation={[0, s.rotation, 0]}>
          {selected && (
            <mesh
              position={[0, 0, -0.03]}
              scale={[s.width + 0.38, s.height + 0.38, 1]}
            >
              <planeGeometry />
              <meshBasicMaterial color="#f1a247" />
            </mesh>
          )}
          <mesh
            geometry={geometries[i]}
            userData={{ slotId: slot.id, mediaReady: !!videoTexture || (!!tex && tex.userData.creative === displayCreative) }}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHover(slot.id);
            }}
            onPointerOut={() => onHover(null)}
            onClick={(e) => {
              e.stopPropagation();
              if (
                (e.delta || 0) < 5 &&
                (e.camera.userData.dragDistance || 0) < 7
              )
                onSelect(slot.id);
            }}
          >
            <meshBasicMaterial
              key={videoTexture?.uuid || tex?.uuid || "loading"}
              map={videoTexture || tex}
              toneMapped={false}
              color={videoTexture || tex ? "#ffffff" : "#efede2"}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function BillboardStructure() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = SLOTS.reduce((n, s) => n + s.segments.length * 3, 0);
  useLayoutEffect(() => {
    const transform = new THREE.Object3D(),
      local = new THREE.Matrix4();
    let i = 0;
    for (const slot of SLOTS)
      for (const s of slot.segments) {
        transform.position.set(...s.position);
        transform.rotation.set(0, s.rotation, 0);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        for (const [x, y, z, w, h, d] of [
          [0, 0, -0.42, s.width + 0.5, s.height + 0.5, 0.72],
          [-s.width * 0.43, 0, -0.95, 0.16, s.height + 1, 1.2],
          [s.width * 0.43, 0, -0.95, 0.16, s.height + 1, 1.2],
        ]) {
          local.makeScale(w, h, d).setPosition(x, y, z);
          mesh.current!.setMatrixAt(i++, local.premultiply(transform.matrix));
        }
      }
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry />
      <meshBasicMaterial color={INK} />
    </instancedMesh>
  );
}
function Label({
  text,
  position,
  rotation = 0,
  width = 12,
  height = 2,
  color = INK,
  bg = PAPER,
}: {
  text: string;
  position: Vec3;
  rotation?: number;
  width?: number;
  height?: number;
  color?: string;
  bg?: string;
}) {
  const t = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = bg;
    g.fillRect(0, 0, 1024, 128);
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.strokeRect(4, 4, 1016, 120);
    g.fillStyle = color;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = "600 55px Arial";
    g.fillText(text, 512, 67, 980);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [text, color, bg]);
  useEffect(() => () => t.dispose(), [t]);
  return (
    <mesh position={position} rotation={[0, rotation, 0]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={t} />
    </mesh>
  );
}
function PavementMarkings() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const markings = useMemo(
    () => [
      ...Array.from({ length: 57 }, (_, i) => [
        0,
        0.001,
        i * 4 - 112,
        54,
        0.026,
        0,
      ]),
      ...Array.from({ length: 15 }, (_, i) => [
        i * 4 - 28,
        0.002,
        0,
        0.022,
        250,
        0,
      ]),
      ...[-48, -7, 35, 102].flatMap((z) =>
        Array.from({ length: 14 }, (_, i) => [i * 3 - 20, 0.009, z, 1.6, 5, 1]),
      ),
      ...[-20, 19].flatMap((x) =>
        Array.from({ length: 23 }, (_, i) => [
          x,
          0.012,
          i * 10 - 110,
          0.18,
          4,
          1,
        ]),
      ),
    ],
    [],
  );
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    markings.forEach(([x, y, z, w, h, color], i) => {
      o.position.set(x, y, z);
      o.rotation.set(-Math.PI / 2, 0, 0);
      o.scale.set(w, h, 1);
      o.updateMatrix();
      mesh.current!.setMatrixAt(i, o.matrix);
      mesh.current!.setColorAt(
        i,
        new THREE.Color(color ? "#faf6e9" : "#a2adae"),
      );
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.instanceColor!.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [markings]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, markings.length]}>
      <planeGeometry />
      <meshBasicMaterial />
    </instancedMesh>
  );
}
function RedSteps() {
  const rise = 0.18;
  const run = 0.58;
  const slope = Math.atan(rise / run);
  return (
    <group name="TKTS red steps">
      <mesh position={[0, 0.06, -71.7]}>
        <boxGeometry args={[16.4, 0.12, 17.8]} />
        <meshBasicMaterial color="#cecfc7" />
      </mesh>
      {Array.from({ length: 27 }, (_, i) => {
        const height = (i + 1) * rise + 0.12;
        const z = -64 - i * run;
        return <group key={i}>
          <mesh position={[0, height / 2, z]}>
            <boxGeometry args={[15, height, run + 0.005]} />
            <meshBasicMaterial color="#ae1831" />
          </mesh>
          <mesh position={[0, height + 0.012, z]}>
            <boxGeometry args={[15.04, 0.025, run]} />
            <meshBasicMaterial color={i % 3 === 0 ? '#ef3c49' : '#df293c'} />
          </mesh>
          <mesh position={[0, height - 0.025, z + run / 2 + 0.008]}>
            <boxGeometry args={[15.04, 0.035, 0.018]} />
            <meshBasicMaterial color="#ff7380" />
          </mesh>
          {(i % 3 === 0 ? [-5, -2.5, 0, 2.5, 5] : []).map(x => <mesh key={x} position={[x, height + 0.027, z]}>
            <boxGeometry args={[0.012, 0.006, run]} />
            <meshBasicMaterial color="#b62035" />
          </mesh>)}
        </group>;
      })}
      {[-7.7, 7.7].map(x => <group key={x}>
        <mesh position={[x, 3.07, -71.54]} rotation={[slope, 0, 0]}>
          <boxGeometry args={[0.06, 1.05, 16.4]} />
          <meshBasicMaterial color="#b6d2d4" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <mesh position={[x, 3.64, -71.54]} rotation={[slope, 0, 0]}>
          <boxGeometry args={[0.075, 0.065, 16.6]} />
          <meshBasicMaterial color="#879a9c" />
        </mesh>
        {[0, 5, 10, 15, 20, 26].map(i => <mesh key={i} position={[x, 0.78 + i * rise, -64 - i * run]}>
          <boxGeometry args={[0.055, 1.14, 0.055]} />
          <meshBasicMaterial color="#a2b2b2" />
        </mesh>)}
      </group>)}
      <mesh position={[0, 2.47, -79.52]}>
        <boxGeometry args={[15.4, 4.7, 0.25]} />
        <meshBasicMaterial color="#e9e6df" />
        <Edges color="#abb7b6" />
      </mesh>
      <Label text="tkts" position={[0, 3.5, -79.66]} width={6} height={1.8}
        bg="#e9e6df" color="#cc1631" rotation={Math.PI} />
      <Label text="tkts" position={[-7.82, 2.55, -75.8]} width={4} height={1.5}
        bg="#e9e6df" color="#cc1631" rotation={-Math.PI / 2} />
      <Label text="tkts" position={[7.82, 2.55, -75.8]} width={4} height={1.5}
        bg="#e9e6df" color="#cc1631" rotation={Math.PI / 2} />
    </group>
  );
}
function Street() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
        <planeGeometry args={[600, 650]} />
        <meshBasicMaterial color="#e4e4da" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.035, 0]}>
        <planeGeometry args={[38, 280]} />
        <meshBasicMaterial color="#dedfd7" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, -0.15]} position={[-4, -0.025, 0]}>
        <planeGeometry args={[24, 270]} />
        <meshBasicMaterial color="#f2eee2" />
      </mesh>
      <PavementMarkings />
      <RedSteps />
      <mesh position={[0, 1, -58]}>
        <boxGeometry args={[2.8, 2, 2.8]} />
        <meshBasicMaterial color="#e6e1d1" />
        <Edges color={INK} />
      </mesh>
      <mesh position={[0, 3, -58]}>
        <capsuleGeometry args={[0.4, 1.5, 3, 5]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 4.3, -58]}>
        <sphereGeometry args={[0.33, 6, 6]} />
        <meshBasicMaterial color={INK} />
      </mesh>
      <mesh position={[0, 83, 81]}>
        <sphereGeometry args={[2, 16, 12]} />
        <meshBasicMaterial color="#e4e4d3" wireframe />
      </mesh>
      <Label
        text="ONE TIMES SQUARE"
        position={[0, 65, 67.4]}
        rotation={Math.PI}
        width={12}
        height={2.1}
      />
      <Label
        text="MARRIOTT MARQUIS"
        position={[-24.6, 63, -20]}
        rotation={Math.PI / 2}
        width={37}
        height={2.3}
      />
      <Label
        text="BROADWAY"
        position={[23, 4.8, -36]}
        rotation={Math.PI}
        width={4.2}
        height={0.7}
        bg={INK}
        color={PAPER}
      />
      <Label
        text="W 45 ST"
        position={[-22, 4.7, 11]}
        rotation={Math.PI}
        width={3.4}
        height={0.65}
        bg={INK}
        color={PAPER}
      />
      <Label
        text="THEATRE / TONIGHT"
        position={[-24.65, 2.8, 7]}
        rotation={Math.PI / 2}
        width={17}
        height={1.3}
        color={PAPER}
        bg={INK}
      />
      <Label
        text="PAPER GOODS & COFFEE"
        position={[23.65, 2.8, -10]}
        rotation={-Math.PI / 2}
        width={22}
        height={1.3}
        color={PAPER}
        bg={INK}
      />
      <Label
        text="THE CITY / IN PRINT"
        position={[23.65, 2.8, 29]}
        rotation={-Math.PI / 2}
        width={22}
        height={1.3}
      />
      <Label
        text="BROADWAY / OPEN LATE"
        position={[-24.65, 3.2, 43]}
        rotation={Math.PI / 2}
        width={25}
        height={1.5}
        color={PAPER}
        bg={INK}
      />
      <Label
        text="DUFFY SQUARE"
        position={[41, 4.5, -88.25]}
        width={26}
        height={1.4}
        color={PAPER}
        bg={INK}
      />
      {[-22, 22].map((x) => (
        <group key={x}>
          {[-85, -55, -25, 5, 35, 65, 95].map((z) => (
            <group key={z} position={[x, 0, z]}>
              <mesh position={[0, 3.2, 0]}>
                <cylinderGeometry args={[0.07, 0.1, 6.4, 6]} />
                <meshBasicMaterial color={INK} />
              </mesh>
              <mesh position={[0.7, 6.35, 0]}>
                <boxGeometry args={[1.5, 0.12, 0.12]} />
                <meshBasicMaterial color={INK} />
              </mesh>
              <mesh position={[1.4, 6.2, 0]}>
                <boxGeometry args={[0.6, 0.25, 0.35]} />
                <meshBasicMaterial color={INK} />
              </mesh>
              <mesh position={[0, 0.25, 5]}>
                <cylinderGeometry args={[0.45, 0.55, 0.5, 8]} />
                <meshBasicMaterial color="#e0ddcd" />
                <Edges color={INK} />
              </mesh>
              <mesh position={[0, 0.8, 5]}>
                <icosahedronGeometry args={[0.55, 0]} />
                <meshBasicMaterial color="#869984" />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {[-12, 12].map((x) => (
        <group key={x}>
          {[-45, -19, 14, 48].map((z) => (
            <group key={z} position={[x, 0, z]}>
              <mesh position={[0, 0.55, 0]}>
                <boxGeometry args={[2.5, 0.18, 0.65]} />
                <meshBasicMaterial color="#d8d8cb" />
                <Edges color={INK} />
              </mesh>
              {[-1, 1].map((v) => (
                <mesh key={v} position={[v, 0.25, 0]}>
                  <boxGeometry args={[0.12, 0.5, 0.5]} />
                  <meshBasicMaterial color={INK} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}
function Ambient({ reduced }: { reduced: boolean }) {
  const taxis = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const time = reduced || document.hidden ? 0 : clock.elapsedTime;
    if (taxis.current) taxis.current.position.z = ((time * 2.6) % 180) - 80;
  });
  return (
    <group>
      <group ref={taxis} position={[20.5, 0, 15]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[1.7, 0.75, 4]} />
          <meshBasicMaterial color="#dfb749" />
          <Edges color={INK} />
        </mesh>
        <mesh position={[0, 1.23, -0.15]}>
          <boxGeometry args={[1.5, 0.65, 1.9]} />
          <meshBasicMaterial color="#e7ca6b" />
          <Edges color={INK} />
        </mesh>
        <mesh position={[0, 1.55, -0.15]}>
          <boxGeometry args={[0.6, 0.23, 0.35]} />
          <meshBasicMaterial color="#f5df98" />
        </mesh>
        {[-1, 1].flatMap((x) =>
          [-1.15, 1.15].map((z) => (
            <mesh
              key={`${x}${z}`}
              position={[x * 0.86, 0.38, z]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.3, 0.3, 0.17, 8]} />
              <meshBasicMaterial color={INK} />
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}
export type SceneCommand = {
  type: "view" | "reset" | "walk" | "tour";
  id?: string;
  nonce: number;
};
type Props = {
  slots: PublicSlot[];
  selected: string | null;
  preview?: Creative;
  paused: boolean;
  sound:boolean;
  quality: string;
  reduced: boolean;
  command: SceneCommand;
  joystick: React.RefObject<{ x: number; y: number }>;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onReady: () => void;
  onFallback: () => void;
  onView: (id: string) => void;
  onStatus: (s: string) => void;
};
function Controls({
  paused,
  command,
  joystick,
  onSelect,
  onStatus,
  onView,
  onHover,
  reduced,
}: Props) {
  const { camera, gl, scene } = useThree();
  const keys = useRef(new Set<string>());
  const drag = useRef({ active: false, x: 0, y: 0, distance: 0 });
  const yaw = useRef(Math.PI),
    pitch = useRef(0.18);
  const tour = useRef(false);
  const tourAt = useRef(0);
  const target = useRef<{ p: THREE.Vector3; q: THREE.Quaternion } | null>(null);
  const visibility = useRef(new Map<string, number>());
  const ray = useMemo(() => new THREE.Raycaster(), []);
  const vec = useMemo(() => new THREE.Vector3(), []);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, "YXZ"), []);
  const tracking = useRef(0);
  const performanceAt = useRef(0);
  function view(p: Vec3, look: Vec3) {
    camera.position.set(...p);
    camera.lookAt(...look);
    euler.setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = euler.y;
    pitch.current = euler.x;
    keys.current.clear();
    if (process.env.NODE_ENV !== "production")
      gl.domElement.dataset.camera = JSON.stringify(camera.position.toArray());
  }
  useEffect(() => {
    view(HERO.position, HERO.look); /* initial camera only */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (command.type === "walk") {
      gl.domElement
        .requestPointerLock?.()
        ?.catch(() =>
          onStatus("Walk mode is unavailable. Drag to look instead."),
        );
      return;
    }
    if (command.type === "tour") {
      tour.current = !tour.current;
      tourAt.current = 6.1;
      onStatus(
        tour.current ? "Guided tour · move or drag to stop" : "Tour stopped",
      );
      return;
    }
    tour.current = false;
    const s = SLOTS.find((s) => s.id === command.id);
    const p = command.type === "view" && s ? s.camera : HERO.position;
    const look = command.type === "view" && s ? s.look : HERO.look;
    view(p, look);
    if (command.type === "reset") {
      const perspective = camera as THREE.PerspectiveCamera;
      perspective.fov = 65;
      perspective.updateProjectionMatrix();
    }
    target.current = null; // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command]);
  useEffect(() => {
    if (paused) {
      keys.current.clear();
      drag.current.active = false;
      document.exitPointerLock?.();
    }
  }, [paused]);
  useEffect(() => {
    const el = gl.domElement;
    const clear = () => {
      keys.current.clear();
      drag.current.active = false;
      joystick.current = { x: 0, y: 0 };
    };
    const down = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        document.exitPointerLock?.();
        clear();
        return;
      }
      if (
        paused ||
        /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement).tagName) ||
        (e.target as HTMLElement).isContentEditable ||
        e.altKey ||
        e.metaKey ||
        e.ctrlKey
      )
        return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      ) {
        keys.current.add(e.key);
        tour.current = false;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key);
    const pd = (e: PointerEvent) => {
      if (paused) return;
      drag.current = { active: true, x: e.clientX, y: e.clientY, distance: 0 };
      camera.userData.dragDistance = 0;
      tour.current = false;
    };
    const pm = (e: PointerEvent) => {
      if (paused) return;
      if (!drag.current.active && document.pointerLockElement !== el) return;
      const dx =
          document.pointerLockElement === el
            ? e.movementX
            : e.clientX - drag.current.x,
        dy =
          document.pointerLockElement === el
            ? e.movementY
            : e.clientY - drag.current.y;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
      drag.current.distance += Math.abs(dx) + Math.abs(dy);
      camera.userData.dragDistance = drag.current.distance;
      yaw.current -= dx * 0.0024;
      pitch.current = THREE.MathUtils.clamp(
        pitch.current - dy * 0.0024,
        -0.65,
        1.15,
      );
    };
    const pu = () => {
      drag.current.active = false;
    };
    const wheel = (e: WheelEvent) => {
      if (paused) return;
      e.preventDefault();
      const c = camera as THREE.PerspectiveCamera;
      c.fov = THREE.MathUtils.clamp(c.fov + e.deltaY * 0.018, 45, 80);
      c.updateProjectionMatrix();
    };
    const click = () => {
      if (paused || document.pointerLockElement !== el) return;
      ray.setFromCamera(new THREE.Vector2(), camera);
      const hit = ray
        .intersectObjects(scene.children, true)
        .find((h) => (h.object as THREE.Mesh).isMesh);
      if (hit?.object.userData.slotId) {
        document.exitPointerLock();
        onSelect(hit.object.userData.slotId);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("pointerlockchange", clear);
    el.addEventListener("pointerdown", pd);
    window.addEventListener("pointermove", pm);
    window.addEventListener("pointerup", pu);
    window.addEventListener("pointercancel", clear);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("click", click);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("pointerlockchange", clear);
      el.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      window.removeEventListener("pointercancel", clear);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("click", click);
    };
  }, [camera, gl, scene, paused, onSelect, ray, joystick]);
  useFrame((state, delta) => {
    if (document.hidden) return;
    performanceAt.current += delta;
    if (performanceAt.current > 1 && process.env.NODE_ENV !== "production") {
      performanceAt.current = 0;
      gl.domElement.dataset.camera = JSON.stringify(camera.position.toArray());
      gl.domElement.dataset.renderCalls = String(gl.info.render.calls);
      gl.domElement.dataset.triangles = String(gl.info.render.triangles);
      gl.domElement.dataset.textures = String(gl.info.memory.textures);
      const videos: {slot:string;time:number;paused:boolean;loop:boolean;texture:string;audioGain:number;audioRms:number;distance:number}[] = [];
      scene.traverse(object=>{
        if (!(object instanceof THREE.Mesh) || !object.userData.slotId) return;
        const material=object.material;
        if (material instanceof THREE.MeshBasicMaterial && material.map instanceof THREE.VideoTexture) {
          const video=material.map.image as HTMLVideoElement;
          videos.push({slot:object.userData.slotId,time:video.currentTime,paused:video.paused,loop:video.loop,texture:material.map.uuid,audioGain:Number(video.dataset.audioGain||0),audioRms:Number(video.dataset.audioRms||0),distance:Number(video.dataset.audioDistance||999)});
        }
      });
      gl.domElement.dataset.videos=JSON.stringify(videos);
    }
    const dt = Math.min(delta, 0.05);
    if (!paused) {
      if (tour.current) {
        tourAt.current += dt;
        if (tourAt.current > 6) {
          const s =
            SLOTS[Math.floor(state.clock.elapsedTime / 6) % SLOTS.length];
          view(s.camera, s.look);
          tourAt.current = 0;
        }
        yaw.current += reduced ? 0 : dt * 0.025;
      }
      const k = keys.current;
      if (k.has("ArrowLeft")) yaw.current += dt * 1.1;
      if (k.has("ArrowRight")) yaw.current -= dt * 1.1;
      const f =
        (k.has("w") || k.has("ArrowUp") ? 1 : 0) -
        (k.has("s") || k.has("ArrowDown") ? 1 : 0) -
        joystick.current.y;
      const r =
        (k.has("d") ? 1 : 0) - (k.has("a") ? 1 : 0) + joystick.current.x;
      const scale = (dt * 4) / Math.max(1, Math.hypot(f, r));
      const dx =
          (-Math.sin(yaw.current) * f + Math.cos(yaw.current) * r) * scale,
        dz = (-Math.cos(yaw.current) * f - Math.sin(yaw.current) * r) * scale;
      if (canWalk(camera.position.x + dx, camera.position.z))
        camera.position.x += dx;
      if (canWalk(camera.position.x, camera.position.z + dz))
        camera.position.z += dz;
      camera.position.y = 1.72;
      camera.quaternion.setFromEuler(
        euler.set(pitch.current, yaw.current, 0, "YXZ"),
      );
    }
    if (document.pointerLockElement === gl.domElement) {
      ray.setFromCamera(new THREE.Vector2(), camera);
      const first = ray
        .intersectObjects(scene.children, true)
        .find((h) => (h.object as THREE.Mesh).isMesh);
      onHover(first?.object.userData.slotId || null);
    }
    tracking.current += dt;
    if (tracking.current < 0.5) return;
    tracking.current = 0;
    const visibleSlots: string[] = [];
    for (const s of SLOTS) {
      let visible = false,
        inFrame = false;
      for (const p of s.segments) {
        vec.set(...p.position);
        projected.copy(vec).project(camera);
        const distance = vec.distanceTo(camera.position);
        const area = (p.width * p.height) / (distance * distance);
        if (
          Math.abs(projected.x) > 1 ||
          Math.abs(projected.y) > 1 ||
          projected.z >= 1 ||
          projected.z < -1 ||
          area < 0.001
        )
          continue;
        ray.set(camera.position, vec.sub(camera.position).normalize());
        const hit = ray
          .intersectObjects(scene.children, true)
          .find((h) => (h.object as THREE.Mesh).isMesh);
        if (hit?.object.userData.slotId !== s.id) continue;
        inFrame = true;
        if (
          Math.abs(projected.x) < 0.85 &&
          Math.abs(projected.y) < 0.85 &&
          area > 0.012
        )
          visible = true;
      }
      if (inFrame) visibleSlots.push(s.id);
      const t = visible ? (visibility.current.get(s.id) || 0) + 0.5 : 0;
      visibility.current.set(s.id, t);
      if (t === 2) onView(s.id);
    }
    if (process.env.NODE_ENV !== "production")
      gl.domElement.dataset.visibleSlots = JSON.stringify(visibleSlots);
  });
  return null;
}
function Ready({
  onReady,
  onFallback,
  hasInventory,
}: {
  onReady: () => void;
  onFallback: () => void;
  hasInventory: boolean;
}) {
  const { gl, camera, scene } = useThree();
  const announced = useRef(false);
  const frustum = useMemo(() => new THREE.Frustum(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  useFrame(() => {
    if (announced.current || !hasInventory) return;
    camera.updateMatrixWorld();
    scene.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    let pending = false;
    scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.userData.slotId &&
          frustum.intersectsObject(object) && !object.userData.mediaReady) pending = true;
    });
    if (!pending) {
      announced.current = true;
      gl.domElement.dataset.mediaReady = 'true';
      onReady();
    }
  });
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onFallback();
    };
    el.addEventListener("webglcontextlost", lost);
    return () => el.removeEventListener("webglcontextlost", lost);
  }, [gl, onFallback]);
  return null;
}
export default function SquareScene(props: Props) {
  const { onFallback } = props;
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // Renderer initialization can reject asynchronously, outside a React boundary.
    // Probe and release a temporary context before mounting the renderer.
    let context: WebGL2RenderingContext | null = null;
    try { context = document.createElement("canvas").getContext("webgl2"); } catch {}
    if (!context) { onFallback(); return; }
    context.getExtension("WEBGL_lose_context")?.loseContext();
    // Browser capability is external state, measured only after mounting.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(true);
  }, [onFallback]);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  if (!supported) return null;
  return (
    <Canvas
      frameloop={visible ? "always" : "never"}
      camera={{ position: HERO.position, fov: 65, near: 0.15, far: 420 }}
      dpr={
        props.quality === "low"
          ? 1
          : props.quality === "high"
            ? [1, 1.8]
            : [1, 1.4]
      }
      gl={{
        antialias: true,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      fallback={<div className="scene-error">The directory is ready even without 3D.</div>}
    >
      <color attach="background" args={["#f3f0e7"]} />
      <fog attach="fog" args={["#f3f0e7", 110, 290]} />
      <Street />
      {BUILDINGS.map((b) => (
        <Block key={b.name + b.z} b={b} />
      ))}
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 10 }, (_, i) => (
          <Block
            key={`bg${side}${i}`}
            b={{
              x: side * (75 + (i % 3) * 14),
              z: i * 31 - 140,
              w: 20,
              d: 22,
              h: 62 + ((i * 17) % 85),
              name: "BACKGROUND",
              style: i % 3,
            }}
          />
        )),
      )}
      {SLOTS.map((s) => (
        <Billboard
          key={s.id}
          slot={s}
          state={props.slots.find((x) => x.id === s.id)}
          selected={props.selected === s.id}
          preview={props.selected === s.id ? props.preview : undefined}
          onSelect={props.onSelect}
          onHover={props.onHover}
          reduced={props.reduced}
          paused={props.paused}
          sound={props.sound}
        />
      ))}
      <BillboardStructure />
      <Ambient reduced={props.reduced} />
      <Controls {...props} />
      <Ready onReady={props.onReady} onFallback={props.onFallback} hasInventory={props.slots.length > 0} />
    </Canvas>
  );
}
