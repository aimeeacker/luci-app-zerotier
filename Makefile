include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zerotier-controller
PKG_VERSION:=1.0.5
PKG_RELEASE:=1

PKG_MAINTAINER:=Aimee <aimee@github.com>
PKG_LICENSE:=Apache-2.0

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-zerotier-controller
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI Support for ZeroTier Controller (UCI & ubus)
  DEPENDS:=+zerotier +curl +jq
  PKGARCH:=all
endef

define Package/luci-app-zerotier-controller/description
  LuCI Support for ZeroTier Controller using hybrid UCI & ubus architecture.
endef

define Build/Configure
endef

define Build/Compile
endef

define Package/luci-app-zerotier-controller/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/zerotier_controller $(1)/etc/config/zerotier_controller

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/99_zerotier_controller $(1)/etc/uci-defaults/99_zerotier_controller

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/zerotier-controller $(1)/usr/libexec/rpcd/zerotier-controller

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-zerotier-controller.json $(1)/usr/share/luci/menu.d/luci-app-zerotier-controller.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-zerotier-controller.json $(1)/usr/share/rpcd/acl.d/luci-app-zerotier-controller.json

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/zerotier_controller
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/zerotier_controller/main.js $(1)/www/luci-static/resources/view/zerotier_controller/main.js
endef

$(eval $(call BuildPackage,luci-app-zerotier-controller))
