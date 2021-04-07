---
layout: post
title: 建造自己的天堂II
category: 计算机
tags: [计算机, 软件]
---


----------

天堂II，曾经也是笔者很喜欢玩的一款韩国网游，在魔兽世界开服之前一直伴随笔者多年。近日，从某国外网站发现下面这款天堂II的开源服务端软件的介绍，遵照官方手册，尝试了一把天堂II服务器搭建。

## 配置需求

笔者的服务器是一台运行在OpenStack云平台上的虚拟机，配置如下：

- vCPU：8
- MEM：16GB
- Disk: 100GB

## 准备操作系统

操作系统选型上，本服务端程序按照官方介绍，支持CentOS、Debian、Ubuntu、Windows等主流服务器操作系统，笔者这里选择CentOS 8.2，操作系统镜像的获取和安装本文不做赘述。

## 配置软件环境
### 第一步：更新操作系统

- 更新系统软件包：

```
[centos@lineage2 ~]$ sudo -i
[root@lineage2 ~]# yum update
CentOS-8 - AppStream                                                                                                                             6.0 MB/s | 5.8 MB     00:00    
CentOS-8 - Base                                                                                                                                  407 kB/s | 2.2 MB     00:05    
CentOS-8 - Extras                                                                                                                                 13 kB/s | 8.1 kB     00:00    
Dependencies resolved.
=================================================================================================================================================================================
 Package                                          Architecture               Version                                                         Repository                     Size
=================================================================================================================================================================================
Installing:
 kernel                                           x86_64                     4.18.0-193.19.1.el8_2                                           BaseOS                        2.8 M
 kernel-core                                      x86_64                     4.18.0-193.19.1.el8_2                                           BaseOS                         28 M
 kernel-modules                                   x86_64                     4.18.0-193.19.1.el8_2                                           BaseOS                         23 M
Upgrading:
 cloud-init                                       noarch                     19.4-1.el8.7                                                    AppStream                     930 k
 libX11                                           x86_64                     1.6.8-3.el8                                                     AppStream                     611 k
 libX11-common                                    noarch                     1.6.8-3.el8                                                     AppStream                     158 k
...
...
...
 linux-firmware                                   noarch                     20191202-97.gite8a0f4c9.el8                                     BaseOS                         72 M
Installing weak dependencies:
 PackageKit                                       x86_64                     1.1.12-4.el8                                                    AppStream                     601 k
 elfutils-debuginfod-client                       x86_64                     0.178-7.el8                                                     AppStream                      62 k

Transaction Summary
=================================================================================================================================================================================
Install   13 Packages
Upgrade  204 Packages

Total download size: 280 M
Is this ok [y/N]: y
Downloading Packages:
(1/217): elfutils-debuginfod-client-0.178-7.el8.x86_64.rpm                                                                                       2.5 MB/s |  62 kB     00:00    
(2/217): PackageKit-glib-1.1.12-4.el8.x86_64.rpm                                                                                                 3.4 MB/s | 141 kB     00:00    
(3/217): PackageKit-1.1.12-4.el8.x86_64.rpm                                                                                                      7.5 MB/s | 601 kB     00:00    
(4/217): gdk-pixbuf2-2.36.12-5.el8.x86_64.rpm                                                                                                    324 kB/s | 467 kB     00:01    
(5/217): grub2-tools-efi-2.02-87.el8_2.x86_64.rpm                                                                                                284 kB/s | 467 kB     00:01    
(6/217): kernel-4.18.0-193.19.1.el8_2.x86_64.rpm                                                                                                 707 kB/s | 2.8 MB     00:04    
(7/217): libappstream-glib-0.7.14-3.el8.x86_64.rpm                                                                                               903 kB/s | 338 kB     00:00    
(8/217): libsoup-2.62.3-1.el8.x86_64.rpm                                                                                                         970 kB/s | 424 kB     00:00    
(9/217): libstemmer-0-10.585svn.el8.x86_64.rpm                                                                                                   598 kB/s |  73 kB     00:00    
(10/217): libzstd-1.4.2-2.el8.x86_64.rpm                                                                                                         812 kB/s | 260 kB     00:00    
(11/217): kernel-modules-4.18.0-193.19.1.el8_2.x86_64.rpm                                                                                        902 kB/s |  23 MB     00:26    
(12/217): cloud-init-19.4-1.el8.7.noarch.rpm                                                                                                     7.0 MB/s | 930 kB     00:00    
(13/217): libX11-1.6.8-3.el8.x86_64.rpm                                                                                                           12 MB/s | 611 kB     00:00    
(14/217): libX11-common-1.6.8-3.el8.noarch.rpm                                                                                                   9.5 MB/s | 158 kB     00:00    
...
...
...
(215/217): zlib-1.2.11-16.el8_2.x86_64.rpm                                                                                                       780 kB/s | 102 kB     00:00    
(216/217): util-linux-2.32.1-22.el8.x86_64.rpm                                                                                                   908 kB/s | 2.5 MB     00:02    
(217/217): selinux-policy-targeted-3.14.3-41.el8_2.6.noarch.rpm                                                                                  1.0 MB/s |  15 MB     00:14    
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Total                                                                                                                                            2.8 MB/s | 280 MB     01:41     
warning: /var/cache/dnf/AppStream-a3ce6348fe6cbd6c/packages/PackageKit-1.1.12-4.el8.x86_64.rpm: Header V3 RSA/SHA256 Signature, key ID 8483c65d: NOKEY
CentOS-8 - AppStream                                                                                                                             102 kB/s | 1.6 kB     00:00    
Importing GPG key 0x8483C65D:
 Userid     : "CentOS (CentOS Official Signing Key) <security@centos.org>"
 Fingerprint: 99DB 70FA E1D7 CE22 7FB6 4882 05B5 55B3 8483 C65D
 From       : /etc/pki/rpm-gpg/RPM-GPG-KEY-centosofficial
Is this ok [y/N]: y
Key imported successfully
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                                                                                                                         1/1 
  Running scriptlet: libgcc-8.3.1-5.el8.0.2.x86_64                                                                                                                           1/1 
  Upgrading        : libgcc-8.3.1-5.el8.0.2.x86_64                                                                                                                         1/421 
  Running scriptlet: libgcc-8.3.1-5.el8.0.2.x86_64                                                                                                                         1/421 
  Upgrading        : grub2-common-1:2.02-87.el8_2.noarch                                                                                                                   2/421 
  Upgrading        : python3-pip-wheel-9.0.3-16.el8.noarch                                                                                                                 3/421 
  Upgrading        : grub2-pc-modules-1:2.02-87.el8_2.noarch                                                                                                               4/421 
...
...
...
  Verifying        : yum-utils-4.0.8-3.el8.noarch                                                                                                                        419/421 
  Verifying        : zlib-1.2.11-16.el8_2.x86_64                                                                                                                         420/421 
  Verifying        : zlib-1.2.11-10.el8.x86_64                                                                                                                           421/421 

Upgraded:
  cloud-init-19.4-1.el8.7.noarch                                      libX11-1.6.8-3.el8.x86_64                           libX11-common-1.6.8-3.el8.noarch                     
  libmaxminddb-1.2.0-7.el8.x86_64                                     libxcb-1.13.1-1.el8.x86_64                          libxkbcommon-0.9.1-1.el8.x86_64                      
  pixman-0.38.4-1.el8.x86_64                                          python3-newt-0.52.20-11.el8.x86_64                  python3-unbound-1.7.3-11.el8_2.x86_64                
  qemu-guest-agent-15:2.12.0-99.module_el8.2.0+385+c644c6e8.2.x86_64  rsyslog-8.1911.0-3.el8.x86_64                       setroubleshoot-plugins-3.3.11-2.el8.noarch           
...
...
...
  systemd-libs-239-31.el8_2.2.x86_64                                  systemd-pam-239-31.el8_2.2.x86_64                   systemd-udev-239-31.el8_2.2.x86_64                   
  teamd-1.29-1.el8_2.2.x86_64                                         tuned-2.13.0-6.el8.noarch                           tzdata-2020a-1.el8.noarch                            
  util-linux-2.32.1-22.el8.x86_64                                     which-2.21-12.el8.x86_64                            xfsprogs-5.0.0-2.el8.x86_64                          
  yum-4.2.17-7.el8_2.noarch                                           yum-utils-4.0.12-4.el8_2.noarch                     zlib-1.2.11-16.el8_2.x86_64                          

Installed:
  kernel-4.18.0-193.19.1.el8_2.x86_64               kernel-core-4.18.0-193.19.1.el8_2.x86_64 kernel-modules-4.18.0-193.19.1.el8_2.x86_64 PackageKit-1.1.12-4.el8.x86_64        
  elfutils-debuginfod-client-0.178-7.el8.x86_64     PackageKit-glib-1.1.12-4.el8.x86_64      gdk-pixbuf2-2.36.12-5.el8.x86_64            grub2-tools-efi-1:2.02-87.el8_2.x86_64
  libappstream-glib-0.7.14-3.el8.x86_64             libsoup-2.62.3-1.el8.x86_64              libstemmer-0-10.585svn.el8.x86_64           libzstd-1.4.2-2.el8.x86_64            
  linux-firmware-20191202-97.gite8a0f4c9.el8.noarch

Complete!
```

### 第二步：安装必要软件包

- 安装系统工具

