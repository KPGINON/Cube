import { Activity, Camera, Hand, Power, ScanLine, Smartphone } from 'lucide-react';
import { useRef, useState } from 'react';
import LandmarkOverlay from './LandmarkOverlay.jsx';
import useGestureRelaySender from '../hooks/useGestureRelaySender.js';
import useHandTracking from '../hooks/useHandTracking.js';
import { getRelayOrigin } from '../hooks/useRemoteGesture.js';

const gestureLabels = {
  idle: '待机',
  open: '张开',
  pinch: '捏合',
  fist: '握拳',
  point: '指向',
  unknown: '识别中',
};

export default function ControllerPage() {
  const videoRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const { status, error, gesture, landmarks, metrics } = useHandTracking(videoRef, enabled, {
    facingMode: 'user',
    width: 960,
    height: 1280,
  });
  const relay = useGestureRelaySender(enabled && status === 'running', gesture, metrics);

  return (
    <main className="controller-shell">
      <section className="controller-camera" aria-label="手机摄像头手势控制器">
        <video ref={videoRef} className="camera-feed" playsInline muted />
        <LandmarkOverlay landmarks={landmarks} />
      </section>

      <section className="controller-panel" aria-label="控制器状态">
        <div className="controller-heading">
          <span className="brand-mark">
            <Smartphone size={18} />
          </span>
          <div>
            <h1>Gesture Controller</h1>
            <p>{getRelayOrigin()}</p>
          </div>
        </div>

        <div className="readout">
          <div>
            <span>发送手势</span>
            <strong>{gestureLabels[gesture] ?? gestureLabels.unknown}</strong>
          </div>
          <Hand size={28} />
        </div>

        <div className="meter-group">
          <MiniMeter icon={<Activity size={16} />} label="张合度" value={metrics.openness} />
          <MiniMeter icon={<Camera size={16} />} label="捏合距离" value={1 - metrics.pinch} />
          <MiniMeter icon={<ScanLine size={16} />} label="发送状态" value={relay.status === 'sending' ? 1 : 0} />
        </div>

        <button className="primary-action" type="button" onClick={() => setEnabled((value) => !value)}>
          <Power size={18} />
          <span>{enabled ? '停止发送' : '启动手机控制'}</span>
        </button>

        {(error || relay.error) && <p className="error-text">{error || relay.error}</p>}
      </section>
    </main>
  );
}

function MiniMeter({ icon, label, value }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

  return (
    <div className="meter">
      <div className="meter-label">
        {icon}
        <span>{label}</span>
        <b>{Math.round(clamped * 100)}</b>
      </div>
      <div className="meter-track">
        <span style={{ width: `${clamped * 100}%` }} />
      </div>
    </div>
  );
}
