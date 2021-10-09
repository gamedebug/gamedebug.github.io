---
layout: post
title: NFS统计数据
category: 计算机
tags: [计算机, 软件]
---

我从未花太多时间做的事情之一就是阅读有关 NFS 的信息。没有必要，它只是有点开箱即用。大多数时候都是这样。当它停止工作或使您的集群陷入困境时，头痛就开始了。您将找到的第一个资源是检查 /proc/net/rpc/nfsd。但这对你没有多大帮助，所以我最近开始监控内容。让我们看看什么是什么。

获取信息很容易：

```
# cat /proc/net/rpc/nfsd
rc 0 225891120 1142621245
fh 94 0 0 0 0
io 2419795101 674116438
th 16 0 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000
ra 32 599168798 0 0 0 0 0 0 0 0 0 7053691
net 1369894951 0 1369046785 21585
rpc 1369784542 0 0 0 0
proc2 18 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
proc3 22 84 253414826 11612033 88162237 147421518 109847 606883959 183127783 11620524 290559 110168 0 11837554 213037 2453880 4605041 36226 12203037 1305364 112 56 20349016
proc4 2 1 548713
proc4ops 59 0 0 0 104291 0 0 0 0 0 218574 3 0 0 0 0 3 0 0 0 0 0 0 548712 0 1 0 330138 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0
```

内容有点多，所以让我们一行一行地解释：

## RC：应答缓存（Reply Cache）

应答缓存是临时存储幂等操作的缓存，这些操作可以重复多次而不会失败。请考虑：通过NFS读取块。因此，当一个应答由于坏连接(或其他原因)而丢失时，NFS不需要再次执行该操作(提高性能)，并且客户端不会看到错误。虽然这看起来是一个足够简单的缓存，但报告的数据却有点复杂：

```
<hits> <misses>   <nocache>
0      225891120  1142621245
```

- hits：客户端没有收到应答，决定重新传输请求，应答被缓存（失败请求）；
- misses：需要缓存的幂等性操作（一般来说查询类操作都是幂等的）；
- nocache：无需缓存的非幂等性操作（写入、修改类的操作都可以视为非幂等的）。

这是一个繁忙服务器的应答缓存的样子：
![reply_cache_white.png-98.7kB][1]

在我监控的大多数服务器上，我几乎没有看到未命中，只有没有缓存，到目前为止我还没有看到任何命中。关于应答缓存的大小/使用的[有趣文章][2]。

## FH：文件句柄（File Handles）

文件句柄是小块内存，用于跟踪打开的文件；然而，在我监控的所有机器上，除了第一个值过时的文件句柄外，这些都为零。当文件句柄引用已回收的位置时，会发生[陈旧的文件句柄（Stale file handles）][3]。当服务器失去连接并且应用程序仍在使用不再可访问的文件时，也会发生这种情况。不使用所有其他值。

```
<stale> <total_lookups>    <anonlookups>  <dirnocache>   <nodirnocache>
94       0                  0              0              0
```

我认为大量陈旧文件是一个不好的迹象，到目前为止我还没有看到这种情况发生。

## IO：输入输出（Input Output）

这个就很简单了，它是自上次重启以来从磁盘（raid）读取的总字节数和写入磁盘的总字节数。对于一台服务器来说，输入既是写入，输出既是读取，这个应该不用多解释了。

```
<read>        <write>
2419795101    674116438
```

一个实际的工作负载例子：
![io_white.png-144.1kB][4]

## TH：线程（Threads）

这显示了“NFS进程”中的线程信息；然而，大部分值已从 2.6.29 上游的内核中剔除。

```
<threads> <fullcnt> <deprecated_histogram>
16         0         0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000 0.000
```

- threads：NFS 守护进程使用的线程数量。（这可以在 /etc/sysconfig/nfs中增加，选项 RPCNFSDCOUNT）
- fullcnt：使用的所有NFS线程的次数。（很可能已弃用）

要调整需要多少线程，可以查看：/proc/fs/nfsd/pool_stats

## RA：预读缓存（Read Ahead Cache）

预读缓存是在预期请求顺序块时使用的缓存。然而，我没有找到这样的解释，所以也许我错了。当某个块被请求为读取时，接下来的几个块也有很大的机会被请求，因此NFS线程已经缓存了这些。

```
<cachesize> <10%> <..> <100%>            <notfound>
32          599168798 0 0 0 0 0 0 0 0 0  7053691
```

- cache size：通常总是两倍于线程数（不知道为什么）；
- 10%-100%：被找到的块的深度柱状图数据；
- not found：不在预读缓存中。

在真实的例子中：我只看到 10% 和 not found 增加。最多的是10%。

## NET: 网络（Network）

网络使用统计。

```
<netcount>   <UDPcount> <TCPcount>  <TCPconnect>
1369894951   0          1369046785  21585
```

- netcount：数据包总量；
- UDPcount：UDP数据包总量；
- TCPcount：TCP数据包总量；
- TCPconnect：TCP连接数。

这些值取决于您如何使用 NFS（UDP 或 TCP）以及 NFS 的活跃程度。下图是随时间绘制的 UDP/TCP 示例。显然我更喜欢 TCP 而不是 UDP 连接。 （TCP连接应该遵循TCP的线路）看到UDP流量的分配是可疑的，通常NFSv3会默认为TCP，NFSv2确实使用UDP。
![net_white.png-52.6kB][5]

## RPC：远程过程调用（remote procedure call）

Linux 下的 NFS 依靠 RPC 调用在客户端和服务器之间路由请求。

```
<count>    <badcnt> <badfmt> <badauth> <badcInt>
1369784542 0        0         0        0
```

