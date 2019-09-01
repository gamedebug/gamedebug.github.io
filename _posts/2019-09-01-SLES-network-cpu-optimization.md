---
layout: post
title: SLES 11/12：网络、CPU调优
category: 计算机
tags: [计算机, 软件]
---


----------
本文档是用于网络和CPU调优和优化的基本SLES调优指南。讨论的许多参数和设置都是Linux通用的，可以应用。在实现调优参数之前，请参阅IHV/ISV应用程序调优指南或文档。

**在开始对服务器进行调优之前，请确保使用“sysctl -A”创建当前内核设置的备份：**

```
sysctl -A > /root/sysctl.settings.backup
```

**注意：**一些调优参数和配置会积极地提高性能。**因此，如果没有在指定的测试环境中进行适当的测试，就不应该在生产环境中应用这些设置。**

## SLES11/12网络调优

网络协议栈中的网络调优包括：

**a)** 调整数据包本身
**b)** TCP/IP栈最后
**c)** 服务器上使用的应用程序栈。调优应用程序堆栈超出了本文的范围，请参阅ISV/应用程序供应商文档，以调优和优化应用程序堆栈，以提高应用程序的特定性能。根据您的internet连接和最大带宽/延迟，其中一些值可以相应地进行微调。

### SLES内核包优化：

Linux内核为发生的每个网络连接分配套接字。套接字是通信通道的两端，每个套接字都有一个接收和发送缓冲区，也称为接收和写入缓冲区。当这些缓冲区被填满时，它不再接受任何数据。因此，没有新的数据可以处理，数据包往往会被丢弃。

这将对服务器网络性能产生负面影响，因为在任何数据包丢失的情况下都必须重新发送和处理数据包。

对于网络上所有预留的套接字，调优来自两个proc可调项，它们是：

```
/proc/sys/net/core/wmem_default
/proc/sys/net/core/rmem_default
```

对于网络中的任何数据包丢失，调优这两个网络参数都非常有用。

当SLES服务器启动时，这两个参数的值会自动计算和设置，但很多时候这些值不是最佳值，可以进一步进行微调。在大约6gb RAM的服务器上，默认情况下这些参数的大小设置为大约4mb，在这种情况下，如果将值更改为8MB或12MB(对于具有大RAM的服务器)，您可能会受益。例如，如果数值由默认值4194304 KB (4MB)更改为更合适的12mb，则这些参数会是：

```
echo 12582912 > /proc/sys/net/core/rmem_max
echo 12582912 > /proc/sys/net/core/wmem_max
```

要使这些值在重启后保持一致：

```
sysctl -w net.core.rmem_max=12582912
sysctl -w net.core.wmem_max=12582912
```

