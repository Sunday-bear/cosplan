import os
import time
import hashlib
import asyncio
from pathlib import Path
from typing import Optional
from concurrent.futures import ThreadPoolExecutor

import httpx

from config import get_settings


class PixivClient:
    """Pixiv 客户端 - 使用 cookie 直接访问（不需要 OAuth token）"""

    def __init__(self):
        self.settings = get_settings()
        self._executor = ThreadPoolExecutor(max_workers=2)
        self.cache_dir = Path(self.settings.cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Pixiv PHPSESSID - 从 Cookie 文件读取
        self._phpsessid = self._load_phpsessid()

    def _load_phpsessid(self) -> Optional[str]:
        """从环境变量或文件加载 PHPSESSID"""
        # 优先从环境变量
        if self.settings.pixiv_phpsessid:
            return self.settings.pixiv_phpsessid
        # 其次从文件
        cookie_file = self.settings.pixiv_cookie_file
        if cookie_file and Path(cookie_file).exists():
            return Path(cookie_file).read_text().strip()
        return None

    def _get_headers(self) -> dict:
        """获取请求头"""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": "https://www.pixiv.net/",
            "Accept": "application/json",
            "Accept-Language": "zh-CN,zh;q=0.9,ja;q=0.8",
        }

    def _get_cookies(self) -> dict:
        return {"PHPSESSID": self._phpsessid} if self._phpsessid else {}

    def _search_cosplay_sync(self, character: str, count: int = 3) -> list:
        """同步搜索角色 Cosplay 图片（使用网页版 Ajax API）"""
        if not self._phpsessid:
            raise ValueError("PHPSESSID 未配置，请设置 PIXIV_PHPSESSID 环境变量")

        import urllib.parse
        keyword = f"{character} コスプレ"
        encoded_keyword = urllib.parse.quote(keyword)
        
        url = f"https://www.pixiv.net/ajax/search/illustrations/{encoded_keyword}"
        params = {"word": keyword, "order": "popular_d", "mode": "all", "p": 1, "s_mode": "s_tag_full"}
        
        response = httpx.get(
            url,
            params=params,
            headers=self._get_headers(),
            cookies=self._get_cookies(),
            timeout=15,
        )
        
        if response.status_code != 200:
            print(f"搜索失败: {response.status_code}")
            return []
        
        data = response.json()
        if data.get("error"):
            print(f"搜索 API 返回错误: {data}")
            return []
        
        illusts = data.get("body", {}).get("illust", {}).get("data", [])
        images = []
        
        for illust in illusts:
            if len(images) >= count:
                break
            
            # 过滤 R18
            if illust.get("xRestrict", 0) != 0:
                continue
            
            # 获取图片 URL
            thumbnails = illust.get("urls", {})
            thumb_url = thumbnails.get("1200x1200_standard", thumbnails.get("540x540", ""))
            
            illust_id = illust.get("id", 0)
            image_info = {
                "id": illust_id,
                "title": illust.get("title", ""),
                "author": illust.get("userName", ""),
                "author_id": illust.get("userId", 0),
                "url": f"/api/image/{illust_id}_0",
                "thumb_url": thumb_url,
                "page_url": f"https://www.pixiv.net/artworks/{illust_id}",
                "bookmark_count": illust.get("bookmarkCount", 0) or illust.get("likeCount", 0),
                "tags": illust.get("tags", []) if isinstance(illust.get("tags", []), list) else [],
                "width": illust.get("width", 0),
                "height": illust.get("height", 0),
            }
            images.append(image_info)
        
        return images

    async def search_cosplay(self, character: str, count: int = 3) -> list:
        """异步搜索"""
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, self._search_cosplay_sync, character, count
        )

    def _get_image_sync(self, image_id: str) -> Optional[bytes]:
        """同步获取图片（带缓存）"""
        # 检查缓存
        cache_key = hashlib.md5(image_id.encode()).hexdigest()
        cache_path = self.cache_dir / cache_key
        if cache_path.exists():
            return cache_path.read_bytes()

        parts = image_id.split("_")
        illust_id = parts[0]
        
        # 通过 Pixiv Ajax API 获取作品详情
        url = f"https://www.pixiv.net/ajax/illust/{illust_id}"
        response = httpx.get(
            url,
            headers=self._get_headers(),
            cookies=self._get_cookies(),
            timeout=15,
        )
        
        if response.status_code != 200:
            return None
        
        data = response.json()
        if data.get("error"):
            return None
        
        body = data.get("body", {})
        
        # 获取原图 URL
        page_index = int(parts[1]) if len(parts) > 1 else 0
        meta_pages = body.get("metaPages", [])
        
        original_url = ""
        if meta_pages and page_index < len(meta_pages):
            original_url = meta_pages[page_index].get("imageUrls", {}).get("original", "")
        else:
            urls = body.get("urls", {})
            original_url = urls.get("original", urls.get("large", ""))
        
        if not original_url:
            return None

        # 下载图片（使用 Pixiv Referer）
        headers = {
            "Referer": "https://www.pixiv.net/",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        }
        img_resp = httpx.get(original_url, headers=headers, timeout=30)
        if img_resp.status_code != 200:
            return None

        content = img_resp.content
        cache_path.write_bytes(content)
        return content

    async def get_image(self, image_id: str) -> Optional[bytes]:
        """异步获取图片"""
        return await asyncio.get_event_loop().run_in_executor(
            self._executor, self._get_image_sync, image_id
        )

    def cleanup_cache(self, max_age_hours: int = 24):
        """清理过期缓存"""
        now = time.time()
        for f in self.cache_dir.iterdir():
            if f.is_file() and (now - f.stat().st_mtime) > max_age_hours * 3600:
                f.unlink()
