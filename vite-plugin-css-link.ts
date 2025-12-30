import type { Plugin } from 'vite';

const cssFiles = new Map<string, string>();

export function cssLinkPlugin(): Plugin {
  return {
    name: 'css-link-plugin',
    enforce: 'post',
    transformIndexHtml(html) {
      try {
        const styleRegex = /<style[^>]*data-vite-dev-id="([^"]+)"[^>]*>([\s\S]*?)<\/style>/gs;
        const linkTags: string[] = [];
        let modifiedHtml = html;
        let match;

        const matches: Array<{ full: string; devId: string; content: string }> = [];
        
        while ((match = styleRegex.exec(html)) !== null) {
          matches.push({
            full: match[0],
            devId: match[1],
            content: match[2],
          });
        }

        for (const { full, devId, content } of matches) {
          const cleanId = devId.replace(/^\/root\/workspace\/client\//, '').replace(/^\//, '');
          const cssFileName = cleanId
            .replace(/\.scss$/, '.css')
            .replace(/\.module\.scss$/, '.module.css')
            .replace(/\//g, '-');
          const cssPath = `/css/${cssFileName}`;
          
          cssFiles.set(cssPath, content.trim());
          
          linkTags.push(`    <link rel="stylesheet" href="${cssPath}" data-vite-dev-id="${devId}">`);
          modifiedHtml = modifiedHtml.replace(full, '');
        }

        if (linkTags.length > 0) {
          const headEndIndex = modifiedHtml.indexOf('</head>');
          if (headEndIndex !== -1) {
            modifiedHtml = modifiedHtml.slice(0, headEndIndex) + '\n' + linkTags.join('\n') + '\n    ' + modifiedHtml.slice(headEndIndex);
          }
        }

        return modifiedHtml;
      } catch (error) {
        console.error('[css-link-plugin] Error:', error);
        return html;
      }
    },
    configureServer(server) {
      server.middlewares.use('/css', (req, res, next) => {
        try {
          const url = req.url || '';
          const cssPath = url.startsWith('/css/') ? url : `/css${url}`;
          const cssContent = cssFiles.get(cssPath);
          
          if (cssContent) {
            res.setHeader('Content-Type', 'text/css');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.end(cssContent);
          } else {
            res.statusCode = 404;
            res.end('CSS file not found');
          }
        } catch (error) {
          console.error('[css-link-plugin] Server error:', error);
          next();
        }
      });
    },
  };
}