在增加读和写缓冲区大小时，增加队列大小以容纳最大的传入包也是非常重要的。这可以通过调优netdev_max_backlog参数来实现。SLES中此参数的默认值设置为1000，可以通过将队列大小增加到与网络性能一致的较高值来进一步微调队列大小。将值增加到更高的值(i。是可取的，特别是在服务器上，您期待延迟或更高数量的包下降。

```
echo 9000 > /proc/sys/net/core/netdev_max_backlog
sysctl -w net.core.netdev_max_backlog=9000
```

增加队列大小为传入的连接以及改善读/写缓冲区将显著改善网络性能,这个值在SLES somaxconn来自参数,默认值为128,翻倍的大小和增加到一个可接受的值256年或512年可能更合适,如：

```
echo 512 > /proc/sys/net/core/somaxconn
sysctl -w net.core.somaxconn=512
```

内核上的所有这些参数都将有助于减少服务器上的数据包丢失，并提高网络性能。

### SLES的基本TCP/IP优化

TCP/IP有自己的读和写缓冲区，这些缓冲区被写入文件tcp_rmem和tcp_wmem。默认情况下，内核在引导期间自动设置这些值，但是可以进一步优化这些值以提高性能。在具有6GB RAM的系统上，它的设置为6MB，可以将其调优为9mb

读写缓冲区的缓冲区大小可以设置为相同的值。

在调优这些值之前，请确保服务器上有足够的RAM，因为分配给TCP读和写缓冲区的RAM不能由OS分配给其他用途。

```
echo "4096 87380 9437184" > /proc/sys/net/ipv4/tcp_rmem
echo "4096 87380 9437184" > /proc/sys/net/ipv4/tcp_wmem
sysctl -w net.ipv4.tcp_rmem="4096 87380 9437184"
sysctl -w net.ipv4.tcp_wmem="4096 87380 9437184"
```

### 禁用TCP时间戳

关闭TCP时间戳有助于减少与时间戳生成相关的性能问题。时间戳是TCP头的一个可选元素，即使从安全性方面考虑，也应该禁用它。

```
echo 0 > /proc/sys/net/ipv4/tcp_timestamps
sysctl -w net.ipv4.tcp_timestamps=0
```

### 禁用TCP SACK、DSACK、FACK

如果您的网络处于高带宽上，那么您可以尝试禁用默认启用的tcp_sack参数。启用tcp_sack有助于以有效的方式处理网络流量，这意味着只发送被丢弃的网络包，而不是整个包流。这对于大多数情况都是很好的，但是如果您的网络具有高带宽(10G)，这也意味着发送的选择性数据包必须进行碎片整理，并按照正确的顺序排列，需要大的TCP接收缓冲区，并且需要更多的内存使用。

对于低带宽网络，保持tcp_sack参数为(1)比较好，但是对于高带宽网络，可以禁用tcp_sack参数以提高网络性能。同样的事情也可以通过

```
echo 0 > /proc/sys/net/ipv4/tcp_sack
sysctl -w net.ipv4.tcp_sack=0
```

禁用选择性TCP确认还强制禁用相应的相关参数，即针对特定包类型的tcp_dsack和tcp_fack。

```
echo 0 > /proc/sys/net/ipv4/tcp_fack
echo 0 > /proc/sys/net/ipv4/tcp_dsack
sysctl -w net.ipv4.tcp_dsack=0
sysctl -w net.ipv4.tcp_fack=0
```

### IP碎片

在SLES中，默认情况下启用了选择性数据包确认，尽管如上所述，可以在一定条件下禁用选择性数据包确认，以提高性能，但如果它仍然启用，这是默认的(i。将e tcp_sack参数设置为1)将为传入包缓冲区预留的内存调优设置为足够高的值。有两个参数需要调优:ipfrag_low_tresh和ipfrag_high_tresh。

ipfrag_high_thresh告诉内核用于重新组装IP片段的最大内存量。当且如果达到高阈值，片段处理程序将抛出所有包，直到内存使用达到ipfrag_low_thresh。这意味着在这段时间内到达我们的所有碎片都必须重新传输。

如果数据包太大而不能通过某个管道，那么它们就会被分割。如果它们太大，试图传输它们的盒子就会把它们分解成更小的片段，然后一个一个地发送出去。当这些片段到达目的地时，需要对它们进行碎片整理(即重新组合)，以便正确读取。

```
echo 393216 > /proc/sys/net/ipv4/ipfrag_low_thresh
echo 544288 > /proc/sys/net/ipv4/ipfrag_high_thresh
sysctl -w net.ipv4.ipfrag_low_thresh=393216
sysctl -w net.ipv4.ipfrag_high_thresh=544288
```

### TCP SYN队列

所有传入的TCP连接都要排队，直到它们成为服务为止。为每个端口创建一个TCP Syn队列。一旦队列被归档，连接就开始被删除。

每个端口的默认值非常低:为每个端口保留1024或2048字节。有机会增加预留端口的大小，以获得更好的性能，这些端口由tcp_max_syn_backlog参数管理，为了提高性能，可以将其更改为：

```
echo 8192 > /proc/sys/net/ipv4/tcp_max_syn_backlog
sysctl -w net.ipv4.tcp_max_syn_backlog=8192
```

### TCP重试

tcp_synack_retries参数将定义内核向新传入的连接请求发送响应的次数。默认情况下，SLES中的值设置为5，对于连接1G到10G的客户网络，这个值可以进一步减少到3，因为服务器通常很忙，将重试次数减少到3将有助于提高网络性能。

```
echo 3 > /proc/sys/net/ipv4/tcp_synack_retries
sysctl -w net.ipv4.tcp_synack_retries=3
```

提高服务器性能的另一种方法是减少synack_retry的值：减少为远程主机建立连接重新发送数据的重试次数将提高服务器使用it资源的能力。SLES中tcp_retries2的默认值为15，可以将其减少到6。

```
echo 6 > /proc/sys/net/ipv4/tcp_retries2
sysctl -w net.ipv4.tcp_retries2=6
```

### TCP保持活动时间

tcp_keepalive_time选项将确定已建立的非活动连接将维持多长时间。默认值是7200秒，这相当大，如果有太多的请求进入，服务器可能会耗尽资源。把它降低到更低的价值是有好处的。

```
echo 1000 > /proc/sys/net/ipv4/tcp_keepalive_time
sysctl -w net.ipv4.tcp_keepalive_time=1000
```

**tcp_keepalive_probe**选项将确定数据包在被声明为死连接之前发送到服务器的次数。keepalive探测的默认值是9，可以将其减少到4，以便更快地终止死连接。

```
echo 4 > /proc/sys/net/ipv4/tcp_keepalive_probes
sysctl -w net.ipv4.tcp_keepalive_probes=4
```

### TCP保持探测活动

tcp_keepalive_intvl参数允许您控制要发送keepalive探测的间隔。默认情况下，在SLES中这个间隔周期是每75秒，这是非常高的，因为您的服务器看到连接失败的时间将超过4分钟。这个参数的合理值是20。

```
echo 20 > /proc/sys/net/ipv4/tcp_keepalive_intvl
sysctl -w net.ipv4.tcp_keepalive_intvl=20
```

### TCP_TW_RECYCLE

它支持快速回收TIME_WAIT套接字。默认值为0(禁用)，这可以启用。

```
echo 1 > /proc/sys/net/ipv4/tcp_tw_recycle
sysctl -w net.ipv4.tcp_tw_recycle=1
```

### TCP_TW_REUSE

这允许在TIME_WAIT状态下重用套接字来创建新的连接。SLES默认值为0(禁用)。可以启用它。

```
echo 1 > /proc/sys/net/ipv4/tcp_tw_reuse
sysctl -w net.ipv4.tcp_tw_reuse=1
```

内核倾向于在重用套接字之前等待一段时间。启用tcp_tw_reuse和tcp_tw_recycle参数都是有益的，这样可以更快地重用套接字。

### TCP_FIN_TIMEOUT

此设置确定TCP/IP释放关闭连接以重用其资源之前必须经过的时间。在这种情况下，与建立新连接相比，重新打开到客户机的连接的成本更低。如果降低此设置的值，TCP/IP可以更快地释放关闭的连接，为新连接分配更多的资源。SLES中tcp_fin_timeout的默认值为60，可以将其减少到30。

```
echo 30 > /proc/sys/net/ipv4/tcp_fin_timeout
sysctl -w net.ipv4.tcp_fin_timeout=30
```

### 巨型帧

网络接口的最大传输单元(MTU)是可以作为单个单元传输的最大数据块的大小。任何大于MTU的设备在传输前都必须分解成更小的单元。

增加MTU的大小可以提高高速以太网的吞吐量。标准以太网MTU保持在1500字节，现代网络设备能够处理更大的帧，但必须相应地配置。利用这种能力的帧被称为“巨型帧”，9000字节是MTU的常用选择。

可以通过配置文件/etc/sysconfig/network/ifcfg-eth0将eth0以太网的SLES的MTU值持续增加，并将编辑参数设置为MTU= ' 9000 '。

与此同时，还推荐了启用巨型帧的主机参数，即启用tcp_mtu_probe。

```
echo 1 > /proc/sys/net/ipv4/tcp_mtu_probing
net.ipv4.tcp_mtu_probing=1
```

启用巨型帧并使其非持久性。

```
ifconfig eth0 mtu 9000
```

## SLES网络/内核安全

文中提到了SLES11/12推荐的一些最佳实践，其中一些参数在SLES中默认启用，而其他参数必须启用。要获得这些设置的当前状态，可以查询内核(/proc/sys/net/ipv4/conf/all/)。在进行任何更改之前，最好存储缺省内核设置(sysctl - > /root/sysctl.settings.store)的输出。

**1)** 启用TCP SYN Cookie保护

