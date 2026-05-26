# 服务器部署说明

## 基本启动

```bash
npm install
npm run build
npm run relay
```

服务默认监听：

```text
0.0.0.0:3000
```

访问地址：

```text
http://服务器IP:3000/
http://服务器IP:3000/controller
```

## 修改端口

用 `PORT` 环境变量指定端口：

```bash
PORT=8080 npm run relay
```

常见平台会自动注入 `PORT`，例如：

```bash
PORT=$PORT npm run relay
```

## Nginx 反向代理示例

如果你希望外部使用 `80` 或 `443`，可以让 Node 服务仍然跑在 `3000`，由 Nginx 转发：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location /api/gesture/stream {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_cache off;
  }
}
```

## 手机摄像头注意点

手机浏览器调用摄像头通常需要 HTTPS。部署到公网服务器时，建议配置域名和 HTTPS：

```text
https://your-domain.com/
https://your-domain.com/controller
```

Safari 尤其严格：

- `http://服务器IP:3000/controller` 通常不能打开摄像头。
- `https://域名/controller` 才是推荐方式。
- iPhone 上需要在 Safari 弹窗里允许摄像头权限。
- 如果曾经拒绝过权限，需要到 iOS 设置里重新允许：设置 -> Safari -> 摄像头。

如果暂时没有 HTTPS，可以先用 Chrome/Edge 测试页面逻辑，但正式手机摄像头控制建议尽快配置 HTTPS。
