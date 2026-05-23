# Cosplan Backend - Pixiv 图片搜索服务

FastAPI + pixivpy3 后端服务，为 cosplan.top 提供 Cosplay 图片搜索。

## 快速开始

### 1. 安装依赖
```bash
cd backend
pip install -r requirements.txt
```

### 2. 获取 Pixiv Refresh Token

方式一（推荐 - OAuth 工具）：
```bash
pip install pixivpy3
python -c "from pixivpy3 import AppPixivAPI; a=AppPixivAPI(); a.login('你的Pixiv用户名', '你的密码'); print(a.refresh_token)"
```

方式二（浏览器 OAuth）：
使用 https://github.com/zip11/pixiv_auth

### 3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env，填入 PIXIV_REFRESH_TOKEN
```

### 4. 运行
```bash
python main.py
# 或
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 测试
```bash
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"character": "妮姬", "count": 3}'
```

## API 文档

### POST /search
搜索指定角色的 Cosplay 图片。

请求：
```json
{
  "character": "妮姬",
  "count": 3
}
```

响应：
```json
{
  "success": true,
  "character": "妮姬",
  "images": [
    {
      "id": 123456789,
      "title": "标题",
      "author": "作者名",
      "url": "/api/image/123456789_0",
      "page_url": "https://www.pixiv.net/artworks/123456789",
      "bookmark_count": 1234
    }
  ]
}
```

### GET /api/image/{image_id}
代理返回 Pixiv 原图（处理防盗链）。

### GET /health
健康检查。

## 部署（Docker）

```bash
docker build -t cosplan-backend .
docker run -d -p 8000:8000 --env-file .env cosplan-backend
```

## 配置说明

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| PIXIV_REFRESH_TOKEN | Pixiv 刷新令牌 | 必填 |
| HOST | 监听地址 | 0.0.0.0 |
| PORT | 监听端口 | 8000 |
| RATE_LIMIT_PER_MIN | 每分钟最大请求数 | 30 |

## 注意
- 只搜索 safe 级别图片（自动过滤 R18）
- 搜索关键词自动拼接「角色名 + コスプレ」
- 图片通过后端代理中转，解决 Pixiv 防盗链
- 缓存图片到 /tmp/cosplan_cache/
