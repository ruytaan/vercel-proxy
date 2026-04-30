const { createProxyMiddleware } = require("http-proxy-middleware");

const TARGET_MAP = {
  "zing": "https://zingmp3.vn",
  "api": "https://api.zingmp3.vn",
  "streaming": "https://streaming.zingmp3.vn",
  "photo": "https://photo-zmp3.zmdcdn.me",
  "photo-resize": "https://photo-resize-zmp3.zmdcdn.me",
  "static": "https://static-zmp3.zmdcdn.me",
  "zjs": "https://zjs.zmdcdn.me",
  "zads": "https://zads.zmdcdn.me",
};

module.exports = (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(204).end();
  }

  const fullUrl = req.url || "";
  
  // Parse URL
  const urlObj = new URL(fullUrl, `https://${req.headers.host || "localhost"}`);
  const urlPath = urlObj.pathname;
  
  let target = null;
  let newPath = fullUrl;

  // Cách 1: Tìm theo prefix /proxy/xxx/ hoặc /proxy/xxx
  const proxyMatch = urlPath.match(/^\/proxy\/([^\/]+)\/?(.*)/);
  if (proxyMatch) {
    const proxyName = proxyMatch[1];
    const remainingPath = proxyMatch[2];
    
    if (TARGET_MAP[proxyName]) {
      target = TARGET_MAP[proxyName];
      newPath = "/" + remainingPath + urlObj.search;
      if (newPath === "/" && !remainingPath) {
        newPath = "/"; // Root của target
      }
    }
  }

  // Cách 2: Check query params target=xxx&path=xxx
  if (!target) {
    const targetParam = urlObj.searchParams.get("target");
    const pathParam = urlObj.searchParams.get("path");
    
    if (targetParam && TARGET_MAP[targetParam]) {
      target = TARGET_MAP[targetParam];
      newPath = "/" + (pathParam || "");
      
      const newSearchParams = new URLSearchParams();
      for (const [key, value] of urlObj.searchParams) {
        if (key !== "target" && key !== "path") {
          newSearchParams.append(key, value);
        }
      }
      const queryString = newSearchParams.toString();
      if (queryString) {
        newPath += "?" + queryString;
      }
    }
  }

  // Cách 3: Fallback subdomain
  if (!target) {
    const host = req.headers.host || "";
    const subdomain = host.split('.')[0];
    target = TARGET_MAP[subdomain];
  }

  // Cách 4: Root path → redirect về /proxy/zing/
  if (!target && (urlPath === "/" || urlPath === "")) {
    return res.redirect(302, "/proxy/zing/");
  }

  // Không tìm thấy target
  if (!target) {
    return res.status(404).json({ 
      error: "Unknown proxy target",
      url: req.url,
      path: urlPath,
      hint: "Use /proxy/zing/ or /proxy/zing or ?target=api&path=xxx"
    });
  }

  req.url = newPath;

  console.log(`[Proxy] ${req.method} ${newPath} → ${target}`);

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers["access-control-allow-origin"] = "*";
      proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD";
      proxyRes.headers["access-control-allow-headers"] = "*";
      proxyRes.headers["access-control-allow-credentials"] = "true";
      proxyRes.headers["access-control-expose-headers"] = "*";
      
      delete proxyRes.headers["x-frame-options"];
      delete proxyRes.headers["content-security-policy"];
      delete proxyRes.headers["content-security-policy-report-only"];
      delete proxyRes.headers["strict-transport-security"];
      
      const location = proxyRes.headers.location;
      if (location) {
        proxyRes.headers.location = rewriteToProxy(location);
      }
    },
    
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15");
      proxyReq.setHeader("Referer", "https://zingmp3.vn");
      proxyReq.setHeader("Origin", "https://zingmp3.vn");
      
      proxyReq.removeHeader("sec-fetch-site");
      proxyReq.removeHeader("sec-fetch-mode");
      proxyReq.removeHeader("sec-fetch-dest");
    },
    
    cookieDomainRewrite: { "*": "" },
    
  })(req, res);
};

function rewriteToProxy(url) {
  if (!url || !url.startsWith("http")) return url;
  
  const REVERSE_MAP = {
    "https://zingmp3.vn": "/proxy/zing",
    "https://api.zingmp3.vn": "/proxy/api",
    "https://streaming.zingmp3.vn": "/proxy/streaming",
    "https://photo-zmp3.zmdcdn.me": "/proxy/photo",
    "https://photo-resize-zmp3.zmdcdn.me": "/proxy/photo-resize",
    "https://static-zmp3.zmdcdn.me": "/proxy/static",
    "https://zjs.zmdcdn.me": "/proxy/zjs",
    "https://zads.zmdcdn.me": "/proxy/zads",
  };
  
  for (const [original, proxyPath] of Object.entries(REVERSE_MAP)) {
    if (url.startsWith(original)) {
      return url.replace(original, "https://security4all.vercel.app" + proxyPath);
    }
  }
  return url;
}
