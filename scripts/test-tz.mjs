// Roda a suite inteira em varios fusos horarios (TZ). Sem dependencias.
import { spawnSync } from 'node:child_process';

const ZONES = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Pacific/Auckland'];
let failed = false;
const rows = [];

for (const tz of ZONES) {
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'src/**/*.test.ts'], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = `${r.stdout}\n${r.stderr}`;
  const n = (label) => Number((new RegExp(`^# ${label} (\\d+)`, 'm').exec(out) ?? [])[1] ?? NaN);
  const row = { tz, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped'), exit: r.status };
  rows.push(row);
  if (r.status !== 0 || row.fail !== 0 || Number.isNaN(row.tests)) {
    failed = true;
    console.error(out.split('\n').filter((l) => /^not ok|^\s+(error|message|name)/.test(l)).join('\n'));
  }
}

console.log('TZ'.padEnd(22), 'tests pass fail skipped exit');
for (const r of rows) console.log(r.tz.padEnd(22), String(r.tests).padStart(5), String(r.pass).padStart(4), String(r.fail).padStart(4), String(r.skipped).padStart(7), String(r.exit).padStart(4));
console.log(failed ? 'RESULTADO: FALHA' : 'RESULTADO: OK em todos os fusos');
process.exit(failed ? 1 : 0);
