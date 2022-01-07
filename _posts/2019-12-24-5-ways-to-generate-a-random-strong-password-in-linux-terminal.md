---
layout: post
title: Linux终端下生成随机复杂密码的五种姿势
category: 计算机
tags: [计算机, 软件]
---


----------
## 概述
大多数情况下，我们可以手动创建一些我们需要的密码，但如果你想为多个用户或服务器生成一个密码，将是解决方案。是的，在Linux中有许多实用程序可以满足这个需求。但是，我将在本文中介绍5个最好的密码生成器。这些工具将为您生成一个强随机密码。这些很容易使用，这就是为什么我更喜欢用它。默认情况下，它将生成一个强大的密码，如果你想生成一个超级强大的密码，然后使用可用的选项。它将帮助您生成一个超级强大的密码在以下组合。它应该至少有12-15个字符长度，包括字母(小写和大写)、数字和特殊字符。

工具列表如下：

- pwgen：pwgen程序生成的密码设计为便于人类记忆，同时尽可能安全；
- openssl：openssl程序是一个命令行工具，用于从shell中使用openssl的加密库的各种加密功能；
- gpg：OpenPGP加密和签名工具；
- mkpasswd：生成新密码，可选地将其应用于用户。；
- makepasswd：makepasswd使用/dev/urandom生成真正的随机密码，强调安全性而不是可读性；
- /dev/urandom文件：字符特殊文件/dev/random和/dev/urandom(从Linux 1.3.30开始)提供了一个到内核随机数生成器的接口；
- md5sum：md5sum是一个计算和验证128位MD5哈希值的计算机程序；
- sha256sum：sha256sum程序用于使用SHA-256 (SHA-2族，其摘要长度为256位)验证数据完整性；
- sha1pass：sha1pass创建一个SHA1密码散列。在命令行中没有salt值时，将生成一个随机的salt向量。


----------
## 如何使用pwgen命令在Linux中生成随机强密码?

pwgen程序生成的密码设计为便于人类记忆，同时尽可能安全。人类记忆的密码永远不会像完全随机的密码那样安全。

使用-s选项生成完全随机、难以记忆的密码。这些只能用于我们无法记住的机器密码。

对于Fedora系统，使用DNF命令安装pwgen：

```
$ sudo dnf install pwgen
```

对于Debian/Ubuntu系统，使用apt-get命令或apt命令安装pwgen：

```
$ sudo apt install pwgen
```

对于基于Arch Linux的系统，使用Pacman命令安装pwgen：

```
$ sudo pacman -S pwgen
```

对于RHEL/CentOS系统，使用YUM命令安装pwgen：

```
$ sudo yum install pwgen
```

对于SuSE系统，使用Zypper命令安装pwgen：

```
$ sudo zypper install pwgen
```
## 如何在Linux中使用pwgen命令?

这是一个简单而直接的方法。请使用下面的示例之一。默认情况下，它会生成一个人可记住的密码。

为此，只需在终端上运行pwgen命令。它能一次生成160个密码。这160个密码被打印成20行8列，如下：

