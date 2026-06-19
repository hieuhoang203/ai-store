const { spawn } = require('node:child_process');

const [, , mode, ...rest] = process.argv;
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const commands = {
  dev: [npmCommand, ['run', 'start:dev', ...rest]],
  debug: [npmCommand, ['run', 'start:debug', ...rest]],
  prod: [npmCommand, ['run', 'start:prod', ...rest]],
};

const [command, args] = commands[mode] || [npmCommand, ['run', 'start:dev', ...(mode ? [mode, ...rest] : rest)]];

const child = spawn(command, args, {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
