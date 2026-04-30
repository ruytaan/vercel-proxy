// api/proxy.js
const { createProxyMiddleware } = require("http-proxy-middleware");

const TARGET_MAP = {
  "/proxy/m/": "https://m.zingmp3.vn",
  "/proxy/zing/": "https://zingmp3.vn",
  "/proxy/api/": "https://api.zingmp3.vn",
  "/proxy/streaming/": "https://streaming.zingmp3.vn",
  "/proxy/photo/": "https://photo-zmp3.zmdcdn.me",
  "/proxy/static/": "https://static-zmp3.zmdcdn.me",
};

module.exports = (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    return res.status(204).end();
  }

  let target = "https://zingmp3.vn";
  let newPath = req.url;

  for (const [prefix, url] of Object.entries(TARGET_MAP)) {
    if (req.url.startsWith(prefix)) {
      target = url;
      newPath = req.url.replace(prefix, "/");
      break;
    }
  }

  req.url = newPath;

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    
    onProxyRes: (proxyRes, req, res) => {
      proxyRes.headers["access-control-allow-origin"] = "*";
      proxyRes.headers["access-control-allow-methods"] = "*";
      proxyRes.headers["access-control-allow-headers"] = "*";
    },
    
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)");
      proxyReq.setHeader("Referer", "https://m.zingmp3.vn");
    },
    
  })(req, res);
};