```
echo 1 > /proc/sys/net/ipv4/tcp_syncookies
sysctl -w net.ipv4.tcp_syncookies=1
```

**2)禁** 用IP源路由

```
echo 0 > /proc/sys/net/ipv4/conf/all/accept_source_route
sysctl -w net.ipv4.conf.all.accept_source_route=0
```

**3)** 禁用ICMP重定向接受

```
echo 0 > /proc/sys/net/ipv4/conf/all/accept_redirects
sysctl -w net.ipv4.conf.all.accept_redirects=0
```

**4)** 启用IP欺骗干扰保护

```
echo 1 > /proc/sys/net/ipv4/conf/all/rp_filter
sysctl -w net.ipv4.conf.all.rp_filter=1
```

**5)** 启用对ICMP请求的忽略

```
echo 1 > /proc/sys/net/ipv4/icmp_echo_ignore_all
sysctl -w net.ipv4.icmp_echo_ignore_all=1
```

**6)** 启用忽略广播请求

```
echo 1 > /proc/sys/net/ipv4/echo_ignore_broadcasts
sysctl -w net.ipv4.icmp_echo_ignore_broadcasts=1
```

**7)** 启用错误消息保护

```
echo 1 > /proc/sys/net/ipv4/icmp_ignore_bogus_error_responses
sysctl -w net.ipv4.icmp_ignore_bogus_error_responses=1
```

