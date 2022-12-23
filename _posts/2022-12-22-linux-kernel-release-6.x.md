---
layout: post
title: Linux kernel release 6.x
category: 计算机
tags: [计算机, 软件]
---


----------
时间来到2022年10月，全新版本的 Linux 内核现已可供使用。

Linux 6.0以良好的形式启动了6.x 系列，带来了各种性能改进、新硬件支持、安全修复以及常见的文件系统调整。

Linus Torvalds在Linux内核邮件列表上宣布发布时说：“希望每个人都清楚，主要版本号的变化更多是关于我的手指和脚趾用尽（调侃），而不是关于任何重大的根本变化。”

“但是当然6.0中有很多不同的变化——毕竟我们总共有超过15k的非合并提交，因此6.0至少在一段时间内的提交数量上是更大的版本之一 .

有关Linux内核6.0中新增功能的更多详细信息，请继续阅读。

## Linux 内核 6.0 特性
![linux-kernel-6.0.jpg-192.5kB][1]
Phoronix 进行的基准测试显示，由于调度程序更改和其他内核能量调整，英特尔至强“Ice Lake”、AMD Ryzen“Threadripper”和AMD EPYC处理器的性能显着提高。看到Linux在使用更少的功率的同时压缩更多的功率总是受欢迎的。

Linux 6.0 还通过为大量即将推出的硬件奠定基础来进行一些强制性的面向未来的验证。 这包括对英特尔第四代至强服务器芯片“Sapphire Rapids”及其第 13 代“Raptor Lake”核心芯片的支持。

AMD为其RDNA 3 GPU提供了一个内核图形驱动程序，为AMD ‘Raphael’平台提供了一个新的音频驱动程序，并改进了对AMD ‘Jadeite’系统的音频支持。 如果使用Linux 6.0，那些注意到Ryzen 6000系列笔记本电脑上的键盘问题的人应该会再次找到预期的功能。

OpenRISC和LoongArch架构都获得了对PCI总线的支持，而RISC-V使用许多新扩展（包括“Zicbom”扩展）增强了其缓存块管理功能。RISC-V 还附带了一个新的默认配置，能够从一开始就运行Docker。

在Qualcomm Snapdragon 8cx Gen3上运行的（昂贵的）Lenovo ThinkPad X13s笔记本电脑开始获得支持。 ThinkPad X13s预装了适用于ARM的Windows 11，但由于Linux支持现在处于形成阶段，对于Linux ARM爱好者来说，这可能是一个很好的参考设备。

谈到Linux爱好者使用的笔记本电脑，一些TUXEDO Computers和Clevo笔记本电脑在从早期内核版本的挂起状态恢复时会出现触摸板和键盘问题。 这些现在已在Linux 6.0中修复。

支持的新硬件包括XP-PEN Deco L绘图板、AMD主板上的一系列传感器，包括更新的Ryzen 笔记本电脑上的Sensor Fusion Hub支持，以及Intel Raptor Lake上的功能性Thunderbolt。

Ubuntu的默认文件系统仍然是ext4，所以我想提一下Linux 6.0启用了两个新的ioctl()操作：EXT4_IOC_GETFSUUID和EXT4_IC_SETFSUUID。这些使得获取或设置存储在文件系统超级块中的UUID成为可能。

Linux 6.0中的其他各种变化包括：

- 内核支持NVMe带内身份验证
- 运行时验证子系统
- 树莓派4 V3D内核驱动
- IO_uring用户空间块驱动程序
- XFS文件系统上的缓冲写入
- 发送协议V2支持Btrfs
- H.265/HEVC API提升为稳定

另外，正如您可以想象的那样，还有更多。我建议查看Phoronix的功能概述以获取顶级信息，或深入了解全面的LWN合并报告1和LWN合并报告2以了解更多详细信息。

## 获取Linux 6.0

Linux 6.0现在可以作为源代码下载，您可以在您选择的发行版上手动编译它吗？ 不适合吗？ 等待你的发行版维护者打包做半移植。 一些发行版（如 Arch）发布新内核更新相对较快，但其他发行版（如：Ubuntu）则不然。

您可以在Canonical的主线存储库上赌一把，在基于Ubuntu的发行版上安装Linux 6.0（但请记住，这些发行版不附带任何保证或支持保证）。


  [1]: http://static.zybuluo.com/gamedebug/aos6plq08sfehwhe013mk5pw/linux-kernel-6.0.jpg