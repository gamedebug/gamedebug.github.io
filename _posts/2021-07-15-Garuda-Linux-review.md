---
layout: post
title: Garuda Linux -- 来自印度的发行版
category: 计算机
tags: [计算机, 软件]
---


----------
许多基于Arch的Linux发行版最近如雨后春笋般涌现。我对Manjaro和Arch Linux非常满意，所以在遇到Garuda Linux之前我一点也不在乎。但这个漂亮的Linux发行版还真有点看头。

Garuda Linux对Linux世界来说是相当新的，其目标是提供最佳性能，提供所有现代和有吸引力的功能。尽管您可以选择各种桌面环境，但很明显，他们的旗舰桌面是高度定制的KDE Plasma，具有深色霓虹色外观。赛博朋克，有人玩过这个游戏吗？哈哈哈哈！

它的旗舰版本（Ultimate Edition）针对游戏进行了优化，最近推出的Dragonized(Dr460nized)版本在美学上是“奢华的”。

Arch Linux安装对于许多Linux用户来说可能是一个里程碑，更不用说在Garuda Linux 提供的Calamares安装程序便利性背后优化您的系统了。

由于我喜欢更传统的桌面，我开始测试Garuda Linux的MATE版本，但我最终还是选择在漂亮的Dragonized版本下截图。

现在，让我谈谈我对Garuda Linux的体验。 Garuda Linux提供了许多桌面环境选项：

- KDE Plasma
- Xfce
- GNOME
- Cinnamon
- LXQt
- MATE
- Deepin
- UKUI
- Wayfire
- BSPWM
- i3WM

我选择了MATE和KDE Plasma进行测试。我将KDE截图包括在内，因为在我看来，这是所有截图中最漂亮的截图。

## 使用Calamares安装程序轻松安装

虽然我鼓励每个人以“传统”方式安装Arch Linux作为他们学习过程的一部分，但我可以理解这项任务对某些用户来说既耗时又令人生畏。与最流行的基于Arch的发行版Manjaro一样，Garuda Linux 只需点击几下即可启动并运行，这要归功于Calamares安装程序。

![garuda-installer.png-88.5kB][1]

## B-tree文件系统(BTRFS)

“更好的文件系统（Better FS）”正如我更喜欢发音的那样，默认情况下可能不会用于大多数Linux发行版。它已有十多年的历史，但被认为是稳定的。引入它是为了解决Linux文件系统的许多缺乏功能，如快照和校验和。

Garuda Linux以BTRFS作为默认文件系统。

## 可从GRUB访问的自动快照

Garuda Linux是一个前沿的滚动版本，测试较少的软件可能会在升级后破坏您的系统。Timeshift会在每次更新前自动备份系统，您可以直接从GRUB访问系统的最新5个快照。这功能很酷，对不对？

![garuda-snapshots.png-6.6kB][2]

## Pamac包管理器

继承自Manjaro，图形包管理器Pamac是命令行包管理器pacman的绝佳替代品。默认情况下启用对AUR的支持，您还可以选择启用Snap和Flatpak支持。关于AUR、Snap、Flatpak这里就不做赘述了。

![Garuda-pamac.png-57.3kB][3]

## Garuda助手（Garuda Assistant）可轻松进行管理设置

Garuda助手是一个图形界面，它使操作系统的管理任务成为一个简单的点击过程。在下面的示例中，您可以看到启用systemd服务十分容易。

![Garuda-Assistant.png-46.4kB][4]

您还可以使用它来更新系统、清除日志、删除数据库锁定、刷新镜像列表和编辑存储库。对于那些不想进入终端的人来说，这是一个方便的工具。

## Garuda设置管理器（Garuda settings manager）

Manjaro Linux用户一旦打开Garuda设置管理器就会有似曾相识的感觉，因为它与Manjaro设置管理器相同。尽管Arch wiki为每个问题提供了解决方案，但通过Garuda设置管理器选择不同内核或专有 Nvidia 驱动程序的便利性是首屈一指的。

![garuda-settings-manager.png-33.2kB][5]

## Garuda游戏（Garuda Gamer） -- 以图形界面展示和管理游戏包

Arch Linux是一个让我望而却步的发行版，在Linux上玩游戏时，我对Linux新用户的建议是Pop OS。 而Garuda Gamer GUI的包选择可能会让很多Linux游戏玩家在打开它时笑出声来。

![Garuda-gamer.png-64.1kB][6]

## 结论

Garuda Linux是代表开发人员真正热情的Linux发行版之一，这可以从工具、功能和配置的惊人选择中看出。

Garuda Linux专注于为大多数常见任务提供GUI应用程序，这使得Garuda Linux成为想要尝试 Arch Linux但不习惯一直使用终端的用户的理想选择。

在Arch Linux存储库之上只有一个额外的存储库，它非常接近于纯 Arch。我不得不承认，我对Garuda Linux感到惊讶，并且肯定会延长我的测试时间以揭开每一个隐藏的地方。

你体验过Garuda Linux吗？你对它的体验如何？如果没有，在阅读了这篇 Garuda Linux 评论后，您是否愿意尝试一下？



  [1]: http://static.zybuluo.com/gamedebug/pou50st64y88grhanqow52kc/garuda-installer.png
  [2]: http://static.zybuluo.com/gamedebug/jrz6zhtpm84ty06jmi4im6ah/garuda-snapshots.png
  [3]: http://static.zybuluo.com/gamedebug/fobnszclfhdb82qyvn0fbkv6/Garuda-pamac.png
  [4]: http://static.zybuluo.com/gamedebug/u87tc76ymzr7npm3q1lpvuhm/Garuda-Assistant.png
  [5]: http://static.zybuluo.com/gamedebug/8y27ort9dri01gr8c9p42vy1/garuda-settings-manager.png
  [6]: http://static.zybuluo.com/gamedebug/jyxf9uj18bch99xioguom6lc/Garuda-gamer.png