**8)** 启用对欺骗包、源路由包、重定向包的日志记录

```
echo 1 > /proc/sys/net/ipv4/conf/all/log_martians
sysctl -w net.ipv4.conf.all.log_martians=1
```

**9)** 虚拟地址空间随机化

```
echo 2 > /proc/sys/kernel/randomize_va_space ;
sysctl -w kernel.randomize_va_space=2
```

**10)** 启用kptr_restrict

```
echo 1 > /proc/sys/kernel/kptr_restrict ;
sysctl -w kernel.kptr_restrict=1
```

**11)** 文件系统硬化

```
echo 1 > /proc/sys/fs/protected_hardlinks
echo 1 > /proc/sys/fs/protected_symlinks
```

## SLES一般网络最佳实践

1. 确保您的SLES上有最新的网络驱动程序模块，这些模块提供了最新的内核更新。
2. 使用网卡链接聚合使服务器中的网卡性能加倍。(如果连接开关支持802.3ad键合，则提供动态链路聚合。)
3. 需要检查网络上的以太网配置设置，如帧大小、MTU、速度和双工模式，以获得最佳性能，确保网络通信中涉及的所有设备都使用类似或相同的设置。

## SLES CPU调优

Linux内核确保所有的进程能公平地占用CPU时间，这将确保没有一个进程缺乏CPU时间甚至所有的进程线程处理方式和CPU调度程序确保没有延迟和共享CPU周期同样在所有涉及的过程。

很多进程可能会涉及到一些I/O操作，这是非常合乎逻辑的，内核会暂停这些进程一段时间，而在I/O操作期间CPU周期不可用，进程线程可以处理它的IO。

在多核/多核环境下，与单CPU系统相比，调度策略趋于复杂。虽然在单CPU系统内核中，可以确保所有进程获得对单个CPU的相当多的访问时间，但是在多CPU环境中，它必须确保在所有CPU之间获得相当均衡的时间，内核试图在可用CPU之间均衡进程线程。为此，Linux使用SMP内核。

CPU系统还允许应用程序移动其他的进程和线程CPU或核心虽然看起来不错,但在将进程/线程移动到其他CPU缓存数据也随着移动过程,这对于CPU周期可以是昂贵的过程,这可以减缓这个过程在多CPU系统。

虽然许多应用程序被设计成使用多cpu并能够有效地使用它们，但其他应用程序则依赖内核来让它们的应用程序进程线程最好地利用多cpu环境。

由于多cpu系统已经成为一种规范，所以在SMP环境中，一个异常性能改进处理进程的优先级和优化。

实时Linux系统运行正常的流程和过程,并同时内核调度器总是运行的实时进程与其他高优先级进程仍将需要分享剩余的可用的CPU周期,taskset就是这样一个命令可用于进程绑定到一个或多个CPU或多个CPU设置CPU关联过程。

### Taskset

CPU关联性表示为位掩码，掩码中的每个位表示一个CPU内核。如果位设置为1，那么线程可以在该核心上运行，如果位设置为0，那么线程将被排除在核心上运行。关联位掩码的默认值是所有允许线程/中断在任何核心上运行的值。可以通过更改进程的关联性来指示进程在选定的cpu上运行。子进程继承其父进程的CPU相似性。

一些映射值0 x00000001或0 x1是指处理器0或CPU0同样价值0 x00000002或0 x2处理器代表1或CPU1, 0 x00000003 0和1或0 x3指处理器同样是0 x00000004或0 x4处理器2或CPU2 x00000008或0×8 CPU3等等。

