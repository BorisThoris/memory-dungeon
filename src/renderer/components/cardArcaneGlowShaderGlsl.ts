/**
 * Procedural card aura shader used for hover, focus, and resolving feedback.
 * It uses the card-space rounded-rect SDF so the glow hugs the physical card silhouette.
 */

export const CARD_ARCANE_GLOW_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uPulse;
uniform float uMotion;
uniform float uMode;
uniform vec2 uOuterHalfSize;
uniform vec2 uInnerHalfSize;
uniform float uOuterCorner;
uniform float uInnerCorner;
uniform vec3 uPrimaryColor;
uniform vec3 uSecondaryColor;
uniform vec3 uAccentColor;

varying vec2 vLocal;

float sdRoundedRect(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + vec2(radius);
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

float hash21(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 37.73);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.52;
  for (int i = 0; i < 4; i++) {
    value += noise(p) * amplitude;
    p = p * 2.08 + vec2(19.2, 7.7);
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  float intensity = clamp(uIntensity, 0.0, 3.0);
  float pulse = clamp(uPulse, 0.0, 2.0);
  float motion = clamp(uMotion, 0.0, 1.5);

  float outerSdf = sdRoundedRect(vLocal, uOuterHalfSize, uOuterCorner);
  float innerSdf = sdRoundedRect(vLocal, uInnerHalfSize, uInnerCorner);
  float softness = max(fwidth(outerSdf), 0.008 + pulse * 0.004);
  float outerMask = 1.0 - smoothstep(-softness, softness * 1.45, outerSdf);
  float innerMask = smoothstep(-softness * 1.25, softness, innerSdf);
  float ringMask = outerMask * innerMask;
  if (ringMask < 0.003) {
    discard;
  }

  vec2 outerNorm = vLocal / max(uOuterHalfSize, vec2(0.0001));
  float phase = atan(outerNorm.y, outerNorm.x);
  float axisRune = max(
    smoothstep(0.92, 1.0, cos(outerNorm.x * 11.0 + uSeed * 8.0)),
    smoothstep(0.92, 1.0, cos(outerNorm.y * 13.0 - uSeed * 6.0))
  );
  float cornerness = smoothstep(0.38, 0.94, min(abs(outerNorm.x), abs(outerNorm.y)));
  float innerGap = max(innerSdf, 0.0);
  float outerGap = max(-outerSdf, 0.0);
  float bandT = clamp(innerGap / max(innerGap + outerGap, 0.0001), 0.0, 1.0);
  float centerBand = 1.0 - abs(bandT * 2.0 - 1.0);

  float t = uTime * motion;
  vec2 flowUv = vec2(phase * (4.0 + uMode * 0.9) + uSeed * 23.0, bandT * 8.0 - t * (1.6 + uMode * 0.55));
  float flow = fbm(flowUv + fbm(flowUv * 0.58 + vec2(t * 0.42, uSeed)) * 0.72);
  float travel = 0.5 + 0.5 * sin(phase * (10.0 + uMode * 2.0) - t * (2.6 + uMode) + uSeed * 41.0);
  float runeBeat = pow(clamp(axisRune * (0.45 + flow * 0.75), 0.0, 1.0), 2.2);
  float core = smoothstep(0.08, 0.92, centerBand) * (0.54 + 0.26 * flow);
  float edge = smoothstep(0.54, 1.0, bandT) * (0.42 + 0.42 * travel + 0.28 * cornerness);
  float flare = (cornerness * 0.64 + runeBeat * 0.7) * (0.42 + pulse * 0.52);

  vec3 color = uPrimaryColor * (core + flare * 0.42) +
    uSecondaryColor * (edge + runeBeat * 0.35) +
    uAccentColor * (flare * 0.34);
  float alpha = ringMask * intensity * (0.24 + core * 0.34 + edge * 0.36 + flare * 0.28);
  alpha *= 0.88 + pulse * 0.22;
  alpha = clamp(alpha, 0.0, 1.0);
  if (alpha < 0.01) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