```
[root@lineage2 ~]# dnf install git zip wget
Last metadata expiration check: 0:13:24 ago on Tue 27 Oct 2020 06:52:25 PM UTC.
Dependencies resolved.
=================================================================================================================================================================================
 Package                                            Architecture                       Version                                       Repository                             Size
=================================================================================================================================================================================
Installing:
 git                                                x86_64                             2.18.4-2.el8_2                                AppStream                             186 k
 wget                                               x86_64                             1.19.5-8.el8_1.1                              AppStream                             735 k
 zip                                                x86_64                             3.0-23.el8                                    BaseOS                                270 k
Installing dependencies:
 emacs-filesystem                                   noarch                             1:26.1-5.el8                                  BaseOS                                 69 k
 git-core                                           x86_64                             2.18.4-2.el8_2                                AppStream                             4.0 M
 git-core-doc                                       noarch                             2.18.4-2.el8_2                                AppStream                             2.3 M
 perl-Carp                                          noarch                             1.42-396.el8                                  BaseOS                                 30 k
 perl-Data-Dumper                                   x86_64                             2.167-399.el8                                 BaseOS                                 58 k
...
...
...
 perl-threads                                       x86_64                             1:2.21-2.el8                                  BaseOS                                 61 k
 perl-threads-shared                                x86_64                             1.58-2.el8                                    BaseOS                                 48 k
 unzip                                              x86_64                             6.0-43.el8                                    BaseOS                                195 k
Installing weak dependencies:
 perl-IO-Socket-IP                                  noarch                             0.39-5.el8                                    AppStream                              47 k
 perl-IO-Socket-SSL                                 noarch                             2.066-4.el8                                   AppStream                             297 k
 perl-Mozilla-CA                                    noarch                             20160104-7.el8                                AppStream                              15 k

Transaction Summary
=================================================================================================================================================================================
Install  51 Packages

Total download size: 20 M
Installed size: 75 M
Is this ok [y/N]: y
Downloading Packages:
(1/51): git-2.18.4-2.el8_2.x86_64.rpm                                                                                                            1.9 MB/s | 186 kB     00:00    
(2/51): perl-Digest-1.17-395.el8.noarch.rpm                                                                                                      5.4 MB/s |  27 kB     00:00    
(3/51): perl-Digest-MD5-2.55-396.el8.x86_64.rpm                                                                                                  5.6 MB/s |  37 kB     00:00    
(4/51): perl-Error-0.17025-2.el8.noarch.rpm                                                                                                      8.3 MB/s |  46 kB     00:00    
(5/51): perl-Git-2.18.4-2.el8_2.noarch.rpm                                                                                                       7.3 MB/s |  77 kB     00:00    
(6/51): perl-IO-Socket-IP-0.39-5.el8.noarch.rpm                                                                                                  7.8 MB/s |  47 kB     00:00    
...
...
...
(46/51): perl-threads-2.21-2.el8.x86_64.rpm                                                                                                      445 kB/s |  61 kB     00:00    
(47/51): perl-threads-shared-1.58-2.el8.x86_64.rpm                                                                                               347 kB/s |  48 kB     00:00    
(48/51): unzip-6.0-43.el8.x86_64.rpm                                                                                                             706 kB/s | 195 kB     00:00    
(49/51): zip-3.0-23.el8.x86_64.rpm                                                                                                               654 kB/s | 270 kB     00:00    
(50/51): perl-libs-5.26.3-416.el8.x86_64.rpm                                                                                                     948 kB/s | 1.6 MB     00:01    
(51/51): perl-interpreter-5.26.3-416.el8.x86_64.rpm                                                                                              1.0 MB/s | 6.3 MB     00:06    
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Total                                                                                                                                            2.2 MB/s |  20 MB     00:09     
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                                                                                                                         1/1 
  Installing       : perl-Exporter-5.72-396.el8.noarch                                                                                                                      1/51 
  Installing       : perl-libs-4:5.26.3-416.el8.x86_64                                                                                                                      2/51 
  Installing       : perl-Carp-1.42-396.el8.noarch                                                                                                                          3/51 
  Installing       : perl-Scalar-List-Utils-3:1.49-2.el8.x86_64                                                                                                             4/51 
  Installing       : perl-parent-1:0.237-1.el8.noarch                                                                                                                       5/51 
  Installing       : perl-Text-ParseWords-3.30-395.el8.noarch                                                                                                               6/51 
...
...
...
  Installing       : unzip-6.0-43.el8.x86_64                                                                                                                               46/51 
  Installing       : emacs-filesystem-1:26.1-5.el8.noarch                                                                                                                  47/51 
  Installing       : perl-Git-2.18.4-2.el8_2.noarch                                                                                                                        48/51 
  Installing       : git-2.18.4-2.el8_2.x86_64                                                                                                                             49/51 
  Installing       : zip-3.0-23.el8.x86_64                                                                                                                                 50/51 
  Installing       : wget-1.19.5-8.el8_1.1.x86_64                                                                                                                          51/51 
  Running scriptlet: wget-1.19.5-8.el8_1.1.x86_64                                                                                                                          51/51 
  Verifying        : git-2.18.4-2.el8_2.x86_64                                                                                                                              1/51 
  Verifying        : git-core-2.18.4-2.el8_2.x86_64                                                                                                                         2/51 
  Verifying        : git-core-doc-2.18.4-2.el8_2.noarch                                                                                                                     3/51 
  Verifying        : perl-Digest-1.17-395.el8.noarch                                                                                                                        4/51 
  Verifying        : perl-Digest-MD5-2.55-396.el8.x86_64                                                                                                                    5/51 
  Verifying        : perl-Error-1:0.17025-2.el8.noarch                                                                                                                      6/51 
...
...
...
  Verifying        : perl-parent-1:0.237-1.el8.noarch                                                                                                                      46/51 
  Verifying        : perl-podlators-4.11-1.el8.noarch                                                                                                                      47/51 
  Verifying        : perl-threads-1:2.21-2.el8.x86_64                                                                                                                      48/51 
  Verifying        : perl-threads-shared-1.58-2.el8.x86_64                                                                                                                 49/51 
  Verifying        : unzip-6.0-43.el8.x86_64                                                                                                                               50/51 
  Verifying        : zip-3.0-23.el8.x86_64                                                                                                                                 51/51 

Installed:
  emacs-filesystem-1:26.1-5.el8.noarch        git-2.18.4-2.el8_2.x86_64              git-core-2.18.4-2.el8_2.x86_64              git-core-doc-2.18.4-2.el8_2.noarch           
  perl-Carp-1.42-396.el8.noarch               perl-Data-Dumper-2.167-399.el8.x86_64  perl-Digest-1.17-395.el8.noarch             perl-Digest-MD5-2.55-396.el8.x86_64          
  perl-Encode-4:2.97-3.el8.x86_64             perl-Errno-1.28-416.el8.x86_64         perl-Error-1:0.17025-2.el8.noarch           perl-Exporter-5.72-396.el8.noarch            
...
...
...
  perl-Time-Local-1:1.280-1.el8.noarch        perl-URI-1.73-3.el8.noarch             perl-Unicode-Normalize-1.25-396.el8.x86_64  perl-constant-1.33-396.el8.noarch            
  perl-interpreter-4:5.26.3-416.el8.x86_64    perl-libnet-3.11-3.el8.noarch          perl-libs-4:5.26.3-416.el8.x86_64           perl-macros-4:5.26.3-416.el8.x86_64          
  perl-parent-1:0.237-1.el8.noarch            perl-podlators-4.11-1.el8.noarch       perl-threads-1:2.21-2.el8.x86_64            perl-threads-shared-1.58-2.el8.x86_64        
  unzip-6.0-43.el8.x86_64                     wget-1.19.5-8.el8_1.1.x86_64           zip-3.0-23.el8.x86_64                      

Complete!
```

- 安装OpenJDK（Version: 14+）

```
[root@lineage2 ~]# cat <<'EOF' > /etc/yum.repos.d/adoptopenjdk.repo
> [AdoptOpenJDK]
> name=AdoptOpenJDK
> baseurl=http://adoptopenjdk.jfrog.io/adoptopenjdk/rpm/centos/$releasever/$basearch
> enabled=1
> gpgcheck=1
> gpgkey=https://adoptopenjdk.jfrog.io/adoptopenjdk/api/gpg/key/public
> EOF
[root@lineage2 ~]# dnf install adoptopenjdk-14-openj9
Last metadata expiration check: 0:01:02 ago on Tue 27 Oct 2020 07:12:36 PM UTC.
Dependencies resolved.
=================================================================================================================================================================================
 Package                                         Architecture                    Version                                             Repository                             Size
=================================================================================================================================================================================
Installing:
 adoptopenjdk-14-openj9                          x86_64                          14.0.2+12.openj9_0.21.0-3                           AdoptOpenJDK                          194 M
Installing dependencies:
 alsa-lib                                        x86_64                          1.2.1.2-3.el8                                       AppStream                             441 k
 libXi                                           x86_64                          1.7.9-7.el8                                         AppStream                              49 k
 libXtst                                         x86_64                          1.2.3-7.el8                                         AppStream                              22 k

Transaction Summary
=================================================================================================================================================================================
Install  4 Packages

Total size: 194 M
Installed size: 311 M
Is this ok [y/N]: y
Downloading Packages:
[SKIPPED] alsa-lib-1.2.1.2-3.el8.x86_64.rpm: Already downloaded                                                                                                                 
[SKIPPED] libXi-1.7.9-7.el8.x86_64.rpm: Already downloaded                                                                                                                      
[SKIPPED] libXtst-1.2.3-7.el8.x86_64.rpm: Already downloaded                                                                                                                    
[SKIPPED] adoptopenjdk-14-openj9-14.0.2+12.openj9-0.21.0-3.x86_64.rpm: Already downloaded                                                                                       
warning: /var/cache/dnf/AdoptOpenJDK-99841c35d41dcef2/packages/adoptopenjdk-14-openj9-14.0.2+12.openj9-0.21.0-3.x86_64.rpm: Header V4 RSA/SHA1 Signature, key ID 74885c03: NOKEY
AdoptOpenJDK                                                                                                                                     3.3 kB/s | 3.1 kB     00:00    
Importing GPG key 0x74885C03:
 Userid     : "AdoptOpenJDK (used for publishing RPM and DEB files) <adoptopenjdk@gmail.com>"
 Fingerprint: 8ED1 7AF5 D7E6 75EB 3EE3 BCE9 8AC3 B291 7488 5C03
 From       : https://adoptopenjdk.jfrog.io/adoptopenjdk/api/gpg/key/public
Is this ok [y/N]: y
Key imported successfully
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                                                                                                                         1/1 
  Installing       : libXi-1.7.9-7.el8.x86_64                                                                                                                                1/4 
  Installing       : libXtst-1.2.3-7.el8.x86_64                                                                                                                              2/4 
  Installing       : alsa-lib-1.2.1.2-3.el8.x86_64                                                                                                                           3/4 
  Running scriptlet: alsa-lib-1.2.1.2-3.el8.x86_64                                                                                                                           3/4 
  Installing       : adoptopenjdk-14-openj9-14.0.2+12.openj9_0.21.0-3.x86_64                                                                                                 4/4 
  Running scriptlet: adoptopenjdk-14-openj9-14.0.2+12.openj9_0.21.0-3.x86_64                                                                                                 4/4 
  Verifying        : alsa-lib-1.2.1.2-3.el8.x86_64                                                                                                                           1/4 
  Verifying        : libXi-1.7.9-7.el8.x86_64                                                                                                                                2/4 
  Verifying        : libXtst-1.2.3-7.el8.x86_64                                                                                                                              3/4 
  Verifying        : adoptopenjdk-14-openj9-14.0.2+12.openj9_0.21.0-3.x86_64                                                                                                 4/4 

Installed:
  adoptopenjdk-14-openj9-14.0.2+12.openj9_0.21.0-3.x86_64          alsa-lib-1.2.1.2-3.el8.x86_64          libXi-1.7.9-7.el8.x86_64          libXtst-1.2.3-7.el8.x86_64         

Complete!
```

- 安装数据库（Version: 10.4+）