```
$ pwgen
ameiK2oo aibi3Cha EPium0Ie aisoh1Ee Nidee9ae uNga0Bee uPh9ieM1 ahn1ooNg
oc5ooTea tai7eKid tae2yieS hiecaiR8 wohY2Ohk Uab2maed heC4aXoh Ob6Nieso
Shaeriu3 uy9Juk5u hoht7Doo Fah6yah3 faz9Jeew eKiek4ju as0Xuosh Eiwo4epo
oot8teeZ Ui1yoohi Aechae7A Ohdi2ael cae5Thoh Au1aeTei ais0aiC2 Cai2quin
Oox9ohz4 neev0Che ahza8AQu Ahz7eica meiBeeW0 Av3bo7ah quoiTu3f taeNg3ae
Aiko7Aiz SheiGh8E aesaeSh7 haet6Loo AeTel3oN Ath7zeer IeYah4ie UG3ootha
Ohch9Och Phuap6su iel5Xu7s diqui7Bu ieF2dier eeluHa1u Thagei0i Ceeth3oh
OCei1ahj zei2aiYo Jahgh1ia ooqu1Cej eez2aiPo Wahd5soo noo7Mei9 Hie5ashe
Uith4Or2 Xie3uh2b fuF9Eilu eiN2sha9 zae2YaSh oGh5ephi ohvao4Ae aixu6aeM
fo4Ierah iephei6A hae9eeGa eiBeiY3g Aic8Kee9 he8AheCh ohM4bid9 eemae3Zu
eesh2EiM cheiGa4j PooV2vii ahpeeg5E aezauX2c Xe7aethu Ahvaph7a Joh2heec
Ii5EeShi aij7Uo8e ooy2Ahth mieKe2ni eiQuu8fe giedaQu0 eiPhob3E oox1uo2U
eehia4Hu ga9Ahw0a ohxuZei7 eV4OoXio Kid2wu1n ku4Ahf5s uigh8uQu AhWoh0po
vo1Eeb2u Ahth7ve5 ieje4eiL ieci1Ach Meephie9 iephieY8 Eesoom7u eakai2Bo
uo8Ieche Zai3aev5 aGhahf0E Wowoo5th Oraeb0ah Gah3nah0 ieGhah0p aeCh0OhJ
ahQu2feZ ahQu0gah foik7Ush cei1Wai1 Aivi3ooY eephei5U MooZae3O quooRoh7
aequae5U pae6Ceiv eizahF1k ohmi7ETa ahyaeK1N Mohw2no8 ooc8Oone coo7Ieve
eePhei9h Weequ8eV Vie4iezu neeMiim4 ie6aiZoh Queegh2E shahwi3N Inichie8
Sid1aeji mohj4Ko7 lieDi0pe Zeemah6a thuevu2E phi4Ohsh paiKeix1 ooz1Ceph
ahV4yore ue2laePh fu1eThui qui7aePh Fahth1nu ohk9puLo aiBeez0b Neengai5
```

要生成安全的随机密码，请使用pwgen命令的-s选项：

```
$ pwgen -s
CU75lgZd 7HzzKgtA 2ktBJDpR F6XJVhBs UjAm3bNL zO7Dw7JJ pxn8fUvp Ka3lLilG
ywJX7iJl D9ajxb6N 78c1HOg2 g8vtWCra Jp6pBGBw oYuev9Vl gbA6gHV8 G6XQoVO5
uQN98IU4 50GgQfrX FrTsou2t YQorO4x6 UGer8Yi2 O7DB5nw1 1ax370UR 1xVRPkA1
RVaGDr2i Nt11ekUd 9Vm3D244 ck8Lnpd0 SjDt8uWn 5ERT4tf8 4EONFzyY Jc6T83jg
WZa6bKPW H4HMo1YU bsDDRik3 gBwV7LOW 9H1QRQ4x 3Ak7RcSe IJu2RBF9 e508xrLC
SzTrW191 AslxDa6E IkWWov2b iOb6EmTy qHt82OwG 5ZFO7B53 97zmjOPu A4KZuhYV
uQpoJR4D 0eKyOiUr Rz96smeO 3HTABu3N 6W0VmEls uPsp5zpw 8UD3VkMG YTct6Rd4
VKo0cVmq E07ZX7j9 kQSlvA69 Nm3fpv3i xWvF2xMu yEfcw8uA oQGVX3l9 grTzx7Xj
s4GVEYtM uJl5sYMe n3icRPiY ED3Mup4B k3M9KHI7 IkxqoSM0 dt2cxmMU yb2tUkut
2Q9wGZQx 8Rpo11s9 I13siOHu 7GV64Fjv 3VONzD8i SCDfVD3F oiPTx239 6BQakoiJ
XUEokiC4 ybL7VGmL el2RfvWk zKc7CLcE 3FqNBSyA NjDWrvZ5 KI3NSX4h VFyo6VPr
h4q3XeqZ FDYMoX6f uTU5ZzU3 6u4ob4Ep wiYPt05n CZga66qh upzH6Z9y RuVcqbe8
taQv11hq 1xsY67a8 EVo9GLXA FCaDLGb1 bZyh0YN8 0nTKo0Qy RRVUwn9t DuU8mwwv
x96LWpCb tFLz3fBG dNb4gCKf n6VYcOiH 1ep6QYFZ x8kaJtrY 56PDWuW6 1R0If4kV
2XK0NLQK 4XQqhycl Ip08cn6c Bnx9z2Bz 7gjGlON7 CJxLR1U4 mqMwir3j ovGXWu0z
MfDjk5m8 4KwM9SAN oz0fZ5eo 5m8iRtco oP5BpLh0 Z5kvwr1W f34O2O43 hXao1Sp8
tKoG5VNI f13fuYvm BQQn8MD3 bmFSf6Mf Z4Y0o17U jT4wO1DG cz2clBES Lr4B3qIY
ArKQRND6 8xnh4oIs nayiK2zG yWvQCV3v AFPlHSB8 zfx5bnaL t5lFbenk F2dIeBr4
C6RqDQMy gKt28c9O ZCi0tQKE 0Ekdjh3P ox2vWOMI 14XF4gwc nYA0L6tV rRN3lekn
lmwZNjz1 4ovmJAr7 shPl9o5f FFsuNwj0 F2eVkqGi 7gw277RZ nYE7gCLl JDn05S5N
```

