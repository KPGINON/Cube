import { useEffect, useMemo, useState } from 'react';

const emptyMetrics = {
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
  confidence: 0,
};

export default function useRemoteGesture() {
  const [remote, setRemote] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const stream = new EventSource(`${getRelayOrigin()}/api/gesture/stream`);

    stream.onopen = () => {
      setConnected(true);
      setError('');
    };

    stream.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        setRemote({
          gesture: payload.gesture ?? 'unknown',
          metrics: payload.metrics ?? emptyMetrics,
          updatedAt: payload.updatedAt ?? Date.now(),
        });
      } catch {
        setError('远端手势数据解析失败');
      }
    };

    stream.onerror = () => {
      setConnected(false);
      setError('未连接手机控制器');
    };

    return () => stream.close();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  return useMemo(() => {
    const age = remote ? now - remote.updatedAt : Infinity;
    return {
      connected,
      error,
      remote,
      active: connected && remote && age < 1800,
    };
  }, [connected, error, now, remote]);
}

export function getRelayOrigin() {
  return import.meta.env.VITE_RELAY_ORIGIN || window.location.origin;
}
