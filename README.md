# luci-app-zerotier-controller

OpenWrt LuCI web interface for managing self-hosted ZeroTier Controller, built with a modern hybrid architecture (UCI for global settings & ubus REST API bridge for dynamic member/network control).

Fully compatible with **OpenWrt 21.02, 23.05, 24.10+** and supports both `opkg` and the new `apk` package managers.

---

## 🌟 Key Features

* **Zero Heavy Dependencies**: Pure Shell + `jq` + `curl` + native LuCI JavaScript Engine (No Node.js, Python, PostgreSQL, or Docker required).
* **Hybrid Architecture**:
  * **Global Settings via UCI** (`/etc/config/zerotier_controller`).
  * **Dynamic Networks & Members via ubus**: Real-time communication with ZeroTier daemon (`127.0.0.1:9993`).
* **Complete Controller Management**:
  * **Create Networks**: Auto-assign non-overlapping `10.x.y.0/24` subnets.
  * **Member Management**: Authorize/deauthorize nodes, change static IP assignments, set node names/notes, and delete nodes.
  * **Default Filter & Sort**: Defaults to showing **Online Only** members with live latency badges and interactive column header sorting.
  * **JSON Backup & Restore**: One-click download of full network backups (including member authorizations and IPs) and one-click JSON restore.
  * **Route Management**: Add and delete custom CIDR routes.
* **OpenWrt Persistence**: Automated symlink setup for `/var/lib/zerotier-one` -> `/etc/zerotier` to prevent identity and database loss on router reboots.

---

## 🏗 Architecture Diagram

```
+-------------------------------------------------------------+
|                  OpenWrt LuCI Browser View                  |
|          (JavaScript / Client-Side Rendering)               |
+------------------------------+------------------------------+
                               |
                               | ubus RPC Call
                               v
+-------------------------------------------------------------+
|                    rpcd ubus Service                        |
|            (/usr/libexec/rpcd/zerotier-controller)          |
+------------------------------+------------------------------+
                               |
                               | Local HTTP (X-ZT-Direct-Token)
                               v
+-------------------------------------------------------------+
|               ZeroTier One Controller Daemon                |
|                    (127.0.0.1:9993)                         |
|   Database: /etc/zerotier/controller.d/*.json (Persistent)  |
+-------------------------------------------------------------+
```

---

## 🚀 Installation & Usage

### Method 1: Manual Quick Installation on Router

1. Clone or download this repository.
2. Copy the contents of `root/` and `htdocs/` into your router's root filesystem `/`:
   ```bash
   cp -r root/* /
   cp -r htdocs/* /
   ```
3. Set executable permissions and restart services:
   ```bash
   chmod +x /usr/libexec/rpcd/zerotier-controller
   chmod +x /etc/uci-defaults/99_zerotier_controller
   /etc/uci-defaults/99_zerotier_controller
   /etc/init.d/rpcd restart
   ```
4. Access your OpenWrt Web GUI and navigate to **VPN -> ZeroTier Controller** or **Services -> ZeroTier Controller**.

### Method 2: Compile with OpenWrt SDK / Buildroot

1. Clone this repository into your OpenWrt buildroot package directory:
   ```bash
   cd openwrt/package
   git clone https://github.com/aimeeacker/luci-app-zerotier-controller.git
   ```
2. Select the package in `make menuconfig`:
   ```
   LuCI -> 3. Applications -> luci-app-zerotier-controller
   ```
3. Compile using `apk` or `opkg`:
   ```bash
   make package/luci-app-zerotier-controller/compile V=s
   ```

---

## 📄 License

Licensed under the Apache License, Version 2.0.
