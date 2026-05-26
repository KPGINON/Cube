import { useEffect, useRef, useState } from 'react';
import { getRelayOrigin } from './useRemoteGesture.js';

export default function useGestureRelaySender(enabled, gesture, metrics) {
  const payloadRef = useRef({ gesture, metrics });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    payloadRef.current = { gesture, metrics };
  }, [gesture, metrics]);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return undefined;
    }

    let disposed = false;

    const send = async () => {
      try {
        const payload = payloadRef.current;
        await fetch(`${getRelayOrigin()}/api/gesture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!disposed) {
          setStatus('sending');
          setError('');
        }
      } catch {
        if (!disposed) {
          setStatus('error');
          setError('无法连接电脑端中继服务');
        }
      }
    };

    const timer = setInterval(send, 66);
    send();

    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [enabled]);

  return { status, error };
}
