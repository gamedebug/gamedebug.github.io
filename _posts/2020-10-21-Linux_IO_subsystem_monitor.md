---
layout: post
title: 用iostat监视Linux I/O子系统
category: 计算机
tags: [计算机, 软件]
---


----------
iostat是I/O statistics（输入/输出统计）的缩写，用来动态监视系统的磁盘操作活动。

### 命令格式

iostat[参数][时间][次数]

### 命令功能

通过iostat方便查看CPU、网卡、tty设备、磁盘、CD-ROM 等等设备的活动情况, 负载信息。

### 命令参数

- -C 显示CPU使用情况
- -d 显示磁盘使用情况
- -k 以 KB 为单位显示
- -m 以 M 为单位显示
- -N 显示磁盘阵列(LVM) 信息
- -n 显示NFS 使用情况
- -p[磁盘] 显示磁盘和分区的情况
- -t 显示终端和CPU的信息
- -x 显示详细信息
- -V 显示版本信息

### 应用实例

#### 实例1：显示所有设备负载情况

```
[root@matrix ~]# iostat
Linux 5.2.4-1.el7.elrepo.x86_64 (matrix)        10/21/2020      _x86_64_        (28 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           1.36    0.00    0.28    0.44    0.00   97.92

Device:            tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
nvme0n1         244.98         1.15     19770.84    3439980 59083434252
sda               4.97         9.75        68.97   29126628  206099894
dm-0              0.02         0.01         0.06      35228     181844
dm-1              5.17         9.73        68.90   29063516  205903272
dm-2              5.17         9.73        68.90   29063516  205903272
dm-4              4.63         5.85        37.83   17485694  113045654
sdb               4.55         5.85        37.83   17484654  113045654
```

CPU属性值说明：

- %user：CPU处在用户模式下的时间百分比；
- %nice：CPU处在带NICE值的用户模式下的时间百分比；
- %system：CPU处在系统模式下的时间百分比；
- %iowait：CPU等待输入输出完成时间的百分比；
- %steal：管理程序维护另一个虚拟处理器时，虚拟CPU的无意识等待时间百分比；
- %idle：CPU空闲时间百分比。

Disk属性值说明：

- rrqm/s：每秒进行 merge 的读操作数目，即 rmerge/s；
- wrqm/s：每秒进行 merge 的写操作数目，即 wmerge/s；
- r/s：每秒完成的读 I/O 设备次数，即 rio/s；
- w/s：每秒完成的写 I/O 设备次数，即 wio/s；
- rsec/s：每秒读扇区数，即 rsect/s；
- wsec/s：每秒写扇区数，即 wsect/s；
- rkB/s：每秒读K字节数，是 rsect/s 的一半，因为每扇区大小为512字节；
- wkB/s：每秒写K字节数，是 wsect/s 的一半；
- avgrq-sz：平均每次设备I/O操作的数据大小 (扇区)；
- avgqu-sz：平均I/O队列长度；
- await：平均每次设备I/O操作的等待时间 (毫秒)；
- svctm：平均每次设备I/O操作的服务时间 (毫秒)；
- %util：一秒中有百分之多少的时间用于 I/O 操作，即被io消耗的cpu百分比。

> **注意：**如果 %util 接近 100%，说明产生的I/O请求太多，I/O系统已经满负荷，该磁盘可能存在瓶颈。如果 svctm 比较接近 await，说明 I/O 几乎没有等待时间；如果 await 远大于 svctm，说明I/O 队列太长，io响应太慢，则需要进行必要优化。如果avgqu-sz比较大，也表示有当量io在等待。

#### 实例2：定时显示所有信息

