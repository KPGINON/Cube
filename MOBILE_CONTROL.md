# 手机摄像头控制电脑网页

## 运行方式

推荐使用 relay 服务作为正式体验入口：

```bash
npm run build
npm run relay
```

默认端口是 `3000`。如果服务器要求指定端口，用 `PORT` 覆盖：

```bash
PORT=8080 npm run relay
```

启动后终端会显示类似：

```text
Gesture relay running on http://localhost:3000
Display:    http://服务器IP:3000/
Controller: http://服务器IP:3000/controller
```

电脑打开：

```text
http://服务器IP:3000/
```

手机打开：

```text
http://服务器IP:3000/controller
```

手机和电脑需要在同一个 Wi-Fi 下。手机页面点击“启动手机控制”后，手机摄像头识别到的手势会发送给电脑页面，中间的流体 cube 会优先跟随手机手势变化。

## 开发方式

开发时可以开两个终端：

```bash
npm run relay
npm run dev
```

如果开发时也要换端口，两个命令要使用同一个端口：

```bash
PORT=8080 npm run relay
RELAY_PORT=8080 npm run dev
```

电脑和手机都可以访问 Vite 地址：

```text
http://电脑IP:5173/
http://电脑IP:5173/controller
```

Vite 默认把 `/api` 转发到 `http://localhost:3000`，也可以用 `RELAY_PORT` 覆盖。

## 摄像头权限说明

手机浏览器调用摄像头通常要求 HTTPS 或安全上下文。部分浏览器会允许局域网地址，部分不会。

如果手机无法授权摄像头，后续可以加 HTTPS 本地证书，或把页面部署到支持 HTTPS 的地址，再把 relay 地址配置为 `VITE_RELAY_ORIGIN`。

## 当前数据链路

- 手机 `/controller`：调用手机摄像头，识别手势。
- `POST /api/gesture`：手机把手势和指标发送到 relay。
- `GET /api/gesture/stream`：电脑页面通过 SSE 接收实时手势。
- 电脑 `/`：远端手势在线时使用手机数据，离线时回退本机摄像头。
