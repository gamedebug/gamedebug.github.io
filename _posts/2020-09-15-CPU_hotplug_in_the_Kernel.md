---
layout: post
title: 内核中的CPU热插拔
category: 计算机
tags: [计算机, 软件]
---


----------
现代先进的系统架构已经引入了先进的错误报告和纠正能力的处理器。也有一些OEM厂商推出了支持热插拔NUMA硬件，其中物理节点插入和删除需要支持CPU热插拔。

这样的升级需要删除内核可用的CPU，要么是出于准备的原因，要么是出于RAS的目的，以使有问题的CPU远离系统执行路径。因此，Linux内核需要CPU热插拔支持。

CPU热插拔支持的一种更新颖的用法是它现在用于SMP（Symmetric multiprocessing：并行多处理机）的暂停恢复支持。双核和HT支持甚至可以让笔记本运行不支持这些方法的SMP内核。

## 命令行开关

**maxcpus=n**
如果你有四个vCPU，使用maxcpus=2将只能引导两个。您可以选择稍后让其他CPU联机。
**nr_cpus=n**
限制内核将支持的CPU总量。如果这里提供的数量低于物理可用cpu的数量，那么这些CPU以后就不能上线。
**additional_cpus=n**
使用它来限制可热插拔CPU。这个选项设置cpu_possible_mask = cpu_present_mask + additional_cpus，此选项仅限于IA64体系结构。
**possible_cpus=n**
此选项设置cpu_possible_cpus位元。该选项仅限于X86和S390体系结构。
**cpu0_hotplug**
允许关闭CPU0。此选项仅限于X86体系结构。

## CPU地图

**cpu_possible_mask**
系统中可能可用的CPU的位图。它用于在启动时为per_cpu变量分配一些内存，这些per_cpu变量在CPU可用或删除时不会增长或缩小。一旦在引导时发现阶段设置，映射就是静态的，也就是说，任何时候都不会添加或删除任何位。精确地为您的系统需要预先削减可以节省一些启动时间内存。
**cpu_online_mask**
当前在线的所有CPU的位图。在CPU可用来进行内核调度并准备接收来自设备的中断之后，它在剩余的cpu_up()中设置。当使用剩余的cpu_disable()关闭一个CPU时，它将被清除，在此之前，包括中断在内的所有操作系统服务将被迁移到另一个目标CPU。
**cpu_present_mask**
系统中当前CPU的位图。并不是所有的CPU都在线。当相关子系统(例如ACPI)处理物理热插拔时，可以根据事件的热添加/热删除来更改和从映射中添加或删除新位。目前没有锁定规则。典型的用法是在引导期间初始化拓扑，此时热插拔是禁用的。

您实际上不需要操作任何系统CPU映射。在大多数情况下，它们应该是只读的。在设置per-cpu资源时，几乎总是使用cpu_possible_mask或者for_each_possible_cpu()来迭代。可以使用宏for_each_cpu()迭代自定义的CPU掩码。

不要使用除了cpumask_t以外的任何东西来表示CPU的位图。

## 使用CPU热插拔
内核选项CONFIG_HOTPLUG_CPU需要被启用。它目前可以在多种架构上使用，包括ARM、MIPS、PowerPC和X86。配置通过sysfs接口完成：

```
$ ls -lh /sys/devices/system/cpu
total 0
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu0
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu1
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu2
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu3
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu4
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu5
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu6
drwxr-xr-x  9 root root    0 Dec 21 16:33 cpu7
drwxr-xr-x  2 root root    0 Dec 21 16:33 hotplug
-r--r--r--  1 root root 4.0K Dec 21 16:33 offline
-r--r--r--  1 root root 4.0K Dec 21 16:33 online
-r--r--r--  1 root root 4.0K Dec 21 16:33 possible
-r--r--r--  1 root root 4.0K Dec 21 16:33 present
```

文件脱机、联机(可能的话)表示CPU掩码。每个CPU文件夹包含一个在线文件，它控制逻辑开(1)和关(0)状态。逻辑关闭CPU4：

