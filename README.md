# luci-app-zerotier-controller

ImmortalWrt/OpenWrt LuCI web interface for managing a self-hosted ZeroTier Controller through the local ZeroTier service API.

The bundled GitHub Actions workflow targets **ImmortalWrt 25.12-SNAPSHOT x86/64** and produces both a Controller-enabled ZeroTier package and the LuCI application package.

> ZeroTier 1.16.x distributes its embedded Controller under the ZeroTier Source-Available License. The workflow enables it with `ZT_NONFREE=1`. Review `nonfree/LICENSE.md` before building or using the Controller; commercial use requires a separate license from ZeroTier.

---

## 🌟 Key Features

* **Zero Heavy Dependencies**: Pure Shell + `jq` + `curl` + native LuCI JavaScript Engine (No Node.js, Python, PostgreSQL, or Docker required).
* **Hybrid Architecture**:
  * **Global Settings via UCI** (`/etc/config/zerotier_controller`).
  * **Dynamic Networks & Members via ubus**: Real-time communication with ZeroTier daemon (`127.0.0.1:9993`).
* **Complete Controller Management**:
  * **Create Networks**: Auto-assign randomized private `10.x.y.0/24` subnets.
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
                               | Local HTTP (X-ZT1-AUTH)
                               v
+-------------------------------------------------------------+
|               ZeroTier One Controller Daemon                |
|                    (127.0.0.1:9993)                         |
|   Database: /etc/zerotier/controller.d/*.json (Persistent)  |
+-------------------------------------------------------------+
```

---

## 🚀 Installation & Usage

### Method 1: GitHub Actions for ImmortalWrt 25.12 x86/64

The default workflow is pinned to the ImmortalWrt `25.12-SNAPSHOT` SDK/feed
series and builds Controller-enabled ZeroTier `1.16.0-r100`. It does not use
the rolling development snapshot SDK.

1. Run the **Build ImmortalWrt Controller Packages** workflow.
2. Download the `immortalwrt-25.12-x86_64-zerotier-controller` artifact.
3. Verify the files against `SHA256SUMS`.
4. Back up `/etc/zerotier`, `/var/lib/zerotier-one`, and `/etc/config/zerotier`.
5. Install the generated `zerotier` package first, then install `luci-app-zerotier-controller`.
6. Clear `/tmp/luci-indexcache`, then restart `zerotier`, `rpcd`, and `uhttpd`.

On ImmortalWrt 25.12 with `apk`, run these commands from the extracted artifact directory:

```bash
apk add --allow-untrusted ./zerotier-*.apk
apk add --allow-untrusted ./luci-app-zerotier-controller-*.apk
rm -f /tmp/luci-indexcache
/etc/init.d/zerotier restart
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

For safest results, run firmware and packages built from the same ImmortalWrt
release series. The workflow accepts a custom SDK target-directory URL when
manually dispatched.

### Method 2: Manual LuCI Installation on Router

This installs only the LuCI/rpcd application. The installed `zerotier-one` binary must already expose `GET /controller` and `GET /controller/network`.

1. Clone or download this repository.
2. Copy the contents of `root/` and `htdocs/` into your router's root filesystem `/`:
   ```bash
   cp -r root/* /
   cp -r htdocs/* /
   cp /www/luci-static/resources/view/zerotier_controller/main.js \
      /www/luci-static/resources/view/zerotier_controller/main-v1_1_0.js
   ```
3. Set executable permissions and restart services:
   ```bash
   chmod +x /usr/libexec/rpcd/zerotier-controller
   chmod +x /etc/uci-defaults/99_zerotier_controller
   /etc/uci-defaults/99_zerotier_controller
   rm -f /tmp/luci-indexcache
   /etc/init.d/rpcd restart
   /etc/init.d/uhttpd restart
   ```
4. Access your OpenWrt Web GUI and navigate to **Services -> ZeroTier Controller**.

### Method 3: Compile with an SDK / Buildroot

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

That command builds only the LuCI/rpcd package. To build the ZeroTier daemon with the embedded Controller, install the `zerotier` feed package, change its build flag from `ZT_NONFREE=0` to `ZT_NONFREE=1`, and rebuild `package/zerotier`. The bundled GitHub Actions workflow performs those steps and records the resulting license metadata automatically.

---

## 📄 Licenses

This LuCI application is licensed under the Apache License, Version 2.0.

The optional ZeroTier embedded Controller built by the GitHub Actions workflow is governed by ZeroTier's Source-Available License. The workflow includes that license alongside its artifacts.
