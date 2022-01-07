---
layout: post
title: 科学上网教程
category: 计算机
tags: [计算机, 软件]
---


----------
## 概述
科学上网的重要性相信很多小朋友都知道，在这里就不再长篇大论了，本文直接开始介绍笔者从2019年开始一直在用的一套科学上网的途径。

## 服务端

首先，需要购买具有海外公网IP的云主机，这个可选项很多，不差钱的小朋友可以直接AWS北美云主机，当然如果考虑性价比，建议用VPS，笔者用的就是搬瓦工的VPS，最小化配置，费用为$49.99USD/year，这个如何购买就不多说了，可以到各大云计算主页咨询了解。搬瓦工的VPS购买成功后，可以自行选择要运行的操作系统，笔者选的Ubuntu。

系统起来后，根据官网指引，拿到主机的SSH登陆地址、端口、密钥等信息，请妥善保存，登陆后开始进行服务端配置，步骤如下：

可以先检查一下VPS能否正常访问Google等墙外网站；

```
root@louis-ssr-obfs:~# ping google.com -c 2
PING google.com (142.250.68.46) 56(84) bytes of data.
64 bytes from lax17s46-in-f14.1e100.net (142.250.68.46): icmp_seq=1 ttl=120 time=0.384 ms
64 bytes from lax17s46-in-f14.1e100.net (142.250.68.46): icmp_seq=2 ttl=120 time=0.489 ms

--- google.com ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1001ms
rtt min/avg/max/mdev = 0.384/0.436/0.489/0.056 ms
```

安装梯子服务的软件包，笔者用的是ssr+obfs，为什么选择这个，也不多说了，Google一下一堆攻略；

```
root@louis-ssr-obfs:~# apt install shadowsocks-libev simple-obfs
```

配置shadowsocks服务；

```
root@louis-ssr-obfs:~# cat /etc/shadowsocks-libev/config.json 
{
    "server":"0.0.0.0",
    "server_port":54321,
    "local_port":1080,
    "password":"xxxxxxx",
    "timeout":100,
    "method":"rc4-md5",
    "plugin":"/usr/bin/obfs-server",
    "plugin_opts":"obfs=tls;failover=127.0.0.1:8443"
}
```

配置obfs插件；

```
root@louis-ssr-obfs:~# cat /etc/shadowsocks-libev/config-obfs.json 
{
    "server":"127.0.0.1",
    "server_port":8388,
    "local_port":1080,
    "password":"FamGhemt",
    "timeout":60,
    "method":"chacha20-ietf-poly1305",
    "mode":"tcp_and_udp",
    "fast_open":true,
    "plugin":"obfs-server",
    "plugin_opts":"obfs=tls;failover=127.0.0.1:8443;fast-open"
}
```

启动服务；

```
root@louis-ssr-obfs:~# systemctl start shadowsocks
root@louis-ssr-obfs:~# systemctl status shadowsocks
Unit shadowsocks.service could not be found.
root@louis-ssr-obfs:~# systemctl status shadowsocks-libev
● shadowsocks-libev.service - Shadowsocks-libev Default Server Service
   Loaded: loaded (/lib/systemd/system/shadowsocks-libev.service; enabled; vendor preset: enabled)
   Active: active (running) since Sun 2020-12-27 09:38:16 EST; 3 months 9 days ago
     Docs: man:shadowsocks-libev(8)
 Main PID: 470 (ss-server)
    Tasks: 2 (limit: 1175)
   CGroup: /system.slice/shadowsocks-libev.service
           ├─470 /usr/bin/ss-server -c /etc/shadowsocks-libev/config.json -u
           └─486 /usr/bin/obfs-server
```

## 客户端

手机平板的话，请自行到应用商店找shadowsocks的app，注意需要支持插件功能，目前笔者在iPhone和iPad上感觉最好用还是从美国Appstore上下的Shadowrocket，需要花$2.99USD进行一次性购买，安卓就不太了解了，小朋友们自己在安卓应用市场上寻摸吧。。。

Windows PC可以在这里下载：https://github.com/shadowsocks/shadowsocks-windows/releases

Mac可以在这里下载：https://github.com/shadowsocks/ShadowsocksX-NG/releases/