```
[root@lineage2 ~]# cat <<'EOF' > /etc/yum.repos.d/MariaDB.repo
> # Paste and Save
> # MariaDB 10.4 CentOS repository list - created 2020-06-01 18:42 UTC
> # http://downloads.mariadb.org/mariadb/repositories/
> [mariadb]
> name = MariaDB
> baseurl = http://yum.mariadb.org/10.4/centos8-amd64
> module_hotfixes=1
> gpgkey=https://yum.mariadb.org/RPM-GPG-KEY-MariaDB
> gpgcheck=1
> EOF
[root@lineage2 ~]# dnf install MariaDB-server MariaDB-client
MariaDB                                                                                                                                          127 kB/s | 517 kB     00:04    
Last metadata expiration check: 0:00:03 ago on Tue 27 Oct 2020 07:16:41 PM UTC.
Dependencies resolved.
=================================================================================================================================================================================
 Package                                      Architecture                  Version                                                       Repository                        Size
=================================================================================================================================================================================
Installing:
 MariaDB-client                               x86_64                        10.4.15-1.el8                                                 mariadb                           12 M
 MariaDB-server                               x86_64                        10.4.15-1.el8                                                 mariadb                           26 M
Installing dependencies:
 MariaDB-common                               x86_64                        10.4.15-1.el8                                                 mariadb                           87 k
 MariaDB-shared                               x86_64                        10.4.15-1.el8                                                 mariadb                          116 k
 boost-program-options                        x86_64                        1.66.0-7.el8                                                  AppStream                        140 k
 galera-4                                     x86_64                        26.4.5-1.el8                                                  mariadb                           13 M
 libaio                                       x86_64                        0.3.112-1.el8                                                 BaseOS                            33 k
 lsof                                         x86_64                        4.91-2.el8                                                    BaseOS                           253 k
 perl-DBI                                     x86_64                        1.641-3.module_el8.1.0+199+8f0a6bbd                           AppStream                        740 k
 perl-Math-BigInt                             noarch                        1:1.9998.11-7.el8                                             BaseOS                           196 k
 perl-Math-Complex                            noarch                        1.59-416.el8                                                  BaseOS                           108 k
 socat                                        x86_64                        1.7.3.3-2.el8                                                 AppStream                        302 k
Enabling module streams:
 perl                                                                       5.26                                                                                                
 perl-DBI                                                                   1.641                                                                                               

Transaction Summary
=================================================================================================================================================================================
Install  12 Packages

Total download size: 53 M
Installed size: 202 M
Is this ok [y/N]: y
Downloading Packages:
(1/12): boost-program-options-1.66.0-7.el8.x86_64.rpm                                                                                            2.0 MB/s | 140 kB     00:00    
(2/12): socat-1.7.3.3-2.el8.x86_64.rpm                                                                                                           2.2 MB/s | 302 kB     00:00    
(3/12): perl-DBI-1.641-3.module_el8.1.0+199+8f0a6bbd.x86_64.rpm                                                                                  4.1 MB/s | 740 kB     00:00    
(4/12): libaio-0.3.112-1.el8.x86_64.rpm                                                                                                          116 kB/s |  33 kB     00:00    
(5/12): perl-Math-Complex-1.59-416.el8.noarch.rpm                                                                                                388 kB/s | 108 kB     00:00    
(6/12): perl-Math-BigInt-1.9998.11-7.el8.noarch.rpm                                                                                              372 kB/s | 196 kB     00:00    
(7/12): lsof-4.91-2.el8.x86_64.rpm                                                                                                               389 kB/s | 253 kB     00:00    
(8/12): MariaDB-common-10.4.15-1.el8.x86_64.rpm                                                                                                   61 kB/s |  87 kB     00:01    
(9/12): MariaDB-shared-10.4.15-1.el8.x86_64.rpm                                                                                                   80 kB/s | 116 kB     00:01    
(10/12): MariaDB-client-10.4.15-1.el8.x86_64.rpm                                                                                                 923 kB/s |  12 MB     00:13    
(11/12): galera-4-26.4.5-1.el8.x86_64.rpm                                                                                                        1.1 MB/s |  13 MB     00:12    
(12/12): MariaDB-server-10.4.15-1.el8.x86_64.rpm                                                                                                 1.6 MB/s |  26 MB     00:15    
---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
Total                                                                                                                                            3.0 MB/s |  53 MB     00:17     
warning: /var/cache/dnf/mariadb-8e0daa38f21ca158/packages/MariaDB-client-10.4.15-1.el8.x86_64.rpm: Header V4 DSA/SHA1 Signature, key ID 1bb943db: NOKEY
MariaDB                                                                                                                                          8.5 kB/s | 8.2 kB     00:00    
Importing GPG key 0x1BB943DB:
 Userid     : "MariaDB Package Signing Key <package-signing-key@mariadb.org>"
 Fingerprint: 1993 69E5 404B D5FC 7D2F E43B CBCB 082A 1BB9 43DB
 From       : https://yum.mariadb.org/RPM-GPG-KEY-MariaDB
Is this ok [y/N]: y
Key imported successfully
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                                                                                                                         1/1 
  Running scriptlet: MariaDB-shared-10.4.15-1.el8.x86_64                                                                                                                    1/12 
  Installing       : MariaDB-shared-10.4.15-1.el8.x86_64                                                                                                                    1/12 
  Running scriptlet: MariaDB-shared-10.4.15-1.el8.x86_64                                                                                                                    1/12 
  Running scriptlet: MariaDB-common-10.4.15-1.el8.x86_64                                                                                                                    2/12 
  Installing       : MariaDB-common-10.4.15-1.el8.x86_64                                                                                                                    2/12 
  Running scriptlet: MariaDB-common-10.4.15-1.el8.x86_64                                                                                                                    2/12 
  Installing       : lsof-4.91-2.el8.x86_64                                                                                                                                 3/12 
  Installing       : libaio-0.3.112-1.el8.x86_64                                                                                                                            4/12 
  Running scriptlet: MariaDB-client-10.4.15-1.el8.x86_64                                                                                                                    5/12 
  Installing       : MariaDB-client-10.4.15-1.el8.x86_64                                                                                                                    5/12 
  Running scriptlet: MariaDB-client-10.4.15-1.el8.x86_64                                                                                                                    5/12 
  Installing       : perl-Math-Complex-1.59-416.el8.noarch                                                                                                                  6/12 
  Installing       : perl-Math-BigInt-1:1.9998.11-7.el8.noarch                                                                                                              7/12 
  Installing       : perl-DBI-1.641-3.module_el8.1.0+199+8f0a6bbd.x86_64                                                                                                    8/12 
  Installing       : socat-1.7.3.3-2.el8.x86_64                                                                                                                             9/12 
  Installing       : boost-program-options-1.66.0-7.el8.x86_64                                                                                                             10/12 
  Running scriptlet: boost-program-options-1.66.0-7.el8.x86_64                                                                                                             10/12 
  Running scriptlet: galera-4-26.4.5-1.el8.x86_64                                                                                                                          11/12 
  Installing       : galera-4-26.4.5-1.el8.x86_64                                                                                                                          11/12 
  Running scriptlet: galera-4-26.4.5-1.el8.x86_64                                                                                                                          11/12 
  Running scriptlet: MariaDB-server-10.4.15-1.el8.x86_64                                                                                                                   12/12 
  Installing       : MariaDB-server-10.4.15-1.el8.x86_64                                                                                                                   12/12 
  Running scriptlet: MariaDB-server-10.4.15-1.el8.x86_64                                                                                                                   12/12 


Two all-privilege accounts were created.
One is root@localhost, it has no password, but you need to
be system 'root' user to connect. Use, for example, sudo mysql
The second is mysql@localhost, it has no password either, but
you need to be the system 'mysql' user to connect.
After connecting you can set the password, if you would need to be
able to connect as any of these users with a password and without sudo

See the MariaDB Knowledgebase at http://mariadb.com/kb or the
MySQL manual for more instructions.

Please report any problems at http://mariadb.org/jira

The latest information about MariaDB is available at http://mariadb.org/.
You can find additional information about the MySQL part at:
http://dev.mysql.com
Consider joining MariaDB's strong and vibrant community:
https://mariadb.org/get-involved/


  Verifying        : boost-program-options-1.66.0-7.el8.x86_64                                                                                                              1/12 
  Verifying        : perl-DBI-1.641-3.module_el8.1.0+199+8f0a6bbd.x86_64                                                                                                    2/12 
  Verifying        : socat-1.7.3.3-2.el8.x86_64                                                                                                                             3/12 
  Verifying        : libaio-0.3.112-1.el8.x86_64                                                                                                                            4/12 
  Verifying        : lsof-4.91-2.el8.x86_64                                                                                                                                 5/12 
  Verifying        : perl-Math-BigInt-1:1.9998.11-7.el8.noarch                                                                                                              6/12 
  Verifying        : perl-Math-Complex-1.59-416.el8.noarch                                                                                                                  7/12 
  Verifying        : MariaDB-client-10.4.15-1.el8.x86_64                                                                                                                    8/12 
  Verifying        : MariaDB-common-10.4.15-1.el8.x86_64                                                                                                                    9/12 
  Verifying        : MariaDB-server-10.4.15-1.el8.x86_64                                                                                                                   10/12 
  Verifying        : MariaDB-shared-10.4.15-1.el8.x86_64                                                                                                                   11/12 
  Verifying        : galera-4-26.4.5-1.el8.x86_64                                                                                                                          12/12 

Installed:
  MariaDB-client-10.4.15-1.el8.x86_64                   MariaDB-common-10.4.15-1.el8.x86_64         MariaDB-server-10.4.15-1.el8.x86_64     MariaDB-shared-10.4.15-1.el8.x86_64  
  boost-program-options-1.66.0-7.el8.x86_64             galera-4-26.4.5-1.el8.x86_64                libaio-0.3.112-1.el8.x86_64             lsof-4.91-2.el8.x86_64               
  perl-DBI-1.641-3.module_el8.1.0+199+8f0a6bbd.x86_64   perl-Math-BigInt-1:1.9998.11-7.el8.noarch   perl-Math-Complex-1.59-416.el8.noarch   socat-1.7.3.3-2.el8.x86_64           

Complete!
```

### 第三步：初始化数据库

- 安全参数初始化

```
[root@lineage2 ~]# systemctl enable mariadb ; systemctl start mariadb
Created symlink /etc/systemd/system/mysql.service → /usr/lib/systemd/system/mariadb.service.
Created symlink /etc/systemd/system/mysqld.service → /usr/lib/systemd/system/mariadb.service.
Created symlink /etc/systemd/system/multi-user.target.wants/mariadb.service → /usr/lib/systemd/system/mariadb.service.

[root@lineage2 ~]# mysql_secure_installation 

NOTE: RUNNING ALL PARTS OF THIS SCRIPT IS RECOMMENDED FOR ALL MariaDB
      SERVERS IN PRODUCTION USE!  PLEASE READ EACH STEP CAREFULLY!

In order to log into MariaDB to secure it, we'll need the current
password for the root user. If you've just installed MariaDB, and
haven't set the root password yet, you should just press enter here.

Enter current password for root (enter for none): 
OK, successfully used password, moving on...

Setting the root password or using the unix_socket ensures that nobody
can log into the MariaDB root user without the proper authorisation.

You already have your root account protected, so you can safely answer 'n'.

Switch to unix_socket authentication [Y/n] 
Enabled successfully!
Reloading privilege tables..
 ... Success!


You already have your root account protected, so you can safely answer 'n'.

Change the root password? [Y/n] 
New password: 
Re-enter new password: 
Password updated successfully!
Reloading privilege tables..
 ... Success!


By default, a MariaDB installation has an anonymous user, allowing anyone
to log into MariaDB without having to have a user account created for
them.  This is intended only for testing, and to make the installation
go a bit smoother.  You should remove them before moving into a
production environment.

Remove anonymous users? [Y/n] 
 ... Success!

Normally, root should only be allowed to connect from 'localhost'.  This
ensures that someone cannot guess at the root password from the network.

Disallow root login remotely? [Y/n] 
 ... Success!

By default, MariaDB comes with a database named 'test' that anyone can
access.  This is also intended only for testing, and should be removed
before moving into a production environment.

Remove test database and access to it? [Y/n] 
 - Dropping test database...
 ... Success!
 - Removing privileges on test database...
 ... Success!

Reloading the privilege tables will ensure that all changes made so far
will take effect immediately.

Reload privilege tables now? [Y/n] 
 ... Success!

Cleaning up...

All done!  If you've completed all of the above steps, your MariaDB
installation should now be secure.

Thanks for using MariaDB!
```

- 用户创建与授权

```
[root@lineage2 ~]# mariadb -uroot -p123456 -e "CREATE OR REPLACE USER 'test'@'%' IDENTIFIED BY '123456'"
[root@lineage2 ~]# mariadb -uroot -piforgot -e "GRANT ALL PRIVILEGES ON *.* TO 'test'@'%' IDENTIFIED BY '123456'"
[root@lineage2 ~]# mariadb -uroot -piforgot -e "FLUSH PRIVILEGES"
```

### 第四步：获取和编辑服务端代码

- 获取服务端代码：

```
[root@lineage2 ~]# mkdir -p /opt/l2j/git && cd /opt/l2j/git
[root@lineage2 git]# git clone https://bitbucket.org/l2jserver/l2j-server-login.git
Cloning into 'l2j-server-login'...
remote: Counting objects: 466, done.
remote: Compressing objects: 100% (382/382), done.
remote: Total 466 (delta 268), reused 62 (delta 26)
Receiving objects: 100% (466/466), 172.11 KiB | 253.00 KiB/s, done.
Resolving deltas: 100% (268/268), done.

[root@lineage2 git]# git clone https://bitbucket.org/l2jserver/l2j-server-game.git
Cloning into 'l2j-server-game'...
remote: Counting objects: 162792, done.
remote: Compressing objects: 100% (27275/27275), done.
remote: Total 162792 (delta 122966), reused 157215 (delta 117629)
Receiving objects: 100% (162792/162792), 125.64 MiB | 11.35 MiB/s, done.
Resolving deltas: 100% (122966/122966), done.

[root@lineage2 git]# git clone https://bitbucket.org/l2jserver/l2j-server-datapack.git
Cloning into 'l2j-server-datapack'...
remote: Counting objects: 279605, done.
remote: Compressing objects: 100% (65880/65880), done.
remote: Total 279605 (delta 216460), reused 271518 (delta 208452)
Receiving objects: 100% (279605/279605), 145.00 MiB | 12.58 MiB/s, done.
Resolving deltas: 100% (216460/216460), done.
Checking out files: 100% (24326/24326), done.

[root@lineage2 git]# git clone https://bitbucket.org/l2jserver/l2j-server-cli.git
Cloning into 'l2j-server-cli'...
remote: Counting objects: 348, done.
remote: Compressing objects: 100% (296/296), done.
remote: Total 348 (delta 171), reused 0 (delta 0)
Receiving objects: 100% (348/348), 135.18 KiB | 220.00 KiB/s, done.
Resolving deltas: 100% (171/171), done.
```

- 编辑代码：

```
[root@lineage2 git]# cat l2j-server-cli/src/main/resources/config/login-server.properties
# Database URL
# DatabaseURL=jdbc:mysql://localhost
# DatabaseURL=jdbc:hsqldb:hsql://localhost
# DatabaseURL=jdbc:sqlserver://localhost
# DatabaseURL=jdbc:mariadb://localhost
DatabaseURL=jdbc:mariadb://localhost
# Database Name
DatabaseName=l2jls
# Database User
DatabaseUser=test
# Database Password
DatabasePassword=123456
[root@lineage2 git]# cat l2j-server-cli/src/main/resources/config/game-server.properties
# Database URL
# DatabaseURL=jdbc:mysql://localhost
# DatabaseURL=jdbc:hsqldb:hsql://localhost
# DatabaseURL=jdbc:sqlserver://localhost
# DatabaseURL=jdbc:mariadb://localhost
DatabaseURL=jdbc:mariadb://localhost
# Database Name
DatabaseName=l2jgs
# Database User
DatabaseUser=test
# Database Password
DatabasePassword=123456

[root@lineage2 git]# cat l2j-server-login/src/main/resources/config/database.properties
# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

# Specify the appropriate driver and URL for the database you're using.
# Examples:
# Driver = com.mysql.cj.jdbc.Driver
# Driver = org.hsqldb.jdbcDriver
# Driver = com.microsoft.sqlserver.jdbc.SQLServerDriver
# Driver = org.mariadb.jdbc.Driver
# Default: org.mariadb.jdbc.Driver
Driver = org.mariadb.jdbc.Driver
# Database URL
# URL = jdbc:mysql://localhost/l2jls?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC
# URL = jdbc:hsqldb:hsql://localhost/l2jls
# URL = jdbc:sqlserver://localhost/database = l2jls/user = sa/password = 
# URL = jdbc:mariadb://localhost/l2jls
# Default: jdbc:mysql://localhost/l2jls?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC
URL = jdbc:mariadb://localhost/l2jls
# Database User
User = test
# Database Password
Password = 123456

# Database Connection Pool
# Available: BoneCP, C3P0, HikariCP, ApacheDBCP, ViburDBCP
# Default: HikariCP
ConnectionPool = HikariCP

# Default: 10
MaxConnections = 10

# Default: 0
MaxIdleTime = 0

[root@lineage2 git]# cat l2j-server-game/src/main/resources/config/database.properties 
# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------
# Database Engine
# Available: MySQL, MariaDB
# Default: MySQL
Engine = MariaDB

# Specify the appropriate driver and URL for the database you're using.
# Examples:
# Driver = com.mysql.cj.jdbc.Driver
# Driver = org.hsqldb.jdbcDriver
# Driver = com.microsoft.sqlserver.jdbc.SQLServerDriver
# Driver = org.mariadb.jdbc.Driver
# Default: org.mariadb.jdbc.Driver
Driver = org.mariadb.jdbc.Driver
# Database URL
# URL = jdbc:mysql://localhost/l2jgs?allowPublicKeyRetrieval=true&useSSL=false&serverTimezone=UTC
# URL = jdbc:hsqldb:hsql://localhost/l2jgs
# URL = jdbc:sqlserver://localhost/database = l2jgs/user = sa/password = 
# URL = jdbc:mariadb://localhost/l2jgs
# Default: jdbc:mariadb://localhost/l2jgs
URL = jdbc:mariadb://localhost/l2jgs
# Database User
User = test
# Database Password
Password = 123456

# Database Connection Pool
# Available: BoneCP, C3P0, HikariCP, ApacheDBCP, ViburDBCP
# Default: HikariCP
ConnectionPool = HikariCP

# Default: 100
MaxConnections = 100

# Default: 0
MaxIdleTime = 0
```

