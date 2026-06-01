module.exports = {
  apps: [{
    name: "aperti",
    script: "node_modules/.bin/next",
    args: "start -p 3000",
    instances: 1,
    exec_mode: "cluster",
    env: { NODE_ENV: "production" },
  }],
};
