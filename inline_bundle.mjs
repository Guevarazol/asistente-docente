import fs from 'fs';
import path from 'path';

const projectDir = 'C:\\Users\\oscar\\.gemini\\antigravity\\scratch\\estudio-creativo';
const distDir = path.join(projectDir, 'dist');
const assetsDir = path.join(distDir, 'assets');
const publicDir = path.join(projectDir, 'public');

// Find the CSS and JS files in dist/assets
const files = fs.readdirSync(assetsDir);
const cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css'));
const jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js'));

if (!cssFile || !jsFile) {
  console.error('Could not find bundle files:', { cssFile, jsFile });
  process.exit(1);
}

const cssContent = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
let jsContent = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
const htmlTemplate = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

// Base64-encode public images so the single HTML file is 100% standalone offline
const imagesToEmbed = [
  { url: '/assets/casm-logo.png', file: path.join(publicDir, 'assets', 'casm-logo.png'), mime: 'image/png' },
  { url: '/assets/aistudio/Logo_largo_renova_5b497c22.png', file: path.join(publicDir, 'assets', 'aistudio', 'Logo_largo_renova_5b497c22.png'), mime: 'image/png' },
  { url: '/assets/renova-logo.png', file: path.join(publicDir, 'assets', 'renova-logo.png'), mime: 'image/png' },
  { url: '/assets/escudo-elsalvador.png', file: path.join(publicDir, 'assets', 'escudo-elsalvador.png'), mime: 'image/png' },
];

for (const img of imagesToEmbed) {
  if (fs.existsSync(img.file)) {
    const b64 = fs.readFileSync(img.file).toString('base64');
    const dataUrl = `data:${img.mime};base64,${b64}`;
    jsContent = jsContent.split(img.url).join(dataUrl);
  }
}

// Replace CSS link with inline <style> using a function to avoid $-token expansion
let singleHtml = htmlTemplate.replace(
  /<link rel="stylesheet"[^>]*href="\/assets\/[^"]*"[^>]*>/,
  () => `<style>\n${cssContent}\n</style>`
);

// Protect HTML tokenizer against premature closing of script tags and comment state collisions
const safeJs = jsContent
  .replace(/<\/script/gi, '<\\/script')
  .replace(/<script/gi, '<\\script')
  .replace(/<!--/g, '<\\!--');

// Remove external script link from head
singleHtml = singleHtml.replace(
  /<script type="module"[^>]*src="\/assets\/[^"]*"[^>]*><\/script>/,
  ''
);

// Append inline script right before </body> using string slice (never String.replace, to avoid $-token expansion)
const bodyCloseIndex = singleHtml.lastIndexOf('</body>');
if (bodyCloseIndex !== -1) {
  singleHtml =
    singleHtml.slice(0, bodyCloseIndex) +
    `<script type="module">\n${safeJs}\n</script>\n` +
    singleHtml.slice(bodyCloseIndex);
} else {
  singleHtml += `<script type="module">\n${safeJs}\n</script>`;
}

const outPathRoot = path.join(projectDir, 'CASM_Docente_Prueba.html');
const outPathPublic = path.join(publicDir, 'CASM_Docente_Prueba.html');
const outPathAsistenteRoot = path.join(projectDir, 'Asistente_Docente.html');
const outPathAsistentePublic = path.join(publicDir, 'Asistente_Docente.html');

fs.writeFileSync(outPathRoot, singleHtml, 'utf8');
fs.writeFileSync(outPathPublic, singleHtml, 'utf8');
fs.writeFileSync(outPathAsistenteRoot, singleHtml, 'utf8');
fs.writeFileSync(outPathAsistentePublic, singleHtml, 'utf8');

console.log('Single self-contained HTML generated successfully!');
console.log('Root destination:', outPathRoot);
console.log('Asistente Docente destination:', outPathAsistenteRoot);
console.log('File size:', (singleHtml.length / (1024 * 1024)).toFixed(2), 'MB');
