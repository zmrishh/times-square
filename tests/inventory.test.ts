import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SLOTS, HERO, slotAspect } from "../src/lib/registry";
import { BUILDINGS, canWalk } from "../src/lib/scene-layout";

test("inventory has stable unique IDs, usable dimensions and collision-safe views", () => {
  assert.equal(SLOTS.length, 72);
  assert.equal(new Set(SLOTS.map((s) => s.id)).size, 72);
  for (let i = 0; i < 72; i++)
    assert.equal(SLOTS[i].id, `tsq-${String(i + 1).padStart(3, "0")}`);
  assert.ok(canWalk(HERO.position[0], HERO.position[2]));
  for (const s of SLOTS) {
    assert.ok(canWalk(s.camera[0], s.camera[2]), `${s.id} unsafe camera`);
    assert.equal(s.camera[1], 1.72);
    assert.ok(Number.isFinite(slotAspect(s)) && slotAspect(s) > 0);
    for (const p of s.segments) {
      assert.ok(p.width >= 3 && p.height >= 2);
      assert.ok(p.position[1] - p.height / 2 > 3, `${s.id} blocks street`);
    }
  }
});

test("screens sharing a facade do not overlap, including their frames", () => {
  const surfaces = SLOTS.flatMap((s) =>
    s.segments.map((p) => ({ id: s.id, ...p })),
  );
  const failures: string[] = [];
  for (let i = 0; i < surfaces.length; i++)
    for (let j = i + 1; j < surfaces.length; j++) {
      const a = surfaces[i],
        b = surfaces[j];
      if (a.id === b.id || Math.abs(a.rotation - b.rotation) > 0.01) continue;
      const axis = Math.abs(Math.sin(a.rotation)) > 0.5 ? 2 : 0,
        normal = axis === 2 ? 0 : 2;
      if (Math.abs(a.position[normal] - b.position[normal]) > 1.3) continue;
      if (
        Math.abs(a.position[axis] - b.position[axis]) <
          (a.width + b.width) / 2 + 0.5 - 0.01 &&
        Math.abs(a.position[1] - b.position[1]) <
          (a.height + b.height) / 2 + 0.5 - 0.01
      )
        failures.push(`${a.id}/${b.id}`);
    }
  assert.deepEqual(failures, [], "overlapping frames");
});

test("each screen attaches to architecture and is unobstructed from its viewing position", () => {
  const material = new THREE.MeshBasicMaterial();
  const buildings = BUILDINGS.map((b) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), material);
    m.position.set(b.x, b.h / 2, b.z);
    m.updateMatrixWorld();
    return m;
  });
  const screens = SLOTS.flatMap((s) =>
    s.segments.map((p) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(p.width, p.height),
        material,
      );
      m.position.set(...p.position);
      m.rotation.y = p.rotation;
      m.userData.slotId = s.id;
      m.updateMatrixWorld();
      return m;
    }),
  );
  const ray = new THREE.Raycaster();
  const failures: string[] = [];
  for (const s of SLOTS) {
    let visible = false;
    for (const p of s.segments) {
      const centre = new THREE.Vector3(...p.position),
        origin = new THREE.Vector3(...s.camera);
      ray.set(origin, centre.clone().sub(origin).normalize());
      if (
        ray.intersectObjects([...buildings, ...screens], false)[0]?.object
          .userData.slotId === s.id
      )
        visible = true;
      // Rooftop slot is explicitly supported from the tower roof below it.
      if (s.id === "tsq-021") continue;
      ray.set(
        centre,
        new THREE.Vector3(-Math.sin(p.rotation), 0, -Math.cos(p.rotation)),
      );
      const attached = ray.intersectObjects(buildings, false)[0];
      if (!attached || attached.distance > 1.5)
        failures.push(`${s.id} detached (${attached?.distance})`);
    }
    if (!visible) failures.push(`${s.id} obscured from own camera`);
  }
  [...buildings, ...screens].forEach((m) => m.geometry.dispose());
  material.dispose();
  assert.deepEqual(failures, []);
});

test("wraparound segment edges join and map at the same physical scale", () => {
  for (const s of SLOTS.filter((s) => s.segments.length > 1)) {
    for (let i = 1; i < s.segments.length; i++) {
      const a = s.segments[i - 1],
        b = s.segments[i];
      const edge = (p: typeof a, side: number) =>
        new THREE.Vector3((side * p.width) / 2, 0, 0)
          .applyAxisAngle(new THREE.Vector3(0, 1, 0), p.rotation)
          .add(new THREE.Vector3(...p.position));
      assert.ok(
        edge(a, 1).distanceTo(edge(b, -1)) < 0.001,
        `${s.id}: UV seam geometry`,
      );
      assert.equal(a.height, b.height);
    }
  }
});
