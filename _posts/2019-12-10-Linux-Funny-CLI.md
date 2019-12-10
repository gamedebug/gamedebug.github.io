---
layout: post
title: 推荐几个Linux命令行下好玩的东东
category: 计算机
tags: [计算机, 软件]
---


----------
## 前言

相信大多数搞计算机的人对Linux都不会很陌生，不论你是软件开发测试人员，或者是系统管理员，又或者是运维工程师什么的……而对于Linux命令行（CLI: Command Line Interface）这种用户接口更应该感到亲切和熟悉。相较于图形用户接口（GUI：Graphical User Interface）而言，命令行有着方便快捷、指令清晰、低系统资源开销等优势，但在外行人看来，简直就是天书，其实即便是专业人士，常年面对这个简单枯燥的纯文本界面操作计算机，久而久之也会产生一定的审美疲劳。那么有没有什么办法缓解一下呢？答案当然是肯定的，程序员从来都是一个不乏自娱自乐精神的群体，于是他们中有这么一些富有余力的人想出来各种各样的办法，在命令行里苦中作乐，玩得也是不亦乐乎……下面就来看看他们自娱自乐的成果，也希望能帮助到更多还没从命令行的痛苦中解脱出来的工程师们在工作之余找到一点点快乐。


----------
## sl

这是一个可以在命令行打印出一台能开动的蒸汽机车车头的小软件，直接通过命令sl即可调用，sl一方面是蒸汽机车头的缩写，更有趣的是，不少人应该已经发现它很像我们最常用的一个命令行工具--ls，相信很多人都有过在键盘上指尖飞舞这种耍帅经历，特别是在有漂亮小姐姐围观我们操作电脑的时候，如此快的手速，偶尔翻车的应该也不再少数，ls敲成了sl这种情况肯定时有发生，如果我们安装了sl这个小玩意，当我们输错ls命令的时候，命令行再也不是给我们返回一行冷冰冰的n“Command not found”，而是会蹦出一台从右向左疾驰的蒸汽机车头，有没有觉得乐趣十足呢？

通过man，可以查看这个小玩意的手册：

```
# man sl

SL(1)                                                                      General Commands Manual                                                                      SL(1)

NAME
       sl - cure your bad habit of mistyping

SYNOPSIS
       sl [ -alFc ]

DESCRIPTION
       sl is a highly advanced animation program for curing your bad habit of mistyping.

       -a     An accident is occurring. People cry for help.

       -l     Little version.

       -F     It flies like the galaxy express 999.

       -c     C51 appears instead of D51.

SEE ALSO
       ls(1)

BUGS
       It sometimes lists directory contents.

AUTHOR
       Toyoda Masashi (mtoyoda@acm.org)

                                                                                March 31, 2014                                                                          SL(1)
 Manual page sl(1) line 1/29 (END) (press h for help or q to quit)
```

默认运行是这个样子：

```
# sl
```
![WX20191210-144018@2x.png-1330.4kB][1]

还可以根据手册中提供的命令参数来尝试不同的效果，乐趣十足，更好玩的是BUGS说明里写到，有时会列出目录内容。。。。哈哈哈哈哈。看这个作者名字，应该是个日本人。总之谢谢他吧。


----------
## cowsay

字面意思很清楚，奶牛说。这个命令能让命令行yi以一头奶牛（不限于奶牛）的字符卡通形象说话的方式显示任何我们想要显示的内容，先来读一读命令的手册：

```
# man cowsay

cowsay(1)                                                                  General Commands Manual                                                                  cowsay(1)

NAME
       cowsay/cowthink - configurable speaking/thinking cow (and a bit more)

SYNOPSIS
       cowsay [-e eye_string] [-f cowfile] [-h] [-l] [-n] [-T tongue_string] [-W column] [-bdgpstwy]

DESCRIPTION
       Cowsay  generates  an ASCII picture of a cow saying something provided by the user.  If run with no arguments, it accepts standard input, word-wraps the message given
       at about 40 columns, and prints the cow saying the given message on standard output.

       To aid in the use of arbitrary messages with arbitrary whitespace, use the -n option.  If it is specified, the given message will not be word-wrapped.  This is possi-
       bly useful if you want to make the cow think or speak in figlet(6).  If -n is specified, there must not be any command-line arguments left after all the switches have
       been processed.

       The -W specifies roughly (where the message should be wrapped.  The default is equivalent to -W 40 i.e. wrap words at or before the 40th column.

       If any command-line arguments are left over after all switches have been processed, they become the cow's message.  The program will not accept standard input  for  a
       message in this case.

       There  are  several provided modes which change the appearance of the cow depending on its particular emotional/physical state.  The -b option initiates Borg mode; -d
       causes the cow to appear dead; -g invokes greedy mode; -p causes a state of paranoia to come over the cow; -s makes the cow appear  thoroughly  stoned;  -t  yields  a
       tired cow; -w is somewhat the opposite of -t, and initiates wired mode; -y brings on the cow's youthful appearance.

       The  user may specify the -e option to select the appearance of the cow's eyes, in which case the first two characters of the argument string eye_string will be used.
       The default eyes are 'oo'.  The tongue is similarly configurable through -T and tongue_string; it must be two characters and does not appear by default.  However,  it
       does appear in the 'dead' and 'stoned' modes.  Any configuration done by -e and -T will be lost if one of the provided modes is used.

       The  -f  option  specifies a particular cow picture file (``cowfile'') to use.  If the cowfile spec contains '/' then it will be interpreted as a path relative to the
       current directory.  Otherwise, cowsay will search the path specified in the COWPATH environment variable.  To list all cowfiles on the current COWPATH, invoke  cowsay
       with the -l switch.

       If the program is invoked as cowthink then the cow will think its message instead of saying it.

COWFILE FORMAT
       A  cowfile  is  made  up  of  a simple block of perl(1) code, which assigns a picture of a cow to the variable $the_cow.  Should you wish to customize the eyes or the
       tongue of the cow, then the variables $eyes and $tongue may be used.  The trail leading up to the cow's message  balloon  is  composed  of  the  character(s)  in  the
       $thoughts  variable.   Any backslashes must be reduplicated to prevent interpolation.  The name of a cowfile should end with .cow, otherwise it is assumed not to be a
       cowfile.  Also, at-signs (``@'') must be backslashed because that is what Perl 5 expects.
       
COMPATIBILITY WITH OLDER VERSIONS
       What older versions? :-)

       Version 3.x is fully backward-compatible with 2.x versions.  If you're still using a 1.x version, consider upgrading.  And tell me where you got the  older  versions,
       since I didn't exactly put them up for world-wide access.

       Oh, just so you know, this manual page documents version 3.02 of cowsay.

ENVIRONMENT
       The  COWPATH environment variable, if present, will be used to search for cowfiles.  It contains a colon-separated list of directories, much like PATH or MANPATH.  It
       should always contain the /usr/local/share/cows directory, or at least a directory with a file called default.cow in it.

FILES
       /usr/share/cows holds a sample set of cowfiles.  If your COWPATH is not explicitly set, it automatically contains this directory.

BUGS
       If there are any, please notify the author at the address below.

AUTHOR
       Tony Monroe (tony@nog.net), with suggestions from Shannon Appel (appel@CSUA.Berkeley.EDU) and contributions from Anthony Polito (aspolito@CSUA.Berkeley.EDU).

SEE ALSO
       perl(1), wall(1), nwrite(1), figlet(6)

                                                                         $Date: 1999/11/04 19:50:40 $                                                               cowsay(1)
 Manual page cowsay(1) line 22/66 (END) (press h for help or q to quit)
```

