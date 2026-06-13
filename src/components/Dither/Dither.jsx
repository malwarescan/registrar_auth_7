import React, { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer, Noise } from "@react-three/postprocessing";
import * as THREE from "three";

function DitherPlane({
  waveColor,
  disableAnimation,
  enableMouseInteraction,
  mouseRadius,
  pixelSize,
  waveAmplitude,
  waveFrequency,
  waveSpeed,
}) {
  const meshRef = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uWaveColor: { value: new THREE.Color(...waveColor) },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uMouseRadius: { value: mouseRadius },
      uPixelSize: { value: pixelSize },
      uWaveAmplitude: { value: waveAmplitude },
      uWaveFrequency: { value: waveFrequency },
    }),
    [mouseRadius, pixelSize, waveAmplitude, waveColor, waveFrequency]
  );

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    uniforms.uTime.value += disableAnimation ? 0 : delta * waveSpeed * 60;
    if (enableMouseInteraction) {
      uniforms.uMouse.value.set((state.pointer.x + 1) * 0.5, (state.pointer.y + 1) * 0.5);
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[2.2, 2.2, 1, 1]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          uniform vec3 uWaveColor;
          uniform vec2 uMouse;
          uniform float uMouseRadius;
          uniform float uPixelSize;
          uniform float uWaveAmplitude;
          uniform float uWaveFrequency;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
          }

          void main() {
            vec2 uv = vUv;
            vec2 pixelUv = floor(uv * (180.0 / max(uPixelSize, 1.0))) / (180.0 / max(uPixelSize, 1.0));
            float wave =
              sin((pixelUv.x * uWaveFrequency + uTime * 0.015) * 6.28318) +
              cos((pixelUv.y * (uWaveFrequency * 0.75) - uTime * 0.012) * 6.28318);
            wave = 0.5 + 0.5 * (wave * 0.5);

            float d = distance(pixelUv, uMouse);
            float mouseBoost = smoothstep(uMouseRadius, 0.0, d) * 0.28;
            float grain = (hash(pixelUv * 320.0 + uTime * 0.1) - 0.5) * 0.06;
            float value = clamp(0.78 + wave * uWaveAmplitude + mouseBoost + grain, 0.0, 1.0);

            vec3 base = mix(vec3(0.98, 0.985, 0.995), uWaveColor, value * 0.22);
            gl_FragColor = vec4(base, 1.0);
          }
        `}
      />
    </mesh>
  );
}

export default function Dither({
  waveColor = [0.45, 0.55, 0.95],
  disableAnimation = false,
  enableMouseInteraction = true,
  mouseRadius = 0.35,
  colorNum = 4,
  pixelSize = 3,
  waveAmplitude = 0.22,
  waveFrequency = 2.4,
  waveSpeed = 0.035,
}) {
  return (
    <div className="ditherCanvasWrap" data-color-num={colorNum}>
      <Canvas camera={{ position: [0, 0, 1.5], fov: 48 }}>
        <DitherPlane
          waveColor={waveColor}
          disableAnimation={disableAnimation}
          enableMouseInteraction={enableMouseInteraction}
          mouseRadius={mouseRadius}
          pixelSize={pixelSize}
          waveAmplitude={waveAmplitude}
          waveFrequency={waveFrequency}
          waveSpeed={waveSpeed}
        />
        <EffectComposer>
          <Bloom mipmapBlur intensity={0.12} luminanceThreshold={0.92} />
          <Noise opacity={0.015} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