### 第五步：编译服务端程序

- 编译CLI

```
[root@lineage2 git]# cd /opt/l2j/git/l2j-server-cli/ && chmod 755 mvnw && ./mvnw install
[INFO] Scanning for projects...
[INFO] 
[INFO] --------------------< com.l2jserver:l2j-server-cli >--------------------
[INFO] Building L2J Server Command Line 1.0.6
[INFO] --------------------------------[ jar ]---------------------------------
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/plugins/maven-resources-plugin/2.6/maven-resources-plugin-2.6.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/plugins/maven-resources-plugin/2.6/maven-resources-plugin-2.6.pom (8.1 kB at 9.8 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/plugins/maven-plugins/23/maven-plugins-23.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/plugins/maven-plugins/23/maven-plugins-23.pom (9.2 kB at 25 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/maven-parent/22/maven-parent-22.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/maven-parent/22/maven-parent-22.pom (30 kB at 56 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/apache/11/apache-11.pom
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-io/3.2.0/plexus-io-3.2.0.jar (76 kB at 32 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/commons/commons-compress/1.19/commons-compress-1.19.jar (615 kB at 238 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/iq80/snappy/snappy/0.4/snappy-0.4.jar (58 kB at 22 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/tukaani/xz/1.8/xz-1.8.jar (109 kB at 42 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/3.3.0/plexus-utils-3.3.0.jar (263 kB at 97 kB/s)
[INFO] Building jar: /opt/l2j/git/l2j-server-cli/target/l2jcli.jar
[INFO] 
[INFO] --- maven-assembly-plugin:3.3.0:single (default) @ l2j-server-cli ---
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-component-annotations/2.0.0/plexus-component-annotations-2.0.0.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-component-annotations/2.0.0/plexus-component-annotations-2.0.0.pom (750 B at 2.1 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-containers/2.0.0/plexus-containers-2.0.0.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-containers/2.0.0/plexus-containers-2.0.0.pom (4.8 kB at 13 kB/s)
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/commons-codec/commons-codec/1.6/commons-codec-1.6.jar (233 kB at 318 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/sonatype/plexus/plexus-build-api/0.0.7/plexus-build-api-0.0.7.jar (8.5 kB at 12 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/shared/maven-filtering/3.1.1/maven-filtering-3.1.1.jar (51 kB at 69 kB/s)
[INFO] Reading assembly descriptor: src/main/assembly/zip.xml
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/felix/maven-bundle-plugin/2.3.7/maven-bundle-plugin-2.3.7.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/felix/maven-bundle-plugin/2.3.7/maven-bundle-plugin-2.3.7.pom (4.0 kB at 11 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/felix/felix-parent/2.1/felix-parent-2.1.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/felix/felix-parent/2.1/felix-parent-2.1.pom (9.7 kB at 27 kB/s)
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/felix/maven-bundle-plugin/3.5.1/maven-bundle-plugin-3.5.1.pom (9.9 kB at 28 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/felix/maven-bundle-plugin/3.5.1/maven-bundle-plugin-3.5.1.jar
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/felix/maven-bundle-plugin/3.5.1/maven-bundle-plugin-3.5.1.jar (232 kB at 589 kB/s)
[INFO] Building zip: /opt/l2j/git/l2j-server-cli/target/l2jcli-1.0.6.zip
[INFO] 
[INFO] --- maven-install-plugin:2.4:install (default-install) @ l2j-server-cli ---
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/3.0.5/plexus-utils-3.0.5.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/3.0.5/plexus-utils-3.0.5.pom (2.5 kB at 7.1 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus/3.1/plexus-3.1.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus/3.1/plexus-3.1.pom (19 kB at 52 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-digest/1.0/plexus-digest-1.0.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-digest/1.0/plexus-digest-1.0.pom (1.1 kB at 3.0 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-components/1.1.7/plexus-components-1.1.7.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-components/1.1.7/plexus-components-1.1.7.pom (5.0 kB at 14 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-container-default/1.0-alpha-8/plexus-container-default-1.0-alpha-8.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-container-default/1.0-alpha-8/plexus-container-default-1.0-alpha-8.pom (7.3 kB at 20 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/classworlds/classworlds/1.1-alpha-2/classworlds-1.1-alpha-2.jar
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/3.0.5/plexus-utils-3.0.5.jar
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-digest/1.0/plexus-digest-1.0.jar
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-digest/1.0/plexus-digest-1.0.jar (12 kB at 32 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/3.0.5/plexus-utils-3.0.5.jar (230 kB at 626 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/classworlds/classworlds/1.1-alpha-2/classworlds-1.1-alpha-2.jar (38 kB at 95 kB/s)
[INFO] Installing /opt/l2j/git/l2j-server-cli/target/l2jcli.jar to /root/.m2/repository/com/l2jserver/l2j-server-cli/1.0.6/l2j-server-cli-1.0.6.jar
[INFO] Installing /opt/l2j/git/l2j-server-cli/pom.xml to /root/.m2/repository/com/l2jserver/l2j-server-cli/1.0.6/l2j-server-cli-1.0.6.pom
[INFO] Installing /opt/l2j/git/l2j-server-cli/target/l2jcli-1.0.6.zip to /root/.m2/repository/com/l2jserver/l2j-server-cli/1.0.6/l2j-server-cli-1.0.6.zip
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  05:38 min
[INFO] Finished at: 2020-10-27T19:41:04Z
[INFO] ------------------------------------------------------------------------
```

- 编译Login Server

```
[root@lineage2 l2j-server-cli]# cd /opt/l2j/git/l2j-server-login && chmod 755 mvnw && ./mvnw install
[INFO] Scanning for projects...
[INFO] 
[INFO] -------------------< com.l2jserver:l2j-server-login >-------------------
[INFO] Building L2J Login Server 2.6.3.2
[INFO] --------------------------------[ jar ]---------------------------------
Downloading from jitpack.io: https://jitpack.io/javax/mail/javax.mail-api/1.6.2/javax.mail-api-1.6.2.pom
Downloading from central: https://repo.maven.apache.org/maven2/javax/mail/javax.mail-api/1.6.2/javax.mail-api-1.6.2.pom
Downloaded from central: https://repo.maven.apache.org/maven2/javax/mail/javax.mail-api/1.6.2/javax.mail-api-1.6.2.pom (4.7 kB at 4.8 kB/s)
Downloading from jitpack.io: https://jitpack.io/com/sun/mail/all/1.6.2/all-1.6.2.pom
Downloading from central: https://repo.maven.apache.org/maven2/com/sun/mail/all/1.6.2/all-1.6.2.pom
Downloaded from central: https://repo.maven.apache.org/maven2/com/sun/mail/all/1.6.2/all-1.6.2.pom (23 kB at 42 kB/s)
Downloading from jitpack.io: https://jitpack.io/org/bitbucket/l2jserver/l2j-server-commons/2.6.4.0/l2j-server-commons-2.6.4.0.pom
Downloaded from jitpack.io: https://jitpack.io/org/bitbucket/l2jserver/l2j-server-commons/2.6.4.0/l2j-server-commons-2.6.4.0.pom (4.9 kB at 14 kB/s)
Downloading from jitpack.io: https://jitpack.io/com/zaxxer/HikariCP/3.4.5/HikariCP-3.4.5.pom
Downloading from central: https://repo.maven.apache.org/maven2/com/zaxxer/HikariCP/3.4.5/HikariCP-3.4.5.pom
Downloaded from central: https://repo.maven.apache.org/maven2/com/zaxxer/HikariCP/3.4.5/HikariCP-3.4.5.pom (27 kB at 66 kB/s)
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/org/vibur/vibur-object-pool/25.0/vibur-object-pool-25.0.jar (20 kB at 9.2 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/vibur/vibur-dbcp/25.0/vibur-dbcp-25.0.jar (103 kB at 48 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/com/googlecode/concurrentlinkedhashmap/concurrentlinkedhashmap-lru/1.4.2/concurrentlinkedhashmap-lru-1.4.2.jar (117 kB at 52 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/bitlet/weupnp/0.1.4/weupnp-0.1.4.jar (30 kB at 13 kB/s)
[INFO] 
[INFO] --- maven-resources-plugin:2.6:resources (default-resources) @ l2j-server-login ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Copying 21 resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:compile (default-compile) @ l2j-server-login ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 60 source files to /opt/l2j/git/l2j-server-login/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:2.6:testResources (default-testResources) @ l2j-server-login ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] skip non existing resourceDirectory /opt/l2j/git/l2j-server-login/src/test/resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:testCompile (default-testCompile) @ l2j-server-login ---
[INFO] No sources to compile
[INFO] 
[INFO] --- maven-surefire-plugin:2.12.4:test (default-test) @ l2j-server-login ---
[INFO] No tests to run.
[INFO] 
[INFO] --- maven-jar-plugin:3.2.0:jar (default-jar) @ l2j-server-login ---
[INFO] Building jar: /opt/l2j/git/l2j-server-login/target/l2jlogin.jar
[INFO] 
[INFO] --- maven-assembly-plugin:3.3.0:single (default) @ l2j-server-login ---
[INFO] Reading assembly descriptor: src/main/assembly/zip.xml
Downloading from central: https://repo.maven.apache.org/maven2/org/bitbucket/l2jserver/l2j-server-commons/2.6.4.0/l2j-server-commons-2.6.4.0.pom
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/mojo/exec-maven-plugin/1.6.0/exec-maven-plugin-1.6.0.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/mojo/exec-maven-plugin/1.6.0/exec-maven-plugin-1.6.0.pom (13 kB at 33 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/codehaus/mojo/mojo-parent/40/mojo-parent-40.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/mojo/mojo-parent/40/mojo-parent-40.pom (34 kB at 88 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/maven-toolchain/2.2.1/maven-toolchain-2.2.1.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/maven-toolchain/2.2.1/maven-toolchain-2.2.1.pom (3.3 kB at 8.8 kB/s)
...
...
...
Downloading from central: https://repo.maven.apache.org/maven2/org/bitbucket/l2jserver/l2j-server-mmocore/2.6.3.0/l2j-server-mmocore-2.6.3.0.pom
Downloading from spring-milestone: http://s3.amazonaws.com/maven.springframework.org/milestone/org/bitbucket/l2jserver/l2j-server-mmocore/2.6.3.0/l2j-server-mmocore-2.6.3.0.pom
Downloading from jboss-public-repository-group: http://repository.jboss.org/nexus/content/groups/public/org/bitbucket/l2jserver/l2j-server-mmocore/2.6.3.0/l2j-server-mmocore-2.6.3.0.pom
[INFO] Building zip: /opt/l2j/git/l2j-server-login/target/l2j-server-login-2.6.3.2.zip
[INFO] 
[INFO] --- maven-install-plugin:2.4:install (default-install) @ l2j-server-login ---
[INFO] Installing /opt/l2j/git/l2j-server-login/target/l2jlogin.jar to /root/.m2/repository/com/l2jserver/l2j-server-login/2.6.3.2/l2j-server-login-2.6.3.2.jar
[INFO] Installing /opt/l2j/git/l2j-server-login/pom.xml to /root/.m2/repository/com/l2jserver/l2j-server-login/2.6.3.2/l2j-server-login-2.6.3.2.pom
[INFO] Installing /opt/l2j/git/l2j-server-login/target/l2j-server-login-2.6.3.2.zip to /root/.m2/repository/com/l2jserver/l2j-server-login/2.6.3.2/l2j-server-login-2.6.3.2.zip
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  50.510 s
[INFO] Finished at: 2020-10-27T19:51:08Z
[INFO] ------------------------------------------------------------------------
```

- 编译Game Server

