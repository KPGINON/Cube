import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';

const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const baseMetrics = {
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
  handCount: 0,
  handSpan: 0,
  confidence: 0,
};

export default function useHandTracking(videoRef, enabled, cameraOptions = {}) {
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const previousMetricsRef = useRef(baseMetrics);
  const previousTimeRef = useRef(0);
  const lastVideoTimeRef = useRef(-1);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [gesture, setGesture] = useState('idle');
  const [landmarks, setLandmarks] = useState([]);
  const [metrics, setMetrics] = useState(baseMetrics);

  const stopCamera = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setLandmarks([]);
    setGesture('idle');
    setMetrics(baseMetrics);
    previousMetricsRef.current = baseMetrics;
    previousTimeRef.current = 0;
    setStatus('idle');
  }, [videoRef]);

  const resetCamera = useCallback(() => {
    stopCamera();
    lastVideoTimeRef.current = -1;
  }, [stopCamera]);

  useEffect(() => {
    let disposed = false;

    async function createDetector() {
      if (detectorRef.current) return detectorRef.current;

      const fileset = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm',
      );

      detectorRef.current = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: modelUrl,
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.45,
        minHandPresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });

      return detectorRef.current;
    }

    async function start() {
      if (!enabled) {
        stopCamera();
        return;
      }

      setStatus('loading');
      setError('');

      try {
        if (!window.isSecureContext) {
          throw new Error('INSECURE_CONTEXT');
        }

        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('GET_USER_MEDIA_UNAVAILABLE');
        }

        const [detector, stream] = await Promise.all([
          createDetector(),
          navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraOptions.facingMode ?? 'user',
              width: { ideal: cameraOptions.width ?? 1280 },
              height: { ideal: cameraOptions.height ?? 720 },
            },
            audio: false,
          }),
        ]);

        if (disposed) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        setStatus('running');

        const detect = () => {
          if (!videoRef.current || !detector || disposed) return;

          const currentVideoTime = videoRef.current.currentTime;
          if (currentVideoTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = currentVideoTime;
            const result = detector.detectForVideo(videoRef.current, performance.now());
            const hands = result.landmarks ?? [];
            setLandmarks(hands);

            if (hands.length) {
              const now = performance.now();
              const nextMetrics = getHandsMetrics(hands, previousMetricsRef.current, previousTimeRef.current, now);
              previousMetricsRef.current = nextMetrics;
              previousTimeRef.current = now;
              setMetrics(nextMetrics);
              setGesture(classifyGesture(hands, nextMetrics));
            } else {
              previousMetricsRef.current = baseMetrics;
              previousTimeRef.current = 0;
              setMetrics(baseMetrics);
              setGesture('unknown');
            }
          }

          frameRef.current = requestAnimationFrame(detect);
        };

        detect();
      } catch (cause) {
        setStatus('error');
        setError(getCameraError(cause));
      }
    }

    start();

    return () => {
      disposed = true;
      if (!enabled) return;
      stopCamera();
    };
  }, [cameraOptions.facingMode, cameraOptions.height, cameraOptions.width, enabled, stopCamera, videoRef]);

  return { status, error, gesture, landmarks, metrics, resetCamera };
}

function classifyGesture(hands, metrics) {
  const primaryHand = hands[0] ?? [];
  const fingers = [8, 12, 16, 20].map((tipIndex) => isFingerOpen(primaryHand, tipIndex));
  const openCount = fingers.filter(Boolean).length;

  if (metrics.handCount >= 2) {
    if (metrics.handSpan > 0.55 || metrics.openness > 0.52) return 'open';
    if (metrics.handSpan < 0.22 || metrics.openness < 0.34) return 'fist';
  }
  if (metrics.pinch < 0.3) return 'pinch';
  if (openCount <= 1 && metrics.openness < 0.38) return 'fist';
  if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3]) return 'point';
  if (openCount >= 3 && metrics.openness > 0.45) return 'open';
  return 'unknown';
}

