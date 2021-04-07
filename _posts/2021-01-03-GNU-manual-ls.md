---
layout: post
title: Linux命令手册--ls
category: 计算机
tags: [计算机, 软件, GNU手册]
---


----------
Linux所有命令的详细帮助信息，均可以通过man命令获取，这里只是将这些手册内容译成中文，进一步帮助阅读。

LS(1) 

### 名字

ls -列出目录内容

### 概要

ls [OPTION]... [FILE]...

### 描述

列出文件信息(默认为当前目录)。如果没有指定-cftuvSUX或--Sort参数，则按字母顺序对条目进行排序。

长选项的强制性参数对于短选项同样适用。

**-a, --all**

不要忽略以.开头的条目

**-A, --almost-all**

不列出隐含条目.和..

**--author**

使用-l，打印每个文件的作者

**-b, --escape**

打印非图形字符的C样式转义符

**--block-size=SIZE**

在打印前按尺寸大小缩放尺寸;例如，'——block-size=M'以1,048,576字节为单位打印大小;尺寸格式见下文

**-B, --ignore-backups**

不列出以〜结尾的隐含条目

**-c**

 与-lt并用：按并显示ctime（文件状态信息的最后修改时间）；使用-l：显示ctime并按名称排序；否则：按ctime排序，最新的优先

**-C**

按列列出条目

**--color[=WHEN]**

着色输出； WHEN可以为“从不”，“自动”或“始终”（默认值）；下面的更多信息

**-d, --directory**

列出目录本身，而不是目录的内容

**-D, --dired**

生成为Emacs的dired模式设计的输出

**-f**

不排序，启用-aU，禁用-ls --color

**-F, --classify**

将指示符（* / => @ |之一）附加到条目

**--file-type**

类似的，除了不附加“*”

**--format=WORD**

跨-x，逗号-m，水平-x，长-l，单列-1，详细-l，垂直-C

**--full-time**

类似于-l --time-style = full-iso

**-g**

类似于-l，但不列出所有者

**--group-directories-first**

在文件之前对目录进行分组；
可以使用--sort选项进行扩充，但是--sort = none（-U）​​的任何使用都将禁用分组

**-G, --no-group**

在长列表中，不打印组名

**-h, --human-readable**

与-l同时使用，以人类可读的格式打印大小（例如1K 234M 2G）

**--si**

类似的，但使用1000的幂而不是1024

**-H, --dereference-command-line**

遵循命令行上列出的符号链接

**--dereference-command-line-symlink-to-dir**

跟随每个命令行符号链接
指向目录

**--hide=PATTERN**

不列出与shell PATTERN匹配的隐式条目（由-a或-A覆盖）

**--indicator-style=WORD**

将带有WORD样式的指示符追加到条目名称：无（默认），斜杠（-p），文件类型（--file-type），分类（-F）

**-i, --inode**

打印每个文件的索引号

**-I, --ignore=PATTERN**

不列出与shell PATTERN匹配的隐式条目

**-k, --kibibytes**

磁盘使用情况默认为​​1024字节块

**-l**

使用长列表格式

**-L, --dereference**

当显示符号链接的文件信息时，请显示链接引用的文件信息，而不是链接本身

**-m**

用逗号分隔的条目列表填充宽度

**-n, --numeric-uid-gid**

类似于-l，但列出数字用户名和组ID

**-N, --literal**

打印原始条目名称（不要特殊处理例如控制字符）

**-o**

类似于-l，但不列出组信息

**-p, --indicator-style=slash**

将/指示器附加到目录

**-q, --hide-control-chars**

打印？而不是非图形字符

**--show-control-chars**

按原样显示非图形字符（默认值，除非程序为“ ls”且输出为终端）

**-Q, --quote-name**

条目名称用双引号引起来

**--quoting-style=WORD**

为条目名称使用引号WORD：文字，语言环境，shell，shell-always，c，转义

**-r, --reverse**

排序时倒序

**-R, --recursive**

递归列出子目录

**-s, --size**

以块为单位打印每个文件的分配大小

**-S**

按文件大小排序

**--sort=WORD**

按WORD而不是名称排序：无（-U），大小（-S），时间（-t），版本（-v），扩展名（-X）

**--time=WORD**

使用-l，将时间显示为WORD而不是默认的修改时间：atime或访问或使用（-u）ctime或状态（-c）；如果--sort = time也使用指定的时间作为排序键

**--time-style=STYLE**

使用-l时，使用样式STYLE显示时间：完全等，长等，等，语言环境或+ FORMAT； FORMAT的解释方式类似于'date'；如果FORMAT是FORMAT1<换行>FORMAT2，则FORMAT1适用于非最新文件，FORMAT2到最新文件；如果STYLE带有'posix-'前缀，则STYLE仅在POSIX语言环境外生效

**-t**

按修改时间排序，最新的优先

**-T, --tabsize=COLS**

假定制表符在每个COLS处停止而不是8个

**-u**

与-lt并用：按访问时间排序并显示；-l：显示访问时间并按名称排序；否则：按访问时间排序

**-U**

不排序按目录顺序列出条目

**-v**

文本中自然的（版本）数字排序

**-w, --width=COLS**

假定屏幕宽度而不是当前值

**-x**

按行而不是按列列出条目

**-X**

按条目扩展名的字母顺序排序

**-1**

每行列出一个文件

### SELinux选项：

**--lcontext**

显示安全上下文。启用-l。对于大多数显示器而言，行可能太宽。

**-Z, --context**

显示安全性上下文，因此适合大多数显示器。仅显示模式，用户，组，安全性上下文和文件名。

**--scontext**

仅显示安全上下文和文件名。

**--help**

显示此帮助并退出

**--version**

输出版本信息并退出

SIZE是整数和可选单位（例如：10M是10 * 1024 * 1024）。单位为K，M，G，T，P，E，Z，Y（1024的幂）或KB，MB，...（1000的幂）。

使用颜色来区分文件类型在默认情况下和使用--color=never时都是禁用的。使用--color=auto, ls只在连接到标准输出时发出颜色代码到一个终端。LS_COLORS环境变量可以更改设置。使用dircolors命令设置它。

### 退出状态：

**0**  执行正确，正常退出，

**1**  执行过程中出现小问题(例如，无法访问子目录)，

**2**  执行过程中出现问题严重(例如，无法访问命令行参数)。

GNU coreutils联机帮助:<http://www.gnu.org/software/coreutils/>报告ls翻译错误到<http://translationproject.org/team/>

### 作者：

作者Richard M. Stallman和David MacKenzie。

### 版权：
ls的完整文档是作为Texinfo手册维护的。如果您的站点上正确安装了info和ls程序，则命令
info coreutils 'ls invocation'
应该能让你看到完整的手册。

GNU coreutils 8.22
November 2020
LS(1)