```
[root@lineage2 l2j-server-login]# cd /opt/l2j/git/l2j-server-game && chmod 755 mvnw && ./mvnw install
[INFO] Scanning for projects...
[INFO] 
[INFO] -------------------< com.l2jserver:l2j-server-game >--------------------
[INFO] Building L2J Game Server 2.6.2.0-SNAPSHOT
[INFO] --------------------------------[ jar ]---------------------------------
Downloading from jitpack.io: https://jitpack.io/org/slf4j/jul-to-slf4j/1.7.30/jul-to-slf4j-1.7.30.pom
Downloading from central: https://repo.maven.apache.org/maven2/org/slf4j/jul-to-slf4j/1.7.30/jul-to-slf4j-1.7.30.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/slf4j/jul-to-slf4j/1.7.30/jul-to-slf4j-1.7.30.pom (990 B at 1.0 kB/s)
Downloading from jitpack.io: https://jitpack.io/org/mdkt/compiler/InMemoryJavaCompiler/1.3.0/InMemoryJavaCompiler-1.3.0.pom
Downloading from central: https://repo.maven.apache.org/maven2/org/mdkt/compiler/InMemoryJavaCompiler/1.3.0/InMemoryJavaCompiler-1.3.0.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/mdkt/compiler/InMemoryJavaCompiler/1.3.0/InMemoryJavaCompiler-1.3.0.pom (6.8 kB at 18 kB/s)
Downloading from jitpack.io: https://jitpack.io/com/google/code/gson/gson/2.8.6/gson-2.8.6.pom
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/net/bytebuddy/byte-buddy/1.10.13/byte-buddy-1.10.13.jar (3.5 MB at 1.5 MB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/net/bytebuddy/byte-buddy-agent/1.10.13/byte-buddy-agent-1.10.13.jar (259 kB at 112 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/objenesis/objenesis/3.1/objenesis-3.1.jar (60 kB at 25 kB/s)
[INFO] 
[INFO] --- maven-resources-plugin:2.6:resources (default-resources) @ l2j-server-game ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Copying 38 resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:compile (default-compile) @ l2j-server-game ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 1791 source files to /opt/l2j/git/l2j-server-game/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:2.6:testResources (default-testResources) @ l2j-server-game ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Copying 1 resource
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:testCompile (default-testCompile) @ l2j-server-game ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 8 source files to /opt/l2j/git/l2j-server-game/target/test-classes
[INFO] 
[INFO] --- maven-surefire-plugin:2.12.4:test (default-test) @ l2j-server-game ---
[INFO] Surefire report directory: /opt/l2j/git/l2j-server-game/target/surefire-reports
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/surefire/surefire-testng/2.12.4/surefire-testng-2.12.4.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/surefire/surefire-testng/2.12.4/surefire-testng-2.12.4.pom (3.6 kB at 9.5 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/apache/maven/surefire/surefire-providers/2.12.4/surefire-providers-2.12.4.pom
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/org/codehaus/plexus/plexus-utils/1.0.4/plexus-utils-1.0.4.jar (164 kB at 388 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/surefire/surefire-grouper/2.12.4/surefire-grouper-2.12.4.jar (38 kB at 63 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/apache/maven/surefire/surefire-testng/2.12.4/surefire-testng-2.12.4.jar (34 kB at 56 kB/s)

-------------------------------------------------------
 T E S T S
-------------------------------------------------------
Running TestSuite
Configuring TestNG with: org.apache.maven.surefire.testng.conf.TestNG652Configurator@f483ec88
[INFO ] 2020-10-27 19:53:37 GameServer: -----------------------------------=[ Network Configuration ]
[INFO ] 2020-10-27 19:53:37 IPConfigData: Using automatic network configuration.
[INFO ] 2020-10-27 19:53:37 IPConfigData: Adding new subnet: 172.16.0.0/16 address: 172.16.0.196
[INFO ] 2020-10-27 19:53:37 IPConfigData: Adding new subnet: 127.0.0.0/8 address: 127.0.0.1
[INFO ] 2020-10-27 19:53:37 IPConfigData: Adding new subnet: 0.0.0.0/0 address: 114.244.70.65
Tests run: 35, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 3.493 sec

Results :

Tests run: 35, Failures: 0, Errors: 0, Skipped: 0

[INFO] 
[INFO] --- maven-jar-plugin:3.2.0:jar (default-jar) @ l2j-server-game ---
[INFO] Building jar: /opt/l2j/git/l2j-server-game/target/l2jserver.jar
[INFO] 
[INFO] --- maven-assembly-plugin:3.3.0:single (default) @ l2j-server-game ---
[INFO] Reading assembly descriptor: src/main/assembly/zip.xml
Downloading from central: https://repo.maven.apache.org/maven2/org/sonatype/plugins/nexus-staging-maven-plugin/1.6.3/nexus-staging-maven-plugin-1.6.3.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/sonatype/plugins/nexus-staging-maven-plugin/1.6.3/nexus-staging-maven-plugin-1.6.3.pom (12 kB at 32 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/sonatype/nexus/maven/nexus-staging/1.6.3/nexus-staging-1.6.3.pom
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/com/google/protobuf/protobuf-java/2.4.1/protobuf-java-2.4.1.jar (450 kB at 277 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/bitbucket/l2jserver/l2j-server-geo-driver/2.6.3.0/l2j-server-geo-driver-2.6.3.0.pom
Downloading from spring-milestone: http://s3.amazonaws.com/maven.springframework.org/milestone/org/bitbucket/l2jserver/l2j-server-geo-driver/2.6.3.0/l2j-server-geo-driver-2.6.3.0.pom
Downloading from jboss-public-repository-group: http://repository.jboss.org/nexus/content/groups/public/org/bitbucket/l2jserver/l2j-server-geo-driver/2.6.3.0/l2j-server-geo-driver-2.6.3.0.pom
[INFO] Building zip: /opt/l2j/git/l2j-server-game/target/l2j-server-game-2.6.2.0-SNAPSHOT.zip
[INFO] 
[INFO] --- maven-install-plugin:2.4:install (default-install) @ l2j-server-game ---
[INFO] Installing /opt/l2j/git/l2j-server-game/target/l2jserver.jar to /root/.m2/repository/com/l2jserver/l2j-server-game/2.6.2.0-SNAPSHOT/l2j-server-game-2.6.2.0-SNAPSHOT.jar
[INFO] Installing /opt/l2j/git/l2j-server-game/pom.xml to /root/.m2/repository/com/l2jserver/l2j-server-game/2.6.2.0-SNAPSHOT/l2j-server-game-2.6.2.0-SNAPSHOT.pom
[INFO] Installing /opt/l2j/git/l2j-server-game/target/l2j-server-game-2.6.2.0-SNAPSHOT.zip to /root/.m2/repository/com/l2jserver/l2j-server-game/2.6.2.0-SNAPSHOT/l2j-server-game-2.6.2.0-SNAPSHOT.zip
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  01:34 min
[INFO] Finished at: 2020-10-27T19:54:09Z
[INFO] ------------------------------------------------------------------------
```

- 编译datapack

```
[root@lineage2 l2j-server-game]# cd /opt/l2j/git/l2j-server-datapack && chmod 755 mvnw && ./mvnw install
[INFO] Scanning for projects...
[INFO] 
[INFO] -----------------< com.l2jserver:l2j-server-datapack >------------------
[INFO] Building L2J DataPack 2.6.2.0-SNAPSHOT
[INFO] --------------------------------[ jar ]---------------------------------
Downloading from central: https://repo.maven.apache.org/maven2/org/easymock/easymock/4.2/easymock-4.2.pom
Downloaded from central: https://repo.maven.apache.org/maven2/org/easymock/easymock/4.2/easymock-4.2.pom (11 kB at 9.4 kB/s)
Downloading from central: https://repo.maven.apache.org/maven2/org/easymock/easymock-parent/4.2/easymock-parent-4.2.pom
...
...
...
Downloaded from central: https://repo.maven.apache.org/maven2/org/powermock/powermock-module-testng/2.0.7/powermock-module-testng-2.0.7.jar (15 kB at 5.9 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/org/powermock/powermock-module-testng-common/2.0.7/powermock-module-testng-common-2.0.7.jar (7.0 kB at 2.6 kB/s)
Downloaded from central: https://repo.maven.apache.org/maven2/cglib/cglib-nodep/3.2.9/cglib-nodep-3.2.9.jar (414 kB at 148 kB/s)
[INFO] 
[INFO] --- maven-resources-plugin:2.6:resources (default-resources) @ l2j-server-datapack ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] Copying 6419 resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:compile (default-compile) @ l2j-server-datapack ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 1273 source files to /opt/l2j/git/l2j-server-datapack/target/classes
[INFO] 
[INFO] --- maven-resources-plugin:2.6:testResources (default-testResources) @ l2j-server-datapack ---
[INFO] Using 'UTF-8' encoding to copy filtered resources.
[INFO] skip non existing resourceDirectory /opt/l2j/git/l2j-server-datapack/src/test/resources
[INFO] 
[INFO] --- maven-compiler-plugin:3.1:testCompile (default-testCompile) @ l2j-server-datapack ---
[INFO] Changes detected - recompiling the module!
[INFO] Compiling 3 source files to /opt/l2j/git/l2j-server-datapack/target/test-classes
[INFO] 
[INFO] --- maven-surefire-plugin:2.12.4:test (default-test) @ l2j-server-datapack ---
[INFO] Surefire report directory: /opt/l2j/git/l2j-server-datapack/target/surefire-reports

-------------------------------------------------------
 T E S T S
-------------------------------------------------------
Running TestSuite
Configuring TestNG with: org.apache.maven.surefire.testng.conf.TestNG652Configurator@2dbb784e
WARNING: An illegal reflective access operation has occurred
WARNING: Illegal reflective access by org.powermock.reflect.internal.WhiteboxImpl (file:/root/.m2/repository/org/powermock/powermock-reflect/2.0.7/powermock-reflect-2.0.7.jar) to method java.lang.Object.clone()
WARNING: Please consider reporting this to the maintainers of org.powermock.reflect.internal.WhiteboxImpl
WARNING: Use --illegal-access=warn to enable warnings of further illegal reflective access operations
WARNING: All illegal access operations will be denied in a future release
[INFO ] 2020-10-27 19:56:54 GameServer: -----------------------------------=[ Network Configuration ]
[INFO ] 2020-10-27 19:56:54 IPConfigData: Using automatic network configuration.
[INFO ] 2020-10-27 19:56:55 IPConfigData: Adding new subnet: 172.16.0.0/16 address: 172.16.0.196
[INFO ] 2020-10-27 19:56:55 IPConfigData: Adding new subnet: 127.0.0.0/8 address: 127.0.0.1
[INFO ] 2020-10-27 19:56:55 IPConfigData: Adding new subnet: 0.0.0.0/0 address: 114.244.70.65
[WARN ] 2020-10-27 19:56:55 IXmlReader: AdminData: Could not parse accessLevels.xml is not a file or it doesn't exist!
[INFO ] 2020-10-27 19:56:55 AdminData: Loaded 0 access levels.
[WARN ] 2020-10-27 19:56:55 IXmlReader: AdminData: Could not parse adminCommands.xml is not a file or it doesn't exist!
[INFO ] 2020-10-27 19:56:55 AdminData: Loaded 0 access commands.
Tests run: 17, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 13.337 sec

Results :

Tests run: 17, Failures: 0, Errors: 0, Skipped: 0

[INFO] 
[INFO] --- maven-assembly-plugin:3.3.0:single (default) @ l2j-server-datapack ---
[INFO] Reading assembly descriptor: src/main/assembly/zip.xml
[INFO] Building zip: /opt/l2j/git/l2j-server-datapack/target/l2j-server-datapack-2.6.2.0-SNAPSHOT.zip
[INFO] 
[INFO] --- maven-install-plugin:2.4:install (default-install) @ l2j-server-datapack ---
[INFO] No primary artifact to install, installing attached artifacts instead.
[INFO] Installing /opt/l2j/git/l2j-server-datapack/pom.xml to /root/.m2/repository/com/l2jserver/l2j-server-datapack/2.6.2.0-SNAPSHOT/l2j-server-datapack-2.6.2.0-SNAPSHOT.pom
[INFO] Installing /opt/l2j/git/l2j-server-datapack/target/l2j-server-datapack-2.6.2.0-SNAPSHOT.zip to /root/.m2/repository/com/l2jserver/l2j-server-datapack/2.6.2.0-SNAPSHOT/l2j-server-datapack-2.6.2.0-SNAPSHOT.zip
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
[INFO] Total time:  59.651 s
[INFO] Finished at: 2020-10-27T19:57:02Z
[INFO] ------------------------------------------------------------------------
```

### 第六步：部署服务端程序

- 部署CLI

