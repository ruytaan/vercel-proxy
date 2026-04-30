// api/proxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

const TARGET_MAP = {
  "/proxy/m/": "https://m.zingmp3.vn",
  "/proxy/zing/": "https://zingmp3.vn",
  "/proxy/api/": "https://api.zingmp3.vn",
  "/proxy/streaming/": "https://streaming.zingmp3.vn",
  "/proxy/photo/": "https://photo-zmp3.zmdcdn.me",
  "/proxy/photo-resize/": "https://photo-resize-zmp3.zmdcdn.me",
  "/proxy/static/": "https://static-zmp3.zmdcdn.me",
  "/proxy/zjs/": "https://zjs.zmdcdn.me",
  "/proxy/zads/": "https://zads.zmdcdn.me",
};

module.exports = (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Max-Age", "86400");
    return res.status(204).end();
  }

  let target = null;
  let newPath = req.url;

  for (const [prefix, url] of Object.entries(TARGET_MAP)) {
    if (req.url.startsWith(prefix)) {
      target = url;
      newPath = req.url.replace(prefix, "/");
      break;
    }
  }

  if (!target) {
    return res.status(404).json({ error: "Unknown proxy target" });
  }

  req.url = newPath;

  console.log(`[Proxy] ${req.method} ${newPath} → ${target}`);

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    
    onProxyRes: (proxyRes, req, res) => {
      // CORS headers
      proxyRes.headers["access-control-allow-origin"] = "*";
      proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD";
      proxyRes.headers["access-control-allow-headers"] = "*";
      proxyRes.headers["access-control-allow-credentials"] = "true";
      proxyRes.headers["access-control-expose-headers"] = "*";
      
      // Xóa header bảo mật
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["content-security-policy-report-only"];
      delete proxyRes.headers["strict-transport-security"];
      
      // Rewrite redirect
      const location = proxyRes.headers.location;
      if (location) {
        proxyRes.headers.location = rewriteToProxy(location);
      }
    },
    
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15");
      proxyReq.setHeader("Referer", "https://m.zingmp3.vn");
      proxyReq.setHeader("Origin", "https://m.zingmp3.vn");
      
      proxyReq.removeHeader("sec-fetch-site");
      proxyReq.removeHeader("sec-fetch-mode");
      proxyReq.removeHeader("sec-fetch-dest");
    },
    
    cookieDomainRewrite: {
      "*": "",
    },
    
  })(req, res);
};

function rewriteToProxy(url) {
  if (!url || !url.startsWith("http")) return url;
  
  const TARGET_MAP = {
    "https://m.zingmp3.vn": "/proxy/m",
    "https://zingmp3.vn": "/proxy/zing",
    "https://api.zingmp3.vn": "/proxy/api",
    "https://streaming.zingmp3.vn": "/proxy/streaming",
    "https://photo-zmp3.zmdcdn.me": "/proxy/photo",
    "https://photo-resize-zmp3.zmdcdn.me": "/proxy/photo-resize",
    "https://static-zmp3.zmdcdn.me": "/proxy/static",
    "https://zjs.zmdcdn.me": "/proxy/zjs",
    "https://zads.zmdcdn.me": "/proxy/zads",
  };
  
  for (const [original, proxyPath] of Object.entries(TARGET_MAP)) {
    if (url.startsWith(original)) {
      return url.replace(original, "https://security4all.vercel.app" + proxyPath);
    }
  }
  return url;
}
