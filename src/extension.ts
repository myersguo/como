import * as vscode from 'vscode';

type ProxyConfig = {
    host: string | undefined;
    port: number | undefined;
    protocol: string | undefined;
};

let huggingFaceToken: string | undefined = undefined;
let proxyConfig: ProxyConfig | undefined = undefined;


const statusBarItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left
);

export function activate(context: vscode.ExtensionContext) {
  const setTokenCommand = vscode.commands.registerCommand(
    'como.setHuggingFaceToken',
    async () => {
      const token = await vscode.window.showInputBox({
        prompt: 'Enter your HuggingFace token',
        ignoreFocusOut: true,
      });

      if (token) {
        huggingFaceToken = token;
        vscode.workspace
          .getConfiguration('como')
          .update('huggingFaceToken', token, true);
        statusBarItem.text = 'HuggingFace token set';
        setTimeout(() => {
          statusBarItem.hide();
        }, 3000);
      }
    }
  );


  const setProxyCommand = vscode.commands.registerCommand(
    'como.setHuggingProxy',
    async () => {
      const proxy = await vscode.window.showInputBox({
        prompt: 'Enter proxy address (e.g. http://127.0.0.1:1080)',
        ignoreFocusOut: true,
      });
      if (proxy) {
        try {
          const proxyUrl = new URL(proxy);
          proxyConfig = {
            host: proxyUrl.hostname,
            port: proxyUrl.port ? parseInt(proxyUrl.port) : undefined,
            protocol: proxyUrl.protocol.substring(0, 4)
          };

          vscode.workspace.getConfiguration('como').update('proxy', proxy, true);
          statusBarItem.text = 'Proxy set';
          setTimeout(() => {
            statusBarItem.hide();
          }, 3000);
        } catch (error) {
          vscode.window.showErrorMessage('Invalid proxy address');
        }
      }
    }
  );


   context.subscriptions.push(setTokenCommand);
   context.subscriptions.push(setProxyCommand);

  huggingFaceToken =
    vscode.workspace.getConfiguration('como').get('huggingFaceToken') ||
    undefined;
    proxyConfig =
      vscode.workspace.getConfiguration('como').get('proxy') || undefined;
  if (!huggingFaceToken) {
    statusBarItem.text = '$(warning) HuggingFace token not set';
    statusBarItem.command = 'como.setHuggingFaceToken';
    statusBarItem.tooltip = 'Click to set your HuggingFace token';
    statusBarItem.show();
  }

  const provider = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**' },
    {
      provideInlineCompletionItems: async (document, position) => {
        console.log('Providing inline completion items...');

        const lineText = document.lineAt(position.line).text;
        const prefixLines = [lineText];
        for (let i = position.line - 1; i >= 0; i--) {
          prefixLines.unshift(document.lineAt(i).text);
          if (prefixLines.length === 4) {
            break;
          }
        }
        const prefix = prefixLines.join('\n');

        if (!huggingFaceToken) {
          console.log('HuggingFace token not set, skipping request.');
          return [];
        }

        statusBarItem.text = '$(sync~spin) Requesting completions...';
        statusBarItem.show();
        if

        try {
          const axios = require('axios-https-proxy-fix');
           const axiosInstance = axios.create({
             proxy: {
                 host: proxyConfig?.host,
                port: proxyConfig?.port,
                protocol: proxyConfig?.protocol || 'http',
             },
           });

          const response = await axiosInstance.post(
            'https://api-inference.huggingface.co/models/bigcode/starcoder/',
            {
              inputs: prefix,
              parameters: {
                do_sample: true,
                max_new_tokens: 256,
                repetition_penalty: 1.0,
                return_full_text: true,
                stop: [],
                seed: 42,
                temperature: 0.9,
                top_k: null,
                top_p: 0.95,
                truncate: null,
                typical_p: null,
                best_of: null,
                watermark: false,
                details: true,
              },
              stream: false,
            },
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${huggingFaceToken}`,
              },
            }
          );
          statusBarItem.text = `Completions received ${response.data[0].generated_text.length}`;
          statusBarItem.show();
          const final_suggest = response.data[0].generated_text.startsWith(prefix)? response.data[0].generated_text.substring(prefix.length): response.data[0].generated_text;
          return [
            {
              text: final_suggest,
              insertText: final_suggest,
              range: new vscode.Range(position, position),
            },
          ];
        } catch (error) {
          console.error('Error fetching completions:', error);
          statusBarItem.text = '$(sync~spin) ${error}';
          statusBarItem.show();
          return [];
        }
      },
    }
  );

  context.subscriptions.push(provider);
}

export function deactivate() {}
