# VPS Setup & Deployment Guide

This document outlines the standard procedure for taking a fresh VPS (Virtual Private Server) and deploying the Restaurant Management System (RMS) to it.

> [!IMPORTANT]
> Keep your SSH credentials, passwords, and `.env` secrets safe. Never commit them to a public repository.

## 1. Initial Access

Once you purchase a VPS, your provider will give you:
- An IP Address (e.g., `192.168.1.100`)
- A Username (usually `root` or a custom username)
- A Password or SSH Key

To access your server from your local terminal (Mac/Linux/Windows WSL), use the SSH command:

```bash
ssh username@your_vps_ip
```
You will be prompted to enter your password. Note that when typing the password, characters will not show up on the screen for security reasons.

*Tip: For better security, generate an SSH key locally (`ssh-keygen`) and copy it to the server (`ssh-copy-id username@your_vps_ip`) to avoid typing passwords.*

## 2. Server Preparation

Once logged into your server, it is highly recommended to update the operating system and install necessary dependencies like Docker.

Update the system:
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

Install Docker and Docker Compose (if not already installed by your host):
```bash
# Install Docker
sudo apt-get install -y docker.io docker-compose

# Ensure Docker starts on boot
sudo systemctl enable docker
sudo systemctl start docker
```

## 3. Transferring the Codebase

You need to copy your local project files to the VPS. You can do this securely using `rsync` or `scp` from your **local machine** (do not run this on the VPS).

```bash
# Run this from your local Mac/PC inside the RMS folder:
rsync -avz --exclude 'node_modules' --exclude '.git' ./ username@your_vps_ip:~/RMS
```

## 4. Environment Variables

Your `.env` file contains critical production secrets (Database passwords, JWT secrets) and is ignored by Git. You must create this file on the server.

SSH back into your server:
```bash
ssh username@your_vps_ip
cd ~/RMS
cp .env.example .env
nano .env
```
Update the values with your production secrets and save the file.

## 5. Deployment

We use a helper script (`deploy.sh`) to automate building Docker containers and spinning up the application.

Make sure the script is executable:
```bash
chmod +x deploy.sh
```

Run the deployment script:
```bash
./deploy.sh
```

This script will:
1. Build the production Docker images.
2. Spin up the MySQL Database, Node.js API, and React Client.
3. Automatically run database migrations.

## 6. Verification

Once the script finishes, your application should be live. Open your web browser and navigate to:
`http://your_vps_ip`

If you configured a domain name (like `rms.yourdomain.com`), point its A-Record to your VPS IP address.