```
[root@matrix ~]# iostat 2 3
Linux 5.2.4-1.el7.elrepo.x86_64 (matrix)        10/21/2020      _x86_64_        (28 CPU)

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           1.36    0.00    0.28    0.44    0.00   97.92

Device:            tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
nvme0n1         244.98         1.15     19770.94    3439980 59094311380
sda               4.97         9.74        68.96   29126628  206128250
dm-0              0.02         0.01         0.06      35228     181844
dm-1              5.17         9.72        68.90   29063516  205931628
dm-2              5.17         9.72        68.90   29063516  205931628
dm-4              4.63         5.85        37.83   17485694  113074010
sdb               4.55         5.85        37.83   17484654  113074010

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           1.20    0.00    0.13    0.18    0.00   98.49

Device:            tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
nvme0n1         146.50         0.00     11896.00          0      23792
sda               0.00         0.00         0.00          0          0
dm-0              0.00         0.00         0.00          0          0
dm-1              0.00         0.00         0.00          0          0
dm-2              0.00         0.00         0.00          0          0
dm-4              0.00         0.00         0.00          0          0
sdb               0.00         0.00         0.00          0          0

avg-cpu:  %user   %nice %system %iowait  %steal   %idle
           1.10    0.00    0.23    0.32    0.00   98.35

Device:            tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
nvme0n1         249.00         0.00     22338.00          0      44676
sda               0.00         0.00         0.00          0          0
dm-0              0.00         0.00         0.00          0          0
dm-1              0.00         0.00         0.00          0          0
dm-2              0.00         0.00         0.00          0          0
dm-4              0.00         0.00         0.00          0          0
sdb               0.00         0.00         0.00          0          0
```

说明：每隔 2秒刷新显示，且显示3次。

#### 实例3：查看TPS和吞吐量

```
[root@matrix ~]# iostat -d -k 1 1
Linux 5.2.4-1.el7.elrepo.x86_64 (matrix)        10/21/2020      _x86_64_        (28 CPU)

Device:            tps    kB_read/s    kB_wrtn/s    kB_read    kB_wrtn
nvme0n1         244.98         1.15     19770.92    3439980 59095350656
sda               4.97         9.74        68.96   29126628  206134438
dm-0              0.02         0.01         0.06      35228     181844
dm-1              5.17         9.72        68.90   29063516  205937816
dm-2              5.17         9.72        68.90   29063516  205937816
dm-4              4.63         5.85        37.83   17485694  113080198
sdb               4.55         5.85        37.83   17484654  113080198
```

各列说明：

- tps：该设备每秒的传输次数（Indicate the number of transfers per second that were issued to the device.）。“一次传输”意思是“一次I/O请求”。多个逻辑请求可能会被合并为“一次I/O请求”。“一次传输”请求的大小是未知的；
- kB_read/s：每秒从设备（drive expressed）读取的数据量；
- kB_wrtn/s：每秒向设备（drive expressed）写入的数据量；
- kB_read：读取的总数据量；kB_wrtn：写入的总数量数据量。

这些单位都为Kilobytes。

上面的例子中，我们可以看到磁盘sda以及它的各个分区的统计数据，当时统计的磁盘总TPS是4.97，下面是各个分区的TPS。（因为是瞬间值，所以总TPS并不严格等于各个分区TPS的总和）

#### 实例4：查看设备使用率（%util）和响应时间（await）

```
[root@matrix ~]# iostat -d -x -k 1 1
Linux 5.2.4-1.el7.elrepo.x86_64 (matrix)        10/21/2020      _x86_64_        (28 CPU)

Device:         rrqm/s   wrqm/s     r/s     w/s    rkB/s    wkB/s avgrq-sz avgqu-sz   await r_await w_await  svctm  %util
nvme0n1           0.00     1.74    0.02  244.96     1.15 19770.89   161.42     0.10    0.61    1.03    0.61   0.21   5.16
sda               0.02     0.21    0.21    4.76     9.74    68.97    31.66     0.03    5.62    5.12    5.65   0.87   0.43
dm-0              0.00     0.00    0.00    0.02     0.01     0.06     6.81     0.00   12.68   21.92   11.20   0.62   0.00
dm-1              0.00     0.00    0.23    4.95     9.72    68.90    30.40     0.03    6.08    5.10    6.12   0.84   0.44
dm-2              0.00     0.00    0.23    4.95     9.72    68.90    30.40     0.03    6.08    5.10    6.12   0.84   0.44
dm-4              0.00     0.00    0.11    4.51     5.85    37.84    18.88     0.03    5.53    6.41    5.51   0.88   0.41
sdb               0.00     0.00    0.10    4.45     5.85    37.84    19.22     0.03    6.10    7.06    6.08   0.87   0.39
```

