const { createProxyMiddleware } = require("http-proxy-middleware");

const TARGET_MAP = {
  "/m/": "https://m.zingmp3.vn",
  "/api/": "https://api.zingmp3.vn",
  "/streaming/": "https://streaming.zingmp3.vn",
  "/photo/": "https://photo-zmp3.zmdcdn.me",
  "/static/": "https://static-zmp3.zmdcdn.me",
};

module.exports = (req, res) => {
  const path = req.url;
  let target = "https://m.zingmp3.vn";
  
  for (const [prefix, url] of Object.entries(TARGET_MAP)) {
    if (path.startsWith(prefix)) {
      target = url;
      req.url = path.replace(prefix, "/");
      break;
    }
  }

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    
    onProxyReq: (proxyReq, req) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)");
      proxyReq.setHeader("Referer", "https://m.zingmp3.vn");
    },
    
  })(req, res);
};
