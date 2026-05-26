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
