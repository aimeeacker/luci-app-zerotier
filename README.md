# luci-app-zerotier

面向 ImmortalWrt/OpenWrt 的统一 ZeroTier LuCI 管理应用。它以 ImmortalWrt
25.12 官方页面为基础，将服务配置、接口状态和本机内置 Controller 管理整合到
同一个入口：`VPN -> ZeroTier`。

## 功能

- 配置 ZeroTier 服务、持久目录、防火墙和加入的网络。
- 查看 ZeroTier 虚拟接口状态。
- 管理本机内置 Controller 的网络、成员、授权、IP 和路由。
- 在 Controller 页面直接编辑托管 IPv4 CIDR、地址池和对应直连路由。
- 导入、导出 Controller 网络 JSON 备份。
- 在网络概览中生成可供 ZeroTier 移动端扫描的加入二维码。
- 自适应 LuCI 页面和移动端布局。
- 独立生成简体中文语言包。

Controller 页面通过本机 `127.0.0.1:9993` API 工作，不需要 Docker、Node.js
或外部数据库。rpcd 适配层只依赖 `curl` 和 `jq`。

## GitHub Actions 构建

默认工作流固定使用 ImmortalWrt `25.12-SNAPSHOT` x86/64 SDK，仅编译和上传：

- `luci-app-zerotier-*.apk`
- `luci-i18n-zerotier-zh-cn-*.apk`

工作流会安装 ZeroTier feed 元数据以解析运行时依赖，但不会重新编译 ZeroTier
守护进程或内置 Controller，因此适合日常 LuCI 界面迭代。首次部署内置 Controller
时，仍需另行安装启用了 `ZT_NONFREE=1` 的 ZeroTier 二进制包。

二维码由浏览器端的 `qrcode-generator`（MIT License）本地生成，不依赖外部服务。

## 在 ImmortalWrt 25.12 上覆盖安装

将 Actions 产物解压到路由器后，日常界面更新只需覆盖 LuCI 应用和语言包：

```sh
apk add --allow-untrusted --force-overwrite ./luci-app-zerotier-*.apk
apk add --allow-untrusted --force-overwrite ./luci-i18n-zerotier-zh-cn-*.apk

rm -f /tmp/luci-indexcache /tmp/luci-indexcache.*
rm -rf /tmp/luci-modulecache
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

以上操作不会替换或重启 ZeroTier 守护进程。首次部署内置 Controller 时，还需
单独安装与固件 SDK 系列一致、启用了 `ZT_NONFREE=1` 的 ZeroTier 二进制包。

安装后可验证：

```sh
zerotier-cli info
ubus -v list zerotier-controller
ubus call zerotier-controller status
```

## SDK / Buildroot 编译

```sh
cd openwrt/package
git clone https://github.com/aimeeacker/luci-app-zerotier.git
cd ..
make menuconfig
make package/luci-app-zerotier/compile V=s
make package/luci-i18n-zerotier-zh-cn/compile V=s
```

要让 ZeroTier 守护进程本身支持 Controller，还需在 1.16.0 feed 包中启用
`ZT_NONFREE=1` 后单独编译 `package/feeds/packages/zerotier/compile`。当前仓库的 LuCI-only Actions 工作流不会执行这一步。

## License

来自 ImmortalWrt LuCI 的服务配置与接口页面采用 GPL-3.0-only；本项目原有的
Controller LuCI/rpcd 实现采用 Apache-2.0；二维码生成组件采用 MIT License。
内置 ZeroTier Controller 的源码另受其 Source-Available License 约束。
