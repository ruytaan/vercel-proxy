const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

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

const PROXY_DOMAIN = "https://security4all.vercel.app";

module.exports = (req, res) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    return res.status(204).end();
  }

  const fullUrl = req.url || "";
  const urlObj = new URL(fullUrl, `https://${req.headers.host || "localhost"}`);
  const urlPath = urlObj.pathname;
  
  let target = null;
  let newPath = fullUrl;

  const proxyMatch = urlPath.match(/^\/proxy\/([^\/]+)\/?(.*)/);
  if (proxyMatch) {
    const proxyName = proxyMatch[1];
    const remainingPath = proxyMatch[2];
    
    if (TARGET_MAP[proxyName]) {
      target = TARGET_MAP[proxyName];
      newPath = "/" + remainingPath + urlObj.search;
      if (newPath === "/" && !remainingPath) {
        newPath = "/";
      }
    }
  }

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

  if (!target) {
    const host = req.headers.host || "";
    const subdomain = host.split('.')[0];
    target = TARGET_MAP[subdomain];
  }

  if (!target && (urlPath === "/" || urlPath === "")) {
    return res.redirect(302, "/proxy/zing/");
  }

  if (!target) {
    return res.status(404).json({ 
      error: "Unknown proxy target",
      url: req.url,
      path: urlPath,
      hint: "Use /proxy/zing/ or ?target=api&path=xxx"
    });
  }

  req.url = newPath;

  console.log(`[Proxy] ${req.method} ${newPath} → ${target}`);

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    
    // QUAN TRỌNG: Tự xử lý response để rewrite HTML
    selfHandleResponse: true,
    
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      
      // CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      
      // Nếu là HTML, inject script và rewrite URL
      if (contentType.includes('text/html')) {
        let body = responseBuffer.toString('utf8');
        
        // Inject proxy intercept script ngay sau <head>
        const injectScript = `
<script>
(function(){
  const PROXY="${PROXY_DOMAIN}";
  const MAP={"https://zingmp3.vn":"/proxy/zing","https://api.zingmp3.vn":"/proxy/api","https://streaming.zingmp3.vn":"/proxy/streaming","https://static-zmp3.zmdcdn.me":"/proxy/static","https://photo-zmp3.zmdcdn.me":"/proxy/photo","https://photo-resize-zmp3.zmdcdn.me":"/proxy/photo-resize","https://zjs.zmdcdn.me":"/proxy/zjs","https://zads.zmdcdn.me":"/proxy/zads"};
  function r(u){for(const[d,p]of Object.entries(MAP))if(u.startsWith(d))return u.replace(d,PROXY+p);return u}
  const o=window.fetch;window.fetch=function(u,opt){return o(r(u),opt)};
  const x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return x.call(this,m,r(u))};
  const c=document.createElement;document.createElement=function(t){const e=c.call(document,t);if(['img','script','link','audio','video','source'].includes(t.toLowerCase())){const s=e.setAttribute;e.setAttribute=function(n,v){if(['src','href','data-src','poster'].includes(n))v=r(v);return s.call(this,n,v)}}return e};
})();
</script>`;
        
        body = body.replace(/<head>/i, '<head>' + injectScript);
        body = body.replace(/<head\s+[^>]*>/i, '$&' + injectScript);
        
        // Rewrite tất cả URL trong HTML
        body = body.replace(/https:\/\/zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/zing');
        body = body.replace(/https:\/\/api\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/api');
        body = body.replace(/https:\/\/streaming\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/streaming');
        body = body.replace(/https:\/\/static-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/static');
        body = body.replace(/https:\/\/photo-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo');
        body = body.replace(/https:\/\/photo-resize-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo-resize');
        body = body.replace(/https:\/\/zjs\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zjs');
        body = body.replace(/https:\/\/zads\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zads');
        
        // Rewrite URL trong JSON/script cũng
        body = body.replace(/"https:\\\/\\\/zingmp3\.vn\\\/"/g, '"' + PROXY_DOMAIN.replace(/\//g, '\\/') + '\\/proxy\\/zing\\/');
        body = body.replace(/'https:\\\/\\\/zingmp3\.vn\\\/'/g, "'" + PROXY_DOMAIN.replace(/\//g, '\\/') + '\\/proxy\\/zing\\/');
        
        return body;
      }
      
      // Nếu là JS, rewrite URL trong code
      if (contentType.includes('javascript') || contentType.includes('json')) {
        let body = responseBuffer.toString('utf8');
        
        body = body.replace(/https:\/\/zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/zing');
        body = body.replace(/https:\/\/api\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/api');
        body = body.replace(/https:\/\/streaming\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/streaming');
        body = body.replace(/https:\/\/static-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/static');
        body = body.replace(/https:\/\/photo-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo');
        body = body.replace(/https:\/\/photo-resize-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo-resize');
        body = body.replace(/https:\/\/zjs\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zjs');
        body = body.replace(/https:\/\/zads\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zads');
        
        return body;
      }
      
      return responseBuffer;
    }),
    
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
