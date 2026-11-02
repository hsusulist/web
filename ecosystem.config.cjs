module.exports = {
  apps: [{ name: 'luc-site', script: 'server.js', env: { PORT: 3000, HOST: '0.0.0.0', LUC_SITE_LOG: '0' }, watch: false, instances: 1, exec_mode: 'fork' }]
};
