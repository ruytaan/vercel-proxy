const httpProxy = require("http-proxy");
const proxy = httpProxy.createProxyServer({});

// Intercept tất cả requests dựa trên referer/origin
module.exports = (req, res) => {
  const referer = req.headers.referer || "";
  let target = "https://www.youtube.com";
  
  // Nếu request đến từ accounts page
  if (referer.includes("accounts.youtube") || req.url.includes("ServiceLogin")) {
    target = "https://accounts.youtube.com";
  }
  // Nếu là request static từ google
  else if (req.url.includes("google.com") || req.url.includes("gstatic")) {
    target = "https://www.google.com";
  }

  proxy.web(req, res, { 
    target, 
    changeOrigin: true,
    autoRewrite: true,      // Tự động rewrite location headers
    protocolRewrite: "https",
    cookieDomainRewrite: {
      "*": ""  // Rewrite cookie domain để tránh lỗi cookie cross-domain
    }
  });
};
