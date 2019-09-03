---
layout: post
title: 关于Linux交换分区的一切
category: 计算机
tags: [计算机, 软件]
---


----------
## 关于Linux交换分区的一切

Linux将其物理RAM(随机访问内存)划分为称为页面的内存块。交换是将一页内存复制到硬盘上预配置的空间(称为交换空间)以释放该页内存的过程。物理内存和交换空间的组合大小是可用虚拟内存的数量。

交换是必要的，原因有两个。首先，当系统需要的内存超过物理上可用的内存时，内核会交换出较少使用的页面，并将内存分配给当前需要内存的应用程序(进程)。其次，应用程序在启动阶段使用的大量页面可能只用于初始化，然后再也不会使用。系统可以交换这些页面，并将内存释放给其他应用程序，甚至磁盘缓存。

然而，交换也有缺点。与内存相比，磁盘非常慢。内存速度可以用纳秒来测量，而磁盘是用毫秒来测量的，因此访问磁盘可能比访问物理内存慢数万倍。交换发生得越多，您的系统就会越慢。有时过多的交换或颠簸发生在页面交换出去，然后很快地交换进来，然后再交换出去，等等。在这种情况下，系统很难找到空闲内存并同时运行应用程序。在这种情况下，只添加更多的RAM将有所帮助。

Linux有两种形式的交换空间：交换分区和交换文件。交换分区是硬盘的一个独立部分，仅用于交换;没有其他文件可以驻留在那里。交换文件是位于系统和数据文件之间的文件系统中的一个特殊文件。

要查看有哪些交换空间，可以使用命令swapon -s。输出将是这样的：

```
# swapon -s
Filename  Type       Size       Used Priority
/dev/sda5 partition  859436  0       -1
```

每一行都列出了系统使用的一个单独的交换空间。在这里，“Type”字段表示这个交换空间是一个分区而不是一个文件，从“Filename”可以看出它位于磁盘sda5上。Size以千字节为单位列出，而Used字段告诉我们使用了多少千字节的交换空间(在本例中为none)。' Priority '告诉Linux先使用哪个交换空间。Linux交换子系统的一个优点是，如果您以相同的优先级挂载两个(或多个)交换空间(最好挂载在两个不同的设备上)，Linux将在它们之间交错交换活动，这可以极大地提高交换性能。

要向系统添加额外的交换分区，首先需要准备它。第一步是确保该分区被标记为交换分区，第二步是创建交换文件系统。要检查分区是否标记为swap，请以root用户身份运行：

```
fdisk -l /dev/hdb
```

用系统上的硬盘设备替换/dev/hdb，并在其上使用交换分区。您应该看到这样的输出：

```
Device Boot    Start      End           Blocks  Id      System
/dev/hdb1       2328    2434    859446  82      Linux swap / Solaris
```

如果分区没有标记为swap，则需要运行fdisk并使用“t”菜单选项来更改它。使用分区时要小心——您不希望错误地删除重要的分区，或者错误地将系统分区的id更改为swap。交换分区上的所有数据都将丢失，因此请仔细检查您所做的每个更改。还要注意，Solaris的分区使用与Linux交换空间相同的ID，所以要小心不要错误地杀死Solaris分区。

一旦一个分区被标记为swap，您需要使用mkswap (make swap)命令作为根目录来准备它：

```
mkswap /dev/hdb1
```

如果没有看到错误，则可以使用交换空间。要立即激活它，请键入：

```
swapon /dev/hdb1
```

您可以通过运行swapon -s来验证它是否被使用。要在引导时自动挂载交换空间，您必须在/etc/fstab文件中添加一个条目，该文件包含一个文件系统列表和需要在引导时挂载的交换空间。每一行的格式为：

由于交换空间是一种特殊类型的文件系统，所以其中许多参数都不适用。对于交换空间，请添加：

```
/dev/hdb1       none    swap    sw      0       0
```

其中/dev/hdb1是交换分区。它没有特定的挂载点，因此没有。它的类型是swap，带有sw选项，最后两个参数没有使用，所以它们被输入为0。

要检查交换空间是否自动挂载而无需重新引导，可以运行swapoff -a命令(它关闭所有交换空间)，然后运行swapon -a(它挂载/etc/fstab文件中列出的所有交换空间)，然后使用swapon -s进行检查。

### 交换文件

除了交换分区之外，Linux还支持交换文件，您可以使用类似于交换分区的方式创建、准备和挂载该文件。交换文件的优点是，您不需要找到一个空分区或对磁盘进行重新分区来添加额外的交换空间。

要创建交换文件，请使用dd命令创建一个空文件。要创建一个1GB的文件，输入：

```
dd if=/dev/zero of=/swapfile bs=1024 count=1048576
```

/swapfile是交换文件的名称，1048576是以千字节(即1GB)为单位的大小。

像准备分区一样使用mkswap准备交换文件，但是这次使用交换文件的名称：

```
mkswap /swapfile
```

类似地，使用swapon命令挂载它:swapon /swapfile。

交换文件的/etc/fstab条目如下：

```
/swapfile       none    swap    sw      0       0
```

### 交换空间应该有多大?

可以运行一个Linux系统没有交换空间,和系统将运行如果你有大量的内存,但如果你的物理内存,那么系统将崩溃,没有别的可以做的,所以它是明智的交换空间,特别是磁盘空间相对便宜。

关键问题是多少?较老版本的unix操作系统(如Sun OS和Ultrix)需要的交换空间是物理内存的两到三倍。现代实现(如Linux)不需要那么多，但是如果您配置它，它们可以使用它。经验法则如下：1)对于桌面系统，使用双系统内存的交换空间，因为它允许您运行大量的应用程序(其中许多可能是空闲的，很容易交换)，从而为活动应用程序提供更多的RAM；2)对于服务器，可用的交换空间要小一些(比如占物理内存的一半)，以便在需要时可以灵活地进行交换，但是要监视使用的交换空间的大小，如果需要，还可以升级RAM；3)对于较老的桌面计算机(比如只有128MB)，尽可能多地使用交换空间，甚至是1GB。

Linux 2.6内核添加了一个名为swappiness的新内核参数，允许管理员调整Linux交换的方式。它是一个从0到100的数。实际上，较高的值导致更多的页面被交换，较低的值导致更多的应用程序被保存在内存中，即使它们是空闲的。内核维护人员Andrew Morton曾经说过，他以100的swappiness运行他的桌面机器，他说“我的观点是减少内核交换东西的趋势是错误的。您真的不希望数百兆字节的BloatyApp的原始内存在机器中到处流动。把它放到磁盘上，把内存用在有用的地方。”

Morton的想法的一个缺点是，如果内存交换得太快，那么应用程序的响应时间就会下降，因为当应用程序的窗口被单击时，系统必须将应用程序交换回内存，这会让它感觉很慢。

swappiness的默认值是60。你可以暂时改变它(直到你下次重新启动)键入作为根：

```
echo 50 > /proc/sys/vm/swappiness
```

如果您想永久地更改它，那么您需要更改vm。/etc/sysctl.conf文件中的swappiness参数。

### 结论

管理交换空间是系统管理的一个基本方面。良好的计划和正确的使用交换可以提供许多好处。不要害怕尝试，始终监视您的系统，以确保您得到所需的结果。