例如，使用PID 5384设置进程与处理器0的亲缘关系。

```
taskset -p 0x1 5384 or taskset -p 0x00000001 5384
```

类似于将关联设置为处理器0和1

```
taskset -p 0x3 5384或taskset -p 0x00000003 5385
```

Taskset可以和cset一起使用，将进程分配给多个CPU。

### SMP_AFFINITY

对称多处理是内核的一个特性，它允许多个CPU处理程序。smp_affinity文件(/proc/irq/<irq_number>/smp_affinity)持有一个IRQ号的中断关联值。您可以使用用于taskset的位掩码来为IRQ设置CPU关联性。

例如，Etherner驱动程序etho (eth0,eth1是聚合网络(bond0))的smp_affinity条目

```
grep eth0 /proc/interrupts
19:   6675     IO-APIC-fasteoi      eth0,eth1
```

eth0的IRQ号为19，对应的smp_affinity文件位于：

```
cat /proc/irq/19/smp_affinity
1
```

在这种情况下，CPU0将为以太网驱动程序的所有IRQ相关请求提供服务。如果您想让IRQ在CPU1上工作，请使用以下命令：

```
echo 2 > /proc/irq/19/smp_affinity
```

### Niceness:

在Linux中，每个进程都以相同的优先级开始。内核可以通过进程nice级别(也称为niceness)确定哪些进程需要比其他进程更多的CPU时间。进程的nice级别越高，它从其他进程占用的CPU时间就越少。使用nice命令进程的niceness可以调整为-20，这使进程具有更高的调度优先级/CPU时间，值为19，这是对CPU最不利的。

root用户有权提高或降低任何用户的nice值，普通用户只能降低进程的优先级，即设置更高的nice值。启动的所有进程的默认niceness级别为0。

运行nice命令将给定命令的当前nice级别增加10。使用nice -n级命令可以指定相对于当前级别的新尼斯。您还可以使用renice命令来调整命令的精度，renice命令与PID一起使用，您可以在PID上调整进程的优先级，您可以使用top或ps命令来查找进程的PID。

若要重新启用某个特定用户拥有的所有进程，请使用选项-u user。使用选项-g进程组id来重命名进程组。

例如，以更高的优先级启动gimp

```
nice -n -8 gimp
```

对于已经运行的进程，可以使用renice命令更改nice值：

```
renice -19 4358 ( renice process 4358 by -19 )
renice -15 `pgrep -u sascha spamd` ( renice user sascha spamd process by -15)
```
### 优化SLES CPU调度程序

从2.6.23开始，完全公平调度程序(CFS)就成为Linux内核的默认调度程序。它确保所有进程获得公平的CPU时间份额，并且这样做有最小的延迟。

在Linux调度器上进行调优需要非常小心，因为调度器会自我调优以获得最佳性能。要获取CPU调度程序相关变量的列表，请运行该命令。

```
sysctl -A | grep "sched" | grep -v"domain"
```

注意，以_ns和_us结尾的变量分别接受以纳秒和微秒为单位的值。如前所述，CPU调度器相关变量不需要修改，但是如果您有一个使用Java的应用程序，或者如果应用程序在父进程之前运行，那么可以进行一些调优。

#### 为Java应用程序优化CPU

**sched_compat_yield：**启用2.6.23内核之前使用的旧0(1)调度器的主动屈服行为。广泛使用同步的Java应用程序在将这个值设置为1时性能更好。依赖于sched_yield()系统调用行为的应用程序可以在将值设置为1时更好地执行。只有在性能下降时才使用它。默认值为0。要将调度程序值设置为1:

```
echo "1" > /proc/sys/kernel/sched_compat_yield
sysctl -w kernel.sched_compat_yield=1
```

在创建应用程序时，如果希望首先在父进程上运行子进程，那么更改sched_child_runs_first参数将非常有用。
如果分岔后的子进程先运行，在具有多个CPU的服务器中，父进程和子进程接收的时间片可能是相同的，那么一些应用程序的性能会更好。
在更改值之前，请检查您的应用程序ISV文档。若要将默认值从0更改为1：

```
echo "1" > /proc/sys/kernel/sched_child_runs_first
sysctl -w kernel.sched_child_runs_first=1
```

CPU附加参数：cgroups、CFS调度程序特性和调优等将今后讨论。