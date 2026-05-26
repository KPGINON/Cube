import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useCallback, useEffect, useRef, useState } from 'react';

const modelUrl =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const baseMetrics = {
  openness: 0,
  pinch: 1,
  palmX: 0,
  palmY: 0,
  confidence: 0,
};

export default function useHandTracking(videoRef, enabled, cameraOptions = {}) {
  const detectorRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
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
        numHands: 1,
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
            const hand = result.landmarks?.[0] ?? [];
            setLandmarks(hand);

            if (hand.length) {
              const nextMetrics = getHandMetrics(hand);
              setMetrics(nextMetrics);
              setGesture(classifyGesture(hand, nextMetrics));
            } else {
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

function classifyGesture(hand, metrics) {
  const fingers = [8, 12, 16, 20].map((tipIndex) => isFingerOpen(hand, tipIndex));
  const openCount = fingers.filter(Boolean).length;

  if (metrics.pinch < 0.3) return 'pinch';
  if (openCount <= 1 && metrics.openness < 0.38) return 'fist';
  if (fingers[0] && !fingers[1] && !fingers[2] && !fingers[3]) return 'point';
  if (openCount >= 3 && metrics.openness > 0.45) return 'open';
  return 'unknown';
}

function getHandMetrics(hand) {
  const wrist = hand[0];
  const palmCenter = average([hand[0], hand[5], hand[9], hand[13], hand[17]]);
  const tips = [hand[4], hand[8], hand[12], hand[16], hand[20]];
  const avgTipDistance =
    tips.reduce((total, point) => total + distance(point, palmCenter), 0) / tips.length;
  const palmSize = distance(wrist, hand[9]) || 0.001;
  const openness = clamp(avgTipDistance / (palmSize * 1.55));
  const pinchDistance = distance(hand[4], hand[8]) / palmSize;

  return {
    openness,
    pinch: clamp(pinchDistance),
    palmX: clamp((palmCenter.x - 0.5) * 2, -1, 1),
    palmY: clamp((palmCenter.y - 0.5) * 2, -1, 1),
    confidence: clamp(1 - Math.abs(0.55 - openness) * 0.7),
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

function getCameraError(cause) {
  if (cause?.name === 'NotAllowedError') return '摄像头权限被拒绝，请在浏览器地址栏允许访问摄像头。';
  if (cause?.name === 'NotFoundError') return '没有找到可用摄像头。';
  return '摄像头或手势模型启动失败，请确认网络和浏览器权限。';
}
