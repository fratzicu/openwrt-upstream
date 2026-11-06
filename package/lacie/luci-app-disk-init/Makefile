include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-disk-init
PKG_VERSION:=2
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-disk-init
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI page to set up storage disks and share them over SMB, FTP and NFS
  DEPENDS:=+luci-base +rpcd +sfdisk +e2fsprogs +block-mount +libblkid
  PKGARCH:=all
endef

define Package/luci-app-disk-init/description
  System > Storage: lists the SATA/USB disks and initialises one for
  storage (GPT, one partition with any file system whose mkfs tool and
  kernel support are installed, mounted by UUID at /mnt/<name>), shares the
  mounted folders over SMB (ksmbd), FTP (vsftpd) and NFS
  (nfs-kernel-server), and manages separate SMB and FTP users. All settings
  are kept in the services' own OpenWrt configuration.
endef

define Build/Compile
endef

define Package/luci-app-disk-init/install
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd $(1)/usr/sbin
	$(INSTALL_BIN) ./root/usr/libexec/rpcd/disk-init $(1)/usr/libexec/rpcd/
	$(INSTALL_BIN) ./root/usr/sbin/disk-init $(1)/usr/sbin/
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-disk-init.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-disk-init.json $(1)/usr/share/rpcd/acl.d/
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/system
	$(INSTALL_DATA) ./htdocs/luci-static/resources/view/system/disk-init.js $(1)/www/luci-static/resources/view/system/
endef

define Package/luci-app-disk-init/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/rpcd reload
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-disk-init))