各列说明：

- rrqm/s： 每秒进行 merge 的读操作数目.即 delta(rmerge)/s；
- wrqm/s： 每秒进行 merge 的写操作数目.即 delta(wmerge)/s；
- r/s： 每秒完成的读 I/O 设备次数.即 delta(rio)/s；
- w/s： 每秒完成的写 I/O 设备次数.即 delta(wio)/s；
- rsec/s： 每秒读扇区数.即 delta(rsect)/s；
- wsec/s： 每秒写扇区数.即 delta(wsect)/s；
- rkB/s： 每秒读K字节数.是 rsect/s 的一半,因为每扇区大小为512字节(需要计算)；
- wkB/s： 每秒写K字节数.是 wsect/s 的一半(需要计算)；
- avgrq-sz：平均每次设备I/O操作的数据大小 (扇区).delta(rsect+wsect)/delta(rio+wio)
- avgqu-sz：平均I/O队列长度.即 delta(aveq)/s/1000 (因为aveq的单位为毫秒)；
- await： 平均每次设备I/O操作的等待时间(毫秒)即 delta(ruse+wuse)/delta(rio+wio)；
- svctm： 平均每次设备I/O操作的服务时间(毫秒).即 delta(use)/delta(rio+wio)；
- %util： 一秒中有百分之多少的时间用于 I/O 操作,或者说一秒中有多少时间 I/O 队列是非空的，即 delta(use)/s/1000 (因为use的单位为毫秒)。

如果 %util 接近 100%，说明产生的I/O请求太多，I/O系统已经满负荷，该磁盘可能存在瓶颈。 idle小于70% IO压力就较大了，一般读取速度有较多的wait。 同时可以结合vmstat 查看查看b参数(等待资源的进程数)和wa参数(IO等待所占用的CPU时间的百分比，高过30%时IO压力高)。

另外 await 的参数也要多和 svctm 来参考。差的过高就一定有 IO 的问题。

avgqu-sz 也是 IO 调优时需要注意的地方，这个就是直接每次操作的数据的大小，如果次数多，但数据拿的小的话，其实 IO 也会很小。如果数据拿的大，才IO 的数据会高。也可以通过 avgqu-sz × ( r/s or w/s ) = rsec/s or wsec/s。也就是讲，读定速度是这个来决定的。

svctm 一般要小于 await (因为同时等待的请求的等待时间被重复计算了)，svctm 的大小一般和磁盘性能有关，CPU/内存的负荷也会对其有影响，请求过多也会间接导致 svctm 的增加。await 的大小一般取决于服务时间(svctm) 以及 I/O 队列的长度和 I/O 请求的发出模式。如果 svctm 比较接近 await，说明 I/O 几乎没有等待时间；如果 await 远大于 svctm，说明 I/O 队列太长，应用得到的响应时间变慢，如果响应时间超过了用户可以容许的范围，这时可以考虑更换更快的磁盘，调整内核 elevator 算法，优化应用，或者升级 CPU。

队列长度(avgqu-sz)也可作为衡量系统 I/O 负荷的指标，但由于 avgqu-sz 是按照单位时间的平均值，所以不能反映瞬间的 I/O 泛洪。

**形象的比喻：**
- r/s+w/s 类似于交款人的总数；
- 平均队列长度(avgqu-sz)类似于单位时间里平均排队人的个数；
- 平均服务时间(svctm)类似于收银员的收款速度；
- 平均等待时间(await)类似于平均每人的等待时间；
- 平均I/O数据(avgrq-sz)类似于平均每人所买的东西多少；
- I/O 操作率 (%util)类似于收款台前有人排队的时间比例。

设备IO操作:总IO(io)/s = r/s(读) +w/s(写)

平均等待时间=单个I/O服务器时间*(1+2+...+请求总数-1)/请求总数

每秒发出的I/0请求很多,但是平均队列就4,表示这些请求比较均匀,大部分处理还是比较及时。