如果希望生成一个长度为14个字符的强5个密码，请使用以下格式：

```
$ pwgen -s 14 5
7YxUwDyfxGVTYD em2NT6FceXjPfT u8jlrljbrclcTi IruIX3Xu0TFXRr X8M9cB6wKNot1e
```

如果你真的想产生一个超强随机20个密码，使用以下格式：

```
$ pwgen -cnys 14 20
mQ3E=vfGfZ,5[B #zmj{i5|ZS){jg Ht_8i7OqJ%N`~2 443fa5iJ\W-L?] ?Qs$o=vz2vgQBR
^'Ry0Az|J9p2+0 t2oA/n7U_'|QRx EsX*%_(4./QCRJ ACr-,8yF9&eM[* !Xz1C'bw?tv50o
8hfv-fK(VxwQGS q!qj?sD7Xmkb7^ N#Zp\_Y2kr%!)~ 4*pwYs{bq]Hh&Y |4u=-Q1!jS~8=;
]{$N#FPX1L2B{h I|01fcK.z?QTz" l~]JD_,W%5bp.E +i2=D3;BQ}p+$I n.a3,.D3VQ3~&i
```


----------
## 如何使用openssl命令在Linux中生成随机强密码?

openssl程序是一个命令行工具，用于从shell中使用openssl的加密库的各种加密功能。

使用以下格式运行openssl命令，生成一个包含14个字符的随机强密码：

```
$ openssl rand -base64 14
WjzyDqdkWf3e53tJw/c=
```

如果您希望使用openssl命令生成10个随机强密码，每个密码包含14个字符，那么可以使用下面的for循环：

```
$ for pw in {1..10}; do openssl rand -base64 14; done
6i0hgHDBi3ohZ9Mil8I=
gtn+y1bVFJFanpJqWaA=
rYu+wy+0nwLf5lk7TBA=
xrdNGykIzxaKDiLF2Bw=
cltejRkDPdFPC/zI0Pg=
G6aroK6d4xVVYFTrZGs=
jJEnFoOk1+UTSx/wJrY=
TFxVjBmLx9aivXB3yxE=
oQtOLPwTuO8df7dIv9I=
ktpBpCSQFOD+5kIIe7Y=
```


----------
## 如何在Linux中使用gpg命令生成随机强密码?

gpg是GNU隐私保护(GnuPG)的OpenPGP部分。它是一个使用OpenPGP标准提供数字加密和签名服务的工具。gpg提供完整的密钥管理和所有您期望从完整的OpenPGP实现中获得的功能。

使用以下格式运行gpg命令，生成一个包含14个字符的随机强密码：

```
$ gpg --gen-random --armor 1 14
or
$ gpg2 --gen-random --armor 1 14
jq1mtY4gBa6gIuJrggM=
```

如果您希望使用gpg命令生成10个随机强密码，并包含14个字符，那么可以使用下面的for循环：

```
$ for pw in {1..10}; do gpg --gen-random --armor 1 14; done
or
$ for pw in {1..10}; do gpg2 --gen-random --armor 1 14; done
F5ZzLSUMet2kefG6Ssc=
8hh7BFNs8Qu0cnrvHrY=
B+PEt28CosR5xO05/sQ=
m21bfx6UG1cBDzVGKcE=
wALosRXnBgmOC6+++xU=
TGpjT5xRxo/zFq/lNeg=
ggsKxVgpB/3aSOY15W4=
iUlezWxL626CPc9omTI=
pYb7xQwI1NTlM2rxaCg=
eJjhtA6oHhBrUpLY4fM=
```


----------
## 如何使用mkpasswd命令在Linux中生成随机强密码?

mkpasswd生成密码，可以自动将其应用于用户。如果没有参数，mkpasswd将返回一个新密码。它是expect包的一部分，因此必须安装expect包才能使用mkpasswd命令。

对于Fedora系统，使用DNF命令安装mkpasswd：

```
$ sudo dnf install expect
```

对于Debian/Ubuntu系统，使用apt-get命令或apt命令安装mkpasswd：

```
$ sudo apt install expect
```

对于基于Arch Linux的系统，使用Pacman命令安装mkpasswd：

```
$ sudo pacman -S expect
```

对于RHEL/CentOS系统，使用YUM命令安装mkpasswd：

```
$ sudo yum install expect
```

对于SuSE系统，使用Zypper命令安装mkpasswd：

```
$ sudo zypper install expect
```

在终端中运行mkpasswd命令以生成随机密码：

```
$ mkpasswd
37_slQepD
```

使用以下格式运行mkpasswd命令，生成一个包含14个字符的随机强密码：

```
$ mkpasswd -l 14
W1qP1uv=lhghgh
```

使用以下格式运行mkpasswd命令，生成一个包含14个字符的随机强密码。它是字母(大小写)、数字和特殊字符的组合：

```
$ mkpasswd -l 14 -d 3 -C 3 -s 3
3aad!bMWG49"t,
```

如果您希望使用mkpasswd命令生成包含14个字符的10个随机强密码(它是字母(大小写)、数字和特殊字符的组合)，那么可以使用下面的for循环：

```
$ for pw in {1..10}; do mkpasswd -l 14 -d 3 -C 3 -s 3; done
zmSwP[q9;P1r6[
E42zcvzM"i3%B\
8}1#Pbh5FjrO@m
0X:zB(mmU22?nj
0sqqL44M}ko(O^
43tQ(.6jG;ceRq
-jB6cp3x1GZ$e=
$of?Rj9kb2N(1J
9HCf,nn#gjO79^
Tu9m56+Ev_Yso(
```


----------
## 如何使用makepasswd命令在Linux中生成随机强密码?

makepasswd使用/dev/urandom生成真正的随机密码，强调安全性而不是可读性。它还可以对命令行上给出的明文密码进行加密。

在终端中运行makepasswd命令以生成随机密码：

```
$ makepasswd
HdCJafVaN
```

使用以下格式运行makepasswd命令，生成一个包含14个字符的随机强密码：

```
$ makepasswd --chars 14
HxJDv5quavrqmU
```

使用以下格式运行makepasswd命令，生成10个随机强密码，包含14个字符：

```
$ makepasswd --chars 14 --count 10
TqmKVWnRGeoVNr
mPV2P98hLRUsai
MhMXPwyzYi2RLo
dxMGgLmoFpYivi
8p0G7JvJjd6qUP
7SmX95MiJcQauV
KWzrh5npAjvNmL
oHPKdq1uA9tU85
V1su9GjU2oIGiQ
M2TMCEoahzLNYC
```


----------
## 如何在Linux中使用多个命令生成随机强密码?

如果您正在寻找其他选项，那么您可以使用以下实用工具在Linux中生成随机密码。

使用md5sum：md5sum是一个计算和验证128位MD5哈希值的计算机程序。

```
$ date | md5sum
9baf96fb6e8cbd99601d97a5c3acc2c4  -
```

使用/dev/urandom：字符特殊文件/dev/random和/dev/urandom(从Linux 1.3.30开始)提供了一个到内核随机数生成器的接口。文件/dev/random有主设备号1和副设备号8。文件/dev/urandom有主设备号1和副设备号9。

```
$ cat /dev/urandom | tr -dc 'a-zA-Z0-9' | head -c 14
15LQB9J84Btnzz
```

使用sha256sum：sha256sum程序用于使用SHA-256 (SHA-2族，摘要长度为256位)验证数据完整性。

```
$ date | sha256sum
a114ae5c458ae0d366e1b673d558d921bb937e568d9329b525cf32290478826a  -
```

使用sha1pass：sha1pass创建一个SHA1密码散列。在命令行上没有salt值时，将生成一个随机的salt向量。

```
$ sha1pass
$4$9+JvykOv$e7U0jMJL2yBOL+RVa2Eke8SETEo$
```

原文链接：https://www.2daygeek.com/5-ways-to-generate-a-random-strong-password-in-linux-terminal/