- rpccount：所有 RPC 操作；
- badcnt：接下来 3 个或所有错误调用的组合值；
- badfmt：最坏调用次数；
- badauth：认证错误次数；
- badcInt：无用的。

到目前为止，我还没有看到太多的错误调用。

## Proc2

Proc2是使用v2协议为NFS客户端生成的统计信息。v2协议相当古老（在1989 年提出），我找不到在v3或v4协议上使用它们的充分理由。除了一些测试，我认为目前没有任何发行版仍在使用它。事实上，在CentOS7中，proc2行已完全删除。（我也假设支持）

但是，v3协议中的操作并没有太大变化，因此仍然值得了解它们的含义。

- 第一个值指示要遵循的值（18）；
- null：什么都不做（调试用）；
- getattr：获取文件属性；
- setattr：设置文件属性；
- root：获取文件系统根目录（已过时）；
- lookup：查找文件名；
- readlink：从符号链接读取；
- read：从文件中读取；
- wrcache：写入缓存（未使用）；
- write：写入文件；
- create：创建文件；
- remove：删除文件；
- rename：重命名文件；
- link：创建链接到文件；
- symlink：创建符号链接到文件；
- mkdir：创建目录；
- rmdir：删除目录；
- readdir：读取目录内容；
- fsstat：获取文件系统属性。

## Proc3

Proc3是v3协议统计信息的后续统计信息。v3协议在1995年提出，它是最常用的协议。最有可能在这里找到体面的统计数据。我只描述与v2协议不同的值。

- 要遵循的值（22）；
- null / getattr / setattr / lookup
- access：检查访问权限；
- readlink / read / write / create / mkdir / symlink
- mknod：创建一个特殊的设备；
- remove / rmdir / rename / link / readdir
- readdirplus：从目录扩展读取；
- fsstat：获取动态文件系统信息；
- fsinfo：获取静态文件系统信息；
- pathconf：检索 POSIX 信息；
- commit：将缓存数据提交到稳定存储（服务器端）。

工作中的NFS服务器：
![proc3.png-94.6kB][6]

正如您所看到的，大多数都是读/写。在异步写入之后调用了大量的提交……（该图例为非数据库场景）

## Proc4

Proc4是最新的协议（2000年），其中一项重大变化是复合操作的使用。而不是发送3个操作来打开文件（查找、打开、读取），在v4协议中这些操作可以在一个复合中完成。这意味着该行可以缩短为两种类型的复合操作：null（什么都不做）和复合（做某事）。由于null仅用作调试，因此会生成proc4ops。

## Proc4ops

这些是v4协议中的操作，一旦复合操作被“解包”。这就是思想变得非常复杂的地方，除了v4之外，还有v4.1和v4.2协议扩展。您将看到（当前）分布之间的值计数差异很大。我在我的环境中发现了40、59和71个值。对于我的librenms脚本，我使用了59计数。40是v4，59 是v4.1，71是v4.2，但是您需要深入内核代码以查看值顺序是否没有改变。我认为它没有。

- op0-unused op1-unused op2-future：未使用值；
- access / close / commit / create
- delegpurge：清除委托等待恢复；
- delegreturn：返回委托；
- getattr
- getfh：获取当前文件句柄；
- link
- lock：创建锁；
- lockt：测试锁；
- locku：解锁；
- lookup：查找文件名；
- lookupp：查找父级目录；
- nverify：验证属性差异；
- open
- openattr：打开命名属性目录；
- open_confirm：确认打开；
- open_dgrd：减少打开文件访问；
- putfh：设置当前文件句柄；
- putpubfh：设置公共文件句柄；
- putrootfh：设置根文件句柄；
- read / readdir / readlink / remove / rename
- renew：续租；
- restorefh：恢复保存的文件句柄；
- savefh：保存当前文件句柄；
- secinfo：获得可用的安全信息；
- setattr
- setcltid：协商客户端ID；
- setcltidconf：确认客户端ID；
- verify：验证相同的属性（请参阅nverify）；
- write
- rellockowner：释放锁所有者（在v4.1中已过时）

关于v4.1，请参阅[RFC5661][7]，而v4.2版本协议目前只有一个[草案][8]可用。

## 本文参考文献如下：

- 大部分信息最初是从进行初步研究的Jordi Prats的[邮件档案][9]中获得的，它被公布到互联网上，所以感谢过去的那些人，谢谢！
- NFSv2：[RFC1094][10]
- NFSv3：[RFC1813][11]
- NFSv4： [RFC3010][12]
- NFSv4.1：[RFC5661][13]


  [1]: http://static.zybuluo.com/gamedebug/mp1upugursnxhpdb2qzx96g0/reply_cache_white.png
  [2]: https://www.kernel.org/doc/ols/2009/ols2009-pages-95-100.pdf
  [3]: https://stackoverflow.com/questions/20105260/what-does-stale-file-handle-in-linux-means
  [4]: http://static.zybuluo.com/gamedebug/f51c0jwx362ri0vbozbzkk3g/io_white.png
  [5]: http://static.zybuluo.com/gamedebug/bopjgj6a75lwg1i6d19frjd6/net_white.png
  [6]: http://static.zybuluo.com/gamedebug/7illhyy4bnocozriplaoe1g4/proc3.png
  [7]: https://tools.ietf.org/html/rfc5661
  [8]: https://tools.ietf.org/html/draft-ietf-nfsv4-minorversion2-41
  [9]: https://web.archive.org/web/20100625004211/http://www.opensubscriber.com/message/nfs@lists.sourceforge.net/7833588.html
  [10]: https://tools.ietf.org/html/rfc1094
  [11]: https://tools.ietf.org/html/rfc1813
  [12]: https://tools.ietf.org/html/rfc3010
  [13]: https://tools.ietf.org/html/rfc5661