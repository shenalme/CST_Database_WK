// Walking logic for the explorer avatar — pure functions, no DOM, no three.js.
// Bundled into twin3d.bundle.js and tested by tools/validate.mjs. Units: metres; the floor is the rectangle (0,0)-(width,height).
// A rect is { x, y, w, d }: top-left corner and size on the floor (same as machine_locations).

export const WALK = { radius: 0.4, walkSpeed: 1.7, runSpeed: 3.6, accel: 10, nearDistance: 3.2, spawnMargin: 1.5 };

// does a circle of radius r at (x, z) overlap this rect?
export function circleHitsRect(x, z, r, rect) {
  const cx = Math.min(Math.max(x, rect.x), rect.x + rect.w), cz = Math.min(Math.max(z, rect.y), rect.y + rect.d);
  return (x - cx) ** 2 + (z - cz) ** 2 < r * r;
}

export function blocked(x, z, r, rects, bounds) {
  if (x < r || z < r || x > bounds.width - r || z > bounds.height - r) return true;
  return rects.some((q) => circleHitsRect(x, z, r, q));
}

// Move from pos by (vx, vz) * dt. Axes are tried separately so the avatar slides along walls and machines instead of sticking.
export function move(pos, vx, vz, dt, rects, bounds, r = WALK.radius) {
  let x = pos.x, z = pos.z;
  const nx = x + vx * dt, nz = z + vz * dt;
  if (!blocked(nx, z, r, rects, bounds)) x = nx;
  if (!blocked(x, nz, r, rects, bounds)) z = nz;
  return { x, z };
}

// nearest rect to a point: { index, dist } (dist is 0 inside a rect), or null when there are no rects
export function nearest(x, z, rects) {
  let best = null;
  rects.forEach((q, i) => {
    const cx = Math.min(Math.max(x, q.x), q.x + q.w), cz = Math.min(Math.max(z, q.y), q.y + q.d), d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.dist) best = { index: i, dist: d };
  });
  return best;
}

// WASD input (ix: +1 right, iz: +1 forward) relative to where the camera looks (fx, fz = its forward direction on the floor)
export function inputDirection(ix, iz, fx, fz) {
  const len = Math.hypot(fx, fz) || 1, f = [fx / len, fz / len], right = [-f[1], f[0]];
  const x = f[0] * iz + right[0] * ix, z = f[1] * iz + right[1] * ix, n = Math.hypot(x, z);
  return n > 1e-9 ? { x: x / n, z: z / n } : { x: 0, z: 0 };
}

// turn a heading (radians) towards a target by at most maxStep, the short way round
export function stepAngle(current, target, maxStep) {
  let d = ((target - current + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  d = Math.max(-maxStep, Math.min(maxStep, d));
  return current + d;
}

// a free spot on the south edge of the floor to start from
export function spawnPoint(rects, bounds, r = WALK.radius) {
  const z = bounds.height - WALK.spawnMargin;
  for (let x = bounds.width / 2; x < bounds.width - r; x += 1) if (!blocked(x, z, r, rects, bounds)) return { x, z };
  for (let x = bounds.width / 2; x > r; x -= 1) if (!blocked(x, z, r, rects, bounds)) return { x, z };
  return { x: bounds.width / 2, z };
}
