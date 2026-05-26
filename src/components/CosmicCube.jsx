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
  palmZ: 0,
  roll: 0,
  yaw: 0,
  pitch: 0,
  spread: 0,
  velocityX: 0,
  velocityY: 0,
  velocityZ: 0,
  grab: 0,
  anchorX: 0,
  anchorY: 0,
  pointX: 0,
  pointY: 0,
  pointZ: 0,
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

    const fluidGeometry = new THREE.SphereGeometry(1.62, 96, 64);
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
    const heldPosition = new THREE.Vector3();
    const heldVelocity = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();
    const heldRotation = new THREE.Euler();
    const heldQuaternion = new THREE.Quaternion();
    const targetQuaternion = new THREE.Quaternion();
    const spinImpulse = new THREE.Vector3();

    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const current = signalRef.current ?? defaultSignal;
      const color = gestureColors[current.gesture] ?? gestureColors.unknown;

      softSignal.openness = THREE.MathUtils.lerp(softSignal.openness, current.openness, 0.055);
      softSignal.pinch = THREE.MathUtils.lerp(softSignal.pinch, current.pinch, 0.075);
      softSignal.palmX = THREE.MathUtils.lerp(softSignal.palmX, current.palmX, 0.05);
      softSignal.palmY = THREE.MathUtils.lerp(softSignal.palmY, current.palmY, 0.05);
      softSignal.palmZ = THREE.MathUtils.lerp(softSignal.palmZ, current.palmZ ?? 0, 0.05);
      softSignal.roll = THREE.MathUtils.lerp(softSignal.roll, current.roll ?? 0, 0.06);
      softSignal.yaw = THREE.MathUtils.lerp(softSignal.yaw, current.yaw ?? 0, 0.06);
      softSignal.pitch = THREE.MathUtils.lerp(softSignal.pitch, current.pitch ?? 0, 0.06);
      softSignal.spread = THREE.MathUtils.lerp(softSignal.spread, current.spread ?? 0, 0.055);
      softSignal.velocityX = THREE.MathUtils.lerp(softSignal.velocityX, current.velocityX ?? 0, 0.12);
      softSignal.velocityY = THREE.MathUtils.lerp(softSignal.velocityY, current.velocityY ?? 0, 0.12);
      softSignal.velocityZ = THREE.MathUtils.lerp(softSignal.velocityZ, current.velocityZ ?? 0, 0.12);
      softSignal.grab = THREE.MathUtils.lerp(softSignal.grab, current.grab ?? 0, 0.09);
      softSignal.anchorX = THREE.MathUtils.lerp(softSignal.anchorX, current.anchorX ?? softSignal.palmX, 0.055);
      softSignal.anchorY = THREE.MathUtils.lerp(softSignal.anchorY, current.anchorY ?? softSignal.palmY, 0.055);
      softSignal.pointX = THREE.MathUtils.lerp(softSignal.pointX, current.pointX ?? softSignal.palmX, 0.08);
      softSignal.pointY = THREE.MathUtils.lerp(softSignal.pointY, current.pointY ?? softSignal.palmY, 0.08);
      softSignal.pointZ = THREE.MathUtils.lerp(softSignal.pointZ, current.pointZ ?? 0, 0.08);
      softSignal.confidence = THREE.MathUtils.lerp(softSignal.confidence, current.confidence, 0.065);

      const squeeze = 1 - softSignal.pinch;
      const pointFollow = current.gesture === 'point' ? softSignal.confidence : 0;
      const breath = 0.5 + Math.sin(elapsed * 1.35) * 0.5;
      const spreadEnergy = Math.max(softSignal.openness, softSignal.spread * 0.92);
      const gatherEnergy = Math.max(0, 1 - softSignal.openness, squeeze * 0.85);
      const held = Math.max(softSignal.grab, pointFollow);
      const motionEnergy =
        Math.abs(softSignal.velocityX) + Math.abs(softSignal.velocityY) + Math.abs(softSignal.velocityZ);
      const scale =
        0.66 +
        spreadEnergy * 0.46 -
        gatherEnergy * 0.18 +
        softSignal.palmZ * -0.12 +
        breath * 0.028;
      const fluidity = 0.1 + spreadEnergy * 0.22 + squeeze * 0.08 + motionEnergy * 0.11;

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

      targetScale.set(
        scale * (1 + spreadEnergy * 0.14 + Math.abs(softSignal.yaw) * 0.08),
        scale * (1 + spreadEnergy * 0.1 + Math.abs(softSignal.pitch) * 0.05),
        scale * (1 + softSignal.palmZ * -0.08),
      );
      fluidGroup.scale.lerp(targetScale, 0.06);

      const followX = THREE.MathUtils.lerp(softSignal.palmX, softSignal.pointX, pointFollow);
      const followY = THREE.MathUtils.lerp(softSignal.palmY, softSignal.pointY, pointFollow);
      const followZ = THREE.MathUtils.lerp(softSignal.palmZ, softSignal.pointZ, pointFollow * 0.6);
      targetPosition.set(
        followX * (1.45 + pointFollow * 0.55) + softSignal.anchorX * held * 0.16,
        -followY * (0.92 + pointFollow * 0.36) - softSignal.anchorY * held * 0.1,
        followZ * 0.82,
      );
      heldVelocity.addScaledVector(targetPosition.clone().sub(heldPosition), 0.055 + held * 0.035);
      heldVelocity.add(new THREE.Vector3(softSignal.velocityX, -softSignal.velocityY, softSignal.velocityZ).multiplyScalar(0.016));
      heldVelocity.multiplyScalar(0.82 - held * 0.08);
      heldPosition.add(heldVelocity);
      fluidGroup.position.copy(heldPosition);

      heldRotation.set(
        softSignal.pitch * 1.05 + softSignal.palmY * 0.22,
        -softSignal.yaw * 1.2 + softSignal.palmX * 0.26,
        -softSignal.roll * 2.1 + Math.sin(elapsed * 0.55) * 0.04,
        'XYZ',
      );
      targetQuaternion.setFromEuler(heldRotation);
      heldQuaternion.slerp(targetQuaternion, 0.08 + held * 0.06);
      fluidGroup.quaternion.copy(heldQuaternion);

      spinImpulse.x = THREE.MathUtils.lerp(spinImpulse.x, softSignal.velocityY * 0.018, 0.08);
      spinImpulse.y = THREE.MathUtils.lerp(spinImpulse.y, softSignal.velocityX * 0.018, 0.08);
      spinImpulse.z = THREE.MathUtils.lerp(spinImpulse.z, (softSignal.velocityX - softSignal.velocityY) * 0.012, 0.08);
      fluidCore.rotation.x += 0.0015 + spinImpulse.x;
      fluidCore.rotation.y += 0.002 + spinImpulse.y;
      fluidCore.rotation.z += spinImpulse.z + Math.sin(elapsed * 0.72) * 0.001 + softSignal.roll * 0.002;
      fluidSkin.rotation.copy(fluidCore.rotation);
      glowShell.rotation.copy(fluidCore.rotation);

      rings.forEach((ring, index) => {
        const ringBreath =
          0.82 + spreadEnergy * 0.34 - gatherEnergy * 0.08 + Math.sin(elapsed * 1.6 + index) * 0.035;
        ring.scale.setScalar(ringBreath);
        ring.rotation.x += 0.0018 * (index + 1) + softSignal.openness * 0.004 + spinImpulse.x * 0.4;
        ring.rotation.y -= 0.0025 * (index + 1) + squeeze * 0.006 + spinImpulse.y * 0.4;
        ring.rotation.z += softSignal.palmX * 0.003 + spinImpulse.z * 0.3;
        ring.material.opacity = 0.13 + softSignal.confidence * 0.18 + squeeze * 0.15;
      });

      particles.rotation.y -= 0.001 + softSignal.openness * 0.0025 + Math.abs(spinImpulse.y) * 0.2;
      particles.rotation.x += softSignal.palmY * 0.001 + spinImpulse.x * 0.15;
      particles.position.copy(heldPosition).multiplyScalar(-0.12);
      particles.scale.setScalar(0.78 + spreadEnergy * 0.48 - gatherEnergy * 0.1);
      particles.material.opacity = 0.2 + softSignal.confidence * 0.26 + squeeze * 0.14 + motionEnergy * 0.08;

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
  const spreadEnergy = Math.max(signal.openness, signal.spread * 0.92);
  const gatherEnergy = Math.max(0, 1 - signal.openness, (1 - signal.pinch) * 0.85);

  for (let i = 0; i < positions.length; i += 3) {
    const x = basePositions[i];
    const y = basePositions[i + 1];
    const z = basePositions[i + 2];

    normal.set(x, y, z);
    normal.normalize();

    const ripple =
      Math.sin(x * 3.1 + elapsed * 2.2 + signal.palmX * 2.2 + signal.roll * 2.4) * 0.45 +
      Math.sin(y * 3.8 - elapsed * 1.85 + signal.palmY * 2.4 + signal.pitch * 1.8) * 0.34 +
      Math.sin((x + y + z) * 2.05 + elapsed * 2.9 + signal.yaw * 2.2) * 0.25;
    const slowPull = Math.sin(elapsed * 0.95 + normal.x * 4 + normal.y * 2) * 0.08;
    const anchorPull =
      signal.grab *
      Math.max(
        0,
        1 -
          Math.hypot(
            normal.x - signal.anchorX * 0.55,
            normal.y + signal.anchorY * 0.55,
            normal.z - signal.palmZ * 0.35,
          ),
      );
    const directionalSmear =
      (normal.x * signal.velocityX - normal.y * signal.velocityY + normal.z * signal.velocityZ) * 0.13;
    const handExpansion = spreadEnergy * 0.34 - gatherEnergy * 0.2;
    const displacement = (handExpansion + ripple * fluidity + slowPull - anchorPull * 0.24 + directionalSmear) * shellScale;

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
