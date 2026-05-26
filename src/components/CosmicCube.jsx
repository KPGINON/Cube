import { useEffect, useRef } from 'react';
import * as THREE from 'three';

const gestureColors = {
  idle: new THREE.Color('#66e6ff'),
  open: new THREE.Color('#64ffc6'),
  pinch: new THREE.Color('#ffd36a'),
  fist: new THREE.Color('#ff5f88'),
  point: new THREE.Color('#a8b1ff'),
  unknown: new THREE.Color('#6ee7ff'),
};

const defaultSignal = {
  gesture: 'idle',
  openness: 0,
  pinch: 1,
  palmX: 0,
  palmY: 0,
  confidence: 0,
};

export default function CosmicCube({ signal }) {
  const hostRef = useRef(null);
  const signalRef = useRef(signal);

  useEffect(() => {
    signalRef.current = signal;
  }, [signal]);

  useEffect(() => {
    const host = hostRef.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const clock = new THREE.Clock();

    camera.position.set(0, 0, 7);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const fluidGroup = new THREE.Group();
    scene.add(fluidGroup);

    const fluidGeometry = new THREE.BoxGeometry(2.32, 2.32, 2.32, 34, 34, 34);
    const basePositions = fluidGeometry.attributes.position.array.slice();

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: '#67eaff',
      roughness: 0.08,
      metalness: 0.08,
      transmission: 0.58,
      transparent: true,
      opacity: 0.7,
      thickness: 1.35,
      ior: 1.35,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      emissive: '#21c8ff',
      emissiveIntensity: 1.05,
    });

    const fluidCore = new THREE.Mesh(fluidGeometry, coreMaterial);
    fluidGroup.add(fluidCore);

    const skinMaterial = new THREE.MeshBasicMaterial({
      color: '#8ef6ff',
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const fluidSkin = new THREE.Mesh(fluidGeometry.clone(), skinMaterial);
    fluidGroup.add(fluidSkin);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: '#4cecff',
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.BackSide,
    });
    const glowShell = new THREE.Mesh(fluidGeometry.clone(), glowMaterial);
    glowShell.scale.setScalar(1.18);
    fluidGroup.add(glowShell);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: '#59e2ff',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const rings = [0, 1, 2, 3].map((index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.05 + index * 0.28, 0.01, 16, 192), ringMaterial);
      ring.rotation.set(index * 0.68, index * 0.42, index * 0.25);
      fluidGroup.add(ring);
      return ring;
    });

    const particles = createParticles();
    fluidGroup.add(particles);

    const ambient = new THREE.AmbientLight('#80ecff', 1.55);
    const key = new THREE.PointLight('#bbfbff', 42, 18);
    key.position.set(4, 3, 5);
    scene.add(ambient, key);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    let animationId = 0;
    const softSignal = { ...defaultSignal };
    const targetScale = new THREE.Vector3(1, 1, 1);

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const current = signalRef.current ?? defaultSignal;
      const color = gestureColors[current.gesture] ?? gestureColors.unknown;

      softSignal.openness = THREE.MathUtils.lerp(softSignal.openness, current.openness, 0.055);
      softSignal.pinch = THREE.MathUtils.lerp(softSignal.pinch, current.pinch, 0.075);
      softSignal.palmX = THREE.MathUtils.lerp(softSignal.palmX, current.palmX, 0.05);
      softSignal.palmY = THREE.MathUtils.lerp(softSignal.palmY, current.palmY, 0.05);
      softSignal.confidence = THREE.MathUtils.lerp(softSignal.confidence, current.confidence, 0.065);

      const squeeze = 1 - softSignal.pinch;
      const breath = 0.5 + Math.sin(elapsed * 1.35) * 0.5;
      const scale = 0.88 + softSignal.openness * 0.48 + squeeze * 0.22 + breath * 0.035;
      const fluidity = 0.12 + softSignal.openness * 0.24 + squeeze * 0.18;

      morphFluidGeometry(fluidGeometry, basePositions, elapsed, softSignal, fluidity, 1);
      morphFluidGeometry(fluidSkin.geometry, basePositions, elapsed + 0.18, softSignal, fluidity * 1.25, 1.012);
      morphFluidGeometry(glowShell.geometry, basePositions, elapsed - 0.22, softSignal, fluidity * 1.5, 1.04);

      coreMaterial.color.lerp(color, 0.08);
      coreMaterial.emissive.lerp(color, 0.08);
      coreMaterial.opacity = 0.56 + softSignal.confidence * 0.2 + squeeze * 0.08;
      coreMaterial.emissiveIntensity = 0.88 + softSignal.confidence * 0.85 + squeeze * 0.45;
      skinMaterial.color.lerp(color, 0.08);
      skinMaterial.opacity = 0.08 + softSignal.openness * 0.1 + squeeze * 0.12;
      glowMaterial.color.lerp(color, 0.08);
      glowMaterial.opacity = 0.14 + softSignal.confidence * 0.1 + squeeze * 0.12;
      ringMaterial.color.lerp(color, 0.08);

      targetScale.set(scale * (1 + squeeze * 0.08), scale * (1 - squeeze * 0.04), scale);
      fluidGroup.scale.lerp(targetScale, 0.055);
      fluidGroup.position.x = THREE.MathUtils.lerp(fluidGroup.position.x, softSignal.palmX * 0.42, 0.045);
      fluidGroup.position.y = THREE.MathUtils.lerp(fluidGroup.position.y, -softSignal.palmY * 0.32, 0.045);
      fluidGroup.rotation.x += 0.0025 + softSignal.palmY * 0.006;
      fluidGroup.rotation.y += 0.0035 + softSignal.palmX * 0.008;
      fluidCore.rotation.z = Math.sin(elapsed * 0.72) * 0.06 + softSignal.palmX * 0.12;
      fluidSkin.rotation.copy(fluidCore.rotation);
      glowShell.rotation.copy(fluidCore.rotation);

      rings.forEach((ring, index) => {
        const ringBreath = 1 + Math.sin(elapsed * 1.6 + index) * 0.035 + squeeze * 0.09;
        ring.scale.setScalar(ringBreath);
        ring.rotation.x += 0.0018 * (index + 1) + softSignal.openness * 0.004;
        ring.rotation.y -= 0.0025 * (index + 1) + squeeze * 0.006;
        ring.rotation.z += softSignal.palmX * 0.003;
        ring.material.opacity = 0.13 + softSignal.confidence * 0.18 + squeeze * 0.15;
      });

      particles.rotation.y -= 0.001 + softSignal.openness * 0.0025;
      particles.rotation.x += softSignal.palmY * 0.001;
      particles.material.opacity = 0.22 + softSignal.confidence * 0.28 + squeeze * 0.16;

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
      host.removeChild(renderer.domElement);
      fluidGeometry.dispose();
      fluidSkin.geometry.dispose();
      glowShell.geometry.dispose();
      rings.forEach((ring) => ring.geometry.dispose());
      particles.geometry.dispose();
      coreMaterial.dispose();
      skinMaterial.dispose();
      glowMaterial.dispose();
      ringMaterial.dispose();
      particles.material.dispose();
      renderer.dispose();
    };
  }, []);

  return <div ref={hostRef} className="cube-scene" aria-hidden="true" />;
}