```
$ echo 0 > /sys/devices/system/cpu/cpu4/online
 smpboot: CPU 4 is now offline
```

一旦CPU关闭，它将从/proc/interrupts、/proc/cpuinfo中删除，并且也不应该在top命令中显示出来。使CPU4恢复联机：

```
$ echo 1 > /sys/devices/system/cpu/cpu4/online
smpboot: Booting Node 0 Processor 4 APIC 0x1
```

CPU又可以使用了。这应该可以在所有CPU上工作。CPU0通常是特殊的，被排除在CPU热插拔之外。在X86上，必须启用内核选项CONFIG_BOOTPARAM_HOTPLUG_CPU0，才能关闭CPU0。另外，还可以使用内核命令选项cpu0_hotplug。一些已知的依赖CPU0：

- 从休眠/暂停状态恢复。如果CPU0离线，则休眠/挂起将失败。
- PIC中断。如果检测到PIC中断，则无法删除CPU0。

## CPU热插拔协调

### CPU离线案例

一旦CPU逻辑关闭，就会调用已注册热插拔状态的teardown回调，从CPUHP_ONLINE开始，到CPUHP_OFFLINE状态结束。这包括：

- 如果任务由于挂起操作而被冻结，那么cpuhp_tasks_frozen将被设置为true。
- 所有进程都从这个传出的CPU迁移到新的CPU。新CPU从每个进程的当前cpuset中选择，该cpuset可以是所有在线CPU的子集。
- 以这个CPU为目标的所有中断都被迁移到一个新的CPU。
- 计时器也被迁移到一个新的CPU。
- 一旦迁移了所有的服务，内核将调用一个特定于arch的例程摔打cpu_disable()来执行特定于arch的清理。

### 使用热插拔API

一旦CPU离线或上线，就可以接收通知。这可能是重要的某些驱动程序，需要执行一些设置或清理功能基于可用cpu的数量：

```
#include <linux/cpuhotplug.h>

ret = cpuhp_setup_state(CPUHP_AP_ONLINE_DYN, "X/Y:online",
                        Y_online, Y_prepare_down);
```

X是子系统，Y是特定的驱动程序。在所有在线CPU上注册期间，将调用Y_online回调。如果在线回调期间发生错误，则将在先前调用了在线回调的所有CPU上调用Y_prepare_down回调。注册完成后，一旦使CPU联机，将调用Y_online回调，而当CPU关闭时将调用Y_prepare_down。先前在Y_online中分配的所有资源都应在Y_prepare_down中释放。如果注册过程中发生错误，则返回值ret为负。否则，将返回一个正值，其中包含用于动态分配状态的已分配热插拔（CPUHP_AP_ONLINE_DYN）。对于预定义状态，它将返回零。

可以通过调用cpuhp_remove_state（）删除回调。如果是动态分配的状态（CPUHP_AP_ONLINE_DYN），请使用返回的状态。在移除热插拔状态期间，将调用拆卸回调。

### 多个实例

如果一个驱动程序有多个实例，并且每个实例都需要独立执行回调，则很可能应该使用“多状态”。首先，需要注册一个多状态的状态：

```
ret = cpuhp_setup_state_multi(CPUHP_AP_ONLINE_DYN, "X/Y:online,
                              Y_online, Y_prepare_down);
Y_hp_online = ret;
```

cpuhp_setup_state_multi()的行为类似于cpuhp_setup_state()，只是它准备了多状态的回调，并且不调用回调。这是一次性的设置。一旦分配了一个新实例，你需要注册这个新实例：

```
ret = cpuhp_state_add_instance(Y_hp_online, &d->node);
```

这个函数将把这个实例添加到以前分配的Y_hp_online状态中，并在所有在线CPU上调用以前注册的回调(Y_online)。节点元素是每个实例数据结构的struct hlist_node成员。

#### 在删除实例时:::

cpuhp_state_remove_instance(Y_hp_online, &d->node)

将在所有在线cpu上调用teardown回调。

### 手工设置

