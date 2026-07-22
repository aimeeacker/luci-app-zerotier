#
# Copyright (C) 2026 OpenWrt.org
#
# This is free software, licensed under the Apache License, Version 2.0.
#

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Support for ZeroTier Controller (UCI & ubus)
LUCI_DEPENDS:=+zerotier +curl +jq
LUCI_PKGARCH:=all

PKG_NAME:=luci-app-zerotier-controller
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0

include $(TOPDIR)/feeds/luci/luci.mk

# OpenWrt Build package signature
