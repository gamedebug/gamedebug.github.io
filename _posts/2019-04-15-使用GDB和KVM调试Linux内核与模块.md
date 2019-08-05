---
layout: post
title: 使用GDB和KVM调试Linux内核与模块
category: Linux
tags: [计算机, 软件]
---

----------
## Linux 内核和模块调试方法简介

目前调试 Linux 内核与模块主要有 printk, /proc 和 kgdb等方法，其中最常用的的 printk。

### printk
printk 是调试内核代码时最常用的一种技术。在内核代码中的特定位置加入 printk() 调试调用，可以直接把所关心的信息打打印到屏幕上，从而可以观察程序的执行路径和所关心的变量、指针等信息。

在使用 printk 时要注意优先级的问题。通过附加不同日志级别（loglevel），或者说消息优先级，可让 printk 根据这些级别所标示的严重程度，对消息进行分类。一般采用宏来指示日志级别。在头文件 <linux/kernel.h> 中定义了 8 种可用的日志级别字符串：KERN_EMERG，KERN_ALERT，KERN_CRIT，KERN_ERR，KERN_WARNING，KERN_NOTICE，KERN_INFO，KERN_INFO。共有 8 种优先级，用户可以根据需要进行配置，也可以通过 proc/sys/kernel/printk 动态修改设置。

使用 printk 来调试内核，明显的优点是：门槛低，上手快，定位问题有帮助。其缺点是要不断的加打印和重编内核。由于 syslogd 会一直保持对其输出文件的同步刷新，每打印一行都会引起一次磁盘操作，因此大量使用 printk 会严重降低系统性能。

### /proc 文件系统
在 /proc 文件系统中，对虚拟文件的读写操作是一种与内核通信的手段。/proc 文件系统是一种特殊的、由程序创建的文件系统，内核使用它向外界输出信息。/proc 下面的每个文件都绑定于一个内核函数，这个函数在文件被读取时，动态地生成文件的“内容”。例如，/proc/modules 列出的是当前载入模块的列表。

### kdb
kdb 是 Linux 内核的补丁，它提供了一种在系统能运行时对内核内存和数据结构进行检查的办法。kdb 还有许多其他的功能，包括单步调试（根据指令，而不是 C 源代码行），在数据访问中设置断点，反汇编代码，跟踪链表，访问寄存器数据等等。加上 kdb 补丁之后，在内核源码树的 Documentation/kdb 目录可以找到完整的手册页。

kdb 的优点是不需要两台机器进行调试。缺点是只能在汇编代码级进行调试。

### gdb
gdb 全称是 GNU Debugger，是 GNU 开源组织发布的一个强大的 UNIX 下的程序调试工具。gdb 主要可帮助工程师完成下面 4 个方面的功能：

启动程序，可以按照工程师自定义的要求随心所欲的运行程序。
让被调试的程序在工程师指定的断点处停住，断点可以是条件表达式。
当程序被停住时，可以检查此时程序中所发生的事，并追索上文。
动态地改变程序的执行环境。
### kgdb
kgdb 是一个在 Linux 内核上提供完整的 gdb 调试器功能的补丁，不过仅限于 x86 系统。它通过串口连线以钩子的形式挂入目标调试系统进行工作，而在远端运行 gdb。使用 kgdb 时需要两个系统——一个用于运行调试器，另一个用于运行待调试的内核（也可以是在同一台主机上用 vmware 软件运行两个操作系统来调试）。和 kdb 一样，kgdb 目前可从 oss.sgi.com 获得。

使用 kgdb 可以进行对内核的全面调试，甚至可以调试内核的中断处理程序。如果在一些图形化的开发工具的帮助下，对内核的调试将更方便。但是，使用 kgdb 作为内核调试环境最大的不足在于对 kgdb 硬件环境的要求较高，必须使用两台计算机分别作为 target 和 development 机。尽管使 用虚拟机的方法可以只用一台 PC 即能搭建调试环境，但是对系统其他方面的性能也提出了一定的要求，同时也增加了搭建调试环境时复杂程度。另外，kgdb 内 核的编译、配置也比较复杂，需要一定的技巧。当调试过程结束后时，还需要重新制作所要发布的内核。使用 kgdb 并不能 进行全程调试，也就是说 kgdb 并不能用于调试系统一开始的初始化引导过程。

### oops
oops（也称 panic），称程序运行崩溃，程序崩溃后会产生 oops 消息。应用程序或内核线程的崩溃都会产生 oops 消息，通常发生 oops 时，系统不会发生死机，而在终端或日志中打印 oops 信息。

当使用 NULL 指针或不正确的指针值时，通常会引发一个 oops 消息，这是因为当引用一个非法指针时，页面映射机制无法将虚拟地址映像到物理地址，处理器就会向操作系统发出一个"页面失效"的信号。如果地址非法，内核就无法“换页”到并不存在的地址上；如果此时处理器处于超级用户模式，系统就会产生一个“oops”。

