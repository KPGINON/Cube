# 需要你自行下载或安装的内容

## Node 项目依赖

项目使用 Vite、React、Three.js、MediaPipe Tasks Vision 和 lucide-react。首次运行前需要你自己执行：

```bash
npm install
```

## 浏览器运行时模型

手势识别模型默认从 MediaPipe 官方公开地址加载：

- `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`

MediaPipe WASM 运行文件默认从 jsDelivr 加载：

- `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm`

如果你希望完全离线运行，可以把上面两类资源下载到 `public/vendor/mediapipe/`，再修改 [src/hooks/useHandTracking.js](/mnt/c/Users/21195/Desktop/Cube/src/hooks/useHandTracking.js) 里的 `modelUrl` 和 `FilesetResolver.forVisionTasks(...)` 路径。

## 可选验证工具

如果后续要做自动化浏览器截图或响应式检查，可以自行安装 Playwright：

```bash
npm install -D playwright
npx playwright install chromium
```

当前项目不强制依赖 Playwright。
