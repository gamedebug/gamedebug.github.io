---
layout: post
title: 查找LINUX上TCP/IP套接字的状态
category: 计算机
tags: [计算机, 软件]
---


----------
![tcpStateDiagram1.gif-17.5kB][1]

首先通过上图我们可以简单了解一下TCP协议各个状态及其之间的转换关系。

通过套接字API查找套接字的连接状态是不可能的。但是在Linux上有一种方法，一种用户空间方法，来找到一个套接字的连接状态。

## PROC文件系统中的网络信息

如果你读文件/proc/net/tcp，你会发现这样的东西：

```
sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
1: D3F35D48:0050 36CB79C8:D94F 06 00000000:00000000 03:00000B71 00000000     0        0 0 3 ffff8809d09b81c0
2: D3F35D48:0050 F8C5E6C9:6C14 01 00000000:00000000 00:00000000 00000000     0        0 265916098 1 ffff880ed4353000 66 4 7 12 -1
```

每一行表示一个当前由操作系统管理的套接字。这将包括关闭并等待清理的套接字。

每一行都是内核级函数tcp_get_info()的输出。

第一列是该条目在表中的位置，并不表示任何有用的信息。这里详细记录了其他的列，但有趣的列如下：

- **local_address：**套接字的本地IP和端口号。这通常是本地服务器的一个ip。
- **remote_address：**在套接字的远程端连接的服务器的IP和端口号。
- **st：**连接状态。这个编号对应于tcp_stats .h中的一个枚举：
  ```
enum {
  TCP_ESTABLISHED = 1,
  TCP_SYN_SENT,
  TCP_SYN_RECV,
  TCP_FIN_WAIT1,
  TCP_FIN_WAIT2,
  TCP_TIME_WAIT,
  TCP_CLOSE,
  TCP_CLOSE_WAIT,
  TCP_LAST_ACK,
  TCP_LISTEN,
  TCP_CLOSING,  /* Now a valid state */
  TCP_NEW_SYN_RECV,
 
  TCP_MAX_STATES    /* Leave at the end! */
};
  ```

- **inode：**最后一个对齐的列包含一个字符串和一组不同的字段。它看起来是这样的：

  ```
265916098 1 ffff880ed4353000 66 4 7 12 -1
  ```

第一个字段是套接字的inode。第三个字段是套接字结构的实际内存地址。我们将使用inode编号来查找程序中的哪个套接字对应于此文件中的每一行，然后读取当前套接字状态。

## 将套接字与/proc/net/tcp中的行匹配

当您使用socket()或accept()函数创建一个套接字时，将返回一个整数。这表示当前打开的套接字。

在内部，这个数字映射到linux虚拟文件系统中的一个inode。文件系统中的所有对象，例如单个普通文件，都有一个inode。但是内核可以为其他可以读写的东西创建inode——包括管道、设备和套接字。

与任何打开的文件相关联的是文件描述符。

inode是一个描述现有文件的系统级编号。文件描述符是标识给定进程中当前打开的文件的数字。

要找到套接字状态，可以将套接字的inode编号与inode列中的inode值进行匹配。

为此，我们首先打开文件，解析它并创建一个以inode编号为键的映射。

```
class TcpDictEntry
{
public:
   TcpDictEntry() { mState = 1000; }
   TcpDictEntry( const char* line )
   {
      const char* tok = getToken( line, 4 );
      mState = strtol( tok, NULL, 16 );
   }
 
   u32 mState;
};
 
class TcpDict : public KxDict<u32,TcpDictEntry>
{
public:
   void reset()
   {
      clear();
 
      Buffer buffer;
      if ( !readFile( "/proc/net/tcp", buffer )) return;
 
      const char* line = buffer.getToken( "\n" );
      while (( line = buffer.getToken( "\n" )))
      {
         const char* tok = getToken( line, 10 );
         u32 id = strtol( tok, NULL, 10 );
         insert( id, TcpDictEntry( line ));
      }
   }
};
```

这是一个更大的项目。KxDict是一个字典类。它从键映射到值。在本例中，我们将其设置为在给定inode时返回state字段的内容。

getToken()将返回以制表符分隔的字符串中的第N个字段的值。状态从第4个字段解析。从第10个字段解析Inode。如果你想要其他领域，你可以很容易地扩展TcpDictEntry。

这个类的reset方法将读入并解析/proc/net/tcp文件的当前内容。当文件被读取和解析时，套接字可能已经很容易地改变了状态。

有了这个字典，你可以查找套接字的状态，并打印它：

```
TcpDict dict;
Socket s = accept();
TcpDictEntry e = dict.valueFromKey( s );
                
switch ( e.mState )
{
   case  0:  os << "**invalid**";              break;
   case  1:  os << "ESTABLISHED";              break;
   case  2:  os << "SYN_SENT";                 break;
   case  3:  os << "SYN_RECV";                 break;
   case  4:  os << "FIN_WAIT1";                break;
   case  5:  os << "FIN_WAIT2";                break;
   case  6:  os << "TIME_WAIT";                break;
   case  7:  os << "CLOSE";                    break;
   case  8:  os << "CLOSE_WAIT";               break;
   case  9:  os << "LAST_ACK";                 break;
   case 10:  os << "LISTEN";                   break; 
   case 11:  os << "CLOSING";                  break;
   default:  os << e.mState;                   break;
}
```

这将在读取tcp文件时报告套接字的状态。因此，您不能使用这个来获得每个套接字的确切当前状态。这只适用于报告，因此您或多或少地了解每个套接字的情况。


  [1]: http://static.zybuluo.com/gamedebug/jxjbwy3tnv35whbv7rznf1rk/tcpStateDiagram1.gif