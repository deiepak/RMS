# RMS Local Network Setup Guide

This guide explains how to set up and run the Restaurant Management System (RMS) on a local machine (the "Host") and access it from other devices on the same local WiFi/LAN network (the "Clients" like Waiter phones, Kitchen tablets, etc.).

---

## 1. Prerequisites (For the Host Machine)

You only need to install these tools on the **Main Server / Cashier Computer**.

### For Windows:
1. **Download & Install Docker Desktop:**
   - Go to: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Download the Windows installer and run it.
   - **Important:** Ensure you enable WSL 2 (Windows Subsystem for Linux) during installation if prompted.
2. **Download & Install Git:**
   - Go to: [https://git-scm.com/download/win](https://git-scm.com/download/win)
   - Download and install Git with the default settings.

### For Mac:
1. **Download & Install Docker Desktop:**
   - Go to: [https://www.docker.com/products/docker-desktop/](https://www.docker.com/products/docker-desktop/)
   - Download the Mac version (Apple Silicon/Intel depending on your Mac) and install it.
2. **Git is usually pre-installed**, but if not, open Terminal and type `git --version`, which will prompt you to install Apple's Command Line Tools.

---

## 2. Get the Code & Start the App

Once Docker is installed and running (you should see the Docker whale icon in your system tray/menu bar):

1. **Open your Terminal (Mac) or Command Prompt / PowerShell (Windows).**
2. **Clone the repository:**
   ```bash
   git clone https://github.com/deiepak/RMS.git
   cd RMS
   ```
3. **Start the application:**
   ```bash
   docker compose up -d
   ```
   *Note: The first time you run this, it will download all the necessary images (Node, MySQL, Caddy) which might take a few minutes depending on your internet speed.*

4. **Verify it's running:**
   - Open your web browser on the Host machine and go to: `http://localhost`
   - You should see the RMS login screen.

---

## 3. Accessing RMS from Other Devices (Local Network)

To allow waiters (mobile phones) and kitchen staff (tablets) to access the system, they need to connect to the Host machine's local IP address.

### Step A: Find the Host Machine's Local IP Address

**On Windows:**
1. Open Command Prompt.
2. Type `ipconfig` and press Enter.
3. Look for the `IPv4 Address` under your active Wi-Fi or Ethernet adapter (it usually looks like `192.168.1.X` or `10.0.0.X`).

**On Mac:**
1. Open Terminal.
2. Type `ipconfig getifaddr en0` (for Wi-Fi) or `ipconfig getifaddr en1` (for Ethernet) and press Enter.
3. The output is your IP address (e.g., `192.168.1.X`).

### Step B: Connect via IP Address (Quick Method)
1. Ensure the Host machine and the Client devices (phones, tablets) are connected to the **same Wi-Fi network**.
2. Open a web browser on the Client device.
3. Type the Host's IP address into the URL bar.
   - Example: `http://192.168.1.50`
4. The RMS portal will load!

### Step C: Connect via `happyhills.lan` (Recommended Method)
To use a friendly domain name like `http://happyhills.lan` on all devices across your network, you need to configure your Wi-Fi Router's DNS settings.

1. **Log into your Wi-Fi Router Admin Panel:**
   - Go to your router's IP address (commonly `http://192.168.1.1` or `http://192.168.0.1`) in your web browser.
   - Log in using your router's admin username and password.
2. **Find the Local DNS / LAN Settings:**
   - Look for a setting called **"Local DNS Record"**, **"LAN DNS"**, **"Static DNS"**, or **"DHCP Server Settings"**.
3. **Add a new DNS Entry:**
   - **Domain Name / Hostname:** `happyhills.lan`
   - **IP Address:** Enter the Host Machine's IP Address (e.g., `192.168.1.50`) that you found in Step A.
4. **Save & Reboot:**
   - Save the settings. You may need to reboot your router or toggle the Wi-Fi off/on on your client devices to flush their DNS cache.
5. **Access the App:**
   - On any phone or tablet connected to the Wi-Fi, open the browser and go to `http://happyhills.lan`!

---

## 4. Troubleshooting / Firewall Issues

If the Host can access `http://localhost` but other devices cannot access `http://192.168.1.X`, your Host's firewall is blocking incoming connections on port 80.

**Fix for Windows Firewall:**
1. Press the Windows Key, type "Windows Defender Firewall" and open it.
2. Click **"Advanced settings"** on the left.
3. Click **"Inbound Rules"** -> **"New Rule..."** (on the right).
4. Select **"Port"** -> Next.
5. Select **"TCP"** and enter **"80"** in "Specific local ports" -> Next.
6. Select **"Allow the connection"** -> Next.
7. Check Domain, Private, and Public -> Next.
8. Name it "RMS Web Port 80" and click Finish.

**Fix for Mac Firewall:**
1. Open **System Settings** -> **Network** -> **Firewall**.
2. Click **Options...**
3. Ensure "Block all incoming connections" is **unchecked**.
4. You may need to click the `+` button and add Docker to allow incoming connections.

---

## 5. Stopping / Updating the App

To stop the system:
```bash
cd RMS
docker compose down
```

To update the system with the latest code from GitHub and restart:
```bash
cd RMS
git pull origin main
docker compose up -d --build
```
