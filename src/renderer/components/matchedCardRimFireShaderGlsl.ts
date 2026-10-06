/** Continuous fire envelope with flowing tongues; its hollow center preserves the card art. */
export const MATCHED_RIM_FIRE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;
uniform float uTime;
uniform float uSeed;
uniform float uIntensity;
uniform float uBurst;
uniform float uMotion;
uniform float uSoftness;
uniform float uInnerWidth;
uniform float uOuterWidth;
uniform float uEmberStrength;
uniform vec2 uOuterHalfSize;
uniform vec2 uInnerHalfSize;
uniform float uOuterCorner;
uniform float uInnerCorner;
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
uniform vec3 uEmberColor;
varying vec2 vLocal;
float sdRoundedRect(vec2 p, vec2 h, float r) {
    vec2 q = abs(p) - h + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
        mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
    float intensity = clamp(uIntensity, 0.0, 4.0);
    if (intensity <= 0.001) discard;
    float burst = clamp(uBurst, 0.0, 2.0);
    float motion = clamp(uMotion, 0.0, 2.0);
    float edge = sdRoundedRect(vLocal, uInnerHalfSize, uInnerCorner);
    float outer = sdRoundedRect(vLocal, uOuterHalfSize, uOuterCorner);
    // Keep the hollow rim stable as cards shrink on dense boards or during camera motion.
    float softness = max(max(uSoftness, 0.003), fwidth(edge));
    float outerSoftness = max(0.0175, fwidth(outer));
    float mask = smoothstep(-softness, softness, edge)
        * (1.0 - smoothstep(-0.0175 - outerSoftness, -0.0175 + outerSoftness, outer));
    if (mask < 0.002) discard;
    float t = uTime * motion;
    vec2 flow = vLocal * vec2(15.0, 9.0) + vec2(uSeed * 37.0, -t * 2.8);
    float broad = noise(flow + noise(flow * 0.48 + t * 0.3) * 1.8);
    float fine = noise(flow * 2.1 - vec2(t * 0.6, t * 1.3));
    float tongue = pow(clamp(broad * 0.85 + fine * 0.15, 0.0, 1.0), 1.25);
    float reach = (0.025 + tongue * (0.18 + uOuterWidth * 0.06)) * (1.0 + burst * 0.25);
    float flame = 1.0 - smoothstep(reach * 0.3, reach, edge);
    float core = exp(-max(edge, 0.0) * (85.0 - uInnerWidth * 30.0));
    float halo = exp(-max(edge, 0.0) * 20.0) * 0.16;
    float filaments = flame * (0.42 + fine * 0.58) * clamp(uEmberStrength, 0.0, 2.0);
    vec3 color = mix(uEmberColor, uGlowColor, clamp(core * 0.3 + fine * 0.22, 0.0, 1.0));
    color = mix(color, uCoreColor, core * 0.75);
    float alpha = mask * intensity * (core * 0.62 + filaments * 0.72 + halo);
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.88));
}
`;