oops 显示发生错误时处理器的状态，包括 CPU 寄存器的内容、页描述符表的位置，以及其一些难理解的信息。这些消息由失效处理函数（arch/*/kernel/traps.c）中的 printk 语句产生。

用户处理 oops 消息的主要问题在于，我们很难从十六进制数值中看出什么内在的意义；为了使这些数据对程序员更有意义，需要把它们解析为符号。有两个工具可用来为开发人员完成这样的解析：klogd 和 ksymoops。前者只要运行就会自行进行符号解码；后者则需要用户有目的地调用。

下面讲述如何使用 gdb 在 KVM 虚拟机上调试内核和模块。本文采用的是 RedHat Enterprise Linux 7.0，在其他 Linux 创建 KVM 虚拟机的方法基本相似。

## 安装 Linux 系统并重新编译内核

使用 gdb 调试需要系统内核中包含调试信息，所以我们从头开始编译内核。本文以内核版本 3.18.2 为例。

首先要下载内核源码。内核源码的下载地址为：http://www.kernel.org

图 1. 内核源码的下载地址

![图 1. 内核源码的下载地址][1]

点击“https://www.kernel.org/pub/”链接，在页面列表中，选择“linux/ -> kernel/ -> v3.x/”。从列表中找到“linux-3.18.2.tar.gz”并点击下载。

图 2. 内核版本 3.18.2 的下载地址

![图 2. 内核版本 3.18.2 的下载地址][2]

把下载的 3.18.2 内核解压到 /usr/src/kernels/linux-3.18.2 目录下。

图 3. 内核解压缩

![图 3. 内核解压缩][3]

修改 Makefile，将“-O3”改为“-O1”, 这样编译出的内核会包含调试信息并正确的被 gdb 调试：

图 4. 修改 Makefile

![图 4. 修改 Makefile][4]

注：对于 kernel 3.18.2，-O0 级别有一个 bug，故需要改为 -O1。

清除旧的编译信息：

```
make mrproper
```

配置内核：

```
make menuconfig  .config(kgdb(kernel haking), module load)
```

编译内核：

```
make
```

编译模块：

```
make modules
```

注：所谓内核模块，是指可以在 Linux 内核中动态加载 / 卸载的模块，常以“.ko”为后缀名。

安装模块：

```
make modules_install(/lib/modules/3.18.2/)
```

安装：

```
make install
```

注：运行此命令，会在 /boot 目录下生成 3 个文件，并在 /boot 下生成 2 个链接文件。

```
(/boot/System.map -> /boot/System.map-3.18.2) 
(/boot/vmlinuz -> /boot/vmlinuz-3.18.2) 
(/boot/initramfs-3.18.2.img) 
(/boot/System.map -> /boot/System.map-3.18.2) 
(/boot/vmlinuz -> /boot/vmlinuz-3.18.2) 
(/boot/initramfs-3.18.2.img)
```

重启 Linux：

```
reboot
```

重新启动以后，检查内核版本，为 3.18.2。

图 5. 检查内核版本

![图 5. 检查内核版本][5]

至此，安装内核的工作告一段落。

## 创建支持 gdb 调试的 KVM 虚拟机

本节介绍如何在 Linux RedHat/CentOS 上创建 KVM 虚拟机，并配置虚机使其运行 gdbserver 以支持 gdb 调试。

如果 KVM 没有安装，首先安装 KVM 及相关软件。安装步骤如下：

- KVM 需要有 CPU 的支持（Intel vmx 或 AMD svm），在安装 KVM 之前检查一下 CPU 是否提供了虚拟技术的支持：

```
[root@myKVM ~]# egrep '^flags.*(vmx|svm)' /proc/cpuinfo
```

若有显示，则说明处理器具有 VT 功能。

- 在主板 BIOS 中开启 CPU 的 Virtual Technolege(VT，虚化技术 )；

- 安装 kvm 及其需要的软件包。

```
[root@myKVM ~]# yum install kvm kmod-kvm qemu kvm-qemu-img virt-viewer virt-manager libvirt libvirt-python python-virtinst
```

或

```
[root@myKVM ~]# yum groupinstall KVM
```

- 检查 kvm 模块是否安装，使用以下命令显示两个模块则表示安装完成：

```
[root@myKVM ~]# lsmod | grep kvm 
 
 kvm_intel              52570  0 
 
 kvm                   314739  1 kvm_intel
```

启动 virt-manager 管理界面。

- 客户端：使用 VNC 连接到服务器端，因为需要用服务器的图形界面。

- 服务器端：启动 libvirtd 服务，并保证下次自动启动：

```
[root@myKVM ~]# service libvirtd start 
 Starting libvirtd daemon:                                  [ 确定 ] 
 [root@myKVM ~]# chkconfig libvirtd on
```

接下来远程创建和管理 KVM 虚拟机。打开 Application -> System Tools -> Virtual Machine Manager 就可以装虚拟机了，功能跟 VMware 类似。

相关的命令有 virt-manager 和 virsh。

使用“virsh list”可以查看虚拟机是否已经创建，然后通过“virsh edit <vm_name>”可以修改 VM 配置。

根据本文的测试结果，domain type 必须改为 .../qemu/1.0 才能支持 gdb 调试。

```
<domain type='kvm' xmlns:qemu='<a href="http://libvirt.org/schemas/domain/qemu/1.0"><code>http://libvirt.org/schemas/domain/qemu/1.0</code></a>'>
```

然后添加下面的配置使得虚拟机支持 gdb 调试：

```
<qemu:commandline> 
    <qemu:arg value='-S'/> 
    <qemu:arg value='-gdb'/> 
    <qemu:arg value='tcp::1234'/> 
 </qemu:commandline>
```
 
如果创建好的虚拟机不能访问，可以使用 ping, brctl show, ps 等命令进行诊断，不再一一详述。

## 使用 gdb 调试 KVM 虚拟机的内核与模块

本节介绍如何调试 KVM 虚拟机内核和模块。并说明在调试过程中如何加载模块并链接符号表。

首先将虚拟机更新至编译好的内核。可将 vmlinux , System.map, initramfs, /lib/modules/<kernel version> 这些文件拷贝至虚拟机，或者在虚拟机上重新编译内核。

然后在主机端创建一个目录，拷贝 vmlinux 文件并进入 gdb 调试：

```
gdb vmlinux-3.18.2
```

图 6. 打开 gdb

![图 6. 打开 gdb][6]

连接虚拟机：

```
target remote 127.0.0.1:1234
```

图 7. 连接虚拟机

![图 7. 连接虚拟机][7]

此时虚拟机已经被中断。

下面在 load_module 添加断点并继续执行。

图 8. 添加断点并执行

![图 8. 添加断点并执行][8]

在虚拟机上插入需要调试的模块：

```
insmod nzuta.ko
```

图 9. 插入模块

![图 9. 插入模块][9]

在宿主机上找到调用 do_init_module 的地方，添加断点并执行到此处。

图 10. 在 do_init_module 处添加断点并执行

![图 10. 在 do_init_module 处添加断点并执行][10]

下面是关键的部分。

打印 text section，data section 和 bss section 的名称和地址：

```
print mod->sect_attrs->attrs[1]->name 
print mod->sect_attrs->attrs[7]->name 
print mod->sect_attrs->attrs[9]->name 
print /x mod->sect_attrs->attrs[1]->address 
print /x mod->sect_attrs->attrs[7]->address 
print /x mod->sect_attrs->attrs[9]->address
```

根据上面打印的地址导入编译好的内核模块（注意编译此模块需要使用与虚拟机相同的内核源码编译，也需要使用 -O1 选项）：

```
add-symbol-file /home/dawei/nzuta/nzuta.ko <text addr> -s .data <data addr> -s .bss 
 <bss addr>
```

图 11. 导入编译好的内核模块

![图 11. 导入编译好的内核模块][11]

下面就可以在模块代码中添加断点并单步调试了：

图 12. 添加断点并单步调试

![图 12. 添加断点并单步调试][12]

如果要退出 gdb，需要先使用 delete 命令清理所有断点，并 detach。

## 总结

本节总结 GDB 调试 KVM 虚机内核和模块的方法，并指出其优点和不足。

使用 GDB+KVM 调试内核和模块有几个优势。一是可以进行源码级单步调试，二是对硬件环境的要求比较简单，只需要一台主机即可。 第三是当内核或模块有问题时可以快速重启虚拟机，这一点对内核模块的开发相当重要。这种方法的局限之处在于，当需要调试硬件驱动的时候，如果这种硬件还没有被 KVM 虚拟化支持，则不能调试与此硬件有关的功能，而只能调试仅与内核操作有关的代码。


  [1]: http://static.zybuluo.com/gamedebug/w0tfkm72ip094bwzcwx2yk70/img001.png
  [2]: http://static.zybuluo.com/gamedebug/hdwxny4r5fvf1daacafg6s8b/img002.png
  [3]: http://static.zybuluo.com/gamedebug/kc2ql3a0roq5v9r8s6p0mxa6/img003.png
  [4]: http://static.zybuluo.com/gamedebug/cock6ks7v0b57fzg8kb3d1am/img004.png
  [5]: http://static.zybuluo.com/gamedebug/g1q40ja7kwy5rgulmq3iinz6/img005.png
  [6]: http://static.zybuluo.com/gamedebug/uqyubocc3tebe84jagrusqgi/img006.png
  [7]: http://static.zybuluo.com/gamedebug/t8u73hd96egekcr33i6foaaf/img007.png
  [8]: http://static.zybuluo.com/gamedebug/0tswa50f3xod4a44feqrbg0d/img008.png
  [9]: http://static.zybuluo.com/gamedebug/zmn70yu6jb436ymy983y3sjw/img009.png
  [10]: http://static.zybuluo.com/gamedebug/04cr770qtxp9yy4zrlteveer/img010.png
  [11]: http://static.zybuluo.com/gamedebug/jhmbixpl3gauvqpy11czmfny/img011.png
  [12]: http://static.zybuluo.com/gamedebug/oxs6ed2ckaonr7dzbh4kqz5u/img012.png