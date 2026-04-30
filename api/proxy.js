const { createProxyMiddleware, responseInterceptor } = require("http-proxy-middleware");

const TARGET_MAP = {
  "zing": "https://zingmp3.vn",
  "api": "https://api.zingmp3.vn",
  "ac": "https://ac.zingmp3.vn",
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
      if (newPath === "/" && !remainingPath) newPath = "/";
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
        if (key !== "target" && key !== "path") newSearchParams.append(key, value);
      }
      const queryString = newSearchParams.toString();
      if (queryString) newPath += "?" + queryString;
    }
  }

  if (!target) {
    const host = req.headers.host || "";
    const subdomain = host.split('.')[0];
    target = TARGET_MAP[subdomain];
  }

  if (!target && (urlPath === "/" || urlPath === "")) {
    // Trả về trang loader thay vì redirect
    return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Zing MP3 Proxy</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; }
    #loader { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #170f23; display: flex; align-items: center; justify-content: center; color: white; z-index: 9999; }
    #content { width: 100%; height: 100vh; border: none; }
  </style>
</head>
<body>
  <div id="loader">Loading Zing MP3...</div>
  <div id="content"></div>
  
  <script>
    (function(){
      const PROXY = "${PROXY_DOMAIN}";
      
      // Load Zing HTML qua proxy
      fetch(PROXY + "/proxy/zing/")
        .then(r => r.text())
        .then(html => {
          // Rewrite tất cả URL trong HTML
          html = html.replace(/https:\\/\\/zingmp3\\.vn/g, PROXY + "/proxy/zing");
          html = html.replace(/https:\\/\\/api\\.zingmp3\\.vn/g, PROXY + "/proxy/api");
          html = html.replace(/https:\\/\\/ac\\.zingmp3\\.vn/g, PROXY + "/proxy/ac");
          html = html.replace(/https:\\/\\/streaming\\.zingmp3\\.vn/g, PROXY + "/proxy/streaming");
          html = html.replace(/https:\\/\\/static-zmp3\\.zmdcdn\\.me/g, PROXY + "/proxy/static");
          html = html.replace(/https:\\/\\/photo-zmp3\\.zmdcdn\\.me/g, PROXY + "/proxy/photo");
          html = html.replace(/https:\\/\\/photo-resize-zmp3\\.zmdcdn\\.me/g, PROXY + "/proxy/photo-resize");
          html = html.replace(/https:\\/\\/zjs\\.zmdcdn\\.me/g, PROXY + "/proxy/zjs");
          html = html.replace(/https:\\/\\/zads\\.zmdcdn\\.me/g, PROXY + "/proxy/zads");
          
          // Inject script patch ngay đầu
          const patchScript = \`<script>
(function(){
  const P="${PROXY_DOMAIN}";
  const M={"https://zingmp3.vn":"/proxy/zing","https://api.zingmp3.vn":"/proxy/api","https://ac.zingmp3.vn":"/proxy/ac","https://streaming.zingmp3.vn":"/proxy/streaming","https://static-zmp3.zmdcdn.me":"/proxy/static","https://photo-zmp3.zmdcdn.me":"/proxy/photo","https://photo-resize-zmp3.zmdcdn.me":"/proxy/photo-resize","https://zjs.zmdcdn.me":"/proxy/zjs","https://zads.zmdcdn.me":"/proxy/zads"};
  function r(u){if(typeof u!=='string')return u;for(const[d,p]of Object.entries(M))if(u.startsWith(d))return u.replace(d,P+p);return u}
  
  // Override ALL network APIs
  const o=fetch;window.fetch=function(u,opt){return o(r(u),opt)};
  const x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){return x.call(this,m,r(u))};
  const w=WebSocket;window.WebSocket=function(u,p){return new w(r(u),p)};
  
  // Override createElement
  const c=document.createElement;document.createElement=function(t){
    const e=c.call(document,t);
    if(['img','script','link','audio','video','source','iframe'].includes(t.toLowerCase())){
      const s=e.setAttribute;e.setAttribute=function(n,v){
        if(['src','href','data-src','poster'].includes(n))v=r(v);
        return s.call(this,n,v)
      };
    }
    return e
  };
  
  console.log("[Proxy] Network APIs patched");
})();
<\\/script>\`;
          
          html = html.replace(/<head>/i, '<head>' + patchScript);
          
          // Render vào div
          document.getElementById('content').innerHTML = html;
          document.getElementById('loader').style.display = 'none';
          
          // Execute scripts
          const scripts = document.getElementById('content').querySelectorAll('script');
          scripts.forEach(s => {
            if (s.src) {
              const newScript = document.createElement('script');
              newScript.src = s.src;
              document.head.appendChild(newScript);
            } else {
              eval(s.textContent);
            }
          });
        });
    })();
  </script>
</body>
</html>
    `);
  }

  if (!target) {
    return res.status(404).json({ error: "Unknown proxy target", url: req.url });
  }

  req.url = newPath;

  createProxyMiddleware({
    target,
    changeOrigin: true,
    secure: true,
    followRedirects: false,
    selfHandleResponse: true,
    
    onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
      const contentType = proxyRes.headers['content-type'] || '';
      
      // Nếu là HTML, rewrite URL + inject script
      if (contentType.includes('text/html')) {
        let body = responseBuffer.toString('utf8');
        
        // Rewrite URL trong HTML
        body = body.replace(/https:\/\/zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/zing');
        body = body.replace(/https:\/\/api\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/api');
        body = body.replace(/https:\/\/ac\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/ac');
        body = body.replace(/https:\/\/streaming\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/streaming');
        body = body.replace(/https:\/\/static-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/static');
        body = body.replace(/https:\/\/photo-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo');
        body = body.replace(/https:\/\/photo-resize-zmp3\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/photo-resize');
        body = body.replace(/https:\/\/zjs\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zjs');
        body = body.replace(/https:\/\/zads\.zmdcdn\.me/g, PROXY_DOMAIN + '/proxy/zads');
        
        return body;
      }
      
      // Nếu là JS, rewrite URL
      if (contentType.includes('javascript')) {
        let body = responseBuffer.toString('utf8');
        body = body.replace(/https:\/\/zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/zing');
        body = body.replace(/https:\/\/api\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/api');
        body = body.replace(/https:\/\/ac\.zingmp3\.vn/g, PROXY_DOMAIN + '/proxy/ac');
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
