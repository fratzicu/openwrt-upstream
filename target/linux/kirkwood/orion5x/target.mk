BOARDNAME:=Orion5x (disk boot)
FEATURES:=rtc usb squashfs targz pci emmc
KERNELNAME:=zImage

define Target/Description
	Marvell Orion5x (88F5182) boards that load the kernel from a disk
	partition with their stock U-Boot and keep the root filesystem on disk.
endef