手册内容比较多，也可以看看简单的用例，首先是让奶牛说出我们想要说的话：

```
# cowsay Hello world!
 ______________
< Hello world! >
 --------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

还可以让它说中文：

```
# cowsay 我爱我的祖国
 ____________________
< 我爱我的祖国 >
 --------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

除了可以让奶牛说出我们想要的话之外，它还支持将任意Linux的标准输出以奶牛说的方式显示出来，例如：

```
# cowsay `ls`
 _________________________________________
/ .Xauthority .bash_history .cache        \
| .config .dbus .docker .gnupg .gtkrc-2.0 |
| .kde4 .local .mozilla .nv .ssh          |
| .subversion .viminfo .wget-hsts .wine   |
| .xauth1xRV48 .zenmap 123.txt Desktop    |
| Documents Downloads Music Pictures      |
| Public Templates Videos bin inst-sys    |
\ superbench.log tcping                   /
 -----------------------------------------
        \   ^__^
         \  (oo)\_______
            (__)\       )\/\
                ||----w |
                ||     ||
```

大家还可以自行结合其他命令输出来玩耍，很有意思。

另外，刚才说不限于奶牛说，我们还可以通过命令内建的一些参数，改变这个说话的卡通形象，比如小恶魔说：

```
# cowsay -f daemon Hello world!
 ______________
< Hello world! >
 --------------
   \         ,        ,
    \       /(        )`
     \      \ \___   / |
            /- _  `-/  '
           (/\/ \ \   /\
           / /   | `    \
           O O   ) /    |
           `-^--'`<     '
          (_.)  _  )   /
           `.___/`    /
             `-----' /
<----.     __ / __   \
<----|====O)))==) \) /====
<----'    `--' `.__,' \
             |        |
              \       /
        ______( (_  / \______
      ,'  ,-----'   |        \
      `--{__________)        \/
```
又比如，大象说：

```
# cowsay -f elephant Hello world!
 ______________
< Hello world! >
 --------------
 \     /\  ___  /\
  \   // \/   \/ \\
     ((    O O    ))
      \\ /     \ //
       \/  | |  \/
        |  | |  |
        |  | |  |
        |   o   |
        | |   | |
        |m|   |m|
```

那到底有多少可以供我们调用的字符卡通形象呢？可以通过查看cowsay这个软件包里的文件来确认（这里以openSUSE为例）：

```
# rpm -ql cowsay | grep share/cows
/usr/share/cows
/usr/share/cows/beavis.zen.cow
/usr/share/cows/bong.cow
/usr/share/cows/bud-frogs.cow
/usr/share/cows/bunny.cow
/usr/share/cows/chameleon.cow
/usr/share/cows/cheese.cow
/usr/share/cows/cower.cow
/usr/share/cows/daemon.cow
/usr/share/cows/default.cow
/usr/share/cows/dragon-and-cow.cow
/usr/share/cows/dragon.cow
/usr/share/cows/elephant-in-snake.cow
/usr/share/cows/elephant.cow
/usr/share/cows/eyes.cow
/usr/share/cows/flaming-sheep.cow
/usr/share/cows/ghostbusters.cow
/usr/share/cows/head-in.cow
/usr/share/cows/hellokitty.cow
/usr/share/cows/kiss.cow
/usr/share/cows/kitty.cow
/usr/share/cows/koala.cow
/usr/share/cows/kosh.cow
/usr/share/cows/luke-koala.cow
/usr/share/cows/meow.cow
/usr/share/cows/milk.cow
/usr/share/cows/moofasa.cow
/usr/share/cows/moose.cow
/usr/share/cows/mutilated.cow
/usr/share/cows/ren.cow
/usr/share/cows/satanic.cow
/usr/share/cows/sheep.cow
/usr/share/cows/skeleton.cow
/usr/share/cows/small.cow
/usr/share/cows/sodomized.cow
/usr/share/cows/stegosaurus.cow
/usr/share/cows/stimpy.cow
/usr/share/cows/supermilker.cow
/usr/share/cows/surgery.cow
/usr/share/cows/telebears.cow
/usr/share/cows/three-eyes.cow
/usr/share/cows/turkey.cow
/usr/share/cows/turtle.cow
/usr/share/cows/tux.cow
/usr/share/cows/udder.cow
/usr/share/cows/vader-koala.cow
/usr/share/cows/vader.cow
/usr/share/cows/www.cow
```

这个清单里列出的所有以.cow为后缀的文件就是当前这个版本所支持的字符卡通形象，我们可以在输入cowsay命令后加上-f xxx 来改变卡通形象，这里的xxx参数是这些*.cow文件的文件名，可以是完整的文件名也可以是不包含.cow的部分。怎么样，好玩吧，有没有觉得Linux的命令行似乎被赋予了各种生命力？哈哈哈哈哈～


----------
## cmatrix

cmatrix也是一个很酷的黑客帝国命令行特效，安装之后只需要在终端内输入cmatrix即可激活这个特效，先来看看效果：

```
# cmatrix
```
![WX20191210-153503@2x.png-4449.7kB][2]

按q键即可退出特效回到原先的提示符下。

跟所有的Linux命令一样，大家也可以通过手册了解更多这个工具的用法：

```
# man cmatrix

CMatrix(1)                                                                 General Commands Manual                                                                 CMatrix(1)

NAME
       CMatrix

SYNOPSIS
       cmatrix [-abBflohnsVx] [-u update] [-C color]

DESCRIPTION
       Shows a scrolling 'Matrix' like screen in Linux

   OPTIONS
       -a     Asynchronous scroll

       -b     Bold characters on

       -B     All bold characters (overrides -b)

       -f     Force the linux $TERM type to be on

       -l     Linux mode (sets "matrix.fnt" font in console)

       -o     Use old-style scrolling

       -h, -? Print usage and exit

       -n     No bold characters (overrides -b and -B)

       -s     "Screensaver" mode, exits on first keystroke

       -x     X window mode, use if your xterm is using mtx.pcf

       -V     Print version information and exit

       -u delay
              Screen update delay 0 - 9, default 4

       -C color
              Use this color for matrix (default green).  Valid colors are green, red, blue, white, yellow, cyan, magenta and black.
              
   KEYSTROKES
       The following keystrokes are available during execution (unavailable in -s mode)

       a      Toggle asynchronous scroll

       b      Random bold characters

       B      All bold characters

       n      Turn off bold characters

       0-9    Adjust update speed

       ! @ # $ % ^ & )
              Change the color of the matrix to the corresponding color: ! - red, @ - green, # - yellow, $ - blue, % - magenta, ^ - cyan, & - white, ) - black.

       q      Quit the program

BUGS
       This program is very CPU intensive.  Don't be surprised if it eats up over 40% of your CPU at times.

HOMEPAGE
       The CMatrix homepage is currently at http://www.asty.org/cmatrix.

AUTHORS
       Chris Allegretta (chrisa@asty.org), with a lot of help from many other people. See README file for details.

                                                                                Mon May 3 1999                                                                     CMatrix(1)
 Manual page cmatrix(1) line 24/68 (END) (press h for help or q to quit)
```

大家也可以自行阅读手册，研究更多玩法。


----------
## figlet

figlet能将我们输入的内容转换为ASCII字符效果，跟cowsay类似，除了可以处理用户自己输入的字符外，它也能处理Linux命令的输出，但是，它处理不了汉字，来看看效果。

处理用户输入：

```
# figlet Hello world!
 _   _      _ _                            _     _ _
| | | | ___| | | ___   __      _____  _ __| | __| | |
| |_| |/ _ \ | |/ _ \  \ \ /\ / / _ \| '__| |/ _` | |
|  _  |  __/ | | (_) |  \ V  V / (_) | |  | | (_| |_|
|_| |_|\___|_|_|\___/    \_/\_/ \___/|_|  |_|\__,_(_)
```

处理其他Linux命令输出：

```
# figlet `ls /`
   _                      _                               _           _
  | |__   _____      ____| |    ___ _ __   __ _ _ __  ___| |__   ___ | |_ ___
  | '_ \ / __\ \ /\ / / _` |   / __| '_ \ / _` | '_ \/ __| '_ \ / _ \| __/ __|
 _| | | | (__ \ V  V / (_| |  _\__ \ | | | (_| | |_) \__ \ | | | (_) | |_\__ \
(_)_| |_|\___| \_/\_/ \__,_| (_)___/_| |_|\__,_| .__/|___/_| |_|\___/ \__|___/
                                               |_|
 _     _         _                 _         _                   _
| |__ (_)_ __   | |__   ___   ___ | |_    __| | _____   __   ___| |_ ___
| '_ \| | '_ \  | '_ \ / _ \ / _ \| __|  / _` |/ _ \ \ / /  / _ \ __/ __|
| |_) | | | | | | |_) | (_) | (_) | |_  | (_| |  __/\ V /  |  __/ || (__
|_.__/|_|_| |_| |_.__/ \___/ \___/ \__|  \__,_|\___| \_/    \___|\__\___|

 _                            _ _ _       _ _ _      __   _  _
| |__   ___  _ __ ___   ___  | (_) |__   | (_) |__  / /_ | || |
| '_ \ / _ \| '_ ` _ \ / _ \ | | | '_ \  | | | '_ \| '_ \| || |_
| | | | (_) | | | | | |  __/ | | | |_) | | | | |_) | (_) |__   _|
|_| |_|\___/|_| |_| |_|\___| |_|_|_.__/  |_|_|_.__/ \___/   |_|

                 _                 _
 _ __ ___  _ __ | |_    ___  _ __ | |_   _ __  _ __ ___   ___
| '_ ` _ \| '_ \| __|  / _ \| '_ \| __| | '_ \| '__/ _ \ / __|
| | | | | | | | | |_  | (_) | |_) | |_  | |_) | | | (_) | (__
|_| |_| |_|_| |_|\__|  \___/| .__/ \__| | .__/|_|  \___/ \___|
                            |_|         |_|
                 _                            _     _
 _ __ ___   ___ | |_   _ __ _   _ _ __    ___| |__ (_)_ __
| '__/ _ \ / _ \| __| | '__| | | | '_ \  / __| '_ \| | '_ \
| | | (_) | (_) | |_  | |  | |_| | | | | \__ \ |_) | | | | |
|_|  \___/ \___/ \__| |_|   \__,_|_| |_| |___/_.__/|_|_| |_|

          _ _
 ___  ___| (_)_ __  _   ___  __  ___ _ __   __ _ _ __    ___ _ ____   __
/ __|/ _ \ | | '_ \| | | \ \/ / / __| '_ \ / _` | '_ \  / __| '__\ \ / /
\__ \  __/ | | | | | |_| |>  <  \__ \ | | | (_| | |_) | \__ \ |   \ V /
|___/\___|_|_|_| |_|\__,_/_/\_\ |___/_| |_|\__,_| .__/  |___/_|    \_/
                                                |_|
                 _
 ___ _   _ ___  | |_ _ __ ___  _ __    _   _ ___ _ __  __   ____ _ _ __
/ __| | | / __| | __| '_ ` _ \| '_ \  | | | / __| '__| \ \ / / _` | '__|
\__ \ |_| \__ \ | |_| | | | | | |_) | | |_| \__ \ |     \ V / (_| | |
|___/\__, |___/  \__|_| |_| |_| .__/   \__,_|___/_|      \_/ \__,_|_|
     |___/                    |_|
```

在处理汉字的时候，会变成这样：


```
# figlet 我爱我的祖国
                   _                      __ __    __   _   __
  __ ____   ___  _| |_ __ ____   ___  ___ \ V /   (()) / | / /__
 / _`  _ \ / __||_   _/ _`  _ \ / __|/ __|__ __| / _ '|| |/ /_  )
| (_|  __/| (__  _|_|| (_|  __/| (__| (__|__ __|| (_| ||_/ / / /
 \__,____| \___||_____\__,____| \___|\___| |_|   \__,_| /_/ /___|
            )_)                  )_)  )_)
```

看下它的手册：

```
# man figlet

FIGLET(6)                                                                        Games Manual                                                                       FIGLET(6)

NAME
       FIGlet - display large characters made up of ordinary screen characters

SYNOPSIS
       figlet [ -cklnoprstvxDELNRSWX ] [ -d fontdirectory ]
              [ -f fontfile ] [ -m layoutmode ]
              [ -w outputwidth ] [ -C controlfile ]
              [ -I infocode ] [ message ]

DESCRIPTION
       FIGlet  prints  its input using large characters (called ``FIGcharacters'')made up of ordinary screen characters (called ``sub-characters'').  FIGlet output is gener-
       ally reminiscent of the sort of ``signatures'' many people like to put at the end of e-mail and UseNet messages.  It is also reminiscent of the output of some  banner
       programs, although it is oriented normally, not sideways.

       FIGlet  can  print  in  a variety of fonts, both left-to-right and right-to-left, with adjacent FIGcharacters kerned and ``smushed'' together in various ways.  FIGlet
       fonts are stored in separate files, which can be identified by the suffix ``.flf''.  In systems with UTF-8 support FIGlet may  also  support  TOIlet  ``.tlf''  fonts.
       Most FIGlet font files will be stored in FIGlet's default font directory.

       FIGlet  can  also use ``control files'', which tell it to map certain input characters to certain other characters, similar to the Unix tr command.  Control files can
       be identified by the suffix ``.flc''.  Most FIGlet control files will be stored in FIGlet's default font directory.

       You can store FIGlet fonts and control files in compressed form.  See COMPRESSED FONTS.

USAGE
       Just start up FIGlet (type ``figlet'') and then type whatever you want.  Alternatively, pipe a file or the output of another command through FIGlet, or put  input  on
       the command line after the options.  See EXAMPLES for other things to do.

OPTIONS
       FIGlet  reads command line options from left to right, and only the last option that affects a parameter has any effect.  Almost every option has an inverse, so that,
       for example, if FIGlet is customized with a shell alias, all the options are usually still available.

       Commonly-used options are -f, -c, -k, -t, -p and -v.

       -f fontfile
              Select the font.  The .flf suffix may be left off of fontfile, in which case FIGlet automatically appends it.  FIGlet looks for the file first in  the  default
              font  directory  and  then  in the current directory, or, if fontfile was given as a full pathname, in the given directory.  If the -f option is not specified,
              FIGlet uses the font that was specified when it was compiled.  To find out which font this is, use the -I3 option.

       -d fontdirectory
              Change the default font directory.  FIGlet looks for fonts first in the default directory and then in the current directory.  If the -d option  is  not  speci-
              fied, FIGlet uses the directory that was specified when it was compiled.  To find out which directory this is, use the -I2 option.
              
               -c
       -l
       -r
       -x     These  options  handle  the justification of FIGlet output.  -c centers the output horizontally.  -l makes the output flush-left.  -r makes it flush-right.  -x
              (default) sets the justification according to whether left-to-right or right-to-left text is selected.  Left-to-right text will be flush-left, while  right-to-
              left text will be flush-right.  (Left-to-right versus right-to-left text is controlled by -L, -R and -X.)

       -t
       -w outputwidth
              These  options  control the outputwidth, or the screen width FIGlet assumes when formatting its output.  FIGlet uses the outputwidth to determine when to break
              lines and how to center the output.  Normally, FIGlet assumes 80 columns so that people with wide terminals won't annoy the people they  e-mail  FIGlet  output
              to.  -t sets the outputwidth to the terminal width.  If the terminal width cannot be determined, the previous outputwidth is retained.  -w sets the outputwidth
              to the given integer.  An outputwidth of 1 is a special value that tells FIGlet to print each non-space FIGcharacter, in its entirety, on a separate  line,  no
              matter how wide it is.

       -p
       -n     These  options control how FIGlet handles newlines.  -p puts FIGlet into ``paragraph mode'', which eliminates some unnecessary line breaks when piping a multi-
              line file through FIGlet.  In paragraph mode, FIGlet treats line breaks within a paragraph as if they were merely  blanks  between  words.   (Specifically,  -p
              causes  FIGlet to convert any newline which is not preceded by a newline and not followed by a space character into a blank.)  -n (default) puts FIGlet back to
              normal, in which every newline FIGlet reads causes it to produce a line break.

       -D
       -E     -D switches to the German (ISO 646-DE) character set.  Turns `[', `\' and `]' into umlauted A, O and U, respectively.  `{', `|' and `}' turn into  the  respec-
              tive  lower  case versions of these.  `~' turns into s-z.  -E turns off -D processing.  These options are deprecated, which means they probably will not appear
              in the next version of FIGlet.

       -C controlfile
       -N     These options deal with FIGlet controlfiles.  A controlfile is a file containing a list of commands that FIGlet executes each time it reads a character.  These
              commands  can  map  certain  input  characters  to  other  characters, similar to the Unix tr command or the FIGlet -D option.  FIGlet maintains a list of con-
              trolfiles, which is empty when FIGlet starts up.  -C adds the given controlfile to the list.  -N clears the controlfile list, cancelling the effect of any pre-
              vious  -C.   FIGlet  executes the commands in all controlfiles in the list.  See the file figfont.txt, provided with FIGlet, for details on how to write a con-
              trolfile.

       -s
       -S
       -k
       -W
              -o     These options control how FIGlet spaces the FIGcharacters that it outputs.  -s (default) and -S cause ``smushing''.  The FIGcharacters are displayed  as  close
              together  as  possible,  and  overlapping  sub-characters are removed.  Exactly which sub-characters count as ``overlapping'' depends on the font's layoutmode,
              which is defined by the font's author.  -k causes ``kerning''.  As many blanks as possible are removed between FIGcharacters,  so  that  they  touch,  but  the
              FIGcharacters are not smushed.  -W makes FIGlet display all FIGcharacters at their full width, which may be fixed or variable, depending on the font.

              The  difference  between -s and -S is that -s will not smush a font whose author specified kerning or full width as the default layoutmode, whereas -S will at-
              tempt to do so.

              If there is no information in the font about how to smush, or if the -o option is specified, then the FIGcharacters are ``overlapped''.  This means that  after
              kerning, the first subcharacter of each FIGcharacter is removed.  (This is not done if a FIGcharacter contains only one subcharacter.)

       -m layoutmode
              Specifies an explicit layoutmode between 1 and 63.  Smushmodes are explained in figfont.txt, which also provides complete information on the format of a FIGlet
              font.  For the sake of backward compatibility with versions of FIGlet before 2.2, -m0 is equivalent to -k, -m-1 is equivalent to -W, and -m-2 is equivalent  to
              -s.  The -m switch is normally used only by font designers testing the various layoutmodes with a new font.

       -v
              -I infocode
              These  options  print  various  information about FIGlet, then exit.  If several of these options are given on the command line, only the last is executed, and
              only after all other command-line options have been dealt with.

              -v prints version and copyright information, as well as a ``Usage: ...''  line.  -I prints the information corresponding to the given infocode in a consistent,
              reliable (i.e., guaranteed to be the same in future releases) format.  -I is primarily intended to be used by programs that use FIGlet.  infocode can be any of
              the following.

              -1 Normal operation (default).
                     This infocode indicates that FIGlet should operate normally, not giving any informational printout, printing its input in the selected font.

              0 Version and copyright.
                     This is identical to -v.

              1 Version (integer).
                     This will print the version of your copy of FIGlet as a decimal integer.  The main version number is multiplied by 10000, the sub-version number is mul-
                     tiplied  by  100,  and the sub-sub-version number is multiplied by 1.  These are added together, and the result is printed out.  For example, FIGlet 2.2
                     will print ``20200'' , version 2.2.1 will print ``20201''.  Similarly, version 3.7.2 would print ``30702''.  These numbers are guaranteed to be  ascend-
                     ing, with later versions having higher numbers.  Note that the first major release of FIGlet, version 2.0, did not have the -I option.

              2 Default font directory.
                     This will print the default font directory.  It is affected by the -d option.

              3 Font.
                     This will print the name of the font FIGlet would use.  It is affected by the -f option.  This is not a filename; the ``.flf'' suffix is not printed.

              4 Output width.
                     This  will  print  the value FIGlet would use for outputwidth, the number of columns wide FIGlet assumes the screen is.  It is affected by the -w and -t
                     options.

              5 Supported font formats.
                     This will list font formats supported by FIGlet .  Possible formats are ``flf2'' for FIGfont Version 2 .flf files and ``tlf2'' for TOIlet .tlf files.

              If infocode is any other positive value, FIGlet will simply exit without printing anything.

       -L
       -R
       -X     These options control whether FIGlet prints left-to-right or right-to-left.  -L selects left-to-right printing.  -R selects right-to-left  printing.   -X  (de-
              fault) makes FIGlet use whichever is specified in the font file.

              Once  the  options are read, if there are any remaining words on the command line, they are used instead of standard input as the source of text.  This feature
              allows shell scripts to generate large letters without having to dummy up standard input files.

              An empty argument, obtained by two sequential quotes, results in a line break.
              
EXAMPLES
       To use FIGlet with its default settings, simply type

              example% figlet

       and then type whatever you like.

       To change the font, use the -f option, for example,

              example% figlet -f script

       Use the -c option if you would prefer centered output:

              example% figlet -c

       We have found that the most common use of FIGlet is making up large text to be placed in e-mail messages.  For this reason, FIGlet defaults to 80 column  output.   If
       you are using a wider terminal, and would like FIGlet to use the full width of your terminal, use the -t option:

              example% figlet -t

       If you don't want FIGlet to smush FIGcharacters into each other, use the -k option:

              example% figlet -k

       If figlet gets its input from a file, it is often a good idea to use -p:

              example% figlet -p < myfile

       Of course, the above can be combined:

              example% figlet -ptk -f shadow < anotherfile
              example% figlet -cf slant

       Finally, if you want to have FIGlet take the input from the command line instead of a file:

              example% figlet Hello world
    Other Things to Try
       On many systems nice effects can be obtained from the lean font by piping it through tr.  Some you might want to try are the following:

              example% figlet -f lean | tr ' _/' ' ()'
              example% figlet -f lean | tr ' _/' './\\'
              example% figlet -f lean | tr ' _/' ' //'
              example% figlet -f lean | tr ' _/' '/  '

       Similar things can be done with the block font and many of the other FIGlet fonts.

COMPRESSED FONTS
       You  can  compress the fonts and controlfiles using the zip archiving program.  Place only one font or controlfile in each archive, and rename the archive file (which
       will have a name ending in .zip) back to .flf or .flc as the case may be.  If you don't rename the file appropriately, FIGlet won't be able to find it.

       FIGlet does not care what the filename within the .zip archive is, and will process only the first file.

       The .zip format was chosen because tools to create and manipulate it are widely available for free on many platforms.

THE STANDARD FONTS
       Here are a few notes about some of the fonts provided with FIGlet.  You can get many other font from the Web site
       http://www.figlet.org/   This location should also contain the latest version of FIGlet and other related utilities.

       The font standard is the basic FIGlet font, used when no other font is specified.  (This default can be changed when FIGlet is compiled on  your  system.)   The  con-
       trolfiles  8859-2, 8859-3, 8859-4, and 8859-9 are provided for interpreting those character sets, also known as ISO Latin-2 through Latin-5 respectively.  The charac-
       ter set 8859-1 (ISO Latin-1) is FIGlet's default and requires no special controlfile.

       Closely related are the fonts slant, shadow, small, smslant (both small and slanted), smshadow, (both small and shadowed), and big.  These fonts support only Latin-1,
       except  that  big supports Greek FIGcharacters as well; the controlfiles frango (for Greek text written in Latin characters, so-called ``frangovlakhika''), and 8859-7
       (for mixed Latin/Greek text) are provided.

       The ivrit font is a right-to-left font including both Latin and Hebrew FIGcharacters; the Latin characters are those of the standard font.  The available controlfiles
       are  ilhebrew, which maps the letters you get by typing on a U.S. keyboard as if it were a Hebrew keyboard; ushebrew, which makes a reasonable mapping from Latin let-
       ters to Hebrew ones; and 8859-8, which supports mixed Latin/Hebrew text.  Warning: FIGlet doesn't support bidirectional text, so everything will  come  out  right-to-
       left, even Latin letters.

       The  fonts  terminal, digital, and bubble output the input character with some decoration around it (or no decoration, in the case of terminal).  The characters coded
       128 to 159, which have varying interpretations, are output as-is.  You can use the appropriate controlfiles to process Latin-2, Latin-3, or Latin-4 (but not  Latin-5)
       text, provided your output device has screen or printer fonts that are appropriate for these character sets.

       Two script fonts are available: script, which is larger than standard, and smscript, which is smaller.

       The font lean is made up solely of `/' and `_' sub-characters; block is a straight (non-leaning) version of it.

       The font mini is very small, and especially suitable for e-mail signatures.
       
              The  font banner looks like the output of the banner program; it is a capitals and small capitals font that doesn't support the ISO Latin-1 extensions to plain ASCII.
       It does, however, support the Japanese katakana syllabary; the controlfile uskata maps the upper-case and lower-case Latin letters into the 48 basic katakana  charac-
       ters, and the controlfile jis0201 handles JIS 0201X (JIS-Roman) mixed Latin and katakana text.  Furthermore, the banner font also supports Cyrillic (Russian) FIGchar-
       acters; the controlfile 8859-5 supports mixed Latin and Cyrillic text, the controlfile koi8r supports the popular KOI8-R mapping of mixed text,  and  the  controlfile
       moscow supports a sensible mapping from Latin to Cyrillic, compatible with the moscow font (not supplied).

       The  fonts  mnemonic  and  safemnem  support  the mnemonic character set documented in RFC 1345.  They implement a large subset of Unicode (over 1800 characters) very
       crudely, using ASCII-based mnemonic sequences, and are good for getting a quick look at UTF-8 unicode files, using the controlfile utf8.
       
ENVIRONMENT
       FIGLET_FONTDIR
              If $FIGLET_FONTDIR is set, its value is used as a path to search for font files.

FILES
       file.flf            FIGlet font file
       file.flc            FIGlet control file

DIAGNOSTICS
       FIGlet's diagnostics are intended to be self-explanatory.  Possible messages are

              Usage: ...
              Out of memory
              Unable to open font file
              Not a FIGlet 2 font file
              Unable to open control file
              Not a FIGlet 2 control file
              "-t" is disabled, since ioctl is not fully implemented.

       This last message is printed when the -t option is given, but the operating system in use does not include the system call  FIGlet  uses  to  determine  the  terminal
       width.

       FIGlet  also prints an explanatory message if the -F option is given on the command line.  The earlier version of FIGlet, version 2.0, listed the available fonts when
       the -F option was given.  This option has been removed from FIGlet 2.1.  It has been replaced by the figlist script, which is part of the standard FIGlet package.

ORIGIN
       ``FIGlet'' stands for ``Frank, Ian and Glenn's LETters''.  Inspired by Frank's .sig, Glenn wrote (most of) it, and Ian helped.

       Most of the standard FIGlet fonts were inspired by signatures on various UseNet articles.  Since typically hundreds of people use the same style of letters  in  their
       signatures, it was often not deemed necessary to give credit to any one font designer.

BUGS
       Very little error checking is done on font and control files.  While FIGlet tries to be forgiving of errors, and should (hopefully) never actually crash, using an im-
       properly-formatted file with FIGlet will produce unpredictable output.

       FIGlet does not handle format characters in a very intelligent way.  A tab character is converted to a blank, and vertical-tab, form-feed and carriage-return are each
       converted to a newline.  On many systems, tabs can be handled better by piping files through expand before piping through FIGlet.

       FIGlet output is quite ugly if it is displayed in a proportionally-spaced font.  I suppose this is to be expected.

       Please report any errors you find in this man page or the program to <info@figlet.org>
       
WEBSITE AND MAILING LIST
       You  can  get  many fonts which are not in the basic FIGlet package from the Web site http://www.figlet.org/   It should also contain the latest version of FIGlet and
       other utilities related to FIGlet.

       There is a mailing list for FIGlet for general discussions about FIGlet and a place where you can ask questions or share ideas with other FIGlet users. It is also the
       place where we will publish news about new fonts, new software updates etc.

       To subscribe or unsubscribe from the FIGlet mailing list, please send email to figlet-subscribe@figlet.org or figlet-unsubscribe@figlet.org or visit the following web
       page: http://www.figlet.org/mailman/listinfo/figlet

AUTHORS
       Glenn Chappell did most of the work.  You can e-mail him but he is not an e-mail fanatic; people who e-mail Glenn will probably get answers, but  if  you  e-mail  his
       best friend:

       Ian  Chai,  who  is  an  e-mail  fanatic,  you'll get answers, endless conversation about the mysteries of life, invitations to join some 473 mailing lists and a free
       toaster.  (Well, ok, maybe not the free toaster.)

       Frank inspired this whole project with his .sig, but don't e-mail him; he's decidedly an un-e-mail-fanatic.

       Gilbert "The Mad Programmer" Healton added the -A option for version 2.1.1.  This option specified input from the command line; it is still allowed, but  has  no  ef-
       fect.

       John  Cowan  added the -o, -s, -k, -S, and -W options, and the support for Unicode mapping tables, ISO 2022/HZ/Shift-JIS/UTF-8 input, and compressed fonts and control
       files.  He also revised this documentation, with a lot of input from Paul Burton.

       Claudio Matsuoka added the support for .tlf files for version 2.2.4 and performs random hacks and bugfixes.

       As a fan of FIGlet, Christiaan Keet revised the official FIGlet documentation and set up the new FIGlet  website  at  http://www.figlet.org/  (and  the  corresponding
       ftp://ftp.figlet.org/pub/figlet/)

SEE ALSO
       figlist(6), chkfont(6), showfigfonts(6), toilet(1)

v2.2.5                                                                           31 May 2012                                                                        FIGLET(6)
 Manual page figlet(6) line 267/311 (END) (press h for help or q to quit)
```

软件不大，手册还不小，真佩服这个作者。。。。


----------
## fortune

fortune能在命令行里随机显示一条谚语之类的英文橘子，这倒是个不错的英语学习工具，随便输出几条看看效果吧：

```
# fortune
Here comes the orator, with his flood of words and his drop of reason.

# fortune
I need to discuss BUY-BACK PROVISIONS with at least six studio SLEAZEBALLS!!

# fortune
Whether weary or unweary, O man, do not rest,
Do not cease your single-handed struggle.
Go on, do not rest.
		-- An old Gujarati hymn
```

有些句子还有出处，嘿嘿～

手册在此：

```
# man fortune

FORTUNE(6)                                                                  UNIX Reference Manual                                                                  FORTUNE(6)

NAME
       fortune - print a random, hopefully interesting, adage

SYNOPSIS
       fortune [-acefilosw] [-n length] [ -m pattern] [[n%] file/dir/all]

DESCRIPTION
       When  fortune  is  run  with  no arguments it prints out a random epigram. Epigrams are divided into several categories, where each category is sub-divided into those
       which are potentially offensive and those which are not..SS Options The options are as follows:

       -a     Choose from all lists of maxims, both offensive and not.  (See the -o option for more information on offensive fortunes.)

       -c     Show the cookie file from which the fortune came.

       -e     Consider all fortune files to be of equal size (see discussion below on multiple files).

       -f     Print out the list of files which would be searched, but don't print a fortune.

       -l     Long dictums only.  See -n on how ``long'' is defined in this sense.

       -m pattern
              Print out all fortunes which match the basic regular expression pattern.  The syntax of these expressions depends on how your system defines re_comp(3) or reg-
              comp(3), but it should nevertheless be similar to the syntax used in grep(1).

              The  fortunes  are  output  to standard output, while the names of the file from which each fortune comes are printed to standard error.  Either or both can be
              redirected; if standard output is redirected to a file, the result is a valid fortunes database file.  If standard error is also redirected to this  file,  the
              result is still valid, but there will be ``bogus'' fortunes, i.e. the filenames themselves, in parentheses.  This can be useful if you wish to remove the gath-
              ered matches from their original files, since each filename-record will precede the records from the file it names.

       -n length
              Set the longest fortune length (in characters) considered to be ``short'' (the default is 160).  All fortunes longer than this  are  considered  ``long''.   Be
              careful!  If you set the length too short and ask for short fortunes, or too long and ask for long ones, fortune goes into a never-ending thrash loop.

       -o     Choose only from potentially offensive aphorisms.  The -o option is ignored if a fortune directory is specified.

              Please,  please,  please request a potentially offensive fortune if and only if you believe, deep in your heart, that you are willing to be offended. (And that
              you'll just quit using -o rather than give us grief about it, okay?)

              ... let us keep in mind the basic governing philosophy of The Brotherhood, as handsomely summarized in these words: we believe in healthy, hearty  laughter  --
              at the expense of the whole human race, if needs be.  Needs be.
                     --H. Allen Smith, "Rude Jokes"
                     
               -s     Short apothegms only.  See -n on which fortunes are considered ``short''.

       -i     Ignore case for -m patterns.

       -w     Wait  before termination for an amount of time calculated from the number of characters in the message.  This is useful if it is executed as part of the logout
              procedure to guarantee that the message can be read before the screen is cleared.

       The user may specify alternate sayings.  You can specify a specific file, a directory which contains one or more files, or the special word all which says to use  all
       the  standard databases.  Any of these may be preceded by a percentage, which is a number n between 0 and 100 inclusive, followed by a %.  If it is, there will be a n
       percent probability that an adage will be picked from that file or directory. If the percentages do not sum to 100, and there are specifications without  percentages,
       the remaining percent will apply to those files and/or directories, in which case the probability of selecting from one of them will be based on their relative sizes.

       As an example, given two databases funny and not-funny, with funny twice as big (in number of fortunes, not raw file size), saying

              fortune funny not-funny

       will get you fortunes out of funny two-thirds of the time.  The command

              fortune 90% funny 10% not-funny

       will pick out 90% of its fortunes from funny (the ``10% not-funny'' is unnecessary, since 10% is all that's left).

       The -e option says to consider all files equal; thus

              fortune -e funny not-funny

       is equivalent to

              fortune 50% funny 50% not-funny

       This fortune also supports the BSD method of appending ``-o'' to database names to specify offensive fortunes.  However this is not how fortune stores them: offensive
       fortunes are stored in a separate directory without the ``-o'' infix.  A plain name (i.e., not a path to a file or directory) that ends in ``-o'' will be  assumed  to
       be  an  offensive  database, and will have its suffix stripped off and be searched in the offensive directory (even if the neither of the -a or -o options were speci-
       fied).  This feature is not only for backwards-compatibility, but also to allow users to distinguish between inoffensive and offensive databases of the same name.

       For example, assuming there is a database named definitions in both the inoffensive and potentially offensive collections, then the following command will  select  an
       inoffensive definition 90% of the time, and a potentially offensive definition for the remaining 10%:

              fortune 90% definitions definitions-o
              
FILES
       Note: these are the defaults as defined at compile time.

       /usr/share/fortune/cookies
              Directory for innoffensive fortunes.
       /usr/share/fortune/cookies/off
              Directory for offensive fortunes.

       If  a  particular  set of fortunes is particularly unwanted, there is an easy solution: delete the associated .dat file.  This leaves the data intact, should the file
       later be wanted, but since fortune no longer finds the pointers file, it ignores the text file.

BUGS
       The division of fortunes into offensive and non-offensive by directory, rather than via the `-o' file infix, is not 100% compatible with  original  BSD  fortune.  Al-
       though  the `-o' infix is recognised as referring to an offensive database, the offensive database files still need to be in a separate directory.  The workaround, of
       course, is to move the `-o' files into the offensive directory (with or without renaming), and to use the -a option.

       The supplied fortune databases have been attacked, in order to correct orthographical and grammatical errors, and particularly to reduce redundancy and repetition and
       redundancy.  But especially to avoid repetitiousness.  This has not been a complete success.  In the process, some fortunes may also have been lost.

       The fortune databases are now divided into a larger number of smaller files, some organized by format (poetry, definitions), and some by content (religion, politics).
       There are parallel files in the main directory and in the offensive files directory (e.g., fortunes/definitions and fortunes/off/definitions).   Not  all  the  poten-
       tially  offensive  fortunes  are in the offensive fortunes files, nor are all the fortunes in the offensive files potentially offensive, probably, though a strong at-
       tempt has been made to achieve greater consistency.  Also, a better division might be made.

HISTORY
       This version of fortune is based on the NetBSD fortune 1.4, but with a number of bug fixes and enhancements.

       The original fortune/strfile format used a single file; strfile read the text file and converted it to null-delimited strings, which were stored after  the  table  of
       pointers  in  the .dat file.  By NetBSD fortune 1.4, this had changed to two separate files: the .dat file was only the header (the table of pointers, plus flags; see
       strfile.h), and the text strings were left in their own file.  The potential problem with this is that text file and header file may get out of synch, but the  advan-
       tage  is that the text files can be easily edited without resorting to unstr, and there is a potential savings in disk space (on the assumption that the sysadmin kept
       both .dat file with strings and the text file).

       Many of the enhancements made over the NetBSD version assumed a Linux system, and thus caused it to fail under other platforms, including BSD.  The  source  code  has
       since been made more generic, and currently works on SunOS 4.x as well as Linux, with support for more platforms expected in the future.  Note that some bugs were in-
       advertently discovered and fixed during this process.

       At a guess, a great many people have worked on this program, many without leaving attributions.

SEE ALSO
       re_comp(3), regcomp(3), strfile(1), unstr(1)

BSD Experimental                                                            19 April 94 [May. 97]                                                                  FORTUNE(6)
 Manual page fortune(6) line 83/127 (END) (press h for help or q to quit)
```

也是软件不大，手册不小的类型。。。。太闲了，有些人。。。。


----------
## oneko

oneko能召唤一只小猫咪，追着你的鼠标指针在屏幕上跑来跑去，这个必须要有图形化的支持，如果安装的是纯文本界面的Linux它是跑不起来的，效果不太方便演示了，大家看看手册然后自己实验吧：

```
# man oneko

ONEKO(6)                                                                         Games Manual                                                                        ONEKO(6)

NAME oneko
       The program oneko creates a cute cat or dog chasing around your mouse cursor.

SYNOPSIS
       oneko [-help] [-neko] [-tora] [-dog] [-time n] [-speed n] [-idle n] [-rv] [-noshape] [-fg s] [-bg s]

       tora [-help] [-neko] [-tora] [-dog] [-time n] [-speed n] [-idle n] [-rv] [-noshape] [-fg s] [-bg s]

       dog [-help] [-neko] [-tora] [-dog] [-time n] [-speed n] [-idle n] [-rv] [-noshape] [-fg s] [-bg s]

DESCRIPTION
       oneko  changes  your cursor into a mouse and creates a little cute cat and the cat starts chasing around your mouse cursor.  If the cat catches the ``mouse'', it will
       start sleeping. Alternatively, changes your mouse cursor into a bone, which is chased around by a dog.

   Options
       -help  Prints help message on usage.

       -neko  Display a cat (default).

       -tora  Make cat into "tora-neko".  "Tora-neko" means cat wite tiger-like stripe.  I don't know how to say it in English.

       -dog   Display a dog instead of the default cat.

       -time interval
              Sets interval timer which determines intervals for the animation.  The default value is 125000 and unit is micro-second.  Smaller value makes the  cat  or  dog
              run faster.

       -speed distance
              Specify the distance where cat jumps at one move in dot resolution.  Default is 16.

       -idle speed
              Specify the threshold of the speed which ``mouse'' running away will wake cat up.

       -rv    Reverse background color and foreground color.

       -noshape
              Don't use SHAPE extension.

       -fg color
              Foreground color.

       -bg color
              Background color.
              
   Resources
       Application name is "neko" (or "tora") and class name is "Oneko".

       tora   Set ``True'' if you want "tora-neko".

       time   Sets interval timer in micro-second.

       speed  Sets distance to jump in pixel.

       idle   Sets speed threshold to wake cat up when ``mouse'' running away.

       noshape
              Set ``True'' if you don't want to use SHAPE extension.

       reverse
              Set ``True'' if you want to switch foreground and background color.

       foreground
              Foreground color.

       background
              Background color.

Notes
       While  this program uses XGetDefault, be sure to use "neko.resouce" form.  If you run this program as "tora", by hard of soft link, the -tora option is enabled by de-
       fault.

AUTHOR
       Original xneko is written by Masayuki Koba and modified by Tatsuya Kato (kato@ntts.co.jp).  Send bug fixes and enhancements to kato@ntts.co.jp

MAINTAINER
       Send questions or problems to ea08@andrew.cmu.edu

                                                                                                                                                                     ONEKO(6)
 Manual page oneko(1x) line 36/80 (END) (press h for help or q to quit)
```


----------
## 结束语

好啦，关于Linux命令行下好玩的东东，这次就先介绍这么多，其实还有很多好玩的，只要用心去发现。这里只是想借此告诉大家，会玩的人，即便在枯燥无味的世界里也能玩出自己的乐趣无穷，祝大家开开心心每一天。

最后也许还会有很多人想问，这些小玩意怎么安装到我们的Linux系统上呢？各大发行版的在线软件源基本都能找到这些东东，至于怎么安装，大家伙自己研究吧，如果你是一名IT工程师，这都解决不了也许你真的不太适合这个行业，如果你是一名非技术人员，那么请找你的工程师朋友帮你解决一下咯，这里就不再花篇幅来介绍了。

  [1]: http://static.zybuluo.com/gamedebug/nw56egy0ttbphh4l4nxirhyj/WX20191210-144018@2x.png
  [2]: http://static.zybuluo.com/gamedebug/ywonem0txq7q0gc0p8892pnr/WX20191210-153503@2x.png