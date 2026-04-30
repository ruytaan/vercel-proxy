const { createProxyMiddleware } = require("http-proxy-middleware");

const TARGET_MAP = {
  "/m/": "https://m.zingmp3.vn",
  "/api/": "https://api.zingmp3.vn",
  "/streaming/": "https://streaming.zingmp3.vn",
  "/photo/": "https://photo-zmp3.zmdcdn.me",
  "/photo-resize/": "https://photo-resize-zmp3.zmdcdn.me",
  "/static/": "https://static-zmp3.zmdcdn.me",
  "/zjs/": "https://zjs.zmdcdn.me",
};

// Middleware CORS tùy chỉnh
const corsMiddleware = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept, Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400");
  
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
};

module.exports = (req, res) => {
  // Áp dụng CORS trước
  corsMiddleware(req, res, () => {
    const path = req.url;
    let target = "https://m.zingmp3.vn";
    let newPath = path;
    
    for (const [prefix, url] of Object.entries(TARGET_MAP)) {
      if (path.startsWith(prefix)) {
        target = url;
        newPath = path.replace(prefix, "/");
        break;
      }
    }
    
    req.url = newPath;

    console.log(`[PROXY] ${req.method} ${path} → ${target}${newPath}`);

    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: true,
      followRedirects: false,
      
      // TẮT buffer để xử lý stream real-time
      buffer: false,
      
      // Tùy chỉnh response
      onProxyRes: (proxyRes, req, res) => {
        // XÓA HẾT header CORS cũ của Zing
        delete proxyRes.headers["access-control-allow-origin"];
        delete proxyRes.headers["access-control-allow-methods"];
        delete proxyRes.headers["access-control-allow-headers"];
        delete proxyRes.headers["access-control-allow-credentials"];
        
        // SET LẠI CORS cho phép tất cả
        proxyRes.headers["access-control-allow-origin"] = "*";
        proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS";
        proxyRes.headers["access-control-allow-headers"] = "*";
        proxyRes.headers["access-control-allow-credentials"] = "true";
        proxyRes.headers["access-control-expose-headers"] = "*";
        
        // Xử lý redirect
        const location = proxyRes.headers.location;
        if (location) {
          proxyRes.headers.location = rewriteUrl(location);
        }
        
        // Set cache cho static assets
        if (path.includes("/static/") || path.includes("/photo/") || path.includes("/zjs/")) {
          proxyRes.headers["cache-control"] = "public, max-age=86400";
        }
      },
      
      onProxyReq: (proxyReq, req) => {
        // Giả lập request từ browser thật
        proxyReq.setHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        proxyReq.setHeader("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
        proxyReq.setHeader("Accept-Language", "vi-VN,vi;q=0.9,en;q=0.8");
        proxyReq.setHeader("Referer", "https://m.zingmp3.vn");
        proxyReq.setHeader("Origin", "https://m.zingmp3.vn");
        
        // Xóa header có thể gây lỗi
        proxyReq.removeHeader("sec-fetch-site");
        proxyReq.removeHeader("sec-fetch-mode");
        proxyReq.removeHeader("sec-fetch-dest");
      },
      
      onError: (err, req, res) => {
        console.error("Proxy error:", err.message);
        res.status(500).json({ error: "Proxy error", message: err.message });
      },
      
    })(req, res);
  });
};

function rewriteUrl(originalUrl) {
  if (!originalUrl || !originalUrl.startsWith("http")) return originalUrl;
  
  try {
    const parsed = new URL(originalUrl);
    const hostname = parsed.hostname;
    
    const map = {
      "m.zingmp3.vn": "/m/",
      "zingmp3.vn": "/m/",
      "api.zingmp3.vn": "/api/",
      "streaming.zingmp3.vn": "/streaming/",
      "photo-zmp3.zmdcdn.me": "/photo/",
      "photo-resize-zmp3.zmdcdn.me": "/photo-resize/",
      "static-zmp3.zmdcdn.me": "/static/",
      "zjs.zmdcdn.me": "/zjs/",
    };
    
    const prefix = map[hostname];
    if (!prefix) return originalUrl;
    
    return `https://security4all.vercel.app${prefix}${parsed.pathname}${parsed.search}`;
  } catch (e) {
    return originalUrl;
  }
}
