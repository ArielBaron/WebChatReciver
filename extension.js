const vscode = require('vscode');
const http = require('http');

const PORT = 37123;
let server;

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

      try {
        const json = JSON.parse(body);
        const code = json.code;

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          console.log('No active editor — nothing to replace');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ status: 'no active editor' }));
          return;
        }

        const fullRange = new vscode.Range(
          editor.document.positionAt(0),
          editor.document.positionAt(editor.document.getText().length)
        );

        editor.edit((editBuilder) => {
          editBuilder.replace(fullRange, code);
        }).then((success) => {
          console.log('edit applied:', success);
        });

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        console.log('error handling request:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
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