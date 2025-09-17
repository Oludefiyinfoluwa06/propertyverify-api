module.exports = {
  apps: [
    {
      name: "propertyverify-api",
      script: "./app.js",
      instances: "max",
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
