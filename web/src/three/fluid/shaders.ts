// Stable-fluids passes (after Dobryakov's WebGL fluid, as used by buttermax.net's mouse fluid).
// Velocity is stored in sim texels per second; all passes draw a full-screen triangle.

export const baseVert = /* glsl */ `
uniform vec2 texelSize;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  vUv = uv;
  vL = uv - vec2(texelSize.x, 0.0);
  vR = uv + vec2(texelSize.x, 0.0);
  vT = uv + vec2(0.0, texelSize.y);
  vB = uv - vec2(0.0, texelSize.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

// Adds a soft capsule from prevPoint to point (smooth trails at low frame rates); `stretch` makes it an ellipse.
// With color = 0 it is a plain copy, used to carry the state across a resize.
export const splatFrag = /* glsl */ `
uniform sampler2D uTarget;
uniform float aspect;
uniform vec3 color;
uniform vec2 point;
uniform vec2 prevPoint;
uniform vec2 stretch;
uniform float radius;
varying vec2 vUv;
void main() {
  vec2 pa = vUv - prevPoint;
  vec2 ba = point - prevPoint;
  pa.x *= aspect;
  ba.x *= aspect;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  vec2 d = (pa - ba * h) / stretch;
  vec3 s = exp(-dot(d, d) / (radius * radius)) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + s, 1.0);
}`;

export const advectionFrag = /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 texelSize;
uniform float dt;
uniform vec4 dissipation;
varying vec2 vUv;
void main() {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
}`;

export const curlFrag = /* glsl */ `
uniform sampler2D uVelocity;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  float L = texture2D(uVelocity, vL).y;
  float R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x;
  float B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

export const vorticityFrag = /* glsl */ `
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float curl;
uniform float dt;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  float L = texture2D(uCurl, vL).x;
  float R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x;
  float B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 1e-4;
  force *= curl * C;
  force.y *= -1.0;
  vec2 vel = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`;

export const divergenceFrag = /* glsl */ `
uniform sampler2D uVelocity;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  vec2 C = texture2D(uVelocity, vUv).xy;
  float L = vL.x < 0.0 ? -C.x : texture2D(uVelocity, vL).x;
  float R = vR.x > 1.0 ? -C.x : texture2D(uVelocity, vR).x;
  float T = vT.y > 1.0 ? -C.y : texture2D(uVelocity, vT).y;
  float B = vB.y < 0.0 ? -C.y : texture2D(uVelocity, vB).y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

export const clearFrag = /* glsl */ `
uniform sampler2D uTexture;
uniform float value;
varying vec2 vUv;
void main() { gl_FragColor = value * texture2D(uTexture, vUv); }`;

export const pressureFrag = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

export const gradientSubtractFrag = /* glsl */ `
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
varying vec2 vUv;
varying vec2 vL;
varying vec2 vR;
varying vec2 vT;
varying vec2 vB;
void main() {
  float L = texture2D(uPressure, vL).x;
  float R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x;
  float B = texture2D(uPressure, vB).x;
  vec2 vel = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(vel, 0.0, 1.0);
}`;
