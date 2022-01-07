---
layout: post
title: 升级到 SUSE Linux Enterprise 12 SP5
category: 计算机
tags: [计算机, 软件]
---


----------
## 概述
 SUSE® Linux Enterprise(SLE)允许将现有系统升级到新版本。不需新安装。主目录和数据目录以及系统配置等现有数据将保持不变。您可以从本地CD或DVD驱动器或从中央网络安装源进行更新。

本文介绍如何通过 DVD、网络、自动化过程或 SUSE Manager 手动升级 SUSE Linux Enterprise 系统。 

## 支持的 SLE 12 SP5 升级路径
![upgrade-paths.png-34.3kB][1]
> 重要：不支持跨体系结构升级
不支持跨体系结构升级！例如从 32 位版本的 SUSE Linux Enterprise Server 升级到 64 位版本，或者从大字节序升级到小字节序。
具体地说，不支持从 SLE 11 on POWER（大字节序）升级到 SLE 12 SP2 on POWER（新增：小字节序）。
另外，由于 SUSE Linux Enterprise 12 只有 64 位版本，因此不支持从任何 32 位 SUSE Linux Enterprise 11 系统升级到 SUSE Linux Enterprise 12 和更高版本。
要跨体系结构升级，需执行全新安装。 

>注意：跳过服务包
最安全的升级路径是逐步连续地安装所有服务包。在某些情况下，支持在升级时跳过一到两个服务包，有关细节，请参见每个版本支持的升级路径和图 19.1 “支持的升级路径概述”。但建议不要跳过任何服务包。 

>注意：升级到主要版本
建议您通过执行全新安装来升级到新的主要版本。 

### 每个版本支持的升级路径
**从SUSE Linux Enterprise 10（任何服务包）升级**
不支持直接迁移到 SUSE Linux Enterprise 12。在此情况下，建议执行全新安装。
    
**从SUSE Linux Enterprise 11 GA/SP1/SP2/SP3升级**
不支持直接迁移到 SUSE Linux Enterprise 12。您的版本至少需为 SLE 11 SP4，才能升级到 SLE 12 SP5。
如果您不能执行全新安装，请先将已安装的 SLE 11 服务包升级到 SLE 11 SP4。《SUSE Linux Enterprise 11 部署指南》中说明了这些步骤：https://documentation.suse.com/sles-11/。 
    
**从SUSE Linux Enterprise 11 SP4升级**
只有通过脱机升级才能从 SLE 11 SP5 升级到 SLE 12 SP4。有关详细信息，请参见第 20 章 “脱机升级”。 
    
**从SUSE Linux Enterprise 12 GA/SP1/SP2升级到SP5**
不支持从 SLE 12 GA、SP1 或 SP2 直接升级到 SP5。请先升级到 SLE 12 SP3 或 SP4。 
    
**从SUSE Linux Enterprise 12 SP3/SP4升级到SP5**
支持从 SUSE Linux Enterprise 12 SP3 或 SP4 升级到 SP5。 
    
**从SUSE Linux Enterprise 12 LTSS GA/SP1升级到SP5**
不支持从 SUSE Linux Enterprise 12 LTSS GA 或 SP1 直接升级到 SP5。请先升级到 SLE 12 LTSS SP2。 
    
**从SUSE Linux Enterprise 12 LTSS SP2/SP3/SP4升级到SP5**
支持从 SUSE Linux Enterprise 12 LTSS SP2、SP3 或 SP4 升级到 SP5。 

## 联机和脱机升级
SUSE 支持两种不同的升级和迁移方法。有关术语的详细信息，请参见第 18.1 节 “术语”。这些方法是：

**联机**
从正在运行的系统中执行的所有升级均视为联机升级。示例：使用 Zypper 或 YaST 通过 SUSE Customer Center、Subscription Management Tool (SMT) 或 SUSE Manager 连接。
    在同一主要版本的服务包之间迁移时，建议使用下面两种方法：第 21.4 节 “使用联机迁移工具 (YaST) 升级”或第 21.5 节 “使用 Zypper 升级”。 
    
