---
layout: post
title: Linux系统审计
category: Linux
tags: [Linux, 系统管理]
---


----------
## 通过Audit守护进程配置和审计Linux系统
Linux audit守护进程是一个框架，它允许审计Linux系统上的事件。在本文中，我们将了解如何安装、配置和使用框架执行Linux系统和安全审计。


----------


### 审计目标
通过使用强大的审计框架，系统可以跟踪许多事件类型来监视和审计系统。例子包括:
- 审核文件访问和修改
- 查看是谁更改了特定的文件
- 检测未经授权的更改
- 监控系统调用和功能
- 检测异常，如崩溃进程
- 设置绊线用于入侵检测
- 记录单个用户使用的命令


----------


### 组件

该框架本身有几个组成部分:

#### 内核:

- **audit:** 挂接到内核中，以捕获事件并将其交付给auditd


#### 二进制文件:

- **auditd:** 捕获事件并存储事件的守护进程(日志文件)
- **auditctl:** 用于配置auditd的客户端工具
- **audispd:** 多路事件的守护进程
- **aureport:** 从日志文件中读取的报告工具(auditd.log)
- **ausearch:** 事件查看器(auditd.log)
- **autrace:** 使用内核中的审计组件跟踪二进制文件
- **aulast:** 与last类似，但使用审计框架安装
- **aulastlog:** 与lastlog类似，也使用审计框架
- **ausyscall:** 映射syscall ID和名称
- **auvirt:** 显示关于虚拟机的审计信息

#### 文件:

- **audit.rule:** auditctl用于读取需要使用的规则
- **auditd.conf:** auditd的配置文件


----------


### 安装

**Debian/Ubuntu:** apt-get install auditd aud -plugins

**Red Hat/CentOS/Fedora:** 通常已经安装(包:audit和audit-libs)


----------
### 配置

审计守护进程的配置由两个文件安排，一个文件用于守护进程本身(**auditd.conf**)，另一个文件用于auditctl工具使用的规则(**audit.rules**)。

#### auditd.conf

文件**auditd.conf**配置Linux审计守护进程(auditd)，重点关注它应该在何处以及如何记录事件。它还定义了如何处理满磁盘、日志旋转和要保留的日志数量。通常，默认配置适用于大多数系统。

#### audit.rules

要配置应该审计哪些事件，审计框架使用一个名为**udit.rules**的规则文件。

和大多数事情一样，使用一个干净的开始，没有任何加载的规则。活动规则可以通过使用-l参数运行**auditctl**来确定。

```
[root@host ~]# auditctl -l
No rules
```

如果加载了任何规则，则使用**auditctl**和-D参数删除它们。

现在开始监视一些东西，比如**/etc/passwd**文件。我们把一个'watch'的文件，通过定义路径和权限，以寻找:

```
auditctl -a exit,always -F path=/etc/passwd -F perm=wa
```

通过定义path选项，我们指示审计框架要监视哪个目录或文件。权限决定触发事件的访问类型。尽管这些看起来类似于文件权限，但请注意这两者之间有一个重要的区别。这四个选项是:

- r =读
- w =写
- x =执行
- a =属性更改

通过使用**ausearch**工具，可以快速找到相关事件或对文件的访问。

```
[root@host audit]# ausearch -f /etc/passwd
time->Tue Mar 18 15:17:25 2014
type=PATH msg=audit(1395152245.230:533): item=0 name=”/etc/passwd” inode=137627 dev=fd:00 mode=0100644 ouid=0 ogid=0 rdev=00:00 obj=system_u:object_r:etc_t:s0 nametype=NORMAL
type=CWD msg=audit(1395152245.230:533):  cwd=”/etc/audit”
type=SYSCALL msg=audit(1395152245.230:533): arch=c000003e syscall=188 success=yes exit=0 a0=d14410 a1=7f66eec38db7 a2=d4ea60 a3=1c items=1 ppid=1109 pid=4900 auid=0 uid=0 gid=0 euid=0 suid=0 fsuid=0 egid=0 sgid=0 fsgid=0 tty=pts0 ses=2 comm=”vi” exe=”/bin/vi” subj=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023 key=(null)
```

这一输出的一些亮点是:

事件的**时间(time)**和对象的**名称(name)**、当前工作路径**(cwd)**、相关的**syscall**、审计用户ID **(auid)**和对文件执行操作的二进制文件**(exe)**。请注意，auid在登录期间定义了原始用户。其他用户ID字段可能表示不同的用户，这取决于触发事件时使用的有效用户。

#### 将系统调用

系统调用由一个数值记录。由于这些值在不同体系结构之间会有重叠，所以活动体系结构也会被记录下来。

通过使用**uname -m**，我们可以确定体系结构，并使用**ausyscall**确定数字调用188代表什么。

```
[root@host audit]# ausyscall x86_64 188
setxattr
```

现在我们知道这是属性的更改，这在我们定义手表以触发属性更改上的事件时是有意义的(perm=a)。

使用临时规则并希望再次使用旧规则?从文件中刷新审计规则:

```
auditctl -R /etc/audit/audit.rules
```


----------
### Linux下进程的审计

与使用strace类似，审计框架也有一个名为autrace的工具。它使用审计框架并添加正确的规则来捕获信息并记录信息。使用ausearch可以显示收集到的信息。

执行跟踪:

```
root@host:~# autrace /bin/ls /tmp
autrace cannot be run with rules loaded.
Please delete all rules using ‘auditctl -D’ if you really wanted to
run this command.
root@host:~# auditctl -D
No rules
root@host:~# autrace /bin/ls /tmp
Waiting to execute: /bin/ls
atop.d  mc-root  mongodb-27017.sock  suds
Cleaning up…
Trace complete. You can locate the records with ‘ausearch -i -p 20314’
```

通过**ausearch**显示相关文件:

```
root@host:~# ausearch –start recent -p 21023 –raw | aureport –file –summary

File Summary Report
===========================
total  file
===========================
1  /bin/ls
1  (null) inode=1975164 dev=08:02 mode=0100755 ouid=0 ogid=0 rdev=00:00
1  /etc/ld.so.cache
1  /lib/x86_64-linux-gnu/libselinux.so.1
1  /lib/x86_64-linux-gnu/librt.so.1
1  /lib/x86_64-linux-gnu/libacl.so.1
1  /lib/x86_64-linux-gnu/libc.so.6
1  /lib/x86_64-linux-gnu/libdl.so.2
1  /lib/x86_64-linux-gnu/libpthread.so.0
1  /lib/x86_64-linux-gnu/libattr.so.1
1  /proc/filesystems
1  /usr/lib/locale/locale-archive
1  /tmp
```

### 审记每个用户的文件访问

审计框架可用于监视系统调用，包括对文件的访问。如果您想知道某个特定用户ID访问了哪些文件，请使用如下规则:

```
auditctl -a exit,always -F arch=x86_64 -S open -F auid=80
```

**-F arch=x86_64** 定义使用什么体系结构(uname -m)来监视正确的系统调用(一些系统调用在主结构之间是不明确的)。

**-S open** 选择“open”系统调用

**-F auid=80** 相关用户ID

这类信息对于入侵检测非常有用，而且在Linux系统上执行取证时也非常有用。



----------


### 后记

审计守护进程还有很多的可能性。如果您认真考虑审核Linux平台，那么Linux审核框架绝对是您的好朋友!