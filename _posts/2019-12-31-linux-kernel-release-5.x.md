---
layout: post
title: Linux kernel release 5.x
category: 计算机
tags: [计算机, 软件]
---


----------
这些是Linux版本5的发行说明。仔细阅读它们，因为它们会告诉你这是怎么回事，解释如何安装内核，如果出现问题该怎么做。

## Linux是什么?

Linux是操作系统Unix的克隆版，由Linus Torvalds在一个松散的网络黑客团队的帮助下从零开始编写。它的目标是POSIX和单一UNIX规范的遵从性。

它具有您在现代成熟的Unix中所期望的所有功能，包括真正的多任务处理、虚拟内存、共享库、按需加载、共享的写时复制可执行文件、适当的内存管理以及包括IPv4和IPv6在内的多堆栈网络。

它是在GNU通用公共许可证v2下发布的——有关更多细节，请参阅附带的复制文件。

## 它在什么硬件上运行?

虽然最初是为基于32位x86的pc(386或更高)开发的，但现在Linux也可以运行(至少)康柏Alpha AXP、Sun SPARC和UltraSPARC、摩托罗拉68000、PowerPC、PowerPC64、ARM、日立SuperH、Cell、IBM S/390、MIPS、HP PA-RISC、Intel IA-64、DEC VAX、AMD x86-64 Xtensa和ARC架构。

只要拥有分页内存管理单元(PMMU)和GNU C compiler (gcc)的端口(GNU compiler Collection的一部分，gcc)， Linux就很容易移植到大多数通用的32位或64位体系结构上。Linux也已经被移植到许多没有PMMU的架构上，尽管功能明显有些受限。Linux也被移植到自身。现在可以将内核作为一个用户空间应用程序来运行——这称为UserMode Linux (UML)。

## 文献

- 在Internet上和书籍中都有大量的电子文档，有特定于linux的，也有关于一般UNIX问题的。我建议在任何Linux FTP站点上查找LDP (Linux文档项目)书籍的文档子目录。这个自述并不意味着是系统上的文档:有更好的可用资源。
- 在Documentation/子目录中有各种README文件:例如，这些文件通常包含特定于内核的安装说明。请阅读文档/流程/更改。rst文件，因为它包含有关问题的信息，这些问题可能通过升级内核而导致。

## 安装内核源代码

- 如果你安装了完整的源代码，把内核tarball放在你有权限的目录下(比如你的主目录)，然后解压：

```
xz -cd linux-5.x.tar.xz | tar xvf -
```

用最新内核的版本号替换“X”。

不要使用/usr/src/linux区域!这个区域有一组(通常不完整的)内核头文件，这些头文件由库头文件使用。它们应该与库匹配，而不是被任何碰巧的内核-du-jour弄得一团糟。

- 你也可以在5.x发布的补丁之间升。补丁以xz格式发布。要通过补丁进行安装，请获取所有更新的补丁文件，输入内核源代码(linux-5.x)的顶层目录并执行：