function getHandsMetrics(hands, previousMetrics, previousTime, now) {
  const handMetrics = hands.map((hand) => getHandMetrics(hand));
  const primary = handMetrics[0];
  const handCount = handMetrics.length;
  let aggregate = { ...primary, handCount, handSpan: 0 };

  if (handCount >= 2) {
    const secondary = handMetrics[1];
    const palmX = (primary.palmX + secondary.palmX) / 2;
    const palmY = (primary.palmY + secondary.palmY) / 2;
    const palmZ = (primary.palmZ + secondary.palmZ) / 2;
    const handSpan = clamp(Math.hypot(primary.palmX - secondary.palmX, primary.palmY - secondary.palmY) / 1.35);

    aggregate = {
      ...aggregate,
      openness: clamp(Math.max((primary.openness + secondary.openness) / 2, handSpan)),
      pinch: clamp((primary.pinch + secondary.pinch) / 2),
      palmX,
      palmY,
      palmZ,
      roll: clampSigned((primary.roll + secondary.roll) / 2),
      yaw: clampSigned((primary.yaw + secondary.yaw) / 2),
      pitch: clampSigned((primary.pitch + secondary.pitch) / 2),
      spread: clamp(Math.max((primary.spread + secondary.spread) / 2, handSpan)),
      grab: clamp(1 - handSpan * 1.35 + (1 - (primary.openness + secondary.openness) / 2) * 0.35),
      anchorX: palmX,
      anchorY: palmY,
      handSpan,
      confidence: clamp((primary.confidence + secondary.confidence) / 2 + 0.18),
    };
  }

  const dt = previousTime ? Math.max((now - previousTime) / 1000, 0.016) : 0.016;
  return {
    ...aggregate,
    velocityX: clampSigned((aggregate.palmX - previousMetrics.palmX) / dt / 6),
    velocityY: clampSigned((aggregate.palmY - previousMetrics.palmY) / dt / 6),
    velocityZ: clampSigned((aggregate.palmZ - previousMetrics.palmZ) / dt / 6),
  };
}

function getHandMetrics(hand, previousMetrics, previousTime, now) {
  const wrist = hand[0];
  const palmCenter = average([hand[0], hand[5], hand[9], hand[13], hand[17]]);
  const thumbIndexMid = average([hand[4], hand[8]]);
  const tips = [hand[4], hand[8], hand[12], hand[16], hand[20]];
  const avgTipDistance =
    tips.reduce((total, point) => total + distance(point, palmCenter), 0) / tips.length;
  const palmSize = distance(wrist, hand[9]) || 0.001;
  const openness = clamp(avgTipDistance / (palmSize * 1.55));
  const pinchDistance = distance(hand[4], hand[8]) / palmSize;
  const knuckleSpan = distance(hand[5], hand[17]) / palmSize;
  const roll = clampSigned(Math.atan2(hand[17].y - hand[5].y, hand[17].x - hand[5].x) / Math.PI);
  const yaw = clampSigned((hand[5].z - hand[17].z) / (palmSize * 0.7));
  const pitch = clampSigned((wrist.y - hand[9].y) / (palmSize * 1.3));
  const palmX = clamp((palmCenter.x - 0.5) * 2, -1, 1);
  const palmY = clamp((palmCenter.y - 0.5) * 2, -1, 1);
  const palmZ = clamp(1 - palmSize * 7.5, -1, 1);

  return {
    openness,
    pinch: clamp(pinchDistance),
    palmX,
    palmY,
    palmZ,
    roll,
    yaw,
    pitch,
    spread: clamp(knuckleSpan / 1.55),
    velocityX: 0,
    velocityY: 0,
    velocityZ: 0,
    grab: clamp(1 - pinchDistance * 1.45 + (1 - openness) * 0.35),
    anchorX: clamp((thumbIndexMid.x - 0.5) * 2, -1, 1),
    anchorY: clamp((thumbIndexMid.y - 0.5) * 2, -1, 1),
    pointX: clamp((hand[8].x - 0.5) * 2, -1, 1),
    pointY: clamp((hand[8].y - 0.5) * 2, -1, 1),
    pointZ: clamp((hand[8].z - hand[0].z) / (palmSize * 1.2), -1, 1),
    handCount: 1,
    handSpan: 0,
    confidence: clamp(1 - Math.abs(0.55 - openness) * 0.55),
  };
}

function isFingerOpen(hand, tipIndex) {
  const tip = hand[tipIndex];
  const pip = hand[tipIndex - 2];
  const wrist = hand[0];
  return distance(tip, wrist) > distance(pip, wrist) * 1.08;
}

function average(points) {
  return points.reduce(
    (sum, point) => ({
      x: sum.x + point.x / points.length,
      y: sum.y + point.y / points.length,
      z: sum.z + point.z / points.length,
    }),
    { x: 0, y: 0, z: 0 },
  );
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function clampSigned(value) {
  return clamp(value, -1, 1);
}

function getCameraError(cause) {
  if (cause?.message === 'INSECURE_CONTEXT') {
    return 'Safari 调用摄像头需要 HTTPS。请使用 https 地址访问，或在本机 localhost 调试。';
  }

  if (cause?.message === 'GET_USER_MEDIA_UNAVAILABLE') {
    return '当前浏览器不支持摄像头 API，或页面不在安全上下文中。Safari 请使用 HTTPS。';
  }

  if (cause?.name === 'NotAllowedError') return '摄像头权限被拒绝，请在浏览器地址栏允许访问摄像头。';
  if (cause?.name === 'NotFoundError') return '没有找到可用摄像头。';
  if (cause?.name === 'NotReadableError') return '摄像头被其他应用占用，关闭占用摄像头的应用后再试。';
  return '摄像头或手势模型启动失败，请确认网络和浏览器权限。';
}
