/**
 * Para dejarlo corriendo 24/7 con pm2:
 *   npm install -g pm2
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup      (para que reviva si el servidor se reinicia)
 *   pm2 logs rasterizar-wa       (ver qué está pasando)
 */
module.exports = {
  apps: [{
    name: 'rasterizar-wa',
    script: 'src/index.js',
    cwd: __dirname,
    autorestart: true,
    max_restarts: 20,
    restart_delay: 5000,
    max_memory_restart: '400M',
    env: { NODE_ENV: 'production' }
  }]
}