```
xz -cd ../patch-5.x.xz | patch -p1
```
对于当前源树in_order中所有大于版本“x”的版本，替换“x”，应该没有问题。您可能希望删除备份文件(some-file-name~或some-file-name.orig)，并确保没有失败的补丁(some-file-name#或some-file-name.rej)。如果有的话，不是你就是我弄错了。

不像5的补丁。x个内核，5。x的补丁。y内核(也称为-稳定内核)不是增量的，而是直接应用于基数5。x内核。例如，如果您的基础内核是5.0，并且希望应用5.0.3补丁，则不能首先应用5.0.1和5.0.2补丁。类似地，如果您正在运行内核版本5.0.2，并且希望跳到5.0.3，那么在应用5.0.3补丁之前，必须先反转5.0.2补丁(即补丁-R)。您可以在文档/流程/应用程序补丁中了解更多信息。

或者，可以使用脚本补丁内核来自动化这个过程。它确定当前的内核版本，并应用任何补丁发现：

```
linux/scripts/patch-kernel linux
```

上面命令中的第一个参数是内核源代码的位置。补丁应用于当前目录，但是可以指定另一个目录作为第二个参数。

- 确保你没有陈旧的.o文件和依赖：

```
cd linux
make mrproper
```

现在应该已经正确安装了源代码。

## 软件需求

编译并运行5.x内核需要各种软件包的最新版本。参考文档/过程/更改。获取所需的最小版本号以及如何获取这些包的更新。请注意，使用这些包的过于旧的版本可能会导致非常难以跟踪的间接错误，所以不要以为在构建或操作期间出现明显问题时就可以更新包。

## 为内核构建目录

编译内核时，默认情况下所有输出文件都与内核源代码一起存储。使用make O=output/dir选项可以为输出文件指定一个替代位置(包括.config)。例子：

```
kernel source code: /usr/src/linux-5.x
build directory:    /home/name/build/kernel
```

要配置和构建内核，请使用：

```
cd /usr/src/linux-5.x
make O=/home/name/build/kernel menuconfig
make O=/home/name/build/kernel
sudo make O=/home/name/build/kernel modules_install install
```

请注意：如果使用O=output/dir选项，那么它必须用于make的所有调用。

## 配置内核

即使只升级一个次要版本，也不要跳过这一步。在每个版本中都会添加新的配置选项，如果没有按照预期设置配置文件，就会出现奇怪的问题。如果您希望以最少的工作量将现有配置迁移到新版本，请使用make oldconfig，它将只询问新问题的答案。

可供选择的配置命令有：

```
"make config"      Plain text interface.

"make menuconfig"  Text based color menus, radiolists & dialogs.

"make nconfig"     Enhanced text based color menus.

"make xconfig"     Qt based configuration tool.

"make gconfig"     GTK+ based configuration tool.

"make oldconfig"   Default all questions based on the contents of
                   your existing ./.config file and asking about
                   new config symbols.

"make olddefconfig"
                   Like above, but sets new symbols to their default
                   values without prompting.

"make defconfig"   Create a ./.config file by using the default
                   symbol values from either arch/$ARCH/defconfig
                   or arch/$ARCH/configs/${PLATFORM}_defconfig,
                   depending on the architecture.

"make ${PLATFORM}_defconfig"
                   Create a ./.config file by using the default
                   symbol values from
                   arch/$ARCH/configs/${PLATFORM}_defconfig.
                   Use "make help" to get a list of all available
                   platforms of your architecture.

"make allyesconfig"
                   Create a ./.config file by setting symbol
                   values to 'y' as much as possible.

"make allmodconfig"
                   Create a ./.config file by setting symbol
                   values to 'm' as much as possible.

"make allnoconfig" Create a ./.config file by setting symbol
                   values to 'n' as much as possible.

"make randconfig"  Create a ./.config file by setting symbol
                   values to random values.

"make localmodconfig" Create a config based on current config and
                      loaded modules (lsmod). Disables any module
                      option that is not needed for the loaded modules.

                      To create a localmodconfig for another machine,
                      store the lsmod of that machine into a file
                      and pass it in as a LSMOD parameter.

              target$ lsmod > /tmp/mylsmod
              target$ scp /tmp/mylsmod host:/tmp

              host$ make LSMOD=/tmp/mylsmod localmodconfig

                      The above also works when cross compiling.

"make localyesconfig" Similar to localmodconfig, except it will convert
                      all module options to built in (=y) options.

"make kvmconfig"   Enable additional options for kvm guest kernel support.

"make xenconfig"   Enable additional options for xen dom0 guest kernel
                   support.

"make tinyconfig"  Configure the tiniest possible kernel.
```

您可以在Documentation/kbuild/kconfig.rst中找到关于使用Linux内核配置工具的更多信息。

make配置说明：

- 使用不必要的驱动程序会使内核变大，并且在某些情况下会导致问题:探测不存在的控制器卡可能会使其他控制器混淆。
- 如果存在协处理器，那么编译了数学仿真的内核仍然会使用协处理器:在这种情况下，数学仿真将永远不会被使用。
内核将稍微大一些，但是可以在不同的机器上工作，不管它们是否有数学协处理器。
- “内核破解”配置细节通常会导致内核变大或变慢(或两者都是)，甚至可能通过配置一些例程来主动尝试破解坏代码以发现内核问题，从而降低内核的稳定性(kmalloc())。因此，对于“开发”、“实验”或“调试”特性的问题，您可能应该回答“n”。

## 编译内核

- 确保至少有gcc 4.6可用。有关更多信息，请参考文档/流程/更改。
请注意，您仍然可以运行a。用这个内核输出用户程序。
- 执行make操作以创建压缩的内核映像。如果您安装了lilo以适应内核的makefile，也可以进行make安装，但是您可能需要首先检查您的特定lilo设置。
要进行实际的安装，您必须是root用户，但是正常的构建都不需要root用户。不要白白取根的名字。
- 如果您将内核的任何部分配置为模块，那么还必须执行make modules_install。
- 详细的内核编译/构建输出：
通常，内核构建系统以一种相当安静的模式运行(但不是完全安静)。但是，有时您或其他内核开发人员需要在执行编译、链接或其他命令时查看它们。为此，请使用“详细”构建模式。这是通过将V=1传递给make命令来实现的，例如：

```
make V=1 all
```

要让构建系统也告诉每个目标重建的原因，使用V=2。默认值是V=0。

- 准备一个备份内核，以防出现问题。对于开发版本尤其如此，因为每个新版本都包含没有调试的新代码。还要确保对与该内核对应的模块进行备份。如果正在安装与工作内核版本号相同的新内核，请在执行make modules_install之前备份modules目录。另外，在编译之前，使用内核配置选项“LOCALVERSION”将唯一后缀附加到常规内核版本。LOCALVERSION可以在“常规设置”菜单中设置。
- 为了引导新内核，您需要将内核映像(例如…/linux/arch/x86/boot/bzImage)复制到常规可引导内核所在的位置。
- 不再支持在没有LILO等引导加载程序的帮助下直接从软盘引导内核。
如果您从硬盘驱动器引导Linux，那么您可能会使用LILO，它使用文件/etc/ LILO . confo中指定的内核映像。内核映像文件通常是/vmlinuz、/boot/vmlinuz、/bzImage或/boot/bzImage。要使用新的内核，请保存旧映像的副本，并将新映像复制到旧映像之上。然后，您必须重新运行LILO来更新加载映射!如果不这样做，就无法引导新的内核映像。
重新安装LILO通常是运行/sbin/ LILO您可能希望编辑/etc/lilo.conf来为旧的内核映像(例如，/vmlinux.old)指定一个条目，以防新映像不能工作。有关更多信息，请参阅LILO文档。
重新安装LILO之后，应该一切就绪。请关闭系统，重新启动并享受!
如果您需要更改内核映像中的默认根设备、视频模式、ramdisk大小等，请使用rdev程序(或者在适当的时候使用LILO引导选项)。不需要重新编译内核来更改这些参数。
- 使用新的内核重新启动并享受它。

## 如果出了问题

- 如果您有问题，似乎是由于内核缺陷，请检查文件维护者，看看是否有一个特定的人与您有问题的内核部分相关。如果没有人列在上面，那么最好的办法就是把它们寄给我(torvalds@linuxfoundation.org)，也可以寄给其他相关的邮件列表或新闻组。
- 在所有的bug报告中，请说明您所讨论的内核是什么，如何复制问题，以及您的设置是什么(请使用您的常识)。如果是新的问题，请告诉我，如果是旧的问题，请在第一次注意到它时告诉我。
- 如果错误结果是这样的消息：

```
unable to handle kernel paging request at address C0000010
Oops: 0002
EIP:   0010:XXXXXXXX
eax: xxxxxxxx   ebx: xxxxxxxx   ecx: xxxxxxxx   edx: xxxxxxxx
esi: xxxxxxxx   edi: xxxxxxxx   ebp: xxxxxxxx
ds: xxxx  es: xxxx  fs: xxxx  gs: xxxx
Pid: xx, process nr: xx
xx xx xx xx xx xx xx xx xx xx
```

或类似的内核调试信息在您的屏幕上或在您的系统日志中，请完全复制它。您可能无法理解该转储，但它确实包含有助于调试问题的信息。转储上面的文本也很重要:它说明了内核转储代码的原因(在上面的示例中，这是由于错误的内核指针造成的)。有关理解转储的更多信息，请参阅文档/管理员指南/bug捕获

- 如果您使用CONFIG_KALLSYMS编译内核，您可以按原样发送转储，否则您将不得不使用ksymoops程序来理解转储(但是通常更倾向于使用CONFIG_KALLSYMS进行编译)。这个实用程序可以从https://www.kernel.org/pub/linux/utils/kernel/ksymoops/下载。或者，你也可以手工进行转储查找。
- 在上面这样的调试转储中，如果您能够查找EIP值的含义，将会有很大的帮助。十六进制值本身对我或任何人都没有太大帮助:它将取决于您特定的内核设置。您应该做的是从EIP行获取十六进制值(忽略0010:)，然后在kernel namelist中查找它，看看哪个内核函数包含了错误的地址。
要找到内核函数名，您需要找到与显示症状的内核相关联的系统二进制文件。这是文件“linux/vmlinux”。要从内核崩溃中提取namelist并将其与EIP进行匹配，请执行以下操作：

```
nm vmlinux | sort | less
```

这将为您提供一个按升序排序的内核地址列表，从中很容易找到包含问题地址的函数。注意地址由内核调试消息也不一定完全匹配的函数地址(事实上,这是不太可能),那么你不能只是“grep”名单:列表将,然而,给你每个内核函数的起点,所以通过寻找函数的起始地址低于你正在寻找,但紧随其后的是一个函数与一个更高的地址你会找到一个你想要的。事实上，在您的问题报告中包含一些“上下文”可能是一个好主意，在有趣的内容周围给出几行。

如果您由于某种原因不能执行上述操作(您有一个预编译的内核映像或类似的东西)，尽可能多地告诉我您的设置将会有所帮助。请阅读管理员指南/报告错误。详细资料请参阅第一份文件。

- 或者，您可以在运行的内核上使用gdb。(只读;例如，你不能改变值或设置断点。)为此，首先用-g编译内核;适当地编辑arch/x86/Makefile，然后进行make清理。您还需要启用CONFIG_PROC_FS(通过make配置)。
在使用新内核重新启动之后，执行gdb vmlinux /proc/kcore。现在可以使用所有常用的gdb命令。查找系统崩溃点的命令是l *0xXXXXXXXX。(用EIP值替换xxx)
由于gdb(错误地)忽略了编译内核时的起始偏移量，所以gdb 'ing一个不运行的内核当前会失败。


