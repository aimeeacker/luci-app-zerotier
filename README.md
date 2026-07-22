# luci-app-zerotier

面向 ImmortalWrt/OpenWrt 的统一 ZeroTier LuCI 管理应用。它以 ImmortalWrt
25.12 官方页面为基础，将服务配置、接口状态和本机内置 Controller 管理整合到
同一个入口：`VPN -> ZeroTier`。

## 功能

- 配置 ZeroTier 服务、持久目录、防火墙和加入的网络。
- 查看 ZeroTier 虚拟接口状态。
- 管理本机内置 Controller 的网络、成员、授权、IP 和路由。
- 导入、导出 Controller 网络 JSON 备份。
- 自适应 LuCI 页面和移动端布局。
- 独立生成简体中文语言包。

Controller 页面通过本机 `127.0.0.1:9993` API 工作，不需要 Docker、Node.js
或外部数据库。rpcd 适配层只依赖 `curl` 和 `jq`。

## GitHub Actions 构建

默认工作流固定使用 ImmortalWrt `25.12-SNAPSHOT` x86/64 SDK，并且只显式选择
以下三个目标包及其必要依赖：

- `zerotier-1.16.0-r100.apk`
- `luci-app-zerotier-*.apk`
- `luci-i18n-zerotier-zh-cn-*.apk`

ZeroTier 使用 ImmortalWrt 25.12 feed 中的 `1.16.0-r2` 源码，将
`ZT_NONFREE=1` 打开并把包 release 改为 `r100`，从而启用内置 Controller。
工作流会拒绝宽泛的 `CONFIG_ALL` 选择，并在上传前逐一验证三个 APK。

> ZeroTier 1.16.x 的内置 Controller 使用 ZeroTier Source-Available License。
> 工作流会把 `nonfree/LICENSE.md` 放入构建产物；商业使用前请确认相应授权。

## 在 ImmortalWrt 25.12 上覆盖安装

先备份 `/etc/config/zerotier`、`/etc/zerotier` 和
`/var/lib/zerotier-one`。将 Actions 产物解压到路由器的同一目录后执行：

```sh
apk del luci-app-zerotier-controller 2>/dev/null || true
apk add --allow-untrusted --force-overwrite ./zerotier-1.16.0-r100.apk
apk add --allow-untrusted --force-overwrite ./luci-app-zerotier-*.apk
apk add --allow-untrusted --force-overwrite ./luci-i18n-zerotier-zh-cn-*.apk

rm -f /tmp/luci-indexcache /tmp/luci-indexcache.*
rm -rf /tmp/luci-modulecache
/etc/init.d/zerotier restart
/etc/init.d/rpcd restart
/etc/init.d/uhttpd restart
```

删除旧独立应用必须发生在安装新应用之前，避免旧包卸载时删除共用的 rpcd 文件。
新包首次安装还会清理旧的菜单、ACL 和浏览器视图路径，因此 LuCI 中只保留一个
`VPN -> ZeroTier` 入口。

安装后可验证：

```sh
zerotier-cli info
ubus -v list zerotier-controller
ubus call zerotier-controller status
```

如果 `zerotier-cli` 报告 `libminiupnpc.so` 版本不匹配，说明固件与 APK 的 SDK
系列不一致。应使用本工作流生成的 ZeroTier APK 覆盖旧二进制，并确保软件源同为
ImmortalWrt 25.12 x86/64，不要混装滚动 snapshot 包。

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
`ZT_NONFREE=1` 后单独编译 `package/feeds/packages/zerotier/compile`。仓库内的
Actions 工作流会自动完成并记录这一步。

## License

来自 ImmortalWrt LuCI 的服务配置与接口页面采用 GPL-3.0-only；本项目原有的
Controller LuCI/rpcd 实现采用 Apache-2.0。内置 ZeroTier Controller 的源码
另受其 Source-Available License 约束。