```
[root@lineage2 l2j-server-datapack]# mkdir -p /opt/l2j/cli && cd /opt/l2j/cli
[root@lineage2 cli]# unzip /opt/l2j/git/l2j-server-cli/target/l2jcli-1.0.6.zip -d /opt/l2j/cli/
Archive:  /opt/l2j/git/l2j-server-cli/target/l2jcli-1.0.6.zip
   creating: /opt/l2j/cli/config/
   creating: /opt/l2j/cli/libs/
  inflating: /opt/l2j/cli/l2jcli.jar  
  inflating: /opt/l2j/cli/l2jcli.bat  
  inflating: /opt/l2j/cli/l2jcli.sh  
  inflating: /opt/l2j/cli/config/game-server.properties  
  inflating: /opt/l2j/cli/config/login-server.properties  
  inflating: /opt/l2j/cli/libs/picocli-4.5.0.jar  
  inflating: /opt/l2j/cli/libs/org.eclipse.jgit-5.8.1.202007141445-r.jar  
  inflating: /opt/l2j/cli/libs/JavaEWAH-1.1.7.jar  
  inflating: /opt/l2j/cli/libs/slf4j-api-1.7.30.jar  
  inflating: /opt/l2j/cli/libs/log4j-slf4j-impl-2.13.3.jar  
  inflating: /opt/l2j/cli/libs/log4j-api-2.13.3.jar  
  inflating: /opt/l2j/cli/libs/log4j-core-2.13.3.jar  
  inflating: /opt/l2j/cli/libs/mysql-connector-java-8.0.21.jar  
  inflating: /opt/l2j/cli/libs/protobuf-java-3.11.4.jar  
  inflating: /opt/l2j/cli/libs/mariadb-java-client-2.6.2.jar  
  inflating: /opt/l2j/cli/libs/mssql-jdbc-8.4.0.jre14.jar  
  inflating: /opt/l2j/cli/libs/postgresql-42.2.15.jar  
  inflating: /opt/l2j/cli/libs/checker-qual-3.5.0.jar  
  inflating: /opt/l2j/cli/libs/hsqldb-2.5.1.jar  
  inflating: /opt/l2j/cli/libs/h2-1.4.200.jar  
  inflating: /opt/l2j/cli/libs/derbyclient-10.15.2.0.jar  
  inflating: /opt/l2j/cli/libs/derbyshared-10.15.2.0.jar  
  inflating: /opt/l2j/cli/libs/asciitable-0.3.2.jar  
  inflating: /opt/l2j/cli/libs/ascii-utf-themes-0.0.1.jar  
  inflating: /opt/l2j/cli/libs/skb-interfaces-0.0.1.jar  
  inflating: /opt/l2j/cli/libs/commons-lang3-3.4.jar  
  inflating: /opt/l2j/cli/libs/ST4-4.0.8.jar  
  inflating: /opt/l2j/cli/libs/antlr-runtime-3.5.2.jar  
  inflating: /opt/l2j/cli/libs/antlr4-4.5.1.jar  
  inflating: /opt/l2j/cli/libs/char-translation-0.0.2.jar  
  inflating: /opt/l2j/cli/libs/owner-java8-1.0.12.jar  
  inflating: /opt/l2j/cli/libs/owner-1.0.12.jar
[root@lineage2 cli]# chmod 755 l2jcli.sh
[root@lineage2 cli]# ./l2jcli.sh 
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~                                     ~
~ (>^_^)> Welcome to L2J CLI  <(^_^<) ~
~                                     ~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

>>> quit
[root@lineage2 cli]#
```

- 部署Login Server

```
[root@lineage2 cli]# mkdir -p /opt/l2j/server/login
[root@lineage2 cli]# unzip /opt/l2j/git/l2j-server-login/target/l2j-server-login-2.6.3.2.zip -d /opt/l2j/server/login
Archive:  /opt/l2j/git/l2j-server-login/target/l2j-server-login-2.6.3.2.zip
   creating: /opt/l2j/server/login/config/
   creating: /opt/l2j/server/login/data/
   creating: /opt/l2j/server/login/data/mail/
   creating: /opt/l2j/server/login/data/mail/html/
   creating: /opt/l2j/server/login/sql/
   creating: /opt/l2j/server/login/sql/cleanup/
   creating: /opt/l2j/server/login/libs/
  inflating: /opt/l2j/server/login/l2jlogin.jar  
  inflating: /opt/l2j/server/login/LoginServer_loop.sh  
  inflating: /opt/l2j/server/login/startLoginServer.bat  
  inflating: /opt/l2j/server/login/startLoginServer.sh  
  inflating: /opt/l2j/server/login/config/banned_ip.cfg  
  inflating: /opt/l2j/server/login/config/email.properties  
  inflating: /opt/l2j/server/login/config/mmo.properties  
  inflating: /opt/l2j/server/login/config/server.properties  
  inflating: /opt/l2j/server/login/config/telnet.properties  
  inflating: /opt/l2j/server/login/config/database.properties  
  inflating: /opt/l2j/server/login/data/mail/MailList.xml  
  inflating: /opt/l2j/server/login/data/mail/MailList.xsd  
  inflating: /opt/l2j/server/login/data/mail/html/SecAuthTempBan.htm  
  inflating: /opt/l2j/server/login/data/servername.xml  
  inflating: /opt/l2j/server/login/data/servername.xsd  
  inflating: /opt/l2j/server/login/sql/account_data.sql  
  inflating: /opt/l2j/server/login/sql/accounts.sql  
  inflating: /opt/l2j/server/login/sql/accounts_ipauth.sql  
  inflating: /opt/l2j/server/login/sql/cleanup/cleanup.sql  
  inflating: /opt/l2j/server/login/sql/gameservers.sql  
  inflating: /opt/l2j/server/login/libs/slf4j-api-1.7.30.jar  
  inflating: /opt/l2j/server/login/libs/log4j-slf4j-impl-2.13.3.jar  
  inflating: /opt/l2j/server/login/libs/log4j-api-2.13.3.jar  
  inflating: /opt/l2j/server/login/libs/log4j-core-2.13.3.jar  
  inflating: /opt/l2j/server/login/libs/owner-java8-1.0.12.jar  
  inflating: /opt/l2j/server/login/libs/owner-1.0.12.jar  
  inflating: /opt/l2j/server/login/libs/javax.mail-api-1.6.2.jar  
  inflating: /opt/l2j/server/login/libs/l2j-server-commons-2.6.4.0.jar  
  inflating: /opt/l2j/server/login/libs/mariadb-java-client-2.6.2.jar  
  inflating: /opt/l2j/server/login/libs/mysql-connector-java-8.0.21.jar  
  inflating: /opt/l2j/server/login/libs/protobuf-java-3.11.4.jar  
  inflating: /opt/l2j/server/login/libs/HikariCP-3.4.5.jar  
  inflating: /opt/l2j/server/login/libs/c3p0-0.9.5.5.jar  
  inflating: /opt/l2j/server/login/libs/mchange-commons-java-0.2.19.jar  
  inflating: /opt/l2j/server/login/libs/bonecp-0.8.0.RELEASE.jar  
  inflating: /opt/l2j/server/login/libs/guava-15.0.jar  
  inflating: /opt/l2j/server/login/libs/commons-dbcp2-2.7.0.jar  
  inflating: /opt/l2j/server/login/libs/commons-pool2-2.7.0.jar  
  inflating: /opt/l2j/server/login/libs/commons-logging-1.2.jar  
  inflating: /opt/l2j/server/login/libs/vibur-dbcp-25.0.jar  
  inflating: /opt/l2j/server/login/libs/vibur-object-pool-25.0.jar  
  inflating: /opt/l2j/server/login/libs/concurrentlinkedhashmap-lru-1.4.2.jar  
  inflating: /opt/l2j/server/login/libs/weupnp-0.1.4.jar  
  inflating: /opt/l2j/server/login/libs/l2j-server-mmocore-2.6.3.0.jar
[root@lineage2 cli]# cd /opt/l2j/server/login && mkdir -p log
[root@lineage2 login]# chmod 755 LoginServer_loop.sh
[root@lineage2 login]# chmod 755 startLoginServer.sh
```

- 部署Game Server

```
[root@lineage2 login]# mkdir -p /opt/l2j/server/game
[root@lineage2 login]# unzip /opt/l2j/git/l2j-server-game/target/l2j-server-game-2.6.2.0-SNAPSHOT.zip -d /opt/l2j/server/game
Archive:  /opt/l2j/git/l2j-server-game/target/l2j-server-game-2.6.2.0-SNAPSHOT.zip
   creating: /opt/l2j/server/game/config/
   creating: /opt/l2j/server/game/libs/
  inflating: /opt/l2j/server/game/l2jserver.jar  
  inflating: /opt/l2j/server/game/GameServer_loop.sh  
  inflating: /opt/l2j/server/game/startGameServer.bat  
  inflating: /opt/l2j/server/game/startGameServer.sh  
  inflating: /opt/l2j/server/game/config/SecondaryAuth.xml  
  inflating: /opt/l2j/server/game/config/SecondaryAuth.xsd  
  inflating: /opt/l2j/server/game/config/SiegeSchedule.xml
...
...
...
  inflating: /opt/l2j/server/game/libs/weupnp-0.1.4.jar  
  inflating: /opt/l2j/server/game/libs/l2j-server-mmocore-2.6.3.0.jar  
  inflating: /opt/l2j/server/game/libs/l2j-server-geo-driver-2.6.3.0.jar
[root@lineage2 login]# cd /opt/l2j/server/game && mkdir -p log
[root@lineage2 game]# chmod 755 GameServer_loop.sh
[root@lineage2 game]# chmod 755 startGameServer.sh
```

- 部署datapack

```
[root@lineage2 login]# unzip /opt/l2j/git/l2j-server-datapack/target/l2j-server-datapack-2.6.2.0-SNAPSHOT.zip -d /opt/l2j/server/game
Archive:  /opt/l2j/git/l2j-server-datapack/target/l2j-server-datapack-2.6.2.0-SNAPSHOT.zip
   creating: /opt/l2j/server/game/script/
   creating: /opt/l2j/server/game/script/com/
   creating: /opt/l2j/server/game/script/com/l2jserver/
   creating: /opt/l2j/server/game/script/com/l2jserver/datapack/
   creating: /opt/l2j/server/game/script/com/l2jserver/datapack/ai/
...
...
...
  inflating: /opt/l2j/server/game/sql/topic.sql  
  inflating: /opt/l2j/server/game/sql/updates/2020-07-11_forums_auto_increment_key.sql  
  inflating: /opt/l2j/server/game/sql/updates/2020-09-06_items_added_agathion_energy.sql  
  inflating: /opt/l2j/server/game/sql/updates/2020-09-20_conquerable_clan_hall_typo_fix.sql
```

### 第七步：导入数据库

```
[root@lineage2 cli]# ./l2jcli.sh
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
~                                     ~
~ (>^_^)> Welcome to L2J CLI  <(^_^<) ~
~                                     ~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

>>> db install -sql /opt/l2j/server/login/sql -u test -p 123456 -m FULL -t LOGIN -c -mods
Oct 27, 2020 8:17:30 PM java.util.prefs.FileSystemPreferences$1 run
INFO: Created user preferences directory.
Executing cleanup script...
Running cleanup.sql...
Installing basic SQL scripts...
Running account_data.sql...
Running accounts.sql...
Running accounts_ipauth.sql...
Running gameservers.sql...
Database installation complete.
>>> db install -sql /opt/l2j/server/game/sql -u test -p 123456 -m FULL -t GAME -c -mods
Executing cleanup script...
Running cleanup.sql...
Oct 27, 2020 8:18:02 PM java.util.prefs.FileSystemPreferences$6 run
WARNING: Prefs file removed in background /root/.java/.userPrefs/prefs.xml
Installing basic SQL scripts...
Running account_gsdata.sql...
Running airships.sql...
Running announcements.sql...
Running auction.sql...
Running auction_bid.sql...
Running auction_watch.sql...
Running bbs_favorite.sql...
Running bot_reported_char_data.sql...
...
...
...
Running territory_registrations.sql...
Running territory_spawnlist.sql...
Running topic.sql...
Installing custom tables...
Running custom_buffer_service_1_ulists.sql...
Running custom_buffer_service_2_ulist_buffs.sql...
Running custom_npc_buffer.sql...
Running custom_spawnlist.sql...
Running custom_teleport.sql...
Installing mod tables...
Running mods_wedding.sql...
Database installation complete.
>>> account create -u admin -p -a 8
Enter value for --password (Password): 
Creating account admin...
>>> quit
[root@lineage2 cli]#
```

### 第八步：运行服务器并验证

- 启动脚本

```
[root@lineage2 cli]# cd /opt/l2j/server/login
[root@lineage2 login]# ./startLoginServer.sh
[root@lineage2 login]# cd /opt/l2j/server/game
[root@lineage2 game]# ./startGameServer.sh
```

- 检查服务端口(Login Server: 2106/Game Server: 7777)

```
[root@lineage2 game]# netstat -natp|grep LISTEN
tcp        0      0 0.0.0.0:5355            0.0.0.0:*               LISTEN      875/systemd-resolve 
tcp        0      0 0.0.0.0:111             0.0.0.0:*               LISTEN      1/systemd           
tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      933/sshd            
tcp6       0      0 :::3306                 :::*                    LISTEN      8567/mysqld         
tcp6       0      0 :::5355                 :::*                    LISTEN      875/systemd-resolve 
tcp6       0      0 :::111                  :::*                    LISTEN      1/systemd           
tcp6       0      0 127.0.0.1:9014          :::*                    LISTEN      9189/java           
tcp6       0      0 :::22                   :::*                    LISTEN      933/sshd            
tcp6       0      0 :::2106                 :::*                    LISTEN      9189/java           
tcp6       0      0 :::7777                 :::*                    LISTEN      9233/java 
```

- 检查登陆服务日志

