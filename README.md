# Bobcoin-Node

Node which hosts and synchronizes a copy of the entire Bobcoin blockchain and relays information like blocks and transactions to other nodes in the peer to peer network.

# Deploying to AWS EC2

## setup pm2

```
npm install pm2@latest -g

pm2 startup
```

Generate pm2 ecosystem file:

```
pm2 ecosystem
```

```
module.exports = {
  apps : [{
    name: 'Bobcoin Testnet Alpha',
    script: 'NODE_ENV=production npm start',
    watch: '.'
  }],
  deploy : {
    production : {
      user : 'SSH_USERNAME',
      host : 'SSH_HOSTMACHINE',
      ref  : 'origin/master',
      repo : 'GIT_REPOSITORY',
      path : 'DESTINATION_PATH',
      'pre-deploy-local': '',
      'post-deploy' : 'npm install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
```

Start node

```
pm2 start

pm2 save

pm2 logs

pm2 status
```

## Configuring service (not needed with pm2)

Create systemd service
`sudo vim /etc/systemd/system/bobcoin.service`

Paste this config into the file:

```
[Unit]
Description=Bobcoin Testnet Alpha
After=multi-user.target

[Service]
ExecStart=/home/ec2-user/.nvm/versions/node/v16.17.1/bin/node /home/ec2-user/Bobcoin-Node/dist/index.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=bobcoin-testnet-alpha
User=ec2-user
EnvironmentFile=/home/ec2-user/Bobcoin-Node/.env

[Install]
WantedBy=multi-user.target
```

Start service
`sudo systemctl start bobcoin.service`

check status of service:
`sudo systemctl status bobcoin.service`

enabled service, so it keeps running even when reboot:
`sudo systemctl enable bobcoin.service`

# Setup nginx

```
sudo amazon-linux-extras install nginx1 -y

sudo systemctl start nginx
sudo systemctl status nginx
sudo systemctl enable nginx
```

Modify config file

```
sudo vim /etc/nginx/nginx.conf
```

remove everything under "server_name", replace with

```
location / {
    proxy_pass http://localhost:3000;
}
```

restart nginx

```
sudo systemctl restart nginx
```

https://www.youtube.com/watch?v=_EBARqreeao

https://www.youtube.com/watch?v=oHAQ3TzUTro

https://levelup.gitconnected.com/adding-a-custom-domain-and-ssl-to-aws-ec2-a2eca296facd
