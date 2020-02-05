---
layout: post
title: fsck与日志文件系统
category: 计算机
tags: [计算机, 软件]
---


----------
日志文件系统(Journal File System)解决了掉电或系统崩溃造成元数据不一致的问题，细节参见旧文《日志文件系统是怎样工作的》，它的原理是在进行写操作之前，把即将进行的各个步骤（称为transaction）事先记录下来，包括：从data block bitmap中分配一个数据块、在inode中添加指向数据块的指针、把用户数据写入数据块等，这些transaction保存在文件系统单独开辟的一块空间上，称为日志(journal)，日志保存成功之后才进行真正的写操作–把文件系统的元数据和用户数据写进硬盘（称为checkpoint），万一写操作的过程中掉电，下次挂载文件系统之前把保存好的日志重新执行一遍就行了（术语叫做replay），保证文件系统的一致性。

Journal replay所需的时间很短，可以通过fsck或者mount命令完成。既然mount命令就可以做journal replay，那还要fsck干什么呢？fsck(file system check)所做的事情可不仅仅是journal replay这么简单，它可以对文件系统进行彻底的检查，扫描所有的inode、目录、superblock、allocation bitmap等等，称为full check。fsck进行full check所需的时间很长，而且文件系统越大，所需的时间也越长。

可能导致文件系统损坏的因素很多，不只是掉电或系统崩溃，比如软件bug和硬件错误都有可能损坏文件系统，而这类问题不是journal replay能解决的，必须用fsck才行。

fsck可以手工执行，也可以在boot时自动执行。无论手工执行还是自动执行，文件系统都必须处于未挂载(unmounted)状态。


----------
## fsck会否在boot过程中自动执行

最早的时候fsck缺省在启动的过程中自动执行，有了日志文件系统之后，掉电和系统崩溃对文件系统的潜在伤害可以通过journal replay得到解决，执行fsck就不是那么紧迫了，而且随着文件系统越来越大，full check所需的时间越来越长，在启动过程中进行自动fsck带来了诸多不便，所以在boot过程中自动fsck的做法引起了很多争议，但fsck又不能不做，因为有些软硬件bug导致的文件系统损坏只有fsck才能处理。现在的倾向是把执行fsck的时机交给系统管理员去决定，是手工执行还是自动执行根据实际需要而定。其中一个讨论如下：
https://bugzilla.redhat.com/show_bug.cgi?id=879315

fsck是否在boot过程中自动执行是通过/etc/fstab的第6个字段控制的，如果为0就表示禁止fsck自动执行：

```
# man fstab
FSTAB(5)                   Linux Programmer's Manual
...
       The sixth field (fs_passno).
              This field is used by the fsck(8) program to determine the order
              in  which  filesystem  checks are done at reboot time.  The root
              filesystem should be specified with a fs_passno of 1, and  other
              filesystems  should have a fs_passno of 2.  Filesystems within a
              drive will be checked sequentially, but filesystems on different
              drives  will  be checked at the same time to utilize parallelism
              available in the hardware.  If the sixth field is not present or
              zero,  a value of zero is returned and fsck will assume that the
              filesystem does not need to be checked.
...
```

在已经禁止fsck自动执行的情况下，仍然可以强制下次boot时自动执行fsck，方法如下：

```
# touch /forcefsck
或者用以下命令重启：
# shutdown -Fr
```

如果要reboot时不做fsck，可以用以下命令重启，它会忽略/etc/fstab的设置，启动时直接跳过fsck：

```
# shutdown -fr
```

## 不同的文件系统有不同的fsck工具

不同类型的文件系统有各自的fsck工具，比如ext3文件系统对应的是fsck.ext3，xfs文件系统对应的是fsck.xfs。fsck命令只是个外壳，它本身没有能力去检查所有类型的文件系统，会根据文件系统的类型去调用相应的fsck工具。

### ext2/ext3/ext4

ext2, ext3和ext4的fsck工具都是e2fsck，fsck.ext2、fsck.ext3和fsck.ext4都是指向e2fsck的链接。

ext2不是日志文件系统，没有日志(journal)，e2fsck执行时会进行full check，耗时较长，尤其对大文件系统耗时更长。

ext3和ext4都是日志文件系统，e2fsck执行的时候，缺省做完journal replay就会返回，速度很快，除非superblock中的标记要求进行full check，（如果文件系统在运行过程中发现metadata不一致的话会在superblock中做标记，e2fsck执行时发现这个标记就会进行full check）。参见e2fsck的manpage：