function morphFluidGeometry(geometry, basePositions, elapsed, signal, fluidity, shellScale) {
  const positions = geometry.attributes.position.array;
  const target = new THREE.Vector3();
  const normal = new THREE.Vector3();

  for (let i = 0; i < positions.length; i += 3) {
    const x = basePositions[i];
    const y = basePositions[i + 1];
    const z = basePositions[i + 2];
    const maxAxis = Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) || 1;
    const cubeBias = 0.72 + signal.openness * 0.12;
    const sphereX = x / maxAxis;
    const sphereY = y / maxAxis;
    const sphereZ = z / maxAxis;

    normal.set(
      THREE.MathUtils.lerp(sphereX, x, cubeBias),
      THREE.MathUtils.lerp(sphereY, y, cubeBias),
      THREE.MathUtils.lerp(sphereZ, z, cubeBias),
    );
    normal.normalize();

    const ripple =
      Math.sin(x * 3.1 + elapsed * 2.2 + signal.palmX * 2.2) * 0.45 +
      Math.sin(y * 3.8 - elapsed * 1.85 + signal.palmY * 2.4) * 0.34 +
      Math.sin((x + y + z) * 2.05 + elapsed * 2.9) * 0.25;
    const slowPull = Math.sin(elapsed * 0.95 + normal.x * 4 + normal.y * 2) * 0.08;
    const displacement = (ripple * fluidity + slowPull) * shellScale;

    target.set(x, y, z).multiplyScalar(shellScale);
    target.addScaledVector(normal, displacement);

    positions[i] = target.x;
    positions[i + 1] = target.y;
    positions[i + 2] = target.z;
  }

  geometry.attributes.position.needsUpdate = true;
  geometry.computeVertexNormals();
}

function createParticles() {
  const count = 950;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const radius = 2.35 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: '#9dfff2',
      size: 0.023,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}
