import time
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel

from config import get_settings
from pixiv_client import PixivClient


# 全局客户端
client: PixivClient = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期"""
    global client
    client = PixivClient()
    yield
    # 清理
    client.cleanup_cache()


app = FastAPI(title="Cosplan Backend", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 请求模型
class SearchRequest(BaseModel):
    character: str
    count: int = 3


class ImageItem(BaseModel):
    id: int
    title: str
    author: str
    author_id: int
    url: str
    thumb_url: str
    page_url: str
    bookmark_count: int
    tags: list
    width: int
    height: int


class SearchResponse(BaseModel):
    success: bool
    character: str
    images: list
    error: str = ""


# 限流中间件
request_times = {}


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    settings = get_settings()

    # 限流只对 /search 生效
    if request.url.path == "/search":
        client_ip = request.client.host
        now = time.time()
        minute_ago = now - 60

        # 清理旧记录
        if client_ip in request_times:
            request_times[client_ip] = [
                t for t in request_times[client_ip] if t > minute_ago
            ]
        else:
            request_times[client_ip] = []

        if len(request_times.get(client_ip, [])) >= settings.rate_limit_per_min:
            return JSONResponse(
                status_code=429,
                content={"success": False, "error": "请求太频繁，请稍后再试"},
            )

        request_times.setdefault(client_ip, []).append(now)

    response = await call_next(request)
    return response


@app.get("/health")
async def health():
    """健康检查"""
    return {"status": "ok", "version": "1.0.0"}


@app.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """搜索指定角色的 Cosplay 图片"""
    global client

    character = req.character.strip()
    if not character:
        return SearchResponse(success=False, character="", images=[], error="角色名不能为空")

    count = max(1, min(req.count, 10))  # 限制 1-10 张

    try:
        images = await client.search_cosplay(character, count)
        return SearchResponse(
            success=True,
            character=character,
            images=images,
        )
    except ValueError as e:
        return SearchResponse(
            success=False,
            character=character,
            images=[],
            error=str(e),
        )
    except Exception as e:
        return SearchResponse(
            success=False,
            character=character,
            images=[],
            error=f"搜索失败: {str(e)}",
        )


@app.get("/api/image/{image_id}")
async def proxy_image(image_id: str):
    """代理返回 Pixiv 原图（处理防盗链）"""
    global client

    try:
        image_data = await client.get_image(image_id)
        if image_data is None:
            raise HTTPException(status_code=404, detail="图片未找到")

        # 根据内容判断 MIME 类型
        content_type = "image/jpeg"
        if image_data[:4] == b"\x89PNG":
            content_type = "image/png"
        elif image_data[:2] == b"\xff\xd8":
            content_type = "image/jpeg"
        elif image_data[:6] in (b"GIF87a", b"GIF89a"):
            content_type = "image/gif"
        elif image_data[:4] == b"RIFF":
            content_type = "image/webp"

        return Response(content=image_data, media_type=content_type)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取图片失败: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )
