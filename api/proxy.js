const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

const PROXY_DOMAIN = "https://security4all.vercel.app";

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

// Script inject vào HTML để patch fetch/XHR trong browser
const INJECT_SCRIPT = `
<script>
(function(){
  const PROXY="${PROXY_DOMAIN}";
  const MAP={"https://zingmp3.vn":"/proxy/zing","https://api.zingmp3.vn":"/proxy/api","https://streaming.zingmp3.vn":"/proxy/streaming","https://static-zmp3.zmdcdn.me":"/proxy/static","https://photo-zmp3.zmdcdn.me":"/proxy/photo","https://photo-resize-zmp3.zmdcdn.me":"/proxy/photo-resize","https://zjs.zmdcdn.me":"/proxy/zjs","https://zads.zmdcdn.me":"/proxy/zads"};
  function R(u){if(typeof u!=='string')return u;for(const[d,p]of Object.entries(MAP))if(u.startsWith(d))return u.replace(d,PROXY+p);return u}
  const f=window.fetch;window.fetch=function(u,o){return f(R(u),o)};
  const x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return x.call(this,m,R(u))};
  const w=window.WebSocket;window.WebSocket=function(u,p){return new w(R(u),p)};
  const c=document.createElement;document.createElement=function(t){const e=c.call(document,t);if(['img','script','link','audio','video','source'].includes(t.toLowerCase())){const s=e.setAttribute;e.setAttribute=function(n,v){if(['src','href','data-src','poster'].includes(n))v=R(v);return s.call(this,n,v)}}return e};
})();
</script>
`;

function rewriteToProxy(url) {
  if (!url || !url.startsWith("http")) return url;
  for (const [original, proxyPath] of Object.entries(REVERSE_MAP)) {
    if (url.startsWith(original)) {
      return url.replace(original, PROXY_DOMAIN + proxyPath);
    }
  }
  return url;
}

function rewriteDomainInHtml(html) {
  // Rewrite tất cả domain Zing thành proxy
  html = html.replace(/https:\/\/zingmp3\.vn/g, PROXY_DOMAIN + "/proxy/zing");
  html = html.replace(/https:\/\/api\.zingmp3\.vn/g, PROXY_DOMAIN + "/proxy/api");
  html = html.replace(/https:\/\/streaming\.zingmp3\.vn/g, PROXY_DOMAIN + "/proxy/streaming");
  html = html.replace(/https:\/\/static-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + "/proxy/static");
  html = html.replace(/https:\/\/photo-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + "/proxy/photo");
  html = html.replace(/https:\/\/photo-resize-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + "/proxy/photo-resize");
  html = html.replace(/https:\/\/zjs\.zmdcdn\.me/g, PROXY_DOMAIN + "/proxy/zjs");
  html = html.replace(/https:\/\/zads\.zmdcdn\.me/g, PROXY_DOMAIN + "/proxy/zads");
  
  // Rewrite relative URL /api/ → /proxy/api/
  html = html.replace(/"\/api\//g, '"/proxy/api/');
  html = html.replace(/'\/api\//g, "'/proxy/api/");
  
  return html;
}

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
  const urlObj = new URL(fullUrl, `https://${req.headers.host || "localhost"}`);
  const urlPath = urlObj.pathname;
  
  let target = null;
  let newPath = fullUrl;

  // Cách 1: Tìm theo prefix /proxy/xxx/
  const proxyMatch = urlPath.match(/^\/proxy\/([^\/]+)\/(.*)/);
  if (proxyMatch) {
    const proxyName = proxyMatch[1];
    const remainingPath = proxyMatch[2];
    
    if (TARGET_MAP[proxyName]) {
      target = TARGET_MAP[proxyName];
      newPath = "/" + remainingPath + urlObj.search;
    }
  }

  // Cách 2: Query params target=xxx&path=xxx
  if (!target) {
    const targetParam = urlObj.searchParams.get("target");
    const pathParam = urlObj.searchParams.get("path");
    
    if (targetParam && TARGET_MAP[targetParam]) {
      target = TARGET_MAP[targetParam];
      const newSearch = new URLSearchParams();
      for (const [key, value] of urlObj.searchParams) {
        if (key !== "target" && key !== "path") {
          newSearch.append(key, value);
        }
      }
      const query = newSearch.toString();
      newPath = "/" + (pathParam || "") + (query ? "?" + query : "");
    }
  }

  // Cách 3: Fallback subdomain
  if (!target) {
    const host = req.headers.host || "";
    const subdomain = host.split('.')[0];
    target = TARGET_MAP[subdomain];
  }

  // Cách 4: Root path → redirect
  if (!target && (urlPath === "/" || urlPath === "")) {
    return res.redirect(302, "/proxy/zing/");
  }

  if (!target) {
    return res.status(404).json({ 
      error: "Unknown proxy target",
      url: req.url,
      hint: "Use /proxy/zing/ or ?target=api&path=xxx"
    });
  }

  req.url = newPath;

  console.log(`[Proxy] ${req.method} ${newPath} → ${target}`);

  // Kiểm tra nếu là request API/streaming (không cần rewrite HTML)
  const isApiRequest = urlPath.includes('/proxy/api/') || 
                       urlPath.includes('/proxy/streaming/') ||
                       urlPath.includes('/proxy/static/') ||
                       urlPath.includes('/proxy/photo/') ||
                       urlPath.includes('/proxy/zjs/') ||
                       urlPath.includes('/proxy/zads/');

  if (isApiRequest) {
    // Proxy trực tiếp không rewrite body
    return createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: true,
      followRedirects: false,
      
      onProxyRes: (proxyRes, req, res) => {
        proxyRes.headers["access-control-allow-origin"] = "*";
        proxyRes.headers["access-control-allow-methods"] = "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD";
        proxyRes.headers["access-control-allow-headers"] = "*";
        proxyRes.headers["access-control-allow-credentials"] = "true";
        
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
  }

  // HTML page request - rewrite body và inject script
  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    selfHandleResponse: true,
    
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      
      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD");
      res.setHeader("Access-Control-Allow-Headers", "*");
      
      // Nếu là HTML, rewrite và inject script
      if (contentType.includes('text/html')) {
        let body = responseBuffer.toString('utf8');
        
        // Rewrite domain trong HTML
        body = rewriteDomainInHtml(body);
        
        // Inject script patch fetch/XHR
        body = body.replace(/<head>/i, '<head>' + INJECT_SCRIPT);
        body = body.replace(/<HEAD>/i, '<HEAD>' + INJECT_SCRIPT);
        
        // Nếu không có <head>, chèn sau <html>
        if (!body.includes('<head') && !body.includes('<HEAD')) {
          body = body.replace(/<html[^>]*>/i, '$&' + INJECT_SCRIPT);
        }
        
        return body;
      }
      
      // Nếu là JS, rewrite domain
      if (contentType.includes('javascript') || urlPath.endsWith('.js')) {
        let body = responseBuffer.toString('utf8');
        body = rewriteDomainInHtml(body);
        return body;
      }
      
      // Các response khác (CSS, JSON, v.v.) giữ nguyên
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
