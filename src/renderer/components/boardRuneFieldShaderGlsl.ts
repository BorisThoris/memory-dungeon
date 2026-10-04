export const BOARD_RUNE_FIELD_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

uniform float uTime;
uniform float uIntensity;
uniform float uMotion;
uniform vec3 uGoldColor;
uniform vec3 uCyanColor;
uniform vec2 uGrid;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.21));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

// Pixel-aware engraving stays crisp at phone DPR without shimmering at desktop scale.
float stroke(float distance, float width) {
  float aa = max(fwidth(distance), 0.0015);
  return 1.0 - smoothstep(width - aa, width + aa, abs(distance));
}

void main() {
  float intensity = clamp(uIntensity, 0.0, 1.4);
  if (intensity <= 0.001) {
    discard;
  }

  vec2 centered = vUv * 2.0 - 1.0;
  float aspect = max(uGrid.x / max(uGrid.y, 0.001), 0.001);
  centered.x *= aspect;
  float motion = clamp(uMotion, 0.0, 1.3);
  float t = uTime * motion * 0.18;
  float radius = length(centered);
  float angle = atan(centered.y, centered.x);
  float outer = stroke(radius - 0.78, 0.0035);
  float inner = stroke(radius - 0.69, 0.0025);
  float orbit = stroke(radius - 0.48, 0.003);
  // Engraved radial ticks, with a slow traveling light instead of a moving grid.
  float sectors = angle * 12.0 / 3.141593;
  float ticks = stroke(sin(angle * 24.0) * radius, 0.007)
    * smoothstep(0.70, 0.72, radius) * (1.0 - smoothstep(0.75, 0.77, radius));
  float arc = pow(0.5 + 0.5 * cos(angle - t), 12.0);
  float counterArc = pow(0.5 + 0.5 * cos(angle + t * 0.7 + 2.4), 16.0);
  float halo = exp(-abs(radius - 0.78) * 42.0) * arc * 0.13;
  vec2 cell = floor(centered * 4.0);
  vec2 local = fract(centered * 4.0) - 0.5;
  float rune = stroke(abs(local.x) + abs(local.y) - 0.12, 0.016)
    * step(0.72, hash21(cell)) * 0.13;
  float vignette = 1.0 - smoothstep(0.82, 1.16, radius);
  float edgeFade = smoothstep(0.0, 0.12, min(min(vUv.x, vUv.y), min(1.0 - vUv.x, 1.0 - vUv.y)));
  float mask = (outer * (0.22 + arc * 0.6) + inner * 0.17
    + orbit * (0.12 + counterArc * 0.32) + ticks * 0.28 + halo + rune) * vignette * edgeFade;
  vec3 color = mix(uCyanColor, uGoldColor, 0.5 + 0.35 * sin(sectors * 0.25 + t));
  float alpha = clamp(mask * intensity, 0.0, 0.38);
  if (alpha < 0.006) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
