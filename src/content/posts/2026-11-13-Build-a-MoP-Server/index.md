---
title: "建造自己的魔兽世界（熊猫人之谜）（一）：选型与部署"
date: 2026-11-13
slug: "Build-a-MoP-Server"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "用 SkyFire_548 在 AWS 上搭一台 5.4.8 熊猫人服务器：选型、部署、配置和客户端设置，以及整个修复工作的进度统计。"
---

几年前我搭过一台巫妖王之怒（3.3.5）的服务器。这次换成熊猫人之谜（5.4.8），主要给家里的小朋友玩，所以用的是英文客户端，英文她读起来比中文顺。整个过程是我和 Claude Code 一起完成的：我负责在游戏里测试、提问题和做决定，它负责查源码、改配置、写补丁。

这个系列一共五篇，按大地图分篇，篇内按地图区域分章：

1. **选型与部署**（本篇）：服务器选型、部署、配置和客户端设置，以及修复进度和待办
2. [全局修复](/Build-a-MoP-Server-2-Global-Fixes/)：全库任务审计、批量修复，以及影响全服的问题
3. [新手村](/Build-a-MoP-Server-3-Starter-Zones/)：熊猫人、矮人、狼人、德莱尼、侏儒、死亡骑士的新手村任务修复
4. [东部王国](/Build-a-MoP-Server-4-Eastern-Kingdoms/)：东部王国各地图的任务修复
5. [卡利姆多](/Build-a-MoP-Server-5-Kalimdor/)：卡利姆多各地图的任务修复

外域、诺森德和潘达利亚目前还没有修复记录，修到那里再开新篇。新手村篇最早写，时间上在全局修复之前，全局审计就是从熊猫人岛和矮人新手村的经验里总结出来的；地图各篇是全局修复之后，在游戏里实际玩到哪里、就修到哪里的记录。

## 第一章　选型

### 1.1 版本和核心的选择