通常，在注册或删除状态时调用setup和teardown回调是很方便的，因为操作通常需要在CPU联机(脱机)和驱动程序的初始设置(关机)期间执行。但是，每个注册和删除函数也可以使用_nocalls后缀，如果调用回调函数不是必需的，则该后缀不会调用提供的回调函数。在手动设置(或删除)期间，应该使用函数get_online_cpus()和put_online_cpus()来禁止CPU热插拔操作。

### 事件的顺序

热插拔状态定义在include/linux/cpuhotplugin.h：

- CPUHP_OFFLINE…CPUHP_AP_OFFLINE的状态是在CPU启动之前调用的。
- CPUHP_AP_OFFLINE…CPUHP_AP_ONLINE的状态只在CPU启动后调用。中断是关闭的，该CPU上的调度程序还没有激活。从CPUHP_AP_OFFLINE开始，回调将在目标CPU上调用。
- CPUHP_AP_ONLINE_DYN和CPUHP_AP_ONLINE_DYN_END之间的状态为动态分配预留。
- 在CPU关闭时，以相反的顺序调用状态，从CPUHP_ONLINE开始，到CPUHP_OFFLINE停止。这里在CPU上调用回调，该CPU将被关闭，直到CPUHP_AP_OFFLINE为止。

通常，通过CPUHP_AP_ONLINE_DYN动态分配状态就足够了。但是，如果在启动或关闭期间需要更早的调用，则应该获得显式状态。如果热插拔事件要求与另一个热插拔事件相关的特定顺序，则可能还需要显式状态。

## 测试热插拔状态

验证自定义状态是否按预期工作的一种方法是关闭CPU，然后将其再次上线。还可以将CPU置于某种状态(例如CPUHP_AP_ONLINE)，然后返回到CPUHP_ONLINE。这将在CPUHP_AP_ONLINE之后模拟一个错误状态，这将导致回滚到在线状态。

所有注册状态在/sys/devices/system/cpu/hotplug/states中枚举：

```
$ tail /sys/devices/system/cpu/hotplug/states
138: mm/vmscan:online
139: mm/vmstat:online
140: lib/percpu_cnt:online
141: acpi/cpu-drv:online
142: base/cacheinfo:online
143: virtio/net:online
144: x86/mce:online
145: printk:online
168: sched:active
169: online
```

将CPU4回滚到lib/percpu_cnt:online和返回online刚刚发出：

```
$ cat /sys/devices/system/cpu/cpu4/hotplug/state
169
$ echo 140 > /sys/devices/system/cpu/cpu4/hotplug/target
$ cat /sys/devices/system/cpu/cpu4/hotplug/state
140
```

需要注意的是，状态140的teardown callbac已经被调用。现在回到网上：

```
$ echo 169 > /sys/devices/system/cpu/cpu4/hotplug/target
$ cat /sys/devices/system/cpu/cpu4/hotplug/state
169
```

启用跟踪事件后，单个步骤也是可见的：

