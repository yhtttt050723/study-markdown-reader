const { spawn } = require('child_process')
const path = require('path')
const net = require('net')

const rootDir = path.join(__dirname, '..')
const port = process.env.STUDY_READER_PORT || '5210'
const url = `http://127.0.0.1:${port}`

const WAIT_HOSTS = ['127.0.0.1', 'localhost', '::1']

function tryConnect(host) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection({ port: Number(port), host }, () => {
      s.destroy()
      resolve(host)
    })
    s.on('error', (err) => {
      s.destroy()
      reject(err)
    })
    s.setTimeout(2000, () => {
      s.destroy()
      reject(new Error('timeout'))
    })
  })
}

async function waitForDevServer(maxMs = 120000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    for (const host of WAIT_HOSTS) {
      try {
        const ok = await tryConnect(host)
        return ok
      } catch {
        /* try next host */
      }
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`timeout waiting for Vite on port ${port} (${WAIT_HOSTS.join(', ')})`)
}

let electronBin
try {
  electronBin = require('electron')
} catch {
  console.error('[dev:electron] electron not installed. Run: npm install')
  process.exit(1)
}

waitForDevServer()
  .then((host) => {
    console.log(`[dev:electron] Vite reachable on ${host}:${port} — opening desktop window…`)
    const child = spawn(electronBin, ['.'], {
      cwd: rootDir,
      stdio: 'inherit',
      windowsHide: false,
      env: { ...process.env, VITE_DEV_SERVER_URL: url },
    })
    child.on('error', (err) => {
      console.error('[dev:electron] failed to start:', err.message)
      process.exit(1)
    })
    child.on('exit', (code, signal) => {
      if (code !== 0 && code != null) {
        console.error(`[dev:electron] exited with code ${code}${signal ? ` (${signal})` : ''}`)
      }
      process.exit(code ?? 0)
    })
  })
  .catch((e) => {
    console.error('[dev:electron]', e.message)
    process.exit(1)
  })