- **客户端版本：5.4.8（build 18414）。** 开源的熊猫人模拟器和数据库基本都只支持这个版本。官方现在的熊猫人怀旧服是 5.5.x，版本号对不上，不能用。
- **核心：[SkyFire_548](https://github.com/ProjectSkyfire/SkyFire_548)。** 它是从 TrinityCore 改出来的开源核心，至今还在更新。网上那些"一键包"和来路不明的商业核心是闭源的，可能有后门，出了问题也没法自己修，所以不考虑。
- **心理预期要放低。** 熊猫人的模拟器远不如 3.3.5 + AzerothCore 成熟：团队副本和地下城的 Boss 脚本缺很多，场景战役、宠物对战也不完整，练级任务大体能做，但会碰到卡住的任务。后面两章基本都在修这类问题。

### 1.2 服务器

我直接用了手上现成的一台 AWS EC2：

| 项目 | 配置 |
|---|---|
| 实例 | t3.large，eu-west-1（爱尔兰），玩家都在欧洲 |
| CPU / 内存 | 2 vCPU / 7.6 GB，不加 swap |
| 磁盘 | 145 GB |
| 系统 | Ubuntu 26.04，内核 7.0 |

小规模游玩，2 核 4 GB 就够了。服务端跑起来以后，worldserver 占内存约 1 GB，MySQL 约 0.7 GB。2 核的瓶颈在编译和生成 mmaps 时才会显现。

系统太新是个问题：SkyFire 代码比较老，直接在 Ubuntu 26.04 上编译大概率会失败。所以**编译和运行全部放进 Docker**，宿主机上只装 Docker CE 和 compose 插件。另外要在 AWS 安全组里放行 `3724/tcp`（登录服务）和 `8085/tcp`（世界服务），MySQL 的 3306 不对外开放。

## 第二章　部署

### 2.1 目录和容器

所有文件都放在服务器的一个工作目录下：

```
claude_works/
├── SkyFire_548/          # 上游仓库 main 分支
└── mop-server/
    ├── Dockerfile        # 多阶段构建，照搬上游 CI 的编译环境
    ├── compose.yaml      # mysql:8.4 + authserver + worldserver
    ├── gen-config.sh     # 从官方 .conf.dist 生成配置，只覆盖要改的项
    ├── db-init.sh        # 首次启动时创建数据库账号
    ├── .env              # 随机生成的数据库密码（权限 600）
    ├── db/sfdb27/        # 官方世界库 SFDB 27
    ├── extract.sh        # 地图数据提取脚本，可以分步重跑
    ├── data/             # dbc / db2 / maps / vmaps / mmaps
    ├── sql-custom/       # 自己写的数据库修复
    ├── patches/          # 自己改的源码补丁
    └── backup/           # 每次改库之前的备份
```

- **编译环境**照搬上游的 `.github/workflows/ubuntu.yml`：Ubuntu 24.04 + GCC 14（项目用的是 C++23），从源码编译 Boost 1.91 和 OpenSSL 4.0（开启 `enable-legacy`），用 CMake + Ninja 构建，同时打开 `TOOLS=ON`，镜像里就带上了地图提取工具。第一次完整编译在 2 核机器上用了约 37 分钟，镜像 310 MB。
- 后来改源码多了，我在 Dockerfile 里给构建目录加了 BuildKit 缓存挂载（`--mount=type=cache,id=skyfire-build,target=/build`）。之后改一两个脚本文件，增量编译只要 1 分钟左右。
- **数据库**用 SkyFire 自带的更新器：首次启动自动建库，导入 SFDB 27，再补跑之后的增量更新。

### 2.2 部署时踩的坑

**1. 通过 SSH heredoc 写文件，单引号被吃掉了。** `db-init.sh` 里的 SQL 少了引号，数据库账号没建出来，authserver 一直报"访问被拒"。后来改成在本地写好文件，再用 scp 传上去。

**2. 世界库里写死了 `DEFINER`。** SFDB 27 的 dump 末尾有 61 个存储过程，都写着 `DEFINER=skyfire@localhost`。我们的账号是 `skyfire@%`，两者不匹配，MySQL 要求更高的权限，导入就中断了。解决办法是用 sed 去掉 DEFINER，生成 `world_base.nodefiner.sql`，再让 compose 挂载这份文件。这样存储过程都还在，也不需要给账号提权。

**3. 导入失败后又被自动重启，留下一个半成品库。** 更新器只要看到 world 库"不为空"，就会跳过基础导入，直接在残缺的库上继续跑更新。正确的处理是：删掉 world 和 characters 两个库，**临时关掉 worldserver 的自动重启**，重新导入；确认成功后，再把自动重启恢复成 `unless-stopped`。

导入成功后的数据：world 库有 180 张表、22.5 万个 NPC 刷新点、1.8 万个任务。日志里有约 500 条 "GUID not found" 之类的一致性警告，这是 SFDB 数据本身的小毛病，不影响运行。

### 2.3 崩溃排查

#### 第一次崩溃：先打开 core dump

11 月 9 日 worldserver 段错误退出过一次（退出码 139）。我用 dmesg 里的地址加 addr2line，定位到 `Player::GetQuestStatus`。最大的嫌疑是熊猫人岛任务 29414 的 Aysa 冥想事件脚本 `npc_aysa_meditationAI`：它缓存了裸的 `Player*` 指针，重置时不清空，每个 tick 都去调用 `GetQuestStatus`。而唯一接过这个任务的角色，正好在崩溃前下线了。

不过这只是推测。我们的原则是**没有调用栈就不改代码**，所以先把 core dump 打开：

- 关掉 apport，`core_pattern` 设为 `/cores/core.%e.%p.%t`；
- compose 里给 worldserver 加上 `ulimits: core: -1`，并把 `./cores` 挂载进容器；
- 宿主机装好 gdb。下次崩溃时，先看调用栈里有没有 `npc_aysa_meditationAI::UpdateAI`，再决定怎么改。

#### 后来抓到的两个 core：关机时的 use-after-free

之后 `cores/` 目录里陆续出现了两个 core，分别生成于 11 月 11 日 14:53 和 11 月 13 日 00:15，每个约 1.3 GB。两次都正好是我改完数据、重启 worldserver 的时候。

**第一个难点：崩溃时运行的二进制已经没了。** 我们几乎每天都在重新编译，第二个 core 生成 8 分钟后，镜像就又编了一版。直接用现有的二进制去 gdb，调用栈全是 `??`。解决办法分三步：

1. **从 core 里读出当时那个二进制的 build-id。** core 里的 `NT_FILE` 记录了 worldserver 映射到的地址，那一页里还保留着 ELF 头和 `.note.gnu.build-id`，写个几十行的 Python 就能把它读出来。两个 core 的 build-id 分别是 `18f43ca4…` 和 `144db24d…`，和现在的二进制都对不上。
2. **按当时的源码重编一份。** 复制一份源码，把第二个 core 之后打的补丁（Raid Night）撤掉，借用同一个 BuildKit 编译缓存增量编译。38 秒就编完了，build-id 正好是 `144db24d…`，完全一致。
3. **在镜像环境里跑 gdb。** 宿主机是 Ubuntu 26.04，容器是 24.04，两边的 libc、libstdc++ 不一样。所以要在镜像里临时装上 gdb，把 core 挂载进去再分析，这样共享库也能对上。

拿到的调用栈：

```
#0  WorldSocket::CloseSocket() [clone .part.0]
#1  ReactorRunnable::Stop()
#2  WorldSocketMgr::StopNetwork()
#3  WorldRunnable::Run()
```

**它不是游戏过程中的崩溃，而是关机过程中的崩溃。** 主循环已经结束，正在断开所有网络连接。第一个 core 没有重编对应的二进制，但我把两个 core 栈上指向 worldserver 的返回地址一一列出来对比：网络模块的地址整体差 0x3200，主程序整体差 0x30c0，崩溃的 PC 也正好差 0x3200。所以这是同一处崩溃。

**原因。** 看反汇编，崩溃点在内联进来的 `CloseTcpSocket()` 里。它依次调用 `cancel()`、`shutdown()`、`close()`，崩在最后的 `close()` 上：从 socket 对象里读出来的指针是 `0x7acba8c1421e`，地址没有对齐，正是 glibc 回收内存后写进去的那种"乱码"。也就是说，**这个 socket 对象在 `CloseSocket()` 执行的过程中被释放了**。再看源码：

```cpp
void Stop()
{
    std::vector<WorldSocket*> sockets;
    {
        std::lock_guard<std::mutex> guard(m_SocketsLock);
        sockets.assign(m_Sockets.begin(), m_Sockets.end());   // 只复制了裸指针
    }
    for (WorldSocket* socket : sockets)
        socket->CloseSocket();
    ...
}
```

`Stop()` 复制了连接列表，但没有给这些连接加引用计数。`CloseSocket()` 里的 `cancel()` 会让网络线程立刻执行被取消的异步读回调，回调一路走到 `SocketClosed()`，减掉最后一个引用，把对象 `delete` 掉。而主线程这时还在 `CloseSocket()` 里面，接着就去 `close()` 一块已经释放的内存。

**影响。** 只有关机时恰好有客户端连着才会触发，比如有人停在登录界面或者人物选择界面。保存角色的 `KickAll()` 在断开网络之前就执行完了，所以角色数据不会丢，只是 worldserver 没能正常退出。

**修复。** 在锁里给每个连接加一个引用，`CloseSocket()` 返回后再减掉：

```cpp
{
    std::lock_guard<std::mutex> guard(m_SocketsLock);
    sockets.assign(m_Sockets.begin(), m_Sockets.end());
    for (WorldSocket* socket : sockets)
        socket->AddReference();
}
for (WorldSocket* socket : sockets)
{
    socket->CloseSocket();
    socket->RemoveReference();
}
```

注意不能在 `CloseSocket()` 自己里面加引用：析构函数 `~WorldSocket()` 也会调用 `CloseSocket()`，引用计数会从 0 变回 1 再变回 0，导致对象被二次 delete。

改完后我做了个测试：开 20 条到 8085 端口的 TCP 连接，然后重启 worldserver。这样测了两轮，都正常退出，没有生成 core。不过原来的 bug 本身也是看时机才触发的，所以这只能说明修复没有引入新问题，还不能算证明它彻底修好了。之后每次重启都会看一眼 `cores/` 目录。

#### 11 月 13 日：一次"被重启"引出的关机顺序问题

下午 18:03 服务器突然重启，`cores/` 里多了一个 core。我一度以为终于抓到了 11 月 9 日那个崩溃的现场，结果不是。

- **谁重启的：** 机器自带的自动更新（unattended-upgrades）的自动重启是关着的。查 SSM agent 的日志才找到，18:00 AWS 下发了一条 Systems Manager Run Command，文档是 `AWS-RunPatchBaselineAssociation`，参数是 `Operation=Install`、`RebootOption=RebootIfNeeded`。这次更新里有 libc，装完就判定需要重启。AWS 的补丁策略我们决定先不动。
- **为什么崩：** 主机关机时，docker 是同时停所有容器的，数据库先停了。worldserver 这时正在给在线的角色做下线存档，写库失败，重连也连不上；退出时数据库连接的句柄已经是空的，`~MySQLConnection` 里的 `ASSERT(m_Mysql)` 主动让进程崩溃。core 是关机途中写的，被截断了，gdb 只看得到 `Skyfire::Assert` 一层，原因是从 docker 日志里那行 `ASSERTION FAILED: m_Mysql` 看出来的。
- **影响：** 那次下线存档没写进去，角色回到了上一次自动存档（当时间隔是 15 分钟）。
- **加固：**
  - 加了一个 systemd 服务 `mop-graceful-stop`，排在 `docker.service` 之后启动，所以关机时会先于 docker 停止。它停止时执行 `docker compose -p mop stop -t 120 worldserver authserver`：worldserver 收到 SIGTERM 会先保存所有在线玩家再退出，最多等 2 分钟，然后 docker 才去停数据库；
  - 自动存档间隔从 15 分钟改成 5 分钟（`PlayerSaveInterval 300000`，写进了 `gen-config.sh`），出事时最多丢 5 分钟。

顺带记一个坑：`etc/worldserver.conf` 是单文件挂载进容器的。用 `sed -i` 改它，会生成一个新文件来替换原文件，运行中的容器还挂着旧文件，所以 `reload config` 读到的仍是旧值，必须重启容器才生效。

**编译缓存的小插曲。** 为了还原旧二进制，我在共享的编译缓存里编过一份"撤掉补丁"的源码。之后正常编译时，ninja 只看修改时间：真实源码比缓存里的 `.o` 旧，就不会重编，结果编出来的 worldserver 里少了 Raid Night 的脚本。我用 `nm` 检查时发现了这个问题，于是把所有改动过的文件 touch 一遍。但 Docker 的层缓存只认文件内容、不认修改时间，又把整个编译步骤跳过了。最后在源码目录里临时放一个标记文件，让 COPY 层失效，才真正重编。以后再借用编译缓存做这种事，最好单独用一个 cache id。

## 第三章　配置

### 3.1 GM 账号和控制台

在 worldserver 控制台里创建账号（SkyFire 的参数顺序是"邮箱 用户名 密码"）：

```
account create <邮箱> <用户名> <密码>
account set gmlevel <用户名> 3 -1
```

小坑：Ubuntu 26.04 的 sudo 换成了 `sudo-rs`，它会在中间多套一层终端，用 `sudo docker attach` 进控制台后，`Ctrl+P Ctrl+Q` 退不出来。直接关掉 SSH 窗口是安全的：容器开着 tty 模式，断开 attach 不会把 worldserver 停掉。以后不加 sudo，并且换一个退出键：

```bash
docker attach --detach-keys="ctrl-x" mop-worldserver-1
```

### 3.2 方便自己人玩的配置

都写进了 `gen-config.sh`，重新生成配置也不会丢：

- 经验倍率：击杀 5 倍、探索 5 倍。任务经验一开始也是 5 倍，后来调回了 1 倍。
- 新角色初始金币 10 万金。
- `AllFlightPaths 1`：所有飞行点直接开放；`InstantFlightPaths 1`：飞行改成瞬间到达。后来发现它会把任务里的演出航线也变成瞬移，就改了源码，只让普通航线瞬间到达（见[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第二章 26094）。
- `PlayerSaveInterval 300000`：自动存档从 15 分钟一次改成 5 分钟一次（原因见 [2.3](#23-崩溃排查) 节 11 月 13 日那次重启）。
- `MaxPrimaryTradeSkill 10`：每个角色可以学全部主专业（默认 2 个）。核心在每次登录时按配置重新计算剩余的专业数，老角色也直接生效。注意英文客户端技能书的专业页只有两个主专业的位置，第三个以后不一定显示出来，但专业本身能用。
- 骑术、飞行许可和本阵营所有坐骑写进 `playercreateinfo_spell`，新建角色就有 36 格大包。

  这里有个意外发现：`playercreateinfo_spell` 不只在创建角色时生效，**每次登录都会重新学一遍**（`Player::LoadFromDB` → `learnDefaultSpells`），所以老角色也都拿到了。我们觉得这样挺好，就保留了。
- 顺手修了沙石幼龙：它的 `VehicleId` 是 0，不能带乘客。根据 Vehicle.dbc 选了一个空闲的双座载具 ID 填上，现在队友也能坐上去了。

### 3.3 修任务的工作方式

修之前我先确认了一件事：核心和 SFDB 都已经是上游最新版本，所以**等上游更新是修不好这些任务的**。另外，通用的任务物品掉落是正常的（20 个各种族的"收集掉落物"任务都完成了），坏的都是个别任务的数据或脚本。于是定了几条规矩：

- **只修"真的坏了"的，不降低难度。** 缺 NPC、缺脚本、缺刷新点、进度根本拿不到，这些算坏了，要修。东西难找、需要自己动脑子的，保持原样，不加提示，也不挪位置。拿不准算哪一种时，先讨论再动手。
- 数据库修复写成 `sql-custom/日期_序号_名字.sql`，改之前先把相关的行导出到 `backup/`。以后重建数据库，要把这些文件按顺序重新执行一遍。
- 源码改动导出成 `patches/*.patch`。不卡进度的 C++ 改动先攒着，攒够一批再编译重启。
- 有两个热重载命令千万别用错：
  - `reload spell_area` 不会清空 `mSpellAreaForAreaMap`，会留下悬空指针（use-after-free）。改了 spell_area 就重启 worldserver，不要热重载。
  - `reload smart_scripts` 不会更新已经刷出来的生物，因为 SAI 在生物创建时就把脚本复制了一份。这种情况同样要重启。

  而 `reload conditions` 和 `reload quest_poi` 可以放心热重载。

## 第四章　客户端设置

### 4.1 客户端和地图数据

- **语言。** 服务器不限制客户端的语言，只要求版本是 18414，而且按每个连接的语言返回文本。但 SFDB 27 的 `locales_*` 表全是空的，用中文客户端会看到界面是中文、任务和 NPC 是英文的混排效果。我们本来就打算用英文客户端，所以这不是问题。
- **地图数据提取**直接在服务器上做：把客户端的 `Data` 目录（约 24 GB）传上去，用镜像里的工具依次提取：
  - mapextractor：dbc、db2、maps，约 1 分钟；
  - vmap4extractor + vmap4assembler：生成 vmaps，1.1 GB；
  - mmaps_generator：最慢的一步，2 核跑了约 **6.5 小时**，生成 3.1 GB。

  日志里有大量 `Can't open ... .wdt`，都来自 `test`、`development`、`Transport*` 这类开发用地图，可以忽略。mmaps 全部完成后，打开 `mmap.enablePathFinding = 1`，NPC 就会绕开障碍物走，不再穿墙。
- **服务器地址。** 熊猫人客户端已经没有 `realmlist.wtf` 文件了，服务器地址只写在 `WTF/Config.wtf` 里：`SET realmList "服务器地址"`。改的时候游戏要关着，否则退出游戏时会把你的修改覆盖掉。
- **连接补丁。** 5.4.8 的 `Wow.exe` 需要打连接补丁（SkyFire 仓库里的 `contrib/Client_Patch`，来自 Arctium 项目），否则登录不上。我用 Python 按补丁的字节模式检查了手上的 exe，发现它**已经打过补丁**：原始模式一个都匹配不上，叠加补丁字节后才各匹配到一处。如果这时再用原版工具打一遍，它会静默跳过所有模式，输出一个和原文件一模一样的 "Wow_Patched.exe"，你根本不会发现。来源不明的 exe 要先扫毒，也别在这个客户端里输入暴雪账号。

## 接下来

30–39 级段继续逐个重建：东瘟疫之地、荆棘谷海角、千针石林、南贫瘠之地、菲拉斯、尘泥沼泽、凄凉之地。（原来列在这里的辛特兰 27626 已在 11-27 修好，见[《东部王国》10.5](/Build-a-MoP-Server-4-Eastern-Kingdoms/#105-the-highvale-documents三份文件一份都没有)。）

德莱尼新手村（[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第四章）跟着 Lizz 的进度逐个修，侏儒新手村（[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第五章）已经做完：11 月 19 日 Evan 交完了侏儒新手村和丹莫罗的全部主线（共 57 个任务，15 级），洛克莫丹的修复记在[《东部王国》](/Build-a-MoP-Server-4-Eastern-Kingdoms/)第五章。

死亡骑士新手村（[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第六章）已经做完：11 月 21 日 Kiv 走完了整条死亡骑士线，60 级。

被隐藏的对话选项（见 [《全局修复》2.8](/Build-a-MoP-Server-2-Global-Fixes/#28-被隐藏的对话选项全库排查3042-级第一批)、[《全局修复》2.9](/Build-a-MoP-Server-2-Global-Fixes/#29-被隐藏的对话选项荒芜之地第二批)）接着修：荒芜之地已经修完，下一批是 45 级以上的任务按钮，最后把剩下的商店、修理、住店、飞行入口一次批量恢复。

## 还没解决的问题

- **重建会丢修复。** 数据库修复都在 `sql-custom/`，重新导入世界库后必须按顺序重跑一遍。源码改动只在工作区和 `patches/` 里，`git pull` 之前要先想好怎么合并。
- **多人同时做同一个任务从没测过。** 每个修复都只用一个角色验证过，像 29799 这种全场共用的事件，中途加入或者几个人进度不同步，都还是未知数。
- **其他种族已知做不了的任务：** 地精的 14113、14153 Life of the Party（派对客人一个刷新点都没有），14110 The New You（物品没有任何来源）。这些暂时搁置。
- **赤脊山 26563 Return of the Bravo Company：** 前置任务和临时跟随者组合在一起，跳过 Weapons of War 的玩家拿不到（见 [《东部王国》2.3](/Build-a-MoP-Server-4-Eastern-Kingdoms/#23-实测反馈bravo-小队营救链断在第一环)），不挡主线，先不改。
- **赤脊山巨魔支线暂缓：** He Who Controls the Ettins（26519）的起始物品 Dirt-Stained Scroll 没有掉落来源（TDB 里由豺狼人掉，50%），后续 Saving Foreman Oslow（26520）控制巨魔搬石头的机制也完全没有脚本。不挡主线，用户决定先维持现状。
- **赤脊山第二期替代设计还没实测：** 坦克能不能开、炮能不能打、Darkblaze 的强度都还是未知数（见 [《东部王国》2.5](/Build-a-MoP-Server-4-Eastern-Kingdoms/#25-赤脊山后半段重建第二期)）。
- **下载具后不能跳。** Deadmines 的机器人和吉尔尼斯的马都出现过：下来以后不能跳，也走不下斜坡，重新登录可以恢复。11 月 15 日上线的"1.5 秒后补发恢复重力"实际上从来没生效过；11 月 20 日找到了原因，改了第二版，但还没在客户端真正卡住时验证过（见 [《新手村》3.1](/Build-a-MoP-Server-3-Starter-Zones/#31-吉尔尼斯城两段骑马任务和一个相位-bug)、[《新手村》6.2](/Build-a-MoP-Server-3-Starter-Zones/#62-into-the-realm-of-shadows接了任务又不能跳而且看不到任务怪)）。
- **狼人、地精新手村改成跳过。** 新建角色直接 12 级出现在达纳苏斯 / 奥格瑞玛（见 [《新手村》3.1](/Build-a-MoP-Server-3-Starter-Zones/#31-吉尔尼斯城两段骑马任务和一个相位-bug) 末尾），还没用真正新建的角色验证。吉尔尼斯里没修完的部分（191、194 号相位，Keel Harbor 弩车打不中、下车后飘在空中）暂时放着，只影响已经在里面的老角色。
- **[《全局修复》2.8](/Build-a-MoP-Server-2-Global-Fixes/#28-被隐藏的对话选项全库排查3042-级第一批)、[《全局修复》2.9](/Build-a-MoP-Server-2-Global-Fixes/#29-被隐藏的对话选项荒芜之地第二批) 两批还没在游戏里验证。** 11 月 18 日都已重启生效，启动日志干净，但还没上号逐个试过。[《全局修复》2.9](/Build-a-MoP-Server-2-Global-Fixes/#29-被隐藏的对话选项荒芜之地第二批) 里雕像变敌对后的强度、宝箱的位置也要实地看一眼。
- **剩下 14 个飞行点附近没有飞行管理员**（见 [《全局修复》2.11](/Build-a-MoP-Server-2-Global-Fixes/#211-飞行管理员站错地方或者干脆不存在) 末尾），包括潘达利亚的 4 个联盟点，还要逐个查。
- **两个阵营去潘达利亚的任务路线都不通**（见 [《全局修复》2.12](/Build-a-MoP-Server-2-Global-Fixes/#212-部落去潘达利亚传送门没有目的地)）：没有炮舰，船上将领的对话没有选项，部落蜜露村开场战斗缺 4 个 NPC，联盟 Paw'Don 村整个据点是空的。目前只能走传送门：奥格瑞玛荣誉谷、暴风城 Tushui 熊猫人那一片。
- **全局审计剩下的问题。** 联盟这边还有约 1000 个任务需要重建内容（见[《全局修复》](/Build-a-MoP-Server-2-Global-Fixes/)），按等级段从低到高逐批修。
- **光明点的炮只是基本修复**（见 [《新手村》6.4](/Build-a-MoP-Server-3-Starter-Zones/#64-massacre-at-lights-point炮弹出膛就炸基本修复)）：有些角度开炮仍会出膛就炸，多半是撞上了相邻的炮。11 月 21 日已改成弹道只让带"会挡导弹"类型标志的生物挡住，还没在游戏里验证。
- **11 月 9 日那次崩溃还没有结论。** 后来抓到的两个 core 都是关机时的另一个 bug（见 [2.3](#23-崩溃排查) 节，已修复）。`GetQuestStatus` 那次一直没有再出现，还在等它的 core。

熊猫人岛、矮人、侏儒和死亡骑士这四条新手线目前都能完整做完。接下来继续往后玩，遇到问题再接着修，这篇文章也会跟着更新。

## 修复进度统计

*统计时间：2026-11-27。每次修复后重新统计并更新这一节。*

统计范围是联盟角色能接到的普通任务（不含节日任务和可重复任务），共 5558 个，比 11 月 26 日多了 207 个：范围只算现在接得到的任务，这期间按 TDB 给几片区域补了刷新点（见[《全局修复》2.19](/Build-a-MoP-Server-2-Global-Fixes/#219-整片区域没刷怪按-tdb-补刷新点先补菲拉斯)、[2.20](/Build-a-MoP-Server-2-Global-Fixes/#220-补刷新点凄凉之地费伍德森林安戈洛环形山石爪山)），原来没有任务给予者的任务接得到了，范围和基数都跟着变大。11 月 21 日补上 1988 个任务的阵营限制后（见[《全局修复》2.14](/Build-a-MoP-Server-2-Global-Fixes/#214-两个阵营的任务谁都能接1988-个任务缺种族限制)），原来被误算进来的部落任务被排除，范围和基数都变小了。统计方法：先重跑[《全局修复》](/Build-a-MoP-Server-2-Global-Fixes/)里的审计脚本（`tools/quest_audit.py`），再用 `tools/quest_fix_stats.py` 和 11 月 13 日前两次审计的结果对比。

| 项目 | 任务数 | 占比 |
| --- | ---: | ---: |
| 审计查出过问题的任务（基数） | 1414 | 100% |
| 已修复（现在审计查不出问题） | 271 | 19.2% |
| 已禁用（交不了，见 [《全局修复》1.6](/Build-a-MoP-Server-2-Global-Fixes/#16-批次二禁用交不了的任务)） | 409 | 28.9% |
| 仍有问题，待修 | 734 | 51.9% |

已修复和已禁用加起来是 48.1%。从整体看，没禁用的 5144 个任务里，审计查不出问题的有 4410 个，占 85.7%。这个审计不检查施法焦点和任务隐身，这两类另见[《全局修复》2.15](/Build-a-MoP-Server-2-Global-Fixes/#215-看不见的-npc-和用不了的任务物品全库审计2039-级)、[2.17](/Build-a-MoP-Server-2-Global-Fixes/#217-看不见的-npc-和用不了的任务物品全库审计4049-级)。

这个数字是**下限**。审计脚本只看数据库，看不懂 C++ 脚本：任务目标或交任务 NPC 只出现在 C++ 里的，一律算"有问题"；靠新写脚本或重建场景修好的任务，脚本也认不出来。比如 14212 Sacrifices 已经在游戏里确认能做完，统计里仍算待修。