```
#  TASK-PID   CPU#    TIMESTAMP  FUNCTION
#     | |       |        |         |
    bash-394  [001]  22.976: cpuhp_enter: cpu: 0004 target: 140 step: 169 (cpuhp_kick_ap_work)
 cpuhp/4-31   [004]  22.977: cpuhp_enter: cpu: 0004 target: 140 step: 168 (sched_cpu_deactivate)
 cpuhp/4-31   [004]  22.990: cpuhp_exit:  cpu: 0004  state: 168 step: 168 ret: 0
 cpuhp/4-31   [004]  22.991: cpuhp_enter: cpu: 0004 target: 140 step: 144 (mce_cpu_pre_down)
 cpuhp/4-31   [004]  22.992: cpuhp_exit:  cpu: 0004  state: 144 step: 144 ret: 0
 cpuhp/4-31   [004]  22.993: cpuhp_multi_enter: cpu: 0004 target: 140 step: 143 (virtnet_cpu_down_prep)
 cpuhp/4-31   [004]  22.994: cpuhp_exit:  cpu: 0004  state: 143 step: 143 ret: 0
 cpuhp/4-31   [004]  22.995: cpuhp_enter: cpu: 0004 target: 140 step: 142 (cacheinfo_cpu_pre_down)
 cpuhp/4-31   [004]  22.996: cpuhp_exit:  cpu: 0004  state: 142 step: 142 ret: 0
    bash-394  [001]  22.997: cpuhp_exit:  cpu: 0004  state: 140 step: 169 ret: 0
    bash-394  [005]  95.540: cpuhp_enter: cpu: 0004 target: 169 step: 140 (cpuhp_kick_ap_work)
 cpuhp/4-31   [004]  95.541: cpuhp_enter: cpu: 0004 target: 169 step: 141 (acpi_soft_cpu_online)
 cpuhp/4-31   [004]  95.542: cpuhp_exit:  cpu: 0004  state: 141 step: 141 ret: 0
 cpuhp/4-31   [004]  95.543: cpuhp_enter: cpu: 0004 target: 169 step: 142 (cacheinfo_cpu_online)
 cpuhp/4-31   [004]  95.544: cpuhp_exit:  cpu: 0004  state: 142 step: 142 ret: 0
 cpuhp/4-31   [004]  95.545: cpuhp_multi_enter: cpu: 0004 target: 169 step: 143 (virtnet_cpu_online)
 cpuhp/4-31   [004]  95.546: cpuhp_exit:  cpu: 0004  state: 143 step: 143 ret: 0
 cpuhp/4-31   [004]  95.547: cpuhp_enter: cpu: 0004 target: 169 step: 144 (mce_cpu_online)
 cpuhp/4-31   [004]  95.548: cpuhp_exit:  cpu: 0004  state: 144 step: 144 ret: 0
 cpuhp/4-31   [004]  95.549: cpuhp_enter: cpu: 0004 target: 169 step: 145 (console_cpu_notify)
 cpuhp/4-31   [004]  95.550: cpuhp_exit:  cpu: 0004  state: 145 step: 145 ret: 0
 cpuhp/4-31   [004]  95.551: cpuhp_enter: cpu: 0004 target: 169 step: 168 (sched_cpu_activate)
 cpuhp/4-31   [004]  95.552: cpuhp_exit:  cpu: 0004  state: 168 step: 168 ret: 0
    bash-394  [005]  95.553: cpuhp_exit:  cpu: 0004  state: 169 step: 140 ret: 0
```

正如所看到的，CPU4下降到22.996，然后回升到95.552。在跟踪中可以看到所有被调用的回调，包括它们的返回代码。

## 架构的要求

需要具备以下功能和配置：

**CONFIG_HOTPLUG_CPU**
这个条目需要在Kconfig中启用
**__cpu_up()**
启动一个CPU的Arch接口
**__cpu_disable()**
Arch接口关闭一个CPU，内核不能再处理中断后，例程返回。这包括关闭计时器。
**__cpu_die()**
这实际上应该确保CPU的死亡。看看其他arch中实现CPU热插拔的一些示例代码。针对特定的体系结构，处理器从idle()循环中删除。通常，剩余的cpu_die()会等待设置某个per_cpu状态，以确保调用处理器死例程，以确保得到确认。

## 用户空间的通知

在CPU成功上线或离线后udev事件被发送。udev规则如下：

```
SUBSYSTEM=="cpu", DRIVERS=="processor", DEVPATH=="/devices/system/cpu/*", RUN+="the_hotplug_receiver.sh"
```

将收到所有事件。一个脚本：

```
#!/bin/sh

if [ "${ACTION}" = "offline" ]
then
    echo "CPU ${DEVPATH##*/} offline"

elif [ "${ACTION}" = "online" ]
then
    echo "CPU ${DEVPATH##*/} online"

fi
```

可以进一步处理事件。

## 内核内联文档引用

>int cpuhp_setup_state(enum cpuhp_state state, const char * name, int (*startup)(unsigned int cpu), int (*teardown) (unsigned int cpu))

