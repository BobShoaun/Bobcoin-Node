module.exports = {
  apps: [
    {
      name: "Bobcoin Mainnet Alpha",
      script: "NODE_ENV=production npm start", // add --norecalc to skip cache recalculation, add --nomine to prevent mining/posting blocks
      watch: ".",
    },
  ],
  deploy: {
    production: {
      user: "SSH_USERNAME",
      host: "SSH_HOSTMACHINE",
      ref: "origin/master",
      repo: "GIT_REPOSITORY",
      path: "DESTINATION_PATH",
      "pre-deploy-local": "",
      "post-deploy": "npm install && pm2 reload ecosystem.config.js --env production",
      "pre-setup": "",
    },
  },
};