```
E2FSCK(8)                   System Manager's Manual
...
e2fsck is used to check the ext2/ext3/ext4 family of file systems. For
ext3 and ext4 filesystems that use a journal, if the system has been
shut down uncleanly without any errors, normally, after replaying the
committed transactions in the journal, the file system should be
marked as clean. Hence, for filesystems that use journalling, e2fsck
will normally replay the journal and exit, unless its superblock indi‐
cates that further checking is required.
```

ext3/ext4是否进行full check是由下列几个因素决定的：

- superblock中的标记要求进行full check（即以上manpage所提到的）；
- e2fsck命令加了”-f”参数，强制进行full check；
- ext3/ext4文件系统有两个参数决定是否进行full check：
  “Maximum mount count” 和 “Check interval”。

> 用”tune2fs -l”命令可以查看ext文件系统的参数，在下例中的文件系统每当mount次数达到25次的时候（Maximum mount count 值是25），一旦执行e2fsck就会进行full check；每过6个月（Check interval 值是6 months），一旦执行e2fsck就会进行full check：
>```
$ sudo tune2fs -l /dev/sdd1
...
Mount count:              3
Maximum mount count:      25
Last checked:             Mon Oct 30 10:49:51 2017
Check interval:           15552000 (6 months)
Next check after:         Sat Apr 28 10:49:51 2018
...
```

修改这两个参数分别用 tune2fs 命令的 “-c” 和 “-i” 参数，比如”tune2fs -c 0 -i 0 /dev/sda”可以禁止”Maximum mount count”和”Check interval”达到指定值导致的full check。参见tune2fs的manpage：

```
       -c max-mount-counts
              Adjust  the  number of mounts after which the filesystem will be
              checked by e2fsck(8).  If max-mount-counts is 0 or -1, the  num-
              ber  of  times  the filesystem is mounted will be disregarded by
              e2fsck(8) and the kernel.
              
              Staggering the mount-counts at which  filesystems  are  forcibly
              checked  will  avoid  all  filesystems being checked at one time
              when using journaled filesystems.
              ...
              
       -i  interval-between-checks[d|m|w]
              Adjust  the maximal time between two filesystem checks.  No suf-
              fix or d will interpret the  number  interval-between-checks  as
              days, m as months, and w as weeks.  A value of zero will disable
              the time-dependent checking.
```

### XFS

XFS是日志文件系统，mount过程会进行journal replay等操作。如果允许boot过程中自动执行fsck，fsck会直接成功返回，因为对应的fsck.xfs什么也不做。

```
fsck.xfs(8)

NAME
       fsck.xfs - do nothing, successfully
       
SYNOPSIS
       fsck.xfs [ filesys ... ]
       
DESCRIPTION
       fsck.xfs  is  called by the generic Linux fsck(8) program at startup to
       check and repair an XFS filesystem.  XFS is a journaling filesystem and
       performs  recovery  at  mount(8)  time if necessary, so fsck.xfs simply
       exits with a zero exit status.
       
       If you wish to check the consistency of an XFS filesystem, or repair  a
       damaged  or corrupt XFS filesystem, see xfs_check(8) and xfs_repair(8).
```

要想检查XFS文件系统，可以手工执行”xfs_repair -n”命令。

> 注：
虽然有xfs_check命令也可以对XFS文件系统做检查，但不建议使用（参见xfs_check的manpage），它很慢，尤其是大文件系统上更慢。

xfs_repair命令的前提条件是journal log必须干净，如果XFS文件系统没有正常umount，那在执行xfs_repair之前应该先mount一下，让它完成journal replay，然后再umount，因为xfs_repair应该在文件系统未挂载的状态下执行。

> 注：
如果XFS的journal replay失败，意味着journal log有可能损坏了，可以用”xfs_repair -L”清除journal log，但务必谨慎，因为丢弃journal有可能会导致文件系统一致性受损。

## 为什么有时候reboot过程中日志文件系统会进行很长时间的fsck？

通常是因为：boot时自动执行了fsck并且fsck在进行full check。需要检查以下事项：

1. /etc/fstab的第6字段是否非0，因为它会自动执行fsck；
2. 是否存在/forcefsck文件，因为它会强制下次boot时自动执行fsck；
3. 是否通过 shutdown -Fr 重启的系统，因为它会强制boot时自动执行fsck；
4. 针对具体的文件系统类型，看在什么情况下会进行full check，譬如ext2文件系统，任何时候执行e2fsck都会进行full check；而ext3/ext4则视情况而定–如果文件系统参数设定了”Maximum mount count”或”Check interval”，又或者superblock因为发现不一致而作了full check标记（详见前面段落），则e2fsck执行时会进行full check。