```
[root@lineage2 server]# cat login/log/stdout.log 
[INFO ] 2020-10-27 20:21:23 ConnectionFactory: Using HikariCP connection pool.
[INFO ] 2020-10-27 20:21:23 LoginController: Loading Login Controller...
[INFO ] 2020-10-27 20:21:24 LoginController: Cached 10 KeyPairs for RSA communication.
[INFO ] 2020-10-27 20:21:24 LoginController: Stored 20 keys for Blowfish communication.
[INFO ] 2020-10-27 20:21:24 HikariDataSource: HikariPool-1 - Starting...
[INFO ] 2020-10-27 20:21:24 HikariDataSource: HikariPool-1 - Start completed.
[INFO ] 2020-10-27 20:21:24 GameServerTable: GameServerTable: Loaded 0 registered Game Servers.
[INFO ] 2020-10-27 20:21:24 GameServerTable: GameServerTable: Cached 10 RSA keys for Game Server communication.
[INFO ] 2020-10-27 20:21:24 LoginServer: Loaded 2 banned IPs.
[INFO ] 2020-10-27 20:21:24 LoginServer: Listening for game servers on 127.0.0.1:9014.
[INFO ] 2020-10-27 20:21:24 LoginServer: Telnet server is currently disabled.
[INFO ] 2020-10-27 20:21:24 LoginServer: Login Server is now listening on *:2106.
[INFO ] 2020-10-27 20:21:24 UPnPService: Looking for UPnP Gateway Devices...
[INFO ] 2020-10-27 20:21:33 UPnPService: No UPnP gateways has been found.
[INFO ] 2020-10-27 20:22:39 GameServerThread: Updated game server Bartz[1] IP's.
[INFO ] 2020-10-27 20:22:39 GameServerThread: 172.16.0.196/172.16.0.0/16
[INFO ] 2020-10-27 20:22:39 GameServerThread: 127.0.0.1/127.0.0.0/8
[INFO ] 2020-10-27 20:22:39 GameServerThread: 114.244.70.65/0.0.0.0/0
[INFO ] 2020-10-27 20:22:39 GameServerAuth: Game Server High Five enabled.
```

- 检查游戏服务日志