**脱机**
脱机方法通常会引导另一个操作系统，从中升级已安装的 SLE 版本。示例有：DVD、闪存盘、ISO 映像、AutoYaST、“纯 RPM”或 PXE 引导。 
只有通过脱机升级才能从 SUSE Linux Enterprise 11 SP5 升级到 SUSE Linux Enterprise 12 SP4。
支持使用任何脱机和联机方法从 SUSE Linux Enterprise 12 LTSS SP2 升级到 SP5。

>重要：SUSE Manager 客户端
如果您的计算机由 SUSE Manager 管理，则应在管理界面中启动升级过程。

## 准备系统
在开始升级过程之前，请确保您的系统已准备妥当。这些准备工作包括备份数据，查看发行说明，以及其他工作。 

### 确保当前系统是最新的
仅支持从最新的增补级别升级系统。运行 zypper patch 或启动 YaST 模块 Online-Update，以确保已安装最新的系统更新。 
### 阅读发行说明
在发行说明中，您可以找到有关自SUSE Linux Enterprise Server的上一个版本发行后所进行的更改的其他信息。检查发行说明以了解： 

- 您的硬件是否有特殊的注意事项；
- 所用的任何软件包是否已发生重大更改；
- 是否需要对您的安装实施特殊预防措施。 

发行说明还提供未能及时编入手册中的信息。它们还包含有关已知问题的说明。
如果您跳过了一个或多个服务包，另请检查所跳过服务包的发行说明。发行说明通常只包含两个连续的版本之间的更改。如果您只阅读最新的发行说明，可能会了解不到某些重大更改。
本地的 /usr/share/doc/release-notes 目录中或 [https://www.suse.com/releasenotes/][2] 网页上会提供发行说明。 

### 创建备份
在更新之前，请将现有配置文件复制到单独一个媒体（如磁带设备、可卸硬盘等）上，用以备份数据。这主要适用于储存在 /etc 中的文件以及 /var 和 /opt 中的一些目录和文件。最好将 /home（HOME 目录）中的用户数据也写入备份媒体。以 root 用户的身份备份此数据。仅 root 用户对所有本地文件具有读许可权限。
如果您已在 YaST 中选择更新现有系统作为安装模式，则可以选择在以后的某个时间执行（系统）备份。您可以选择包含所有已修改的文件以及 /etc/sysconfig 目录中的文件。但是，此备份尚不完整，因为缺少了上述所有其他重要目录。在 /var/adm/backup 目录中查找备份。 

### 列出已安装的包和储存库
已安装包列表通常很有用，例如，在全新安装某个新的主要 SLE 版本或恢复到旧版本时就是如此。
请注意，并非所有已安装的包或使用的储存库在 SUSE Linux Enterprise 的较新版本中都可用。有些包或储存库可能已被重命名，有些可能已被取代。还有可能提供的一些包只是用于旧版，而默认会使用另一个替代它的包。因此，可能需要手动编辑一些文件。您可使用任何文本编辑器进行编辑。
创建包含所有使用的储存库列表的文件 repositories.bak： 
```
root # zypper lr -e repositories.bak
```
另外，创建包含所有已安装包的列表的文件 installed-software.bak：
```
root # rpm -qa --queryformat '%{NAME}\n' > installed-software.bak
```
备份这两个文件。使用以下命令可恢复储存库和已安装的包： 
```
root # zypper ar repositories.bak
root # zypper install $(cat installed-software.bak)
```
>注意： 更新到新主要版本后，包数量也随之增加
升级到新主要版本的系统 (SLE X+1) 包含的包可能会比初始系统 (SLE X) 的多，也会比选择相同模式执行的 SLE X+1 全新安装所包含的包多。原因如下：
>
- 包经过拆分，以便用户能以更高的粒度选择包。例如，SLE 11 上的 37 个 texlive 包已拆分成 SLE 12 上的 422 个包。
- 将某个包拆分成其他包后，在升级过程中会安装所有新包，以与旧版本保持相同的功能。但是，SLE X+1 全新安装的新默认设置可能不会安装所有包。
- 出于兼容原因，可能会保留 SLE X 中的旧包。
- 包依赖项和模式范围可能已发生变化。 


  [1]: http://static.zybuluo.com/gamedebug/k5utcuoynjtajvb1lipwr6v8/upgrade-paths.png
  [2]: https://www.suse.com/releasenotes/