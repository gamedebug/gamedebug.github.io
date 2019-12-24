---
layout: post
title: 如何设置Linux密码复杂度？
category: 计算机
tags: [计算机, 软件]
---


----------
用户管理是Linux系统管理的重要任务之一。这涉及到很多方面，实现强密码策略就是其中之一。关于如何生成强密码，可以点击这里。它将限制对系统的未授权访问。

默认情况下，大家都知道Linux是安全的。但是，我们需要对此进行必要的调整，以使其更加安全。不安全的密码会导致安全漏洞。所以，要格外小心。如果您想查看生成的强密码的密码强度和得分，请点击这里。

在本文中，我们将向您展示如何在Linux上实现最佳安全策略。我们可以使用PAM(“可插拔的身份验证模块”)在大多数Linux系统上实施密码策略。

可以在以下位置找到该文件：

```
Redhat系列：/etc/pam.d/system-auth
Debian系列：/etc/pam.d/common-password
```

默认的密码老化细节可以在**/etc/login.defs**文件中找到。

为了更好地理解，我已经精简了这个文件：

```
# vi /etc/login.defs

PASS_MAX_DAYS   99999
PASS_MIN_DAYS   0
PASS_MIN_LEN    5
PASS_WARN_AGE   7
```

细节解读：

- PASS_MAX_DAYS：使用密码的最大天数。
- PASS_MIN_DAYS：更改密码之间允许的最小天数。
- PASS_MIN_LEN：可接受的最小密码长度。
- PASS_WARN_AGE：在密码到期之前给出警告的天数。

我们将向您展示如何在Linux中实现以下11种密码策略：

- 密码可使用的最大天数（Password Max days）
- 两次密码修改之间最小的间隔天数（Password Min days）
- 密码过期前给出警告的天数（Password warning days）
- 密码历史记录/拒绝重复使用密码（Password history or Deny Re-Used Passwords）
- 密码最小长度（Password minimum length）
- 最少的大写字母个数（Minimum upper case characters）
- 最少的小写字母个数（Minimum lower case characters）
- 最少的数字个数（Minimum digits in password）
- 最少的其他字符（符号）个数（Minimum other characters (Symbols)）
- 账号锁定 — 重试（Account lock – retries）
- 账号解锁时间（Account unlock time）

## 什么是密码可使用的最大天数?

此参数限制密码可以使用的最大天数。用户必须在到期前更改帐户密码。如果忘记更改，则不允许登录系统。他们需要与系统管理员合作来解决。它可以在**/etc/login.defs**文件中设置。这里我将设置为90天。

```
# vi /etc/login.defs

PASS_MAX_DAYS   90
```

## 什么是密码最小天数?

此参数限制密码更改后的最小天数。例如，如果该参数设置为15并且用户今天更改了密码。那他在15天内就不能再修改密码了。它可以在**/etc/login.defs**文件中设置。这里我将设置为15天。

```
# vi /etc/login.defs

PASS_MIN_DAYS   15
```
## 什么是密码警告天数?

此参数控制密码警告日期，并将在密码到期时警告用户。将定期向用户发出警告，直至警告日结束。这有助于用户在密码到期之前更改密码。否则，我们需要与系统管理员解锁密码。它可以在**/etc/login.defs**文件中设置。这里我将设置为10天。

```
# vi /etc/login.defs

PASS_WARN_AGE   10
```

注：以上参数只适用于新开帐户，不适用于现有帐户。

## 什么是密码历史或拒绝重复使用？

此参数保留密码历史记录的控制。保存使用过的密码的历史记录(不能重复使用的先前密码的数量)。当用户尝试设置新密码时，它将检查密码历史记录，并在用户使用相同的旧密码时发出警告。它可以在**/etc/pamc.d/system-auth**文件中设置。这里我将把它设为5作为密码历史。

```
# vi /etc/pam.d/system-auth

password  sufficient  pam_unix.so md5 shadow nullok try_first_pass use_authtok remember=5
```

## 什么是密码的最短长度？

此参数保持最小密码长度条件。当用户设置新密码时，它将检查该参数，如果用户试图设置的密码长度小于此值，它将发出警告。它可以在**/etc/pamc.d/system-auth**文件中设置。这里我将设置为12个字符的最小密码长度。

```
# vi /etc/pam.d/system-auth

password  requisite   pam_cracklib.so try_first_pass retry=3 minlen=12
```

try_first_pass retry=3：在密码设置交互界面，用户有 3 次机会重设密码。

## 设置最少大写字母数量?

此参数保留，密码中应添加多少个最小大写字符。这些是密码增强参数，用于增加密码强度。当用户设置新密码时，它将检查该参数，并警告用户密码中是否包含任何大写字母。它可以在**/etc/pamc.d/system-auth**文件中设置。这里我将它设置为1个字符的最小密码长度。

```
# vi /etc/pam.d/system-auth

password   requisite   pam_cracklib.so try_first_pass retry=3 minlen=12 ucredit=-1
```

## 设置最少小写字母数量?

此参数保留，密码中应添加多少小写字符。这些是密码增强参数，用于增加密码强度。当用户设置新密码时，它将检查该参数，并警告用户密码中是否包含任何小写字符。它可以在*/etc/pamc.d/system-auth文件中设置。这里我将它设为1个字符。

```
# vi /etc/pam.d/system-auth

password    requisite     pam_cracklib.so try_first_pass retry=3 minlen=12 lcredit=-1
```

## 设置最少数字数量?

此参数保留，密码中应添加多少位数字。这些是密码增强参数，用于增加密码强度。当用户设置新密码时，它将检查该参数，如果用户的密码中不包含任何数字，它将发出警告。它可以在**/etc/pamc.d/system-auth**文件中设置。这里我将它设为1个字符。

```
# vi /etc/pam.d/system-auth

password    requisite     pam_cracklib.so try_first_pass retry=3 minlen=12 dcredit=-1
```

## 设置最少其他字符（符号）数量?

此参数保留，密码中应添加多少特殊字符。这些是密码增强参数，用于增加密码强度。当用户设置新密码时，它将检查该参数，并警告用户是否在密码中包含任何符号。它可以在**/etc/pamc.d/system-auth**文件中设置。这里我将它设为1个字符。

```
# vi /etc/pam.d/system-auth

password    requisite     pam_cracklib.so try_first_pass retry=3 minlen=12 ocredit=-1
```

## 设置账号锁定？

此参数控制用户失败的尝试。它锁定用户帐户后，达到给定数量的登录失败的尝试。它可以在**/etc/pamc.d/system-auth**文件中设置。

```
# vi /etc/pam.d/system-auth

auth        required      pam_tally2.so onerr=fail audit silent deny=5
account required pam_tally2.so
```

## 设置账号锁定时间？

这个参数保持用户解锁时间。如果用户帐户在连续验证失败后被锁定。到达指定时间后解锁被锁定的用户账号。设置帐户应该保持锁定的时间(900秒= 15分钟)。它可以在**/etc/pamc.d/system-auth**文件中设置。

```
# vi /etc/pam.d/system-auth

auth        required      pam_tally2.so onerr=fail audit silent deny=5 unlock_time=900
account required pam_tally2.so
```

原文链接： https://www.2daygeek.com/how-to-set-password-complexity-policy-on-linux/