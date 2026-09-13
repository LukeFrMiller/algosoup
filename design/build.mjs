import fs from 'node:fs';
const css = fs.readFileSync('shared.css','utf8');
const navT = fs.readFileSync('nav.html','utf8');
const nav = (on) => navT.replace(/\{\{([A-D])\}\}/g,(_,k)=>k===on?'on':'');
for (const f of fs.readdirSync('.').filter(f=>f.endsWith('.body.html'))) {
  const name = f.replace('.body.html','');
  let body = fs.readFileSync(f,'utf8').replace(/<!--NAV:([A-D])-->/g,(_,k)=>nav(k));
  const out = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
  <style>
${css}
  </style>
</helmet>
${body}
</x-dc>
</body>
</html>
`;
  fs.writeFileSync(`${name}.dc.html`, out);
  console.log('built', name);
}
