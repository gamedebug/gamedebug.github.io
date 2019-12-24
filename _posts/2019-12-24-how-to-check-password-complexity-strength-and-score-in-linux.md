---
layout: post
title: 在Linux中检查密码复杂度/强度和分数的不同方法
category: 计算机
tags: [计算机, 软件]
---


----------
我们都知道密码的重要性。使用复杂密码是最佳实践。

另外，我建议您为每个服务使用不同的密码，如电子邮件、ftp、ssh等，

最重要的是，你应该经常更改密码，以避免任何不必要的黑客攻击。默认情况下，RHEL和它的克隆使用cracklib模块来检查密码强度。

我们将讨论，如何使用cracklib模块来检查密码强度。

如果您想检查您创建的密码分数，那么使用pwscore包。

如果你想创建一个好的密码，基本上它应该至少有12-15个字符的长度。它应该以下列组合方式创建：字母(小写和大写)、数字和特殊字符。

在Linux中有许多可用的实用程序来检查密码复杂性。


----------
## 如何在Linux中安装cracklib模块?

cracklib模块在大多数发行版存储库中都是可用的，因此，使用发行版官方包管理器来安装它。

对于Fedora系统，使用DNF命令安装cracklib：

```
$ sudo dnf install cracklib
```

对于Debian/Ubuntu系统，使用apt-get命令或apt命令安装libcrack2：

```
$ sudo apt install libcrack2
```

对于基于Arch Linux的系统，使用Pacman命令安装cracklib：

```
$ sudo pacman -S cracklib
```

于RHEL/CentOS系统，使用YUM命令安装cracklib：

```
$ sudo yum install cracklib
```

对于SuSE系统，使用Zypper命令安装cracklib：

```
$ sudo zypper install cracklib
```

## 如何在Linux中使用cracklib模块检查密码复杂度?

为了让您更好地理解这个模块，我在本文中添加了一些示例。

如果你使用像人名、地名或常用词这样的词，你就会得到这样的信息“它是基于一个字典单词”：

```
$ echo "password" | cracklib-check
password: it is based on a dictionary word
```

Linux的默认密码长度是7个字符。如果你输入的密码少于7个字符，你就会收到“太短了”的信息：

```
$ echo "123" | cracklib-check 
123: it is WAY too short
```

如果你能像这样样提供良好的密码，你就会看到OK：

```
$ echo "ME$2w!@fgty6723" | cracklib-check
ME!@fgty6723: OK
```


----------
## 如何在Linux中安装pwscore ?

pwscore包在大多数发行版官方存储库中都是可用的，因此，使用发行版包管理器来安装它。

对于Fedora系统，使用DNF命令安装libpwquality：

```
$ sudo dnf install libpwquality
```

对于Debian/Ubuntu系统，使用apt-get命令或apt命令安装libpwquality：

```
$ sudo apt install libpwquality
```

对于基于Arch Linux的系统，使用Pacman命令安装libpwquality：

```
$ sudo pacman -S libpwquality
```

对于RHEL/CentOS系统，使用YUM命令安装libpwquality：

```
$ sudo yum install libpwquality
```

对于SuSE系统，使用Zypper命令安装libpwquality：

```
$ sudo zypper install libpwquality
```

## 如何在Linux中使用pwcore来为密码评分？

如果你得到任何像人名、地名或常用词这样的单词，你就会得到一条信息“它是基于一个字典单词”：

```
$ echo "password" | pwscore
Password quality check failed:
 The password fails the dictionary check - it is based on a dictionary word
```

Linux的默认密码长度是7个字符。如果你输入的密码少于7个字符，你就会收到“太短了”的信息：

```
$ echo "123" | pwscore
Password quality check failed:
 The password is shorter than 8 characters
```

如果您能像这样提供良好的密码，您将获得密码分数：

```
$ echo "ME!@fgty6723" | pwscore
90
```

原文链接：https://www.2daygeek.com/how-to-check-password-complexity-strength-and-score-in-linux/