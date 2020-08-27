---
layout: post
title: KVM客户虚拟机时间管理
category: 计算机
tags: [计算机, 软件]
---


----------
虚拟化涉及到在客户虚拟机中保持时间的几个挑战。

- 中断不能总是同时和即时地发送到所有客户虚拟机。这是因为虚拟机中的中断不是真正的中断。相反，它们由宿主机注入到客户虚拟机中。
- 宿主机可能运行另一个客户虚拟机，或者不同的进程。因此，中断通常需要的精确计时可能并不总是可能的。

没有准确时间保持的来宾虚拟机可能会遇到网络应用程序和进程问题，因为会话有效性、迁移和其他网络活动都依赖于时间戳来保持正确。
KVM通过向客户虚拟机提供半虚拟化时钟(KVM -clock)来避免这些问题。但是，在尝试可能受到时间保持不准确(如客户迁移)影响的活动(例如，客户迁移)之前，测试计时仍然很重要。

> 重要
为了避免上述问题，应该在主机和客户虚拟机上配置网络时间协议(NTP)。在使用诸如Red Hat Enterprise Linux 6、SUSE Linux Enterprise 11等更早版本的客户虚拟机上，NTP是由ntpd服务实现的。
在使用Red Hat Enterprise Linux 7、SUSE Linux Enterprise 12的系统上，NTP时间同步服务可以由ntpd或chronyd服务提供。注意，Chrony在虚拟机上有一些优势。

## 客户虚拟机时间同步的机制
默认情况下，客户虚拟机与hypervisor同步时间，如下所示：

- 当客户虚拟机系统引导时，从模拟实时时钟(RTC)读取时间。
- 当NTP协议启动时，它会自动同步客户时钟。之后，在正常的客户虚拟机操作期间，NTP对客户虚拟机进行时钟调整。
- 当客户虚拟机在暂停或恢复过程后恢复时，管理软件(例如virt-manager)应该发出命令，将客户虚拟机时钟同步到指定的值。只有在QEMU客户代理安装在客户中并支持该特性时，这种同步才能工作。客户时钟同步到的值通常是主机时钟的值。

## 常量时间戳计数器(TSC)
现代Intel和AMD cpu提供了一个常量时间戳计数器(TSC)。当CPU核心本身改变频率(例如为了遵守节能策略)时，不变的TSC的计数频率不会改变。为了将TSC用作KVM客户的时钟源，需要一个TSC频率恒定的CPU。

如果存在constant_tsc标志，则CPU有一个常量时间戳计数器。要确定你的CPU是否有constant_tsc标志，输入以下命令：

```
$ cat /proc/cpuinfo | grep constant_tsc
```

如果给定任何输出，则CPU具有constant_tsc位。如果没有给出输出，请遵循下面的说明。

## 在没有常量时间戳计数器的情况下配置主机
没有固定TSC频率的系统不能使用TSC作为虚拟机的时钟源，并且需要额外的配置。电源管理特性会干扰准确的时间保持，因此必须对客户虚拟机禁用才能准确地与KVM保持时间。

>重要
这些指令仅针对AMD F系列CPU修正。

如果CPU缺少constant_tsc位，请禁用所有电源管理特性。每个系统都有几个计时器用于计时。TSC在主机上不稳定，这有时是由cpufreq更改、深C状态或迁移到具有更快TSC的主机造成的。深度C睡眠状态可以停止TSC。为了防止内核使用深C状态追加处理器。max_cstate=1到内核引导。要使此更改持久，请在/etc/default/grubfile.中编辑GRUB_CMDLINE_LINUX键的值为例。如果您希望为每次启动启用紧急模式，请按如下方式编辑条目：

```
GRUB_CMDLINE_LINUX="emergency"
```

注意，您可以为GRUB_CMDLINE_LINUX指定多个参数，类似于在GRUB 2引导菜单中添加参数。

要禁用cpufreq(只需要在没有constant_tsc的主机上禁用)，请安装内核工具并启用cpupower。service (systemctl启用cpupower.service)。如果希望在每次引导客户虚拟机时禁用此服务，请更改/etc/sysconfig/cpupower中的配置文件，并更改CPUPOWER_START_OPTS和CPUPOWER_STOP_OPTS。有效的限制可以在/sys/devices/system/cpu/cpuid/cpufreq/scaling_available_governors文件中找到。

