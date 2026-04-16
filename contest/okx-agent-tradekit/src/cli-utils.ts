import { exec } from 'child_process';

interface CliCommandResult {
  success: boolean;
  data?: any;
  error?: string;
}

export async function runOkxCliCommand(command: string): Promise<CliCommandResult> {
  return new Promise((resolve) => {
    const cliPath = '/home/ubuntu/okx-agent-contest/vendor/agent-trade-kit/packages/cli/dist/index.js';
    const fullCommand = `node ${cliPath} --profile contest --json ${command}`;

    exec(fullCommand, (error, stdout, stderr) => {
      if (error) {
        console.error(`CLI Command Error: ${error.message}`);
        console.error(`CLI Stderr: ${stderr}`);
        resolve({ success: false, error: `CLI Error: ${error.message}, Stderr: ${stderr}` });
        return;
      }
      try {
        const jsonOutput = JSON.parse(stdout);
        resolve({ success: true, data: jsonOutput });
      } catch (parseError: any) {
        console.error(`Failed to parse JSON output: ${parseError.message}`);
        console.error(`Stdout: ${stdout}`);
        resolve({ success: false, error: `JSON parse error: ${parseError.message}, Stdout: ${stdout}` });
      }
    });
  });
}