通过调用回调设置热插拔状态回调

**参数**
**enum cpuhp_state state**
调用被安装的状态
**const char * name**
回调的名称(将在调试输出中使用)
**int (*)(unsigned int cpu) startup**
启动回调函数
**int (*)(unsigned int cpu) teardown**
拆卸回调函数

**描述**
安装回调函数，并在已经到达状态的当前cpu上调用启动回调。

>int cpuhp_setup_state_nocalls(enum cpuhp_state state, const char * name, int (*startup)(unsigned int cpu), int (*teardown) (unsigned int cpu))

设置热插拔状态回调，而不调用回调

**参数**
**enum cpuhp_state state**
调用被安装的状态
**const char * name**
回调的名称。
**int (*)(unsigned int cpu) startup**
启动回调函数
**int (*)(unsigned int cpu) teardown**
拆卸回调函数

**描述**
与cpuhp_setup_state相同，只是在此回调的安装过程中没有调用执行的调用。如果SMP=n或HOTPLUG_CPU=n，请输入NOP。

>int cpuhp_setup_state_multi(enum cpuhp_state state, const char * name, int (*startup)(unsigned int cpu, struct hlist_node *node), int (*teardown) (unsigned int cpu, struct hlist_node *node))

添加多状态的回调

**参数**
**enum cpuhp_state state**
调用被安装的状态
**const char * name**
回调的名称。
**int (*)(unsigned int cpu, struct hlist_node *node) startup**
启动回调函数
**int (*)(unsigned int cpu, struct hlist_node *node) teardown**
拆卸回调函数

**描述**
设置内部的multi_instance标志，并准备一个作为多实例回调工作的状态。此时没有调用回调。一旦通过cpuhp_state_add_instance或cpuhp_state_add_instance_nocalls注册了该状态的实例，就会调用回调。

>int cpuhp_state_add_instance(enum cpuhp_state state, struct hlist_node * node)

为状态添加一个实例并调用启动回调。

**参数**
**enum cpuhp_state state**
实例安装的状态
**struct hlist_node * node**
此单个状态的节点。

**描述**
为状态安装实例，并对已经到达状态的当前cpu调用启动回调。状态之前必须由cpuhp_setup_state_multi标记为多实例。

>int cpuhp_state_add_instance_nocalls(enum cpuhp_state state, struct hlist_node * node)

为状态添加一个实例，而不调用启动回调。

**参数**
**enum cpuhp_state state**
实例安装的状态
**struct hlist_node * node**
此单个状态的节点。

**描述**
安装状态的实例cpuhp_setup_state_multi之前必须将状态标记为多实例。

>void cpuhp_remove_state(enum cpuhp_state state)

删除热插拔状态回调并调用拆卸

**参数**
**enum cpuhp_state state**
调用被删除的状态

**描述**
删除回调函数，并对已经到达状态的当前cpu调用teardown回调。

>void cpuhp_remove_state_nocalls(enum cpuhp_state state)

在不调用拆卸的情况下删除热插拔状态回调

**参数**
**enum cpuhp_state state**
调用被删除的状态

>void cpuhp_remove_multi_state(enum cpuhp_state state)

删除热插拔多状态回调

**参数**
**enum cpuhp_state state**
调用被删除的状态

**描述**
从多状态中移除回调函数。这是cpuhp_setup_state_multi()的反面。在调用此函数之前，应该删除所有实例。

>int cpuhp_state_remove_instance(enum cpuhp_state state, struct hlist_node * node)

从状态中删除热插拔实例并调用teardown回调

**参数**
**enum cpuhp_state state**
从其中删除实例的状态
**struct hlist_node * node**
此单个状态的节点。

**描述**
删除实例，并对已经到达状态的当前cpu调用teardown回调。

>int cpuhp_state_remove_instance_nocalls(enum cpuhp_state state, struct hlist_node * node)

**参数**
**enum cpuhp_state state**
从其中删除实例的状态
**struct hlist_node * node**
此单个状态的节点。

**描述**
在不调用teardown回调的情况下移除实例。