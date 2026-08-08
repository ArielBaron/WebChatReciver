const vscode = require('vscode');
const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const PORT = process.env.PORT;
console.log('cwd:', process.cwd());
console.log('__dirname:', __dirname);
console.log('.env path:', path.join(__dirname, '.env'));
console.log('.env exists:', require('fs').existsSync(path.join(__dirname, '.env')));
console.log('PORT:', process.env.PORT);
let server;

const EXTENSION_ALIASES = {
  yaml: ['yaml', 'yml'],
};

function normalizeBaseName(name) {
  return name
    .toLowerCase()
    .replace(/[\s_\-]+/g, '');
}

function matchesExtension(label, actualExt) {
  const normalized = label.toLowerCase();
  const aliases = EXTENSION_ALIASES[normalized] || [normalized];
  return aliases.includes(actualExt);
}

async function findMatchingFile(title, language) {
  if (!title || !language) return null;

  const normalizedTitle = normalizeBaseName(title);
  const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');

  for (const fileUri of files) {
    const fileName = fileUri.path.split('/').pop();
    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex === -1) continue;

    const baseName = fileName.slice(0, dotIndex);
    const actualExt = fileName.slice(dotIndex + 1).toLowerCase();

    if (normalizeBaseName(baseName) === normalizedTitle && matchesExtension(language, actualExt)) {
      return fileUri;
    }
  }

  return null;
}

function activate(context) {
  console.log('im on');

  server = http.createServer((req, res) => {
    console.log('\n--- Incoming Request ---');
    console.log('Method:', req.method);
    console.log('URL:', req.url);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });

    req.on('end', () => {
      console.log('--- body ---');
      console.log(body);
      console.log('--- end body ---');

      (async () => {
        try {
          const json = JSON.parse(body);
          const code = json.code;
          const title = json.title;
          const language = json.language;
          const mode = json.mode || 'match';

          let targetDoc;

          if (mode === 'active') {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
              console.log('mode=active but no active editor — nothing to do');
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({ status: 'error', message: 'no active editor' }));
              return;
            }
            targetDoc = editor.document;
          } else {
            // mode === 'match' — find by name, or fail clearly. No silent fallback.
            const matchedUri = await findMatchingFile(title, language);
            if (!matchedUri) {
              console.log(`no file matching "${title}" (${language}) found in workspace`);
              res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              res.end(JSON.stringify({
                status: 'error',
                message: `No file matching "${title}" (${language}) found in workspace`,
              }));
              return;
            }
            console.log('matched file by name:', matchedUri.path);
            targetDoc = await vscode.workspace.openTextDocument(matchedUri);
            await vscode.window.showTextDocument(targetDoc);
          }

          const editor = vscode.window.activeTextEditor;
          const fullRange = new vscode.Range(
            targetDoc.positionAt(0),
            targetDoc.positionAt(targetDoc.getText().length)
          );

          await editor.edit((editBuilder) => {
            editBuilder.replace(fullRange, code);
          });

          console.log('edit applied');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'ok' }));
        } catch (err) {
          console.log('error handling request:', err.message);
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        }
      })();
    });
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`Insert Bridge server listening on http://127.0.0.1:${PORT}`);
  });

  context.subscriptions.push({
    dispose: () => {
      server.close();
    },
  });
}

function deactivate() {
  if (server) {
    server.close();
  }
}

module.exports = {
  activate,
  deactivate,
};