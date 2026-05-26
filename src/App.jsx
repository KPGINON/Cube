import { Activity, Camera, Hand, Power, RotateCcw, ScanLine } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import ControllerPage from './components/ControllerPage.jsx';
import CosmicCube from './components/CosmicCube.jsx';
import LandmarkOverlay from './components/LandmarkOverlay.jsx';
import useHandTracking from './hooks/useHandTracking.js';
import useRemoteGesture from './hooks/useRemoteGesture.js';

const gestureLabels = {
  idle: '待机',
  open: '张开',
  pinch: '捏合',
  fist: '握拳',
  point: '指向',
  unknown: '识别中',
};

function App() {
  if (window.location.pathname.startsWith('/controller')) {
    return <ControllerPage />;
  }

  const videoRef = useRef(null);
  const [enabled, setEnabled] = useState(false);
  const { status, error, gesture, landmarks, metrics, resetCamera } = useHandTracking(videoRef, enabled);
  const remote = useRemoteGesture();
  const activeGesture = remote.active ? remote.remote.gesture : gesture;
  const activeMetrics = remote.active ? remote.remote.metrics : metrics;
  const inputMode = remote.active ? '手机控制' : '本机摄像头';

  const signal = useMemo(
    () => ({
      gesture: activeGesture,
      openness: activeMetrics.openness,
      pinch: activeMetrics.pinch,
      palmX: activeMetrics.palmX,
      palmY: activeMetrics.palmY,
      palmZ: activeMetrics.palmZ,
      roll: activeMetrics.roll,
      yaw: activeMetrics.yaw,
      pitch: activeMetrics.pitch,
      spread: activeMetrics.spread,
      velocityX: activeMetrics.velocityX,
      velocityY: activeMetrics.velocityY,
      velocityZ: activeMetrics.velocityZ,
      grab: activeMetrics.grab,
      anchorX: activeMetrics.anchorX,
      anchorY: activeMetrics.anchorY,
      pointX: activeMetrics.pointX,
      pointY: activeMetrics.pointY,
      pointZ: activeMetrics.pointZ,
      confidence: activeMetrics.confidence,
    }),
    [activeGesture, activeMetrics],
  );

  return (
    <main className="app-shell">
      <section className="stage" aria-label="手势球体交互区">
        <CosmicCube signal={signal} />

        <div className="top-bar">
          <div className="brand">
            <span className="brand-mark">
              <ScanLine size={18} />
            </span>
            <div>
              <h1>Gesture Sphere</h1>
              <p>Camera driven interaction base</p>
            </div>
          </div>

          <div className="status-pill" data-state={remote.active ? 'running' : status}>
            <span />
            {remote.active ? '手机在线' : statusText(status)}
          </div>
        </div>

        <aside className="control-panel" aria-label="控制面板">
          <div className="readout">
            <div>
              <span>手部状态</span>
              <strong>{gestureLabels[activeGesture] ?? gestureLabels.unknown}</strong>
            </div>
            <Hand size={28} />
          </div>

          <div className="meter-group">
            <Meter icon={<Activity size={16} />} label="张合度" value={activeMetrics.openness} />
            <Meter icon={<Camera size={16} />} label="捏合距离" value={1 - activeMetrics.pinch} />
            <Meter icon={<ScanLine size={16} />} label={inputMode} value={activeMetrics.confidence} />
          </div>

          <div className="actions">
            <button className="primary-action" type="button" onClick={() => setEnabled((value) => !value)}>
              <Power size={18} />
              <span>{enabled ? '停止识别' : '启动识别'}</span>
            </button>
            <button className="icon-action" type="button" onClick={resetCamera} aria-label="重置摄像头">
              <RotateCcw size={18} />
            </button>
          </div>

          {(error || remote.error) && <p className="error-text">{error || remote.error}</p>}
        </aside>

        <div className="camera-panel">
          <video ref={videoRef} className="camera-feed" playsInline muted />
          <LandmarkOverlay landmarks={landmarks} />
        </div>
      </section>
    </main>
  );
}

function Meter({ icon, label, value }) {
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

function statusText(status) {
  if (status === 'ready') return '就绪';
  if (status === 'running') return '识别中';
  if (status === 'loading') return '加载模型';
  if (status === 'error') return '异常';
  return '离线';
}

export default App;
