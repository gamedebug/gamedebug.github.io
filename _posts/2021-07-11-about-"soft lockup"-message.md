---
layout: post
title: “Bug soft lockup”消息的含义？
category: 计算机
tags: [计算机, 软件]
---


----------
## 概况
在系统日志(/var/log/messages或journalctl)中打印了大量以下消息：

```
May 25 07:23:59 XXXXXXX kernel: [13445315.881356] BUG: soft lockup - CPU#16 stuck for 23s! [yyyyyyy:81602]
```

在这些信息之后是各种堆栈跟踪。本文试图解释软锁定消息的含义。

## 解决方案

在正常情况下，如果负载减少，这些消息可能会消失。
这种“软锁定”可能发生在内核繁忙时，处理大量需要分别扫描、释放或分配的对象。
这些任务的堆栈跟踪可以初步了解这些任务在做什么。但是，为了能够检查消息背后的原因，需要一个内核转储。

虽然不能完全禁用这些消息，但在某些情况下，会增加这些消息之前的时间
解除软锁定可以缓和局势。

为此，增加以下sysctl参数:kernel.watchdog_thresh

此参数的默认值为10，将该值增加一倍可能是个不错的开始。

例如：

```
hostname:~ # echo 20 > /proc/sys/kernel/watchdog_thresh
```

又如：

```
hostname:~ # echo "kernel.watchdog_thresh=20" > /etc/sysctl.d/99-watchdog_thresh.conf
hostname:~ # sysctl -p  /etc/sysctl.d/99-watchdog_thresh.conf
```

说明如何配置和捕获内核转储的TID，本文不做赘述。

## 原因

“soft lockup”定义为导致内核在内核模式下循环超过20秒而不给其他任务运行机会的bug。
watchdog守护进程将发送一个不可屏蔽中断(NMI)给系统中的所有cpu，这些cpu依次打印当前运行任务的堆栈跟踪。