```
[root@lineage2 server]# cat game/log/stdout.log 
[INFO ] 2020-10-27 20:21:33 GameServer: ------------------------------------------------=[ Database ]
[INFO ] 2020-10-27 20:21:33 GameServer: -----------------------------------=[ Network Configuration ]
[INFO ] 2020-10-27 20:21:33 IPConfigData: Using automatic network configuration.
[INFO ] 2020-10-27 20:21:33 IPConfigData: Adding new subnet: 172.16.0.0/16 address: 172.16.0.196
[INFO ] 2020-10-27 20:21:33 IPConfigData: Adding new subnet: 127.0.0.0/8 address: 127.0.0.1
[INFO ] 2020-10-27 20:21:33 IPConfigData: Adding new subnet: 0.0.0.0/0 address: 114.244.70.65
[INFO ] 2020-10-27 20:21:34 ConnectionFactory: Using HikariCP connection pool.
[INFO ] 2020-10-27 20:21:34 DAOFactory: Using MySQL DAO Factory.
[INFO ] 2020-10-27 20:21:34 HikariDataSource: HikariPool-1 - Starting...
[INFO ] 2020-10-27 20:21:34 HikariDataSource: HikariPool-1 - Start completed.
[INFO ] 2020-10-27 20:21:34 IdFactory: Updated characters online status.
[INFO ] 2020-10-27 20:21:34 IdFactory: Cleaned 0 elements from database in 0s.
[INFO ] 2020-10-27 20:21:34 IdFactory: Cleaned 0 expired timestamps from database.
[INFO ] 2020-10-27 20:21:34 BitSetIDFactory: 102912 Ids available.
[INFO ] 2020-10-27 20:21:34 GameServer: ---------------------------------------------------=[ World ]
[INFO ] 2020-10-27 20:21:34 InstanceManager: Multiverse Instance created.
[INFO ] 2020-10-27 20:21:34 InstanceManager: Universe Instance created.
[INFO ] 2020-10-27 20:21:34 InstanceManager: Loaded 160 instance names.
[INFO ] 2020-10-27 20:21:35 L2World: 128 by 136 world region grid set up.
[INFO ] 2020-10-27 20:21:35 MapRegionManager: Loaded 57 map regions.
[INFO ] 2020-10-27 20:21:35 GlobalVariablesManager: Loaded 0 variables.
[INFO ] 2020-10-27 20:21:35 GameServer: ----------------------------------------------------=[ Data ]
[INFO ] 2020-10-27 20:21:35 CategoryData: Loaded 124 Categories.
[INFO ] 2020-10-27 20:21:35 SecondaryAuthData: Loaded 328 forbidden passwords.
[INFO ] 2020-10-27 20:21:35 GameServer: -------------------------------------------------=[ Effects ]
[INFO ] 2020-10-27 20:21:39 EffectMasterHandler: Loaded 162 effect handlers.
[INFO ] 2020-10-27 20:21:39 GameServer: ------------------------------------=[ Enchant Skill Groups ]
[INFO ] 2020-10-27 20:21:39 EnchantSkillGroupsData: Loaded 4 groups and 90 routes.
[INFO ] 2020-10-27 20:21:39 GameServer: ---------------------------------------------=[ Skill Trees ]
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 17176 Class Skills for 103 Class Skill Trees.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 76 Sub-Class Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 77 Transfer Skills for 3 Transfer Skill Trees.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 117 Fishing Skills, 8 Dwarven only Fishing Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 3 Collect Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 74 Pledge Skills, 44 for Pledge and 30 Residential.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 18 Sub-Pledge Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 32 Transform Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 8 Noble Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 5 Hero Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 46 Game Master Skills.
[INFO ] 2020-10-27 20:21:39 SkillTreesData: Loaded 46 Game Master Aura Skills.
[INFO ] 2020-10-27 20:21:39 GameServer: --------------------------------------------------=[ Skills ]
[INFO ] 2020-10-27 20:21:51 DocumentEngine: Loaded 65957 skill templates from XML files.
[INFO ] 2020-10-27 20:21:52 SummonSkillsTable: Loaded 1891 summon skills.
[INFO ] 2020-10-27 20:21:52 GameServer: ---------------------------------------------------=[ Items ]
[INFO ] 2020-10-27 20:21:53 ItemTable: Highest item Id used 22567.
[INFO ] 2020-10-27 20:21:53 ItemTable: Loaded 11481 Etc items.
[INFO ] 2020-10-27 20:21:53 ItemTable: Loaded 3825 Armor items.
[INFO ] 2020-10-27 20:21:53 ItemTable: Loaded 3893 Weapon items.
[INFO ] 2020-10-27 20:21:53 ItemTable: Loaded 19199 items in total.
[INFO ] 2020-10-27 20:21:53 EnchantItemGroupsData: Loaded 4 item group templates.
[INFO ] 2020-10-27 20:21:53 EnchantItemGroupsData: Loaded 1 scroll group templates.
[INFO ] 2020-10-27 20:21:53 EnchantItemData: Loaded 63 enchant scrolls.
[INFO ] 2020-10-27 20:21:53 EnchantItemData: Loaded 20 support items.
[INFO ] 2020-10-27 20:21:53 EnchantItemOptionsData: Loaded 23 items and 1093 options.
[INFO ] 2020-10-27 20:21:54 OptionData: Loaded 24985 item options.
[INFO ] 2020-10-27 20:21:54 EnchantItemHPBonusData: Loaded 6 Enchant HP Bonuses.
[INFO ] 2020-10-27 20:21:54 MerchantPriceConfigTable: Loaded 28 merchant price configs.
[INFO ] 2020-10-27 20:21:55 BuyListData: Loaded 760 buy lists.
[INFO ] 2020-10-27 20:21:56 MultisellData: Loaded 192 multisell lists.
[INFO ] 2020-10-27 20:21:56 RecipeData: Loaded 1000 recipes.
[INFO ] 2020-10-27 20:21:56 ArmorSetsData: Loaded 198 armor sets.
[INFO ] 2020-10-27 20:21:56 FishData: Loaded 278 fish.
[INFO ] 2020-10-27 20:21:56 FishingMonstersData: Loaded 8 fishing monsters.
[INFO ] 2020-10-27 20:21:56 FishingRodsData: Loaded 6 fishing rods.
[INFO ] 2020-10-27 20:21:56 HennaData: Loaded 180 Henna data.
[INFO ] 2020-10-27 20:21:56 GameServer: ----------------------------------------------=[ Characters ]
[INFO ] 2020-10-27 20:21:56 ClassListData: Loaded 107 class data.
[INFO ] 2020-10-27 20:21:56 InitialEquipmentData: Loaded 11 initial equipment data.
[INFO ] 2020-10-27 20:21:56 InitialShortcutData: Loaded 5 initial dlobal shortcuts data.
[INFO ] 2020-10-27 20:21:56 InitialShortcutData: Loaded 4 initial shortcuts data.
[INFO ] 2020-10-27 20:21:56 InitialShortcutData: Loaded 0 macros presets.
[INFO ] 2020-10-27 20:21:56 KarmaData: Loaded 85 karma modifiers.
[INFO ] 2020-10-27 20:21:56 HitConditionBonusData: Loaded Hit Condition bonuses.
[INFO ] 2020-10-27 20:21:57 PlayerTemplateData: Loaded 103 character templates.
[INFO ] 2020-10-27 20:21:57 PlayerTemplateData: Loaded 52530 level up gain records.
[INFO ] 2020-10-27 20:21:57 PlayerCreationPointData: Loaded 62 character creation points.
[INFO ] 2020-10-27 20:21:57 CharNameTable: Loaded 0 char names.
[INFO ] 2020-10-27 20:21:57 AdminData: Loaded 10 access levels.
[INFO ] 2020-10-27 20:21:57 AdminData: Loaded 444 access commands.
[INFO ] 2020-10-27 20:21:57 RaidBossPointsManager: Loaded 0 characters raid points.
[INFO ] 2020-10-27 20:21:57 PetDataTable: Loaded 52 Pets.
[INFO ] 2020-10-27 20:21:57 GameServer: -----------------------------------------------------=[ BBS ]
[INFO ] 2020-10-27 20:21:57 ForumsBBSManager: Loaded 4 forums.
[INFO ] 2020-10-27 20:21:57 GameServer: ---------------------------------------------------=[ Clans ]
[INFO ] 2020-10-27 20:21:57 ClanTable: Restored 0 clans from the database.
[INFO ] 2020-10-27 20:21:57 AuctionManager: Loaded 0 auction(s).
[INFO ] 2020-10-27 20:21:57 AuctionManager: Created auction for clan hall Id 22.
[INFO ] 2020-10-27 20:21:57 AuctionManager: Created auction for clan hall Id 23.
[INFO ] 2020-10-27 20:21:57 AuctionManager: Created auction for clan hall Id 24.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 25.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 26.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 27.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 28.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 29.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 30.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 31.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 32.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 33.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 36.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 37.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 38.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 39.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 40.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 41.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 42.
[INFO ] 2020-10-27 20:21:58 AuctionManager: Created auction for clan hall Id 43.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 44.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 45.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 46.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 47.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 48.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 49.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 50.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 51.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 52.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 53.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 54.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 55.
[INFO ] 2020-10-27 20:21:59 AuctionManager: Created auction for clan hall Id 56.
[INFO ] 2020-10-27 20:22:00 AuctionManager: Created auction for clan hall Id 57.
[INFO ] 2020-10-27 20:22:00 AuctionManager: Created auction for clan hall Id 58.
[INFO ] 2020-10-27 20:22:00 AuctionManager: Created auction for clan hall Id 59.
[INFO ] 2020-10-27 20:22:00 AuctionManager: Created auction for clan hall Id 60.
[INFO ] 2020-10-27 20:22:00 AuctionManager: Created auction for clan hall Id 61.
[INFO ] 2020-10-27 20:22:00 ClanHallManager: Loaded 0 clan halls.
[INFO ] 2020-10-27 20:22:00 ClanHallManager: Loaded 38 free clan halls.
[INFO ] 2020-10-27 20:22:00 ClanHallSiegeManager: Loaded 6 conquerable clan halls.
[INFO ] 2020-10-27 20:22:00 GameServer: -------------------------------------------------=[ Geodata ]
[INFO ] 2020-10-27 20:22:00 GeoData: Loaded 0 regions.
[INFO ] 2020-10-27 20:22:00 GameServer: ----------------------------------------------------=[ NPCs ]
[INFO ] 2020-10-27 20:22:00 SkillLearnData: Loaded 256 skill learn data.
[INFO ] 2020-10-27 20:22:00 NpcData$MinionData: Loaded 128 minions data.
[INFO ] 2020-10-27 20:22:04 NpcData: Loaded 10461 NPCs.
[INFO ] 2020-10-27 20:22:05 WalkingManager: Loaded 121 walking routes.
[INFO ] 2020-10-27 20:22:05 StaticObjectData: Loaded 51 static object templates.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Queen Ant (29001) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Core (29006) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Orfen (29014) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Baium (29020) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Valakas (29028) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Antharas (29068) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Beleth (29118) status is 0.
[INFO ] 2020-10-27 20:22:05 GrandBossManager: Loaded 7 grand boss instances.
[INFO ] 2020-10-27 20:22:05 DoorData: Loaded 1301 door templates for 22 regions.
[INFO ] 2020-10-27 20:22:07 ZoneManager: Loaded 28 zone classes and 2793 zones.
[INFO ] 2020-10-27 20:22:07 ZoneManager: Loaded 0 NPC spawn territoriers.
[INFO ] 2020-10-27 20:22:07 CastleManager: Loaded 9 castles.
[INFO ] 2020-10-27 20:22:07 NpcBufferTable: Loaded 1 buffers and 10 skills.
[INFO ] 2020-10-27 20:22:07 GrandBossManager: Initialized 12 grand boss zones.
[INFO ] 2020-10-27 20:22:07 GameServer: -----------------------------------------=[ Auction Manager ]
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Loaded 82 item(s) and registered 0 auction(s) for NPC ID 32320.
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Schedule next auction ID 1 on 17:00:00 30.10.20 for NPC ID 32320.
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Loaded 82 item(s) and registered 0 auction(s) for NPC ID 32321.
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Schedule next auction ID 2 on 17:00:00 02.11.20 for NPC ID 32321.
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Loaded 82 item(s) and registered 0 auction(s) for NPC ID 32322.
[INFO ] 2020-10-27 20:22:07 ItemAuctionInstance: Schedule next auction ID 3 on 17:00:00 28.10.20 for NPC ID 32322.
[INFO ] 2020-10-27 20:22:07 ItemAuctionManager: Loaded 3 auction manager instance(s).
[INFO ] 2020-10-27 20:22:07 GameServer: ------------------------------------------------=[ Olympiad ]
[INFO ] 2020-10-27 20:22:07 Olympiad: Failed to load data from database, trying to load from file.
[INFO ] 2020-10-27 20:22:07 Olympiad: Loading Olympiad System....
[INFO ] 2020-10-27 20:22:07 Olympiad: Currently in Olympiad Period
[INFO ] 2020-10-27 20:22:07 Olympiad: 6697 minutes until period ends
[INFO ] 2020-10-27 20:22:07 Olympiad: Next weekly change is in 10079 minutes
[INFO ] 2020-10-27 20:22:07 Olympiad: Loaded 0 Nobles
[INFO ] 2020-10-27 20:22:07 Olympiad: Competition Period Starts in 0 days, 0 hours and 0 mins.
[INFO ] 2020-10-27 20:22:07 Olympiad: Event starts/started : Tue Oct 27 18:00:07 UTC 2020
[INFO ] 2020-10-27 20:22:07 Hero: Loaded 0 Heroes.
[INFO ] 2020-10-27 20:22:07 Hero: Loaded 0 all time Heroes.
[INFO ] 2020-10-27 20:22:07 GameServer: ---------------------------------------------=[ Seven Signs ]
[INFO ] 2020-10-27 20:22:07 SevenSigns: Currently in the Competition (Quest Event) period.
[INFO ] 2020-10-27 20:22:07 SevenSigns: The Seal of Avarice remains unclaimed.
[INFO ] 2020-10-27 20:22:07 SevenSigns: The Seal of Gnosis remains unclaimed.
[INFO ] 2020-10-27 20:22:07 SevenSigns: The Seal of Strife remains unclaimed.
[INFO ] 2020-10-27 20:22:07 SevenSigns: The competition, if the current trend continues, will end in a tie this week.
[INFO ] 2020-10-27 20:22:07 SevenSigns: Next period change set to 2020-11-02T18:00:07.646+0000.
[INFO ] 2020-10-27 20:22:07 SevenSigns: Next period begins in 5 days, 21 hours and 37 mins.
[INFO ] 2020-10-27 20:22:07 GameServer: ---------------------------------------------------=[ Cache ]
[INFO ] 2020-10-27 20:22:07 HtmCache: Running lazy cache.
[INFO ] 2020-10-27 20:22:07 Olympiad: Olympiad Game Started
[INFO ] 2020-10-27 20:22:07 CrestTable: Loaded 0 crests.
[INFO ] 2020-10-27 20:22:07 OlympiadGameManager: Loaded 160 stadiums.
[INFO ] 2020-10-27 20:22:07 TeleportLocationTable: Loaded 957 teleport location templates.
[INFO ] 2020-10-27 20:22:07 UIData: Loaded 4 keys 5 categories.
[INFO ] 2020-10-27 20:22:07 AugmentationData: Loaded 33960 augmentations.
[INFO ] 2020-10-27 20:22:07 AugmentationData: Loaded 2754 accessory augmentations.
[INFO ] 2020-10-27 20:22:07 CursedWeaponsManager: Loaded 2 cursed weapon(s).
[INFO ] 2020-10-27 20:22:08 TransformData: Loaded 111 transform templates.
[INFO ] 2020-10-27 20:22:08 BotReportTable: Loaded 0 bot reports.
[INFO ] 2020-10-27 20:22:08 AirShipManager: Loaded 0 private airships.
[INFO ] 2020-10-27 20:22:08 GameServer: ------------------------------------------------=[ Handlers ]
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 1 Voiced Command Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 10 Action Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 6 Action Shift Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 447 Admin Command Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 48 Bypass Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 14 Chat Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 15 Community Board Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 31 Item Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 3 Punishment Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 17 User Command Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 37 Target Handler.
[INFO ] 2020-10-27 20:22:13 MasterHandler: Loaded 20 Telnet Handler.
[INFO ] 2020-10-27 20:22:13 GameServer: ------------------------------------------------------=[ AI ]
[INFO ] 2020-10-27 20:22:17 NpcBuffersData: Loaded 33 buffers data.
[INFO ] 2020-10-27 20:22:17 HandysBlockCheckerEvent: Loaded Handy's Block Checker event.
[INFO ] 2020-10-27 20:22:17 AILoader: Loaded 179 AI scripts.
[INFO ] 2020-10-27 20:22:17 GameServer: -----------------------------------------------=[ Instances ]
[INFO ] 2020-10-27 20:22:19 InstanceLoader: Loaded 30 instnaces.
[INFO ] 2020-10-27 20:22:19 GameServer: --------------------------------------------------=[ Gracia ]
[INFO ] 2020-10-27 20:22:20 GraciaLoader: Loaded 20 Gracia scripts.
[INFO ] 2020-10-27 20:22:20 GameServer: -----------------------------------------------=[ Hellbound ]
[INFO ] 2020-10-27 20:22:20 HellboundPointData: Loaded 47 trust point reward data.
[INFO ] 2020-10-27 20:22:20 HellboundSpawns: Loaded 598 Hellbound spawns.
[INFO ] 2020-10-27 20:22:20 HellboundEngine: Level 0.
[INFO ] 2020-10-27 20:22:20 HellboundEngine: Trust 0.
[INFO ] 2020-10-27 20:22:20 HellboundEngine: Status locked.
[INFO ] 2020-10-27 20:22:20 RaidBossSpawnManager: Spawning raid bosses...
[INFO ] 2020-10-27 20:22:21 RaidBossSpawnManager: Loaded 188 bosses.
[INFO ] 2020-10-27 20:22:21 RaidBossSpawnManager: Scheduled 0 boss instances.
[INFO ] 2020-10-27 20:22:21 HellboundLoader: Loaded 34 Hellbound scripts.
[INFO ] 2020-10-27 20:22:21 GameServer: --------------------------------------------------=[ Quests ]
[INFO ] 2020-10-27 20:22:26 Q00350_EnhanceYourWeapon: Loaded 54 soul crystal data.
[INFO ] 2020-10-27 20:22:26 Q00350_EnhanceYourWeapon: Loaded 240 npc leveling data.
[INFO ] 2020-10-27 20:22:26 QuestLoader: Loaded 501 quests.
[INFO ] 2020-10-27 20:22:26 AbstractScript: TerritoryWarSuperClass: Siege date: Sun Nov 08 22:00:00 UTC 2020
[INFO ] 2020-10-27 20:22:26 GameServer: -------------------------------------------------=[ Scripts ]
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Fortress of the Dead siege scheduled for 2020-11-10T12:00:00.305+0000.
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Beast Farm siege scheduled for 2020-11-10T12:00:00.280+0000.
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Rainbow Springs siege scheduled for 2020-11-10T12:00:00.256+0000.
[INFO ] 2020-10-27 20:22:27 BufferService: Disabled.
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Bandit Stronghold siege scheduled for 2020-11-10T12:00:00.231+0000.
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Devastated Castle siege scheduled for 2020-11-10T12:00:00.207+0000.
[INFO ] 2020-10-27 20:22:27 ClanHallSiegeEngine: Fortress of Resistance siege scheduled for 2020-11-10T12:00:00.671+0000.
[INFO ] 2020-10-27 20:22:35 SpawnTable: Loaded 3764 NPC spawns.
[INFO ] 2020-10-27 20:22:36 SpawnTable: Loaded 1190 NPC spawns from XML.
[INFO ] 2020-10-27 20:22:36 DayNightSpawnManager: Removed 0 day creatures.
[INFO ] 2020-10-27 20:22:36 DayNightSpawnManager: Spawned 553 night creatures.
[INFO ] 2020-10-27 20:22:36 DayNightSpawnManager: Spawning Hellman raidboss.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Loaded 20 Mysterious-Box spawns.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Loaded 716 Physical type monsters spawns.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Loaded 716 Magical monsters spawns.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Loaded 92 Church of duke monsters spawns.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Loaded 68 Emperor's Grave spawns.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Spawned Conquerors' Sepulcher Manager.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Spawned Emperors' Sepulcher Manager.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Spawned Great Sages' Sepulcher Manager.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Spawned Judges' Sepulcher Manager.
[INFO ] 2020-10-27 20:22:36 FourSepulchersManager: Beginning in attack time.
[INFO ] 2020-10-27 20:22:36 DimensionalRiftManager: Loaded 7 room types with 56 rooms.
[INFO ] 2020-10-27 20:22:36 DimensionalRiftManager: Loaded 462 Dimensional Rift spawns.
[INFO ] 2020-10-27 20:22:36 GameServer: ---------------------------------------------------=[ Siege ]
[INFO ] 2020-10-27 20:22:36 SiegeScheduleData: Loaded 2 siege schedulers.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Gludio: 2020-11-08T16:00:00.461+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Dion: 2020-11-08T16:00:00.589+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Giran: 2020-11-08T16:00:00.613+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Oren: 2020-11-08T16:00:00.721+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Aden: 2020-11-08T16:00:00.779+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Innadril: 2020-11-08T20:00:00.811+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Goddard: 2020-11-08T20:00:00.838+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Rune: 2020-11-08T20:00:00.863+0000.
[INFO ] 2020-10-27 20:22:36 Siege: Siege of Schuttgart: 2020-11-08T20:00:00.888+0000.
[INFO ] 2020-10-27 20:22:37 FortManager: Loaded 21 fortress.
[INFO ] 2020-10-27 20:22:37 CastleManorManager: Loaded 258 seeds.
[INFO ] 2020-10-27 20:22:37 CastleManorManager: Manor data loaded.
[INFO ] 2020-10-27 20:22:37 MercTicketManager: Loaded 0 mercenary tickets.
[INFO ] 2020-10-27 20:22:37 AutoSpawnHandler: Loaded 129 handlers.
[INFO ] 2020-10-27 20:22:37 SevenSignsFestival: The first Festival of Darkness cycle begins in 2 minute(s).
[INFO ] 2020-10-27 20:22:37 FaenorEventParser: Event Id Valentines Event has passed... Ignored.
[INFO ] 2020-10-27 20:22:37 FaenorScriptEngine: Loaded Valentines.xml successfully.
[INFO ] 2020-10-27 20:22:37 TaskManager: Loaded 12 tasks.
[INFO ] 2020-10-27 20:22:37 MailManager: Successfully loaded 0 messages.
[INFO ] 2020-10-27 20:22:37 PunishmentManager: Loaded 0 active and 0 expired punishments.
[INFO ] 2020-10-27 20:22:37 GameServer: Free Object Ids remaining 1879002067.
[INFO ] 2020-10-27 20:22:37 TvTManager: Engine is disabled.
[INFO ] 2020-10-27 20:22:39 GameServer: Started, free memory 1541 Mb of 2048 Mb
[INFO ] 2020-10-27 20:22:39 LoginServerThread: Connecting to login server on 127.0.0.1:9014
[INFO ] 2020-10-27 20:22:39 GameServer: Now listening on *:7777
[INFO ] 2020-10-27 20:22:39 GameServer: ----------------------------------------------------=[ UPnP ]
[INFO ] 2020-10-27 20:22:39 UPnPService: Looking for UPnP Gateway Devices...
[INFO ] 2020-10-27 20:22:39 LoginServerThread: Registered on login as Server 1: Bartz
[INFO ] 2020-10-27 20:22:48 UPnPService: No UPnP gateways has been found.
[INFO ] 2020-10-27 20:22:48 GameServer: Telnet server is currently disabled.
[INFO ] 2020-10-27 20:22:48 GameServer: Maximum numbers of connected players 500.
[INFO ] 2020-10-27 20:22:48 GameServer: Server Bartz loaded in 74 seconds.
```

## 结束

至此，天堂II服务器搭建完毕！启动游戏客户端尽情游玩吧！
