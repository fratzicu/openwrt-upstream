# Orion5x boards whose stock U-Boot loads a raw uImage from a disk partition.
# The root filesystem is squashfs on another disk partition, with the overlay
# behind it (fstools rootdisk), so sysupgrade, failsafe and firstboot work as
# on flash based devices (emmc.sh does the writing, see platform.sh).

define Device/lacie_internet-space
  DEVICE_VENDOR := LaCie
  DEVICE_MODEL := Internet Space
  DEVICE_DTS := orion5x-lacie-internet-space
  KERNEL_IN_UBI :=
  KERNEL_SIZE := 7168k
  KERNEL := kernel-bin | append-dtb | uImage none | check-size 7168k
  IMAGES := sysupgrade.bin rootfs.img kernel.bin
  IMAGE/sysupgrade.bin := sysupgrade-tar | append-metadata
  IMAGE/rootfs.img := append-rootfs | pad-to 64k
  IMAGE/kernel.bin := append-kernel
  DEVICE_PACKAGES := kmod-gpio-button-hotplug kmod-rtc-rs5c372a \
	kmod-usb-storage block-mount e2fsprogs
endef
TARGET_DEVICES += lacie_internet-space
