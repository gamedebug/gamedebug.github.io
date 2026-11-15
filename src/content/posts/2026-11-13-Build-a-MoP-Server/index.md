---
title: "建造自己的魔兽世界（熊猫人之谜）"
date: 2026-11-13
slug: "Build-a-MoP-Server"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "用 SkyFire_548 在 AWS 上搭一台 5.4.8 熊猫人服务器，逐个修复熊猫人新手岛和矮人新手村的任务 bug，再用审计脚本对全库任务做批量修复。"
---

几年前我搭过一台巫妖王之怒（3.3.5）的服务器。这次换成熊猫人之谜（5.4.8），主要给家里的小朋友玩，所以用的是英文客户端，英文她读起来比中文顺。整个过程是我和 Claude Code 一起完成的：我负责在游戏里测试、提问题和做决定，它负责查源码、改配置、写补丁。

本文按时间顺序记录了到 2026-11-13 为止的工作，一共四章：

1. 服务器选型、基础设施搭建、服务端部署
2. 熊猫人新手岛（Wandering Isle）任务修复
3. 矮人新手村（Coldridge Valley / Dun Morogh）任务修复
4. 全局修复：全库任务审计和批量修复

## 第一章　选型、基础设施与服务端部署

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

### 1.3 目录和容器

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

### 1.4 部署时踩的坑

**1. 通过 SSH heredoc 写文件，单引号被吃掉了。** `db-init.sh` 里的 SQL 少了引号，数据库账号没建出来，authserver 一直报"访问被拒"。后来改成在本地写好文件，再用 scp 传上去。

**2. 世界库里写死了 `DEFINER`。** SFDB 27 的 dump 末尾有 61 个存储过程，都写着 `DEFINER=skyfire@localhost`。我们的账号是 `skyfire@%`，两者不匹配，MySQL 要求更高的权限，导入就中断了。解决办法是用 sed 去掉 DEFINER，生成 `world_base.nodefiner.sql`，再让 compose 挂载这份文件。这样存储过程都还在，也不需要给账号提权。

**3. 导入失败后又被自动重启，留下一个半成品库。** 更新器只要看到 world 库"不为空"，就会跳过基础导入，直接在残缺的库上继续跑更新。正确的处理是：删掉 world 和 characters 两个库，**临时关掉 worldserver 的自动重启**，重新导入；确认成功后，再把自动重启恢复成 `unless-stopped`。

导入成功后的数据：world 库有 180 张表、22.5 万个 NPC 刷新点、1.8 万个任务。日志里有约 500 条 "GUID not found" 之类的一致性警告，这是 SFDB 数据本身的小毛病，不影响运行。

### 1.5 客户端和地图数据

- **语言。** 服务器不限制客户端的语言，只要求版本是 18414，而且按每个连接的语言返回文本。但 SFDB 27 的 `locales_*` 表全是空的，用中文客户端会看到界面是中文、任务和 NPC 是英文的混排效果。我们本来就打算用英文客户端，所以这不是问题。
- **地图数据提取**直接在服务器上做：把客户端的 `Data` 目录（约 24 GB）传上去，用镜像里的工具依次提取：
  - mapextractor：dbc、db2、maps，约 1 分钟；
  - vmap4extractor + vmap4assembler：生成 vmaps，1.1 GB；
  - mmaps_generator：最慢的一步，2 核跑了约 **6.5 小时**，生成 3.1 GB。

  日志里有大量 `Can't open ... .wdt`，都来自 `test`、`development`、`Transport*` 这类开发用地图，可以忽略。mmaps 全部完成后，打开 `mmap.enablePathFinding = 1`，NPC 就会绕开障碍物走，不再穿墙。
- **服务器地址。** 熊猫人客户端已经没有 `realmlist.wtf` 文件了，服务器地址只写在 `WTF/Config.wtf` 里：`SET realmList "服务器地址"`。改的时候游戏要关着，否则退出游戏时会把你的修改覆盖掉。
- **连接补丁。** 5.4.8 的 `Wow.exe` 需要打连接补丁（SkyFire 仓库里的 `contrib/Client_Patch`，来自 Arctium 项目），否则登录不上。我用 Python 按补丁的字节模式检查了手上的 exe，发现它**已经打过补丁**：原始模式一个都匹配不上，叠加补丁字节后才各匹配到一处。如果这时再用原版工具打一遍，它会静默跳过所有模式，输出一个和原文件一模一样的 "Wow_Patched.exe"，你根本不会发现。来源不明的 exe 要先扫毒，也别在这个客户端里输入暴雪账号。

### 1.6 GM 账号和控制台

在 worldserver 控制台里创建账号（SkyFire 的参数顺序是"邮箱 用户名 密码"）：

```
account create <邮箱> <用户名> <密码>
account set gmlevel <用户名> 3 -1
```

小坑：Ubuntu 26.04 的 sudo 换成了 `sudo-rs`，它会在中间多套一层终端，用 `sudo docker attach` 进控制台后，`Ctrl+P Ctrl+Q` 退不出来。直接关掉 SSH 窗口是安全的：容器开着 tty 模式，断开 attach 不会把 worldserver 停掉。以后不加 sudo，并且换一个退出键：

```bash
docker attach --detach-keys="ctrl-x" mop-worldserver-1
```

### 1.7 方便自己人玩的配置

都写进了 `gen-config.sh`，重新生成配置也不会丢：

- 经验倍率：击杀 5 倍、探索 5 倍。任务经验一开始也是 5 倍，后来调回了 1 倍。
- 新角色初始金币 10 万金。
- `AllFlightPaths 1`：所有飞行点直接开放；`InstantFlightPaths 1`：飞行改成瞬间到达。后来发现它会把任务里的演出航线也变成瞬移，就改了源码，只让普通航线瞬间到达（见第三章 26094）。
- `PlayerSaveInterval 300000`：自动存档从 15 分钟一次改成 5 分钟一次（原因见 1.8 节 11 月 13 日那次重启）。
- `MaxPrimaryTradeSkill 10`：每个角色可以学全部主专业（默认 2 个）。核心在每次登录时按配置重新计算剩余的专业数，老角色也直接生效。注意英文客户端技能书的专业页只有两个主专业的位置，第三个以后不一定显示出来，但专业本身能用。
- 骑术、飞行许可和本阵营所有坐骑写进 `playercreateinfo_spell`，新建角色就有 36 格大包。

  这里有个意外发现：`playercreateinfo_spell` 不只在创建角色时生效，**每次登录都会重新学一遍**（`Player::LoadFromDB` → `learnDefaultSpells`），所以老角色也都拿到了。我们觉得这样挺好，就保留了。
- 每个出生点放了一个自制的装备商人（Newcomer Watcher），按职业只卖对应的装备。
- 顺手修了沙石幼龙：它的 `VehicleId` 是 0，不能带乘客。根据 Vehicle.dbc 选了一个空闲的双座载具 ID 填上，现在队友也能坐上去了。

### 1.8 崩溃排查

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

### 1.9 修任务的工作方式

修之前我先确认了一件事：核心和 SFDB 都已经是上游最新版本，所以**等上游更新是修不好这些任务的**。另外，通用的任务物品掉落是正常的（20 个各种族的"收集掉落物"任务都完成了），坏的都是个别任务的数据或脚本。于是定了几条规矩：

- **只修"真的坏了"的，不降低难度。** 缺 NPC、缺脚本、缺刷新点、进度根本拿不到，这些算坏了，要修。东西难找、需要自己动脑子的，保持原样，不加提示，也不挪位置。拿不准算哪一种时，先讨论再动手。
- 数据库修复写成 `sql-custom/日期_序号_名字.sql`，改之前先把相关的行导出到 `backup/`。以后重建数据库，要把这些文件按顺序重新执行一遍。
- 源码改动导出成 `patches/*.patch`。不卡进度的 C++ 改动先攒着，攒够一批再编译重启。
- 有两个热重载命令千万别用错：
  - `reload spell_area` 不会清空 `mSpellAreaForAreaMap`，会留下悬空指针（use-after-free）。改了 spell_area 就重启 worldserver，不要热重载。
  - `reload smart_scripts` 不会更新已经刷出来的生物，因为 SAI 在生物创建时就把脚本复制了一份。这种情况同样要重启。

  而 `reload conditions` 和 `reload quest_poi` 可以放心热重载。

## 第二章　熊猫人新手岛任务修复

熊猫人新手岛（Wandering Isle）是这个服务器里问题最集中的地方。查了很久才找到根源：上游的 **commit `2f8c98dc67`（"Drop dead code"）把新手岛的一大批 NPC 脚本当成死代码删掉了**，但数据库里这些 NPC 的 `ScriptName` 还留着。结果就是 NPC 站在那里，什么都不做。之后再遇到"有 ScriptName 却找不到代码"的新手岛 NPC，第一步就是 `git show 2f8c98dc67`，把原来的代码找回来。

第二个大问题是**相位（phase）**，后面好几个任务都栽在这上面。

### 29423 The Passion of Shen-zin Su：Huo 下线就丢，相位不刷新

- **现象：** 要护送火精灵 Huo 回神庙，下线再上线 Huo 就没了，任务卡住。
- **原因：**
  1. Huo 是法术 128700 召唤出来的临时守护者，下线时会消失，但 128700 的光环还保存在角色身上，所以系统不会再召唤一次。
  2. 交付进度靠区域触发器 AT 7835 的一次性脚本，要求 Huo 在 15 码以内，很容易错过。
  3. **核心的相位 bug：** `UpdateAreaPhase` 只会在进入区域时加上 `phase_area` 定义的相位，离开时从不移除；接任务、交任务时也不会重新计算区域相位，只有重新登录才会。
- **修复：**
  - 新增一个 PlayerScript，登录时如果有 128700 光环就重新召唤 Huo；
  - 把交付逻辑抽成一个共用函数，判定半径放宽到 40 码，再加一个"看见 Shang Xi 就交付"的兜底；
  - 在 `Object.cpp` 里补上离开区域时移除相位的逻辑，并在接任务、设置任务状态、交任务、放弃任务时重新计算区域相位。注意不能放进 `UpdatePhasing`：移除相位光环时会调用它，结果又会把相位加回来。

### 29663 Lesson of the Balanced Rock：被删掉的脚本

站在木桩上的 Tushui 武僧（55019）的脚本被上游删掉了。我把它恢复了：武僧会自动站上 8 码内最近的空木桩，被打败后消失；同时把它们的游荡改成原地不动。顺带一提，同一组的 29661 Lesson of Dry Fur 其实没坏，只是没找到那口铃铛。

### 31450 A New Fate：选阵营的灵魂不能对话，交任务的 NPC 不存在

- **对话：** Master Shang Xi 的灵魂（56013）的 `npcflag` 只有任务标记，没有对话标记。任务图标消失后，玩家就点不出对话了。补上对话标记后，选阵营的界面能弹出来，传送去暴风城或奥格瑞玛也正常。
- **交任务：** 两边负责交任务的 Aysa（60566，联盟）和 Ji（60570，部落）**在数据库里根本没有刷新点**。我把他们刷在传送落地点前方 4 码处。暴风城的落地点在城市建筑模型（WMO）上面，地形高度比实际站立高度低了将近 30 码，所以 z 坐标要用建筑表面的高度。

### 29678 Shu, the Spirit of Water：跳石头跳回原地

河里的跳石是陷阱型游戏对象，踩上去会强制施放 Rock Jump A/B/C。脚本里调用了 `MoveJump`，但法术默认的 `EffectJumpDest` 效果会在之后执行。因为 DEST_DB 类型的目标在 `spell_target_position` 表里没有数据，默认效果就把玩家"跳到自己身上"，覆盖掉了脚本的跳跃。在三个法术脚本里加上 `PreventHitDefaultEffect` 就好了。

### 29770 Still Good!：不是 bug

要收集的南瓜（Pilfered Pumpkins，17 个）在地鼠洞（Virmen Grotto）里，不在旁边那片装饰用的南瓜田。这个算"难但能做"，保持原样，最后靠自己找到了。

### 29792 Bidden to Greatness：护送脚本被删

原来的护送脚本 `mob_mandori_escort` 被删掉了。我没有完整还原护送过程，而是写了一个区域触发器脚本：任务未完成时走到 Mandori 门口给一个进度，走到 Pei-Wu 门口再给一个。流程比原版简单，但任务能完成了。

### 29794 None Left Behind：背伤员

- 恢复了受伤水手（55999）的脚本：右键水手，他会坐上玩家的"载具位"让你背着走；送到 Delora 旁边，任务进度加一，水手道谢后消失。
- 第一次测试时水手背上了，但交付点没反应。原因是**玩家处于载具状态时，客户端似乎不发送 `CMSG_AREATRIGGER`**。于是改成由水手的 AI 自己判断：离交付点 15 码以内就算送到。

### 30767 Risking It All：没有路径点的护送

原版的护送 NPC 和对话都被删掉了，数据库里也没有路径点。我做了个简化版：玩家任务未完成、走到坠毁的飞艇边时，直接给进度，播放动画（movie 117），1 秒后把玩家传送到坡下交任务的 Ji 身边。没有原版的对话。

### 29799 The Healing of Shen-zin Su：治疗事件

恢复了 Ji（57739）的事件脚本和治疗者（60878/60896）。附近有任务未完成的玩家时，持续召唤治疗者和来捣乱的鱼人（Deepscale Fleshrippers）。每 3 秒按存活的治疗者数量累计进度，通过替代能量条显示，到 700 就完成，大约 3 到 5 分钟。

### 29786 Battle for the Skies：Boss 看不见，还卡在 Evade

- **看不见：** 接任务后，Aysa 把玩家放进了相位 524（为了显示炮台），而 Zhao-Ren 在相位 0。按 `WorldObject::IsPhased` 的规则，玩家的相位列表必须为空或包含 169，才看得见相位 0 的对象。重新登录能看见 Zhao-Ren，但炮台又没了。修复方法是：接任务时同时加上相位 169，再用 `phase_area` 规则保证任务期间该区域是 169 + 524。
- **Evade：** 所有攻击都显示 "Evade"。`EnterEvadeMode` 先设置 `UNIT_STATE_EVADE`，然后让它飞回出生点；但 `Reset()` 清掉了移动，回家的移动没到终点就结束了，Evade 状态也就永远不会被清除。修复是：在 `Reset` 里清除这个状态，并重写 `EnterEvadeMode`，让它不再飞回出生点。

### 29421 Only the Worthy Shall Pass：一刀秒杀导致 NPC 消失

- **现象：** 打完 Li Fei，负责交任务的 Li Fei 不见了，要重新登录才出来。
- **原因：** 我们的装备太好，一下就把 Li Fei 从 20% 以上的血量直接打死了。智能脚本（SAI）里"血量在 1%–20% 之间时给进度并切换相位"的事件根本没有触发。击杀本身让任务完成了，但玩家还留在旧相位 631 里。
- **修复：** 纯 SQL，加了两个死亡事件，在 Li Fei 死亡时给击杀者切换相位；顺便修了一条接反了的事件链接。SAI 在生物创建时就复制了脚本，热重载对已经刷出来的 Li Fei 无效，所以要重启。

### 29679 A New Friend：水精跳到远处就停了（实测抽检）

这一段是跟着水精 Shu 在倒影池里追水柱：Shu 随机跳到 4 个池边位置之一，2 秒后在身边召出水柱，7 秒后喷发，踩在上面的玩家计数。脚本（`npc_shu_pool_of_reflection`）是在的，问题在它的"还有没有人在玩"检查：每轮水柱消失后只在 Shu 周围 **20 码**内找接了任务的玩家，找不到就停；重新启动也要求玩家走进这 20 码。可 4 个跳点之间隔着 20–50 码，玩家只要没紧贴着 Shu，它跳到远处就停住了——实测时角色在池子西边缘，离最近的跳点也有 28 码。把半径改成 60 码，覆盖整个池子（补丁 `patches/2026_11_13_05_zone_wandering_island_cumulative_incl_shu_pool_radius.patch`）。

### 29775 The Spirit and Body of Shen-zin Su：牛车点了没反应（实测抽检）

任务说"路边有辆车等着送你去神庙"。车就在 Dai-Lo 农场，鼠标移上去有上车的箭头，但点了没反应。新手岛一共有三个这样的牛车站：Singing Pools → Dai-Lo 农场、Dai-Lo 农场 → 神庙、天火号坠毁点 → 神庙。三个站的问题完全一样：

- **点击法术不对。**路边那辆车点击时施放的是通用的"骑乘载具"（46598），可它本身不是载具，所以什么都不发生。法术数据里其实有正确的法术，比如 114453 "Summon Ox Cart, Farmlands -> Temple"：在路边那辆车的位置召出一辆能坐人的车（59496），把点击的人放上车，再触发 114454 在旁边那头牦牛的位置召出一头会走路的牦牛（59498）；
- **召唤位置缺条件。**这两个法术的目标类型是"附近某个 NPC"（46），必须用条件指明是哪个 NPC，没有条件就找不到目标、什么都不召。补上：车召在路边那辆车的位置，牦牛召在旁边那头牦牛的位置；
- **没有路线。**上游原来的脚本（`spell_grab_carriage`、`npc_nourished_yak`）已经被当作死代码删掉了，而且从来没有路线数据（`script_waypoint` 是空的）。

路线我没有手画，而是又写了一个小工具 **navpath**（`tools/navpath/`），做法和 vmapcheck 一样：用服务端自带的 Detour 寻路库，直接读服务端的寻路网格（mmaps），算出两点之间真正能走的路，每 5 码取一个点，每个点都贴到网格表面上。三条路线分别是 488、554、699 码（101、124、145 个路点），只走地面不走水。去神庙的两条都停在神庙大台阶脚下。

行为全部用 SmartAI 实现：牦牛被召出来就沿路线走；车 0.5 秒后跟在牦牛后面；牦牛走到终点时把车收掉（乘客自动下车），自己再消失。召唤物只存在 5 分钟，最长那条按默认步行速度要 280 秒，太紧，所以牦牛和车的步行速度加倍，最长约 140 秒。文件是 `sql-custom/2026_11_13_42_wandering_isle_ox_carts.sql`，由 `tools/gen_ox_carts.py` 生成。

实测：Dai-Lo 农场这一站可以上车，牦牛拉着车一路走到神庙台阶下放人。

### 再回到 29423：相位 632 一直不走

上面那段 Li Fei 脚本会把玩家放进相位 632，但没有任何地方再把它移除。结果是所有相位 0 的 NPC 都看不见，包括神庙里的 Shang Xi，所以 Huo 交付不了，任务也交不了。修复方法是：在 Huo 的接任务回调里先移除 632 并刷新相位，再给祝福、召唤 Huo。

### 小结

| 类别 | 任务 |
|---|---|
| 上游误删脚本，已恢复或简化重写 | 29663、29792、29794、30767、29799 |
| 相位问题 | 29423（两处）、29786、29421 |
| 核心通用 bug | 区域相位不刷新、跳石法术默认效果、Evade 状态卡住 |
| 数据缺失 | 31450（对话标记、两个交任务 NPC 没有刷新点） |
| 不是 bug | 29770、29661 |

## 第三章　矮人新手村任务修复

矮人这条线的问题，比熊猫人岛的"零散"：很少有整段脚本被删，多数是**某个 NPC、某条条件、某个阵营值缺了**。大部分改 SQL 就够了，只有两个任务要写 C++。

### 24477 Dwarven Artifacts：箱子"已被使用"（全服修复）

- **现象：** 点矮人文物的箱子，客户端提示 "That is already being used"。
- **原因：** 全库有 **126 个宝箱类游戏对象（type 3）的刷新状态 `state` 是 0**，而客户端把 0 理解成"正在被使用"。潘达利亚的矿点、草点也在其中。
- **修复：** 统一改成 1。这是本服务器的第一个数据修复，对全服生效。

### 24489 Trolling for Information：偷听不到巨魔说话

任务要求站在巨魔祭司旁边偷听。偷听靠的是区域光环 69991，但它在 `spell_area` 里的 `autocast` 是 0，而所有任务相关的行里只有这一行是 0。改成 1 以后就正常了。这个光环是隐藏的，没有增益图标，需要站在祭司 10 码以内。

**教训：** 一开始我用 `reload spell_area` 热重载，读了源码才发现它不会清空内部映射表，会留下悬空指针。之后凡是改 spell_area，一律重启 worldserver。

### 412 Operation Recombobulation：地图标错了位置

任务本身没坏：要收集的齿轮（Gyromechanic Gear）是 Frostmane Scavenger 100% 掉落的任务物品。但 `quest_poi_points` 里的地图标记指向了 New Tinkertown，那是侏儒任务 26222 收集零件的区域，数据被抄错了。我把 POI 重画到 Frostmane Front，用 `reload quest_poi` 热重载就生效了。后来发现当时看错位置，主要是地图插件标错了，但服务端的数据确实是错的，所以修复保留。SFDB 里可能还有别的任务 POI 也是这样抄错的。

### 25839 The Ultrasafe Personnel Launcher：发射器点了没反应

- **原因：** 两台发射器（41398）没有 `npcflag`，没有右键施法，也没有任何脚本，点了什么都不会发生。这个任务没有任务目标，只能靠法术 77393 完成：它会把玩家击飞，空中给一个降落伞，最后直接完成任务。
- **难点：** 77393 是对自己施放的击退。核心对"击退自己"会**随机挑一个方向**（`Position::GetSinCos`），玩家可能被弹到任何地方。
- **修复：**
  - SQL：给发射器加上右键施法，条件是接了任务且未完成；
  - C++：新增法术脚本 `spell_q25839_ultrasafe_personnel_launcher`，击飞方向取最近那台发射器的朝向。两台发射器本来就朝着目的地，这样每次都能飞到对的地方。

### 28868 The View from Down Here：把自己缩小了

望远镜道具（Viewpoint Equalizer）施放的法术 93773 能把目标缩小 55%，但它的目标类型是"任意单位"，又没有任何限制。没选中目标时，就把玩家自己缩小了，而且这个光环是永久的（持续时间 -1，会存进 `character_aura`）。修复方法是加一条条件，限定目标只能是 Frostmane Builder。至于已经缩小的角色，要在离线时删掉那条光环记录。

### 25841 Strike From Above：信号弹打不出效果

信号弹（Signal Flare）施放的法术 77488 是"附近指定 NPC"类型，但缺了限定目标的条件（conditions 类型 13），南北两个标记点的 NPC 也没有任何 AI。补上条件后，再用 SAI 写成"被法术命中 → 给施法者击杀进度"。原版的飞机飞过轰炸动画没有重做。

### 25905 Rams on the Lam：吹口哨唤不回山羊

走失的山羊（Stolen Ram，26 只）没有 AI。用 SAI 补上：收到 `/whistle` 表情时给进度，跟着玩家走 4 秒后消失。注意表情只会发给当前选中的目标，所以要先选中山羊再吹口哨。

### 25932 It's Raid Night Every Night：整个事件不存在

这个任务完全没有事件数据：负责计数的 NPC 一个刷新点都没有，也没有 AI；相关的法术没有被任何地方用到；数据库里那个突袭者（41603）只是一个 1 级友好的占位 NPC。只能自己写：

- 新建 `zone_dun_morogh.cpp`，加进 CMakeLists 和 ScriptLoader；
- Sergeant Flinthammer（41578）：玩家接任务时，或者带着这个任务走到他 30 码以内时，就开始事件。一共 3 波，每波 3 个巨魔，从西边营地方向出来攻击玩家；一波死光 8 秒后来下一波，三波都打完，就给 150 码内的参与者计数；
- 如果附近已经没有有效的参与者，或者事件超过 6 分钟，就收场清理。

波数和每波人数是我们估计的，原版的数值查不到。

### 25997 Dark Iron Scheming：掉任务物品的队长不存在

图纸是 Captain Beld 100% 掉落的，但 Beld **一个刷新点都没有**。我参考任务 POI 和旁边黑铁间谍的位置，把他刷在了建筑里面。

### 25978 Entombed in Ice：冰块打不动

被冻住的山地人会召唤一个冰块（Icy Tomb 41768），任务要你把冰块打碎。但召唤属性沿用了模板阵营 35（友好），冰块打不动。把它的阵营改成 7（中立，可以攻击）就好了。

### 26078 Extinguish the Fires：大部分火点扑不灭

- **现象：** 铁炉堡机场一共 15 个起火点，只扑灭了两个。
- **机制：** 灭火装备放出的法术 78369 是"面前 10 码扇形"的空效果（DUMMY），命中隐形的计数 NPC（Burning Bomber Credit 42046）后，由它的 SAI 给进度。
- **排除过的方向：** 法术的区域限制（所有火点都在允许的区域里），以及命中数量上限（没有设）。
- **原因：** 大部分计数 NPC 离地 1–4 码，正好嵌在燃烧的轰炸机残骸模型里。核心在 `Spell::CheckEffectTarget` 里会做视线（LOS）检查，残骸模型挡住了视线，法术就跳过它们。能扑灭的正好是贴在地面上的那两三个。
- **修复：** 在 `disables` 表里只给这一个法术关掉视线检查（flags 64 = `SPELL_DISABLE_LOS`，法术本身不受影响），用 `reload disables` 热加载。库里本来就有同样的写法，注释是"bunnies sit inside the towers"。

### 26085 Rallying the Defenders：插完旗人物和镜头卡一下

- **现象：** 旗子能插，任务也能完成，但每次插完人物和镜头都会卡一下。
- **原因：** 插旗法术 78395 有三个效果：在目标物体（雪堆 Loose Snow，也是施法焦点）上立旗、碰一下雪堆、触发计数。核心按顺序处理效果，立旗（效果 0，`TRANS_DOOR`）时，雪堆的位置还没被记成目的地（要到效果 2 才设），于是 `EffectTransmitted` 退回用施法者的位置——**旗子直接立在了角色身上**，角色卡进旗子的碰撞模型，镜头也撞上去。
- **修复（C++）：** 效果的目标如果是一个游戏物体，就把旗子立在那个物体的位置上。我把整个法术库扫了一遍，用"在目标物体上生成物体"这种写法的只有这一个法术，改动不会波及别的法术。补丁：`patches/2026_11_13_03_plant_banner_on_snow.patch`。

### 26094 Striking Back：轰炸机点了没反应

- **原因：** 跑道起点那架修好的轰炸机（Repaired Bomber 42092）没有右键施法，点上去什么都不会发生。按原设计，点它会放法术 78510，把玩家送上一条绕机场一圈的专用航线（2203，起点终点都是节点 575，坐骑是 42097）。飞行中用任务给的炸弹（Iron Hammer Bomb，78499）炸地面上的黑铁矮人。
- **还有两个坑：**
  1. 炸弹是"落点 10 码内所有指定 NPC"类型，却没有任何条件，会把机场上友方的卫兵、山地人一起炸到；
  2. 我们开的 `InstantFlightPaths` 对这条航线也生效：起点和终点是同一个点，玩家会被直接传回原地，根本飞不起来。
- **修复：**
  - SQL：轰炸机加右键施法（条件：接了任务且未完成），炸弹只对黑铁一方生效（火焰术士、入侵者、两种魔像、General Grimaxe）；
  - C++：`Player::ActivateTaxiPathTo` 里，瞬间飞行只对普通航线生效。由法术触发的航线是任务演出，要真正飞完全程（补丁 `patches/2026_11_13_04_instant_taxi_not_for_spell_flights.patch`）。

顺带一提：`Player.cpp` 是 CRLF 换行，第一次用 Python 打补丁时整个文件被转成了 LF，diff 有四万多行。退回后改用 `open(..., newline="")` 重新打，最终改动只有 3 行。

### 26102 Grimaxe's Demise：将军打不动

General Grimaxe（42010）站在他的黑铁魔像（42008）头顶上，模板里带着"对玩家免疫"的标志（`IMMUNE_TO_PC | IMMUNE_TO_NPC`），而魔像、Grimaxe 和配套的控制 NPC 都**没有任何脚本**，所以他永远打不动。修法是用 SAI 重建一个流程：先打死魔像，Grimaxe 解除免疫，喊一句话后冲向最近的玩家。

这个"先打魔像"的流程是我们根据数据推测的，原版细节查不到。

### 26118 Seize the Ambassador：带不走大使

- **机制：** 对大使（Ambassador Slaghammer 42146）使用手铐，法术 78628 会召唤一个"被押解的大使"（42153）。任务是事件型的，完成要靠法术 78642（Credit for Arresting Slaghammer，目标是"召唤者"）。
- **原因：** 召唤属性 2967 在核心里落到普通召唤分支，被押解的大使只会站着不动；整个库里也没有任何东西会施放 78642，任务永远完成不了。原来那个大使也不会消失，会出现两个。
- **修复（SQL + SAI）：**
  - 手铐只能对大使用，并且要接了任务；
  - 原来的大使被铐住后消失（2 分钟后刷新，别人也能做）；
  - 被押解的大使跟着玩家走，走到 Moira Thaurissan 10 码以内时，自己施放 78642（玩家拿到完成），说一句话后消失。

### 小结

| 类别 | 任务 |
|---|---|
| 缺 NPC 刷新点 | 25997 |
| 缺 AI 或脚本，用 SAI 补 | 25841、25905、26102、26118 |
| 缺整段事件，用 C++ 重写 | 25932 |
| 法术目标、条件不对 | 28868、25841、25839（加 C++ 定方向）、26094 |
| 核心通用 bug | 26085（目标物体上生成物体）、26094（瞬间飞行吃掉任务航线） |
| 视线被模型挡住 | 26078 |
| 数据值写错 | 24477（全服 126 个箱子）、24489、25978、412 |

## 第四章　全局修复

一个个任务边做边修，效率太低：小朋友卡住了，我才去查，查完再编译重启。做完矮人新手村后，我们换了策略：**把前面修过的 bug 归类，每一类写成一个自动检测，扫一遍全库所有任务，提前把问题找出来批量处理。**

### 4.1 种族限制（全服）

这个问题是给两个 GM 角色批量标记任务时顺带发现的。`quest_template.RequiredRaces` 里有 2224 个联盟任务写的是 1101（人类、矮人、暗夜精灵、侏儒、德莱尼），2027 个部落任务写的是 690（兽人、亡灵、牛头人、巨魔、血精灵）。这些都是大灾变之前的老掩码，不包含**狼人、地精和两边的熊猫人**。核心的 `SatisfyQuestRace` 只是简单按位比较，所以这几个种族根本接不了这些任务。

修法是一条规则：只要掩码包含了某个阵营**全部**的老种族，就把这个阵营的新种族补上。按这个规则改了 4349 个任务和 30 条阵营区域光环（`spell_area`，比如达拉然的阵营设定、冰冠堡垒的阵营增益、冬拥湖）。

有两处要单独处理：

- `conditions.ConditionValue1` 是 MEDIUMINT，存不下熊猫人那几位的种族位。唯一受影响的是儿童周任务 558 的接取条件，改成了"阵营 = 联盟"。
- 13 个任务用的是"某阵营减去一个种族"的掩码（77 = 联盟减德莱尼，178 = 部落减血精灵，255 = 前 8 个老种族）。它们是故意排除那个种族的，因为那个种族有自己专用的一版任务。这些也补上了新种族，但原本排除的种族照旧排除，否则那个种族会看到两份重复的任务。

文件：`sql-custom/2026_11_13_07_faction_race_masks.sql`（可以重复执行）。

### 4.2 审计脚本

`tools/quest_audit.py` 是只读的，跑一遍大约两分钟，结果写到 `audit/quest_audit.json`。它把前面遇到过的 bug 都变成了检测：

| 检测 | 对应前面的例子 |
|---|---|
| 交任务的 NPC/物体没有刷新点，也不会被任何法术、SAI、脚本召唤 | 31450 A New Fate |
| 要杀/要互动的 NPC 不存在，也没有任何替代计数方式（KillCredit、计数法术、SAI 计数、老式脚本计数） | 25932 Raid Night |
| 计数法术存在，但没有任何东西会施放它 | 26118 押解大使 |
| 要收集的物品没有来源：掉落它的怪不存在，或者掉落表是空的 | 25997 Captain Beld |
| 事件型任务没有任何东西触发完成 | 26118 |
| 要击杀的目标带免疫标志，又没有脚本能解除 | 26102 Grimaxe |
| 任务物品的法术按编号挑目标却没有条件，而且效果有害（伤害、缩小、变形）或会放错位置 | 28868、26094 |
| 数据库里的 `ScriptName` 在 C++ 里找不到 | 新手岛 `2f8c98dc67` |
| 有点击法术却没有点击标记的 NPC；任务物体的刷新状态不对 | 25839、24477 |

"有没有被引用"的判断用的是：全库的召唤法术、SAI 动作、老式脚本命令，加上把 C++ 源码里所有数字都收集起来做兜底（C++ 里写了这个编号，就当它可能被代码处理了）。

### 4.3 校准：先把误报压下去

第一轮跑出来的数字吓人：1416 个任务的发任务 NPC 不存在，2175 个交不了。抽样一看，误报的来源很清楚：

- **大灾变删掉的旧任务。** 凄凉之地、费伍德、丹莫罗的很多旧任务在库里还有记录，但发任务的 NPC 早就不在了。玩家根本接不到，不是 bug。于是加了"可接性"计算：发任务的 NPC/物体在场，或者起始物品拿得到，或者前置任务能做完，才算玩家能接到。只对能接到的任务报问题，另外单独找"前置能做、后续却接不到"的断链。
- **对立阵营。** 没有种族限制的任务，有不少其实是部落 NPC 发的。按发任务 NPC 的阵营模板（FactionTemplate）判断敌对，过滤掉。
- **物体施放的法术。** 熊猫人新手岛的铃铛、卷轴、火盆，计数法术是玩家点物体时由物体施放的（goober 的 data10、spellcaster 的 data0 等），一开始没算进去。
- **无害的标记法术。** 灭火这类"空效果命中计数 NPC"的法术，没条件也能工作，只是会顺带标记旁边的单位。只把伤害、缩小、变形、以及"放错位置"的情况算作问题。
- **载具。** `Vehicle::Vehicle` 会根据座位自动加上点击标记，218 个"缺点击标记"里绝大多数是载具，真正缺的只有十几个。

- **前置任务。** 后来修暴风城的 29399 Shopping Around 时才发现：发任务的 NPC 在场，不代表能接到。29399 要先做完 29398，而 29398 的发任务人根本没有刷新点。于是"可接性"又加了一条：前置任务（`PrevQuestId`，以及 `NextQuestId` 指向它的任务）也必须能接到，迭代到不再变化为止。能接到的任务从 8899 降到 8597，联盟剩余的阻塞任务从 846 降到 734。

校准的标准是：**玩家实际做完过的任务**（排除两个批量标记的 GM 角色）一定是好的，如果审计把它们标成有问题，就是误报。最后几类核心检测在这个对照上都是零误报。抽查剩下的条目，也都是真问题，比如黑海岸 13518 The Last Wave of Survivors 要救的 4 个幸存者全库都没有刷新点，贫瘠之地 King Reaperclaw 有刷新点但掉落表是空的，任务要的角永远拿不到。

### 4.4 审计结果

联盟能接、非日常非节日的任务里，有明确阻塞问题的一共 **1354 个**：

| 问题 | 任务数 |
|---|---|
| 交任务的 NPC 不在场或不存在 | 约 500 |
| 要杀/互动的目标不存在 | 630 |
| 要收集的物品没有来源 | 379 |
| 要击杀的目标被设成免疫 | 216 |
| 事件型任务没有触发 | 41 |
| 其他（物体缺失、断链、物品法术） | 约 50 |

60 级以下大约 550 个，80 级以上（大灾变、熊猫人区域）大约 620 个。丹莫罗、洛克莫丹基本干净，问题集中在千针石林、荆棘谷海角、凄凉之地、燃烧平原、荒芜之地、东西瘟疫之地这些区域。

处理方针是我定的：

1. **能接到却交不了的任务，直接禁用**，让玩家接不到，免得白做；
2. 其余需要重建内容的问题，**按等级段从低到高**一批批修；
3. 机械性的标志错误马上修。

下面每一批都附上逐项清单。

### 4.5 批次一：机械性修复

文件：`sql-custom/2026_11_13_12_audit_mechanical_flags.sql`，备份：`backup/audit_mechanical_20261113.tsv`。

- 16 个**非载具** NPC 有点击法术却没有点击标记（`npcflag | 16777216`），点了没反应。只配了"骑乘载具"法术（46598、43671、66245）、本身又不是载具的跳过了，加标记也没用。
- Time-Lost Shrine（222776，任务物体）13 个刷新点里有 5 个 `state = 0`，和 24477 的箱子是同一类问题，改成 1。

<details>
<summary>16 个补点击标记的 NPC</summary>

| NPC | 名称 | 刷新点 | 点击法术 |
|---|---|---|---|
| 24992 | The Big Gun | 0 | 45008 |
| 33498 | Maloric | 1 | 63126 |
| 36059 | Blood-filled Leech | 0 | 68291,68293 |
| 37227 | Teleport Portal | 0 | 70104 |
| 37966 | Undercity Love Boat | 0 | 69342 |
| 42716 | Stormbeak | 0 | 80690 |
| 43044 | Unexploded Artillery Shell | 0 | 80436 |
| 43747 | Hippogryph | 3 | 81877 |
| 45005 | Wyvern | 0 | 84071 |
| 47747 | Whisperwind Lasher | 0 | 89960 |
| 48457 | Tainted Squirrel | 0 | 90102 |
| 48520 | Crystalwing Stone Drake | 2 | 90287 |
| 48639 | Ruby Gemstone Cluster | 0 | 90644 |
| 49072 | Erunak Stonespeaker (1) | 0 | 69063 |
| 51391 | Throne of Tides Teleporter | 0 | 95284 |
| 51395 | Throne of Tides Teleporter | 0 | 95285 |

</details>

### 4.6 批次二：禁用交不了的任务

判定条件：玩家能接到这个任务，但它的每一个交任务 NPC/物体都没有刷新点，也不会被任何法术、SAI、脚本召唤，C++ 里也没有引用；或者干脆没有交任务方，又不是自动完成的任务。

- 用 `disables` 表禁用（`sourceType = 1`，注释 `auto-audit 2026-11-13: no reachable quest ender`），普通玩家接不到，GM 仍然可以接；
- 禁用之前确认过：没有任何玩家做完过这些任务，也没有人正接着；
- 依赖它的后续任务本来就做不了，禁用不会让情况更糟；
- `reload disables` 热加载就生效。

文件：`sql-custom/2026_11_13_13_audit_disable_uncompletable_quests.sql`，清单：`audit/disable_candidates.json`。

要特别注意其中的 31013 The Horde Way：这是部落熊猫人选完阵营后的下一个任务，交任务的 Garrosh Hellscream 在库里没有刷新点，按规则也禁用了。以后要走部落熊猫人线，需要回头补上。

<details>
<summary>666 个被禁用的任务（按等级排序）</summary>

| 任务 | 名称 | 等级 | 区域 | 原因 |
|---|---|---|---|---|
| 29382 | Thanks, But No Thanks | 0 | （任务分类 -22） | 无交任务 NPC |
| 29383 | Thanks, But No Thanks | 0 | （任务分类 -22） | 无交任务 NPC |
| 31013 | The Horde Way | 0 | Orgrimmar | 交任务方不存在：Garrosh Hellscream |
| 5805 | Welcome! | 1 | Northshire Abbey | 无交任务 NPC |
| 5841 | Welcome! | 1 | Coldridge Valley | 无交任务 NPC |
| 5843 | Welcome! | 1 | Valley of Trials | 无交任务 NPC |
| 5844 | Welcome! | 1 | Camp Narache | 无交任务 NPC |
| 5847 | Welcome! | 1 | Deathknell | 无交任务 NPC |
| 8547 | Welcome! | 1 | Sunstrider Isle | 无交任务 NPC |
| 9247 | The Keeper's Call | 1 | （任务分类 -368） | 无交任务 NPC |
| 9278 | Welcome! | 1 | Ammen Vale | 无交任务 NPC |
| 12278 | Brew of the Month Club | 1 | （任务分类 -370） | 无交任务 NPC |
| 12306 | Brew of the Month Club | 1 | （任务分类 -370） | 无交任务 NPC |
| 12781 | Welcome! | 1 | Acherus: The Ebon Hold | 无交任务 NPC |
| 14022 | Pilgrim's Bounty | 1 | （任务分类 -375） | 交任务方不存在：Gregory Tabor |
| 14036 | Pilgrim's Bounty | 1 | （任务分类 -375） | 交任务方不存在：Miles Standish |
| 14125 | 447 | 1 | Kezan | 交任务方不存在：Claims Adjuster |
| 31316 | Julia, The Pet Tamer | 1 | （任务分类 -394） | 交任务方不存在：Julia Stevens |
| 31812 | Zunta, The Pet Tamer | 1 | （任务分类 -394） | 交任务方不存在：Zunta |
| 31813 | Dagra the Fierce | 1 | （任务分类 -394） | 交任务方不存在：Dagra the Fierce |
| 31814 | Analynn | 1 | （任务分类 -394） | 交任务方不存在：Analynn |
| 31815 | Zonya the Sadist | 1 | （任务分类 -394） | 交任务方不存在：Zonya the Sadist |
| 31817 | Merda Stronghoof | 1 | （任务分类 -394） | 交任务方不存在：Merda Stronghoof |
| 31870 | Cassandra Kaboom | 1 | （任务分类 -394） | 交任务方不存在：Cassandra Kaboom |
| 31897 | Grand Master Trixxy | 1 | （任务分类 -394） | 交任务方不存在：Stone Cold Trixxy |
| 31915 | Grand Master Lydia Accoste | 1 | （任务分类 -394） | 交任务方不存在：Lydia Accoste |
| 31920 | Grand Master Antari | 1 | （任务分类 -394） | 交任务方不存在：Bloodknight Antari |
| 31928 | Grand Master Payne | 1 | （任务分类 -394） | 交任务方不存在：Major Payne |
| 31970 | Grand Master Obalis | 1 | （任务分类 -394） | 无交任务 NPC |
| 24970 | No Better Than the Zombies | 3 | Deathknell | 交任务方不存在：Darnell |
| 9130 | Goods from Silvermoon City | 5 | Eversong Woods | 交任务方不存在：Skymaster Brightdawn |
| 14128 | Return of the Highborne? | 8 | Azshara | 交任务方不存在：Malynea Skyreaver |
| 28517 | The Howling Oak | 8 | Darnassus | 交任务方不存在：Genn Greymane |
| 14161 | Basilisk Bashin' | 9 | Azshara | 交任务方不存在：Horzak Zignibble |
| 14162 | Report to Horzak | 9 | Azshara | 交任务方不存在：Horzak Zignibble |
| 14194 | Refleshification | 9 | Azshara | 交任务方不存在：Horzak Zignibble |
| 27045 | Waiting to Exsanguinate | 9 | Silverpine Forest | 交任务方不存在：Deathstalker Commander Belmont |
| 27056 | Belmont's Report | 9 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 7944 | Your Fortune Awaits You... | 10 | （任务分类 -364） | 交任务方不存在：Mysterious Wailing Caverns Chest |
| 7945 | Your Fortune Awaits You... | 10 | （任务分类 -364） | 交任务方不存在：Mysterious Tree Stump |
| 24453 | Private Chat | 10 | Azshara | 交任务方不存在：Private Worcester |
| 27096 | Orcs are in Order | 10 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 29403 | The Collector's Agent | 10 | （任务分类 -21） | 交任务方不存在：Stolen Crate |
| 29411 | What Now? | 10 | （任务分类 -21） | 交任务方不存在：Anson Hastings、Hudson Barnes |
| 29425 | Shopping Around | 10 | （任务分类 -21） | 交任务方不存在：Delian Sunshade |
| 29426 | Taking Precautions | 10 | （任务分类 -21） | 交任务方不存在：Delian Sunshade |
| 29427 | The Collector's Agent | 10 | （任务分类 -21） | 交任务方不存在：Stolen Crate |
| 14442 | My Favorite Subject | 11 | Azshara | 交任务方不存在：Subject Nine |
| 27098 | Lordaeron | 11 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27099 | No Escape | 11 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27181 | Excising the Taint | 11 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27193 | Seek and Destroy | 11 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27194 | Cornered and Crushed! | 11 | Silverpine Forest | 交任务方不存在：Master Forteski |
| 14408 | Nine's Plan | 12 | Azshara | 交任务方不存在：Subject Nine |
| 14422 | Raptor Raptor Rocket | 12 | Azshara | 交任务方不存在：Subject Nine |
| 24448 | Field Promotion | 12 | Azshara | 交任务方不存在：Captain Tork |
| 13586 | The Emerald Dream | 13 | Darkshore | 交任务方不存在：Thessera |
| 27438 | The Great Escape | 13 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27475 | Unyielding Servitors | 14 | Silverpine Forest | 交任务方不存在：Daschla |
| 27484 | Only One May Enter | 14 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27513 | Transdimensional Warfare: Chapter II | 14 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 27518 | Transdimensional Warfare: Chapter III | 14 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 14296 | Watch Your Step | 15 | Azshara | 交任务方不存在：Image of Archmage Xylem |
| 14413 | The Pinnacle of Learning | 15 | Azshara | 交任务方不存在：Image of Archmage Xylem |
| 26567 | John J. Keeshan | 15 | Redridge Mountains | 交任务方不存在：John J. Keeshan |
| 26878 | Disciples of Naralex | 15 | Wailing Caverns | 交任务方不存在：Nalpak |
| 27594 | On Her Majesty's Secret Service | 15 | Silverpine Forest | 交任务方不存在：Lady Sylvanas Windrunner |
| 29110 | Mor'shan Caravan Rescue | 15 | Northern Barrens | 交任务方不存在：Balgor Whipshank |
| 11886 | Unusual Activity | 16 | （任务分类 -369） | 交任务方不存在：Earthen Ring Guide |
| 11891 | An Innocent Disguise | 16 | （任务分类 -369） | 交任务方不存在：Earthen Ring Guide |
| 26607 | They Drew First Blood | 16 | Redridge Mountains | 交任务方不存在：John J. Keeshan |
| 26651 | To Win a War, You Gotta Become War | 16 | Redridge Mountains | 交任务方不存在：John J. Keeshan |
| 13900 | The Offering to Azshara | 17 | Darkshore | 交任务方不存在：Malfurion Stormrage |
| 26694 | The Grand Magus Doane | 17 | Redridge Mountains | 交任务方不存在：John J. Keeshan |
| 26714 | Darkblaze, Brood of the Worldbreaker | 17 | Redridge Mountains | 交任务方不存在：Colonel Troteman |
| 14475 | Grounded! | 18 | Azshara | 交任务方不存在：Bombardier Captain Smooks |
| 14476 | Rigged to Blow | 18 | Azshara | 交任务方不存在：Bombardier Captain Smooks |
| 13712 | To the Rescue! | 19 | Ashenvale | 交任务方不存在：Kadrak |
| 13798 | Rain of Destruction | 19 | Ashenvale | 交任务方不存在：Durak |
| 13805 | Pierce Their Heart! | 19 | Ashenvale | 交任务方不存在：Kadrak |
| 28206 | Little Girl Lost | 19 | Hillsbrad Foothills | 交任务方不存在：Johnny Awesome |
| 28237 | A Blight Upon the Land | 19 | Hillsbrad Foothills | 交任务方不存在：Master Apothecary Lydon |
| 325 | Armed and Ready | 20 | Duskwood | 无交任务 NPC |
| 14079 | Learn to Ride in Elwynn Forest | 20 | Elwynn Forest | 无交任务 NPC |
| 26882 | Blackfathom Villainy | 20 | Blackfathom Deeps | 交任务方不存在：Ashelan Northwood |
| 28344 | Can You Smell What the Lok'tar is Cooking? | 20 | Hillsbrad Foothills | 交任务方不存在：Kingslayer Orkus |
| 28345 | *Gurgle* HELP! *Gurgle* | 20 | Hillsbrad Foothills | 交任务方不存在：Kingslayer Orkus |
| 28348 | Stormpike Rendezvous | 20 | Hillsbrad Foothills | 交任务方不存在：Kingslayer Orkus |
| 28354 | Kasha Will Fly Again | 20 | Hillsbrad Foothills | 交任务方不存在：Kingslayer Orkus |
| 6922 | Baron Aquanis | 21 | Blackfathom Deeps | 交任务方不存在：Je'neu Sancrea |
| 13879 | Thunder Peak | 21 | Ashenvale | 交任务方不存在：Stikwad |
| 13888 | Vortex | 21 | Ashenvale | 交任务方不存在：Stikwad |
| 26754 | Morbent's Bane | 22 | Duskwood | 交任务方不存在：Sven Yorgen |
| 26894 | Blackfathom Deeps | 22 | Blackfathom Deeps | 交任务方不存在：Je'neu Sancrea |
| 26897 | Blackfathom Deeps | 22 | Blackfathom Deeps | 交任务方不存在：Sentinel Aluwyn |
| 26898 | Blackfathom Deeps | 22 | Blackfathom Deeps | 交任务方不存在：Sentinel Aluwyn |
| 824 | Je'neu of the Earthen Ring | 23 | Ashenvale | 交任务方不存在：Je'neu Sancrea |
| 26745 | Favored Skull | 24 | Northern Stranglethorn | 交任务方不存在：Osborn Obnoticus |
| 26746 | A Nose for This Sort of Thing | 24 | Northern Stranglethorn | 交任务方不存在：Osborn Obnoticus |
| 26747 | A Physical Specimen | 24 | Northern Stranglethorn | 交任务方不存在：Osborn Obnoticus |
| 26939 | The G-Team | 24 | Gnomeregan | 交任务方不存在：B.E Barechus |
| 26941 | The G-Team | 24 | Gnomeregan | 交任务方不存在：Face |
| 26942 | The G-Team | 24 | Gnomeregan | 交任务方不存在：Hann Ibal |
| 26101 | Might Makes Right | 26 | Stonetalon Mountains | 交任务方不存在：Overlord Krom'gar |
| 26943 | Home Sweet Gnome | 26 | Gnomeregan | 交任务方不存在：Murd Doc |
| 26944 | Exploring Gnomeregan | 26 | Gnomeregan | 交任务方不存在：Murd Doc |
| 1453 | Reclaimers' Business in Desolace | 27 | Ironforge | 交任务方不存在：Kreldig Ungor |
| 14184 | My Time Has Passed | 27 | Desolace | 交任务方不存在：Cerelia |
| 14188 | Avenge Furien! | 27 | Desolace | 交任务方不存在：Sorrem |
| 14189 | Translation | 27 | Desolace | 交任务方不存在：Ancient Tablets |
| 14191 | Furien's Footsteps | 27 | Desolace | 交任务方不存在：Ancient Tablets |
| 14193 | Nothing a Couple of Melons Won't Fix | 27 | Desolace | 交任务方不存在：Ancient Tablets |
| 14195 | All Becoming Clearer | 27 | Desolace | 交任务方不存在：Ancient Vortex Runestone |
| 14196 | Firestarter | 27 | Desolace | 交任务方不存在：Ancient Vortex Runestone |
| 14198 | Rider on the Storm | 27 | Desolace | 交任务方不存在：Cerelia |
| 14360 | Nothing a Couple of Melons Won't Fix | 27 | Desolace | 交任务方不存在：Ancient Tablets |
| 14384 | Rerouted! | 27 | Desolace | 交任务方不存在：Corporal Melkins |
| 25938 | Help for Desolace | 27 | Stonetalon Mountains | 交任务方不存在：Officer Jankie |
| 24504 | Clear the High Road | 28 | Southern Barrens | 交任务方不存在：Tunawa Stillwind |
| 26069 | Nura Pathfinder | 28 | Stonetalon Mountains | 交任务方不存在：Nura Pathfinder |
| 26982 | The Scarlet Monastery | 28 | Scarlet Monastery | 交任务方不存在：Joseph the Awakened |
| 26986 | Into the Scarlet Monastery | 28 | Scarlet Monastery | 交任务方不存在：Dark Ranger Velonara |
| 1392 | Noboru the Cudgel | 29 | Swamp of Sorrows | 无交任务 NPC |
| 14318 | Delicate Negotiations | 29 | Desolace | 交任务方不存在：Khan Kammah |
| 14325 | Will Work For Food | 29 | Desolace | 交任务方不存在：Khan Kammah |
| 14328 | Three Princes | 29 | Desolace | 交任务方不存在：Khan Shodo |
| 14329 | Not So Fast! | 29 | Desolace | 交任务方不存在：Khan Shodo |
| 28531 | Hero's Call: Desolace! | 29 | Desolace | 交任务方不存在：Officer Jankie |
| 28549 | Warchief's Command: Southern Barrens! | 29 | Southern Barrens | 交任务方不存在：Nura Pathfinder |
| 14330 | Behind Closed Doors | 30 | Desolace | 交任务方不存在：Kherrah |
| 14332 | Time For Change | 30 | Desolace | 交任务方不存在：Khan Leh'Prah |
| 14393 | Into the Fray! | 31 | Desolace | 交任务方不存在：Khan Leh'Prah |
| 26983 | Just Close Enough | 31 | Scarlet Monastery | 交任务方不存在：Joseph the Awakened |
| 26987 | The Right Way | 31 | Scarlet Monastery | 交任务方不存在：Dark Ranger Velonara |
| 25120 | Marley's Final Flight | 32 | Southern Barrens | 交任务方不存在：Marley Twinbraid |
| 25151 | He Needs Ale! | 32 | Southern Barrens | 交任务方不存在：Marley Twinbraid |
| 27235 | Renn McGill | 32 | Dustwallow Marsh | 交任务方不存在：Renn McGill |
| 27236 | Secondhand Diving Gear | 32 | Dustwallow Marsh | 交任务方不存在：Renn McGill |
| 27237 | Recover the Cargo! | 32 | Dustwallow Marsh | 交任务方不存在：Renn McGill |
| 25344 | Ogre Abduction | 34 | Feralas | 交任务方不存在：Swar'jan |
| 25454 | Perfect Yeti Hide | 34 | Feralas | 交任务方不存在：Jangdor Swiftstrider |
| 26988 | Moving Things Along | 34 | Scarlet Monastery | 交任务方不存在：Dark Ranger Velonara |
| 28510 | Warchief's Command: Feralas! | 34 | Feralas | 交任务方不存在：Konu Runetotem |
| 28511 | Hero's Call: Feralas! | 34 | Feralas | 交任务方不存在：Telaron Windflight |
| 25342 | Talk to Swar'jan | 35 | Feralas | 交任务方不存在：Swar'jan |
| 25451 | Pristine Yeti Hide | 35 | Feralas | 交任务方不存在：Pratt McGrubben |
| 25475 | Find OOX-22/FE! | 35 | Feralas | 交任务方不存在：Homing Robot OOX-22/FE |
| 25643 | The Darkmist Ruins | 35 | Feralas | 交任务方不存在：Empty Pedestal |
| 27677 | Archaedas, The Ancient Stone Watcher | 35 | Uldaman | 交任务方不存在：Lead Prospector Durdin |
| 27680 | Archaedas, The Ancient Stone Watcher | 35 | Uldaman | 交任务方不存在：High Examiner Tae'thelan Bloodwatcher |
| 25365 | Woodpaw Investigation | 36 | Feralas | 交任务方不存在：Woodpaw Battle Map |
| 25387 | To Camp Mojache | 36 | Feralas | 交任务方不存在：Chief Spirithorn |
| 26957 | The Long Trip Home | 36 | Western Plaguelands | 交任务方不存在：Del Gahrron |
| 27017 | Memories from a Lost Past | 36 | Western Plaguelands | 交任务方不存在：Del Gahrron |
| 26991 | Enemies Abroad | 37 | Scarlet Monastery | 交任务方不存在：Dark Ranger Velonara |
| 25479 | To New Thalanaar | 38 | Feralas | 交任务方不存在：Caryssia Moonhunter |
| 27130 | Saving Warpwood | 38 | Dire Maul | 交任务方不存在：Furgus Warpwood |
| 28142 | To the Withering | 38 | Thousand Needles | 交任务方不存在：Magatha Grimtotem |
| 27524 | Blind Fury | 39 | Eastern Plaguelands | 交任务方不存在：Tarenar Sunstrike |
| 27525 | Guardians of Stratholme | 39 | Eastern Plaguelands | 交任务方不存在：Tarenar Sunstrike |
| 28503 | Hero's Call: Thousand Needles! | 39 | Thousand Needles | 交任务方不存在：Caryssia Moonhunter |
| 11400 | Brewfest Riding Rams | 40 | （任务分类 -370） | 无交任务 NPC |
| 11419 | Brewfest Riding Rams | 40 | （任务分类 -370） | 无交任务 NPC |
| 27009 | The Coldbringer | 40 | Razorfen Downs | 交任务方不存在：Koristrasza |
| 27022 | Extinguishing the Idol | 40 | Razorfen Downs | 交任务方不存在：Belnistrasz's Brazier |
| 27132 | The Highborne | 41 | Dire Maul | 交任务方不存在：Estulan |
| 27062 | Looming Threat | 42 | Razorfen Downs | 交任务方不存在：Koristrasza |
| 25121 | Momentum | 44 | Tanaris | 交任务方不存在：Kelsey Steelspark |
| 27068 | Chief Ukorz Sandscalp | 44 | Zul'Farrak | 交任务方不存在：Mazoga's Spirit |
| 27134 | Ogre in the Field | 44 | Dire Maul | 交任务方不存在：Stonemaul Ogre |
| 27422 | A City Under Siege | 44 | Stratholme | 交任务方不存在：Packmaster Stonebruiser |
| 27769 | Rhea Revealed | 44 | Badlands | 交任务方不存在：Rheastrasza |
| 27890 | The Bad Dogs | 44 | Badlands | 交任务方不存在：Amakkar |
| 27912 | The Titans' Trove | 44 | Badlands | 交任务方不存在：Trove of the Watchers |
| 27913 | The Titans' Trove | 44 | Badlands | 交任务方不存在：Trove of the Watchers |
| 27930 | Devastation | 44 | Badlands | 交任务方不存在：Rhea's Final Note |
| 27995 | Dance for Ruumbo! | 44 | Felwood | 交任务方不存在：Grazle |
| 27997 | The Corruption of the Jadefire | 44 | Felwood | 交任务方不存在：Tenell Leafrunner |
| 28116 | Crying Violet | 44 | Felwood | 交任务方不存在：Andalar Shadevale |
| 28542 | Warchief's Command: Felwood! | 44 | Felwood | 交任务方不存在：Tenell Leafrunner |
| 28543 | Hero's Call: Felwood! | 44 | Felwood | 交任务方不存在：Tenell Leafrunner |
| 8470 | Deadwood Ritual Totem | 45 | Felwood | 交任务方不存在：Kernda |
| 9295 | Letter from the Front | 45 | （任务分类 -368） | 无交任务 NPC |
| 9299 | Note from the Front | 45 | （任务分类 -368） | 无交任务 NPC |
| 9304 | Document from the Front | 45 | （任务分类 -368） | 无交任务 NPC |
| 25061 | Land's End | 45 | Tanaris | 交任务方不存在：Kelsey Steelspark |
| 25556 | Into Zul'Farrak | 46 | Zul'Farrak | 交任务方不存在：Mazoga's Spirit |
| 27963 | A New Master... But Who? | 46 | Searing Gorge | 交任务方不存在：Jack Rockleg |
| 27964 | Dig-Boss Dinwhisker | 46 | Searing Gorge | 交任务方不存在：Jack Rockleg |
| 28512 | To the Aid of the Thorium Brotherhood | 46 | Searing Gorge | 交任务方不存在：Jack Rockleg |
| 28581 | Warchief's Command: Searing Gorge! | 47 | Searing Gorge | 交任务方不存在：Jack Rockleg |
| 28582 | Hero's Call: Searing Gorge! | 47 | Searing Gorge | 交任务方不存在：Jack Rockleg |
| 24690 | Blazerunner | 49 | Un'Goro Crater | 交任务方不存在：Williden Marshal |
| 24734 | Lost! | 49 | Un'Goro Crater | 交任务方不存在：Ringo's Sack |
| 24740 | Volcanic Activity | 49 | Un'Goro Crater | 交任务方不存在：Williden Marshal |
| 24911 | Tropical Paradise Beckons | 49 | Un'Goro Crater | 交任务方不存在：Williden Marshal |
| 28068 | Adventurers Wanted: Blackrock Depths | 49 | Blackrock Depths | 交任务方不存在：Morgan |
| 28174 | Burning Vengeance | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28183 | Return to Keeshan | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28202 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28203 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28204 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28205 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28253 | Taking the Horn For Ourselves | 49 | Burning Steppes | 交任务方不存在：Colonel Troteman |
| 28418 | Burning Vengeance | 49 | Burning Steppes | 交任务方不存在：Ariok |
| 28425 | Return to Ariok | 49 | Burning Steppes | 交任务方不存在：Ariok |
| 28428 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28429 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28430 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28431 | A Perfect Costume | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28434 | Strategic Cuts | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28436 | Taking the Horn For Ourselves | 49 | Burning Steppes | 交任务方不存在：Eitrigg |
| 28479 | The Ruins of Kel'Theril | 49 | Winterspring | 交任务方不存在：Kaldorei Spirit |
| 28513 | Pride of the Highborne | 49 | Winterspring | 交任务方不存在：Kaldorei Spirit |
| 28518 | Legacy of the High Elves | 49 | Winterspring | 交任务方不存在：Quel'dorei Spirit |
| 28525 | Hero's Call: Un'Goro Crater! | 49 | Un'Goro Crater | 交任务方不存在：Williden Marshal |
| 28526 | Warchief's Command: Un'Goro Crater! | 49 | Un'Goro Crater | 交任务方不存在：Williden Marshal |
| 28534 | Descendants of the Highborne | 49 | Winterspring | 交任务方不存在：Quel'dorei Spirit |
| 28666 | Hero's Call: Burning Steppes! | 49 | Burning Steppes | 交任务方不存在：John J. Keeshan |
| 28667 | Warchief's Command: Burning Steppes! | 49 | Burning Steppes | 交任务方不存在：Ariok |
| 24704 | The Evil Dragons of Un'Goro Crater | 51 | Un'Goro Crater | 交任务方不存在：Maximillian of Northshire |
| 24705 | Damsels Were Made to be Saved | 51 | Un'Goro Crater | 交任务方不存在：Maximillian of Northshire |
| 24706 | The Spirits of Golakka Hot Springs | 51 | Un'Goro Crater | 交任务方不存在：Maximillian of Northshire |
| 24707 | The Ballad of Maximillian | 51 | Un'Goro Crater | 交任务方不存在：Maximillian of Northshire |
| 27582 | Infiltrating Shadowforge City | 51 | Blackrock Depths | 交任务方不存在：Razal'blade |
| 27585 | The 109th Division | 51 | Blackrock Depths | 交任务方不存在：Hierophant Theodora Mulvadania |
| 27591 | The Dark Iron Pact | 51 | Blackrock Depths | 交任务方不存在：Warlord Goretooth |
| 27593 | Rebirth of the K.E.F. | 51 | Blackrock Depths | 交任务方不存在：Warlord Goretooth |
| 8280 | Securing the Supply Lines | 54 | Silithus | 交任务方不存在：Windcaller Proudhorn |
| 8281 | Stepping Up Security | 54 | Silithus | 交任务方不存在：Windcaller Proudhorn |
| 8314 | Unraveling the Mystery | 54 | Silithus | 交任务方不存在：Geologist Larksbane |
| 8501 | Target: Hive'Ashi Stingers | 54 | Silithus | 无交任务 NPC |
| 8502 | Target: Hive'Ashi Workers | 54 | Silithus | 无交任务 NPC |
| 8539 | Target: Hive'Zora Hive Sisters | 54 | Silithus | 无交任务 NPC |
| 8687 | Target: Hive'Zora Tunnelers | 54 | Silithus | 无交任务 NPC |
| 8770 | Target: Hive'Ashi Defenders | 54 | Silithus | 无交任务 NPC |
| 8771 | Target: Hive'Ashi Sandstalkers | 54 | Silithus | 无交任务 NPC |
| 8772 | Target: Hive'Zora Waywatchers | 54 | Silithus | 无交任务 NPC |
| 8773 | Target: Hive'Zora Reavers | 54 | Silithus | 无交任务 NPC |
| 8774 | Target: Hive'Regal Ambushers | 54 | Silithus | 无交任务 NPC |
| 8775 | Target: Hive'Regal Spitfires | 54 | Silithus | 无交任务 NPC |
| 8776 | Target: Hive'Regal Slavemakers | 54 | Silithus | 无交任务 NPC |
| 8777 | Target: Hive'Regal Burrowers | 54 | Silithus | 无交任务 NPC |
| 25688 | The Altar of Storms | 54 | Blasted Lands | 交任务方不存在：Loramus Thalipedes |
| 25693 | Enhancing the Stone | 54 | Blasted Lands | 交任务方不存在：Loramus Thalipedes |
| 25700 | Loramus Thalipedes Awaits | 54 | Blasted Lands | 交任务方不存在：Loramus Thalipedes |
| 26162 | The Altar of Storms | 54 | Blasted Lands | 交任务方不存在：Loramus Thalipedes |
| 26170 | The Final Ritual | 54 | Blasted Lands | 交任务方不存在：Loramus Thalipedes |
| 28527 | Warchief's Command: Silithus! | 54 | Silithus | 交任务方不存在：Windcaller Proudhorn |
| 28528 | Hero's Call: Silithus! | 54 | Silithus | 交任务方不存在：Windcaller Proudhorn |
| 28856 | The Sands of Silithus | 54 | Silithus | 交任务方不存在：Windcaller Proudhorn |
| 25718 | How Best to Proceed | 55 | Blasted Lands | 交任务方不存在：Elijah Dawnflight |
| 8183 | The Heart of Hakkar | 58 | Zul'Gurub | 无交任务 NPC |
| 29542 | Invading the Citadel | 59 | Hellfire Ramparts | 交任务方不存在：Stone Guard Stok'ton |
| 29543 | Invading the Citadel | 59 | Hellfire Ramparts | 交任务方不存在：Advance Scout Chadwick |
| 7490 | Victory for the Horde | 60 | Orgrimmar | 无交任务 NPC |
| 7491 | For All To See | 60 | Orgrimmar | 无交任务 NPC |
| 7495 | Victory for the Alliance | 60 | Stormwind City | 无交任务 NPC |
| 7496 | Celebrating Good Times | 60 | Stormwind City | 无交任务 NPC |
| 8791 | The Fall of Ossirian | 60 | Ruins of Ahn'Qiraj | 交任务方不存在：Commander Mar'alith |
| 9984 | Host of the Hidden City | 62 | Terokkar Forest | 无交任务 NPC |
| 9985 | Host of the Hidden City | 62 | Terokkar Forest | 无交任务 NPC |
| 29566 | Checking Up | 62 | The Slave Pens | 交任务方不存在：Watcher Jhang |
| 29571 | Defending the Wilds | 63 | The Underbog | 交任务方不存在：Watcher Jhang |
| 29582 | Grek's Crazy Night | 64 | Mana-Tombs | 交任务方不存在：Artificer Morphalius |
| 29583 | Eckert the Mad | 64 | Mana-Tombs | 交任务方不存在：Artificer Morphalius |
| 29652 | One Last Favor | 66 | The Shattered Halls | 交任务方不存在：Advance Scout Chadwick、Advance Scout Chadwick |
| 29653 | The Will of the Warchief | 66 | The Shattered Halls | 交任务方不存在：Stone Guard Stok'ton |
| 29689 | Advancing the Campaign | 66 | The Shattered Halls | 交任务方不存在：Advance Scout Chadwick |
| 29616 | Storming the Steamvault | 67 | The Steamvault | 交任务方不存在：Watcher Jhang |
| 10754 | Entry Into the Citadel | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10755 | Entry Into the Citadel | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10756 | Grand Master Rohok | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10757 | Rohok's Request | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10758 | Hotter than Hell | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10763 | Dumphry's Request | 68 | Hellfire Peninsula | 无交任务 NPC |
| 10764 | Hotter than Hell | 68 | Hellfire Peninsula | 无交任务 NPC |
| 11452 | The Slumbering King | 68 | Howling Fjord | 无交任务 NPC |
| 29641 | The Soul Devices | 68 | Shadow Labyrinth | 交任务方不存在：Spy Grik'tha |
| 29642 | Trouble at Auchindoun | 68 | Shadow Labyrinth | 交任务方不存在：Field Commander Mahfuun |
| 29644 | Into the Heart of the Labyrinth | 68 | Shadow Labyrinth | 交任务方不存在：Field Commander Mahfuun |
| 10949 | Entry Into the Black Temple | 70 | Shadowmoon Valley | 交任务方不存在：Xi'ri |
| 10974 | Stasis Chambers of Bash'ir | 70 | Blade's Edge Mountains | 交任务方不存在：Image of Commander Ameer |
| 11095 | Commander Hobb | 70 | Shadowmoon Valley | 交任务方不存在：Commander Hobb |
| 13429 | A Distraction for Akama | 70 | Shadowmoon Valley | 无交任务 NPC |
| 14203 | Waterlogged Recipe | 70 | Dalaran City | 无交任务 NPC |
| 29682 | Magisters' Terrace | 70 | Magisters' Terrace | 交任务方不存在：Exarch Larethor |
| 29685 | Hard to Kill | 70 | Magisters' Terrace | 交任务方不存在：Exarch Larethor |
| 29826 | Reclaiming Ahn'Kahet | 73 | Ahn'kahet: The Old Kingdom | 交任务方不存在：Seer Ixit |
| 29833 | Unfinished Business | 74 | Gundrak | 交任务方不存在：Tol'mar |
| 29836 | Just Checkin' | 74 | Gundrak | 交任务方不存在：Chronicler Bah'Kini |
| 14483 | Something is in the Air (and it Ain't Love) | 75 | （任务分类 -376） | 交任务方不存在：Detective Snap Snagglebolt |
| 24745 | Something is in the Air (and it Ain't Love) | 75 | （任务分类 -376） | 交任务方不存在：Inspector Snip Snagglebolt |
| 12703 | Kartak's Rampage | 76 | Sholazar Basin | 交任务方不存在：Shaman Jakjek |
| 12705 | Will of the Titans | 76 | Sholazar Basin | 交任务方不存在：Lightningcaller Soo-met |
| 12759 | Tools of War | 76 | Sholazar Basin | 交任务方不存在：Shaman Jakjek |
| 12760 | Secret Strength of the Frenzyheart | 76 | Sholazar Basin | 交任务方不存在：Shaman Jakjek |
| 12761 | Mastery of the Crystals | 76 | Sholazar Basin | 交任务方不存在：Lightningcaller Soo-met |
| 12762 | Power of the Great Ones | 76 | Sholazar Basin | 交任务方不存在：Lightningcaller Soo-met |
| 12547 | The Activation Rune | 77 | Un'Goro Crater | 交任务方不存在：The Etymidian |
| 12548 | The Etymidian | 77 | Sholazar Basin | 交任务方不存在：The Etymidian |
| 12879 | Fury of the Frostborn King | 77 | The Storm Peaks | 交任务方不存在：Creteus |
| 12880 | The Master Explorer | 77 | The Storm Peaks | 交任务方不存在：Brann Bronzebeard |
| 12897 | If He Cannot Be Turned | 77 | Icecrown | 交任务方不存在：Koltira Deathweaver |
| 13221 | I'm Not Dead Yet! | 77 | Icecrown | 交任务方不存在：Absalan the Pious |
| 13224 | Orgrim's Hammer | 77 | Icecrown | 交任务方不存在：Sky-Reaver Korm Blackscar |
| 13225 | The Skybreaker | 77 | Icecrown | 交任务方不存在：High Captain Justin Bartlett |
| 13229 | I'm Not Dead Yet! | 77 | Icecrown | 交任务方不存在：Brother Keltan |
| 13230 | Avenge Me! | 77 | Icecrown | 交任务方不存在：Sky-Reaver Korm Blackscar |
| 13232 | Finish Me! | 77 | Icecrown | 交任务方不存在：High Captain Justin Bartlett |
| 13282 | Return to the Surface | 77 | Icecrown | 交任务方不存在：Koltira Deathweaver |
| 13320 | Cannot Reproduce | 77 | Icecrown | 交任务方不存在：Chief Engineer Boltwrench |
| 13321 | Retest Now | 77 | Icecrown | 交任务方不存在：Chief Engineer Boltwrench |
| 13348 | Futility | 77 | Icecrown | 交任务方不存在：Koltira Deathweaver |
| 13349 | Cradle of the Frostbrood | 77 | Icecrown | 交任务方不存在：Koltira Deathweaver |
| 13362 | Knowledge is a Terrible Burden | 77 | Icecrown | 交任务方不存在：Koltira Deathweaver |
| 13418 | Preparations for War | 77 | Icecrown | 交任务方不存在：High Captain Justin Bartlett |
| 13419 | Preparations for War | 77 | Icecrown | 交任务方不存在：Sky-Reaver Korm Blackscar |
| 29861 | Whatever it Takes! | 77 | Halls of Lightning | 交任务方不存在：Stormherald Eljrrin |
| 29863 | Stormherald Eljrrin | 77 | Halls of Lightning | 交任务方不存在：Stormherald Eljrrin |
| 13151 | A Royal Escort | 78 | The Culling of Stratholme | 交任务方不存在：Chromie |
| 24522 | Journey To The Sunwell | 80 | Isle of Quel'Danas | 交任务方不存在：Halduron Brightwing |
| 24535 | Thalorien Dawnseeker | 80 | Isle of Quel'Danas | 交任务方不存在：Halduron Brightwing |
| 24562 | Journey To The Sunwell | 80 | Isle of Quel'Danas | 交任务方不存在：Halduron Brightwing |
| 24563 | Thalorien Dawnseeker | 80 | Isle of Quel'Danas | 交任务方不存在：Halduron Brightwing |
| 25268 | The Voice of Goldrinn | 80 | Mount Hyjal | 交任务方不存在：Ian Duran |
| 25271 | Goldrinn's Ferocity | 80 | Mount Hyjal | 交任务方不存在：Ian Duran |
| 25278 | Cleaning House | 80 | Mount Hyjal | 交任务方不存在：Ian Duran |
| 25280 | The Shrine Reclaimed | 80 | Mount Hyjal | 交任务方不存在：Ian Duran |
| 25316 | As Hyjal Burns | 80 | Mount Hyjal | 交任务方不存在：Ysera |
| 25372 | Aessina's Miracle | 80 | Mount Hyjal | 交任务方不存在：Arch Druid Hamuul Runetotem |
| 25405 | Rest For the Weary | 80 | Kelp'thar Forest | 交任务方不存在：Captain Taylor |
| 25412 | The Name Never Spoken | 80 | Mount Hyjal | 交任务方不存在：Tyrus Blackhorn |
| 25428 | Black Heart of Flame | 80 | Mount Hyjal | 交任务方不存在：Tyrus Blackhorn |
| 25540 | Bellies Await | 80 | Shimmering Expanse | 交任务方不存在：Wavespeaker Valoren |
| 25558 | All or Nothing | 80 | Kelp'thar Forest | 交任务方不存在：Erunak Stonespeaker |
| 25578 | Return to Nordrassil | 80 | Mount Hyjal | 交任务方不存在：Ysera |
| 25583 | Upon the Scene of Battle | 80 | Shimmering Expanse | 交任务方不存在：Admiral Dvorek |
| 25617 | Into the Maw! | 80 | Mount Hyjal | 交任务方不存在：Jordan Olafson |
| 25618 | Into the Maw! | 80 | Mount Hyjal | 交任务方不存在：Jordan Olafson |
| 25624 | Into the Maw! | 80 | Mount Hyjal | 交任务方不存在：Jordan Olafson |
| 25637 | To the Fathom-Lord's Call | 80 | Shimmering Expanse | 交任务方不存在：Fathom-Lord Zin'jatar |
| 25659 | Not Soon Forgotten | 80 | Shimmering Expanse | 交任务方不存在：Fathom-Lord Zin'jatar |
| 25740 | Fact-Finding Mission | 80 | Mount Hyjal | 交任务方不存在：Thisalee Crow |
| 25743 | Decisions, Decisions | 80 | Kelp'thar Forest | 交任务方不存在：Budd |
| 25746 | Sethria's Brood | 80 | Mount Hyjal | 交任务方不存在：Thisalee Crow |
| 25807 | An Ancient Reborn | 80 | Mount Hyjal | 交任务方不存在：Aviana |
| 25830 | The Last Living Lorekeeper | 80 | Mount Hyjal | 交任务方不存在：Nordu |
| 25842 | Firefight | 80 | Mount Hyjal | 交任务方不存在：Nordu |
| 25863 | Chosen Burden | 80 | Shimmering Expanse | 交任务方不存在：Lady Naz'jar |
| 25890 | Nespirah | 80 | Shimmering Expanse | 交任务方不存在：Earthmender Duarn |
| 25898 | Honor and Privilege | 80 | Shimmering Expanse | 交任务方不存在：Jorlan Trueblade |
| 25900 | Making Contact | 80 | Shimmering Expanse | 交任务方不存在：Earthmender Duarn |
| 25921 | Overseer Idra'kess | 80 | Shimmering Expanse | 交任务方不存在：Earthmender Duarn |
| 25941 | Rest For the Weary | 80 | Kelp'thar Forest | 交任务方不存在：Legionnaire Nazgrim |
| 25946 | Helm's Deep | 80 | Kelp'thar Forest | 交任务方不存在：Legionnaire Nazgrim |
| 25947 | Finders, Keepers | 80 | Kelp'thar Forest | 交任务方不存在：Legionnaire Nazgrim |
| 25949 | Blood and Thunder! | 80 | Kelp'thar Forest | 交任务方不存在：Erunak Stonespeaker |
| 25956 | Upon the Scene of Battle | 80 | Shimmering Expanse | 交任务方不存在：Captain Vilethorn |
| 25983 | Promontory Point | 80 | Abyssal Depths | 交任务方不存在：Captain Taylor |
| 25984 | Promontory Point | 80 | Abyssal Depths | 交任务方不存在：Legionnaire Nazgrim |
| 26071 | Clearing the Defiled | 80 | Abyssal Depths | 交任务方不存在：Legionnaire Nazgrim |
| 26181 | Back to Darkbreak Cove | 80 | Abyssal Depths | 交任务方不存在：Erunak Stonespeaker |
| 26182 | Back to the Tenebrous Cavern | 80 | Abyssal Depths | 交任务方不存在：Erunak Stonespeaker |
| 27687 | An Opened Can of Whoop Gnash | 80 | Kelp'thar Forest | 交任务方不存在：Captain Samir |
| 27708 | The Warden's Time | 80 | Kelp'thar Forest | 交任务方不存在：Erunak Stonespeaker |
| 27717 | Piece of the Past | 80 | Shimmering Expanse | 交任务方不存在：Elendri Goldenbrow |
| 26247 | Diplomacy First | 81 | Deepholm | 交任务方不存在：Stormcaller Mylra |
| 27203 | The Maelstrom | 82 | Deepholm | 交任务方不存在：Thrall |
| 28760 | Vengeance for Orsis | 82 | The Vortex Pinnacle | 交任务方不存在：Itesh |
| 28845 | The Vortex Pinnacle | 82 | The Vortex Pinnacle | 交任务方不存在：Itesh |
| 27003 | Easy Money | 83 | Uldum | 交任务方不存在：Adarrah |
| 27141 | Premature Explosionation | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27176 | Just the Tip | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27179 | Field Work | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27196 | On to Something | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27431 | Tipping the Balance | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27511 | The Thrill of Discovery | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27517 | Be Prepared | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27541 | Lessons From the Past | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27549 | By the Light of the Stars | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27624 | After the Fall | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27669 | Do the Honors | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27899 | That Gleam in his Eye | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27900 | I've Got This Guy | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 27993 | Take it to 'Em! | 83 | Uldum | 交任务方不存在：Harrison Jones |
| 28198 | The Weakest Link | 83 | Uldum | 交任务方不存在：Salhet |
| 28274 | Two Tents | 83 | Uldum | 交任务方不存在：Sullah |
| 28295 | Meetup with the Caravan | 83 | Tanaris | 交任务方不存在：Adarrah |
| 28296 | Meetup with the Caravan | 83 | Tanaris | 交任务方不存在：Adarrah |
| 28350 | Master Trapper | 83 | Uldum | 交任务方不存在：Sullah |
| 28376 | Myzerian's Head | 83 | Uldum | 交任务方不存在：Sullah |
| 28557 | Warchief's Command: Uldum! | 83 | Ruins of Uldum | 交任务方不存在：Adarrah |
| 28558 | Hero's Call: Uldum! | 83 | Ruins of Uldum | 交任务方不存在：Adarrah |
| 26388 | Twilight Skies | 84 | Azshara | 交任务方不存在：Admiral Stonefist |
| 26539 | Stalled Negotiations | 84 | Twilight Highlands | 交任务方不存在：Ornak |
| 26608 | Negotiations Terminated | 84 | Twilight Highlands | 交任务方不存在：Admiral Stonefist |
| 26840 | Return to the Highlands | 84 | Twilight Highlands | 交任务方不存在：Zaela |
| 27301 | Unbroken | 84 | Twilight Highlands | 交任务方不存在：Earthcaller Yevaa |
| 27303 | Mercy for the Bound | 84 | Twilight Highlands | 交任务方不存在：Earthcaller Yevaa |
| 27338 | Our Boys on the Shore | 84 | Twilight Highlands | 交任务方不存在：Lieutenant Emry |
| 27378 | The Worldbreaker | 84 | Twilight Highlands | 交任务方不存在：Earthcaller Yevaa |
| 27379 | The Terrors of Iso'rath | 84 | Twilight Highlands | 交任务方不存在：Earthcaller Yevaa |
| 27380 | Nightmare | 84 | Twilight Highlands | 交任务方不存在：Earthcaller Torunscar |
| 27485 | Warm Welcome | 84 | Twilight Highlands | 交任务方不存在：Calen |
| 27500 | Four Heads are Better than None | 84 | Twilight Highlands | 交任务方不存在：Cassius the White |
| 27504 | Even Dragons Bleed | 84 | Twilight Highlands | 交任务方不存在：Velastrasza |
| 27505 | Draconic Mending | 84 | Twilight Highlands | 交任务方不存在：Velastrasza |
| 27564 | In Defense of the Redoubt | 84 | Twilight Highlands | 交任务方不存在：Calen |
| 27636 | Just You and Mathias | 84 | Twilight Highlands | 交任务方不存在：Master Mathias Shaw |
| 27643 | Donnelly Dunwald | 84 | Twilight Highlands | 交任务方不存在：Donnelly Dunwald |
| 27644 | Eoin Dunwald | 84 | Twilight Highlands | 交任务方不存在：Eoin Dunwald |
| 27645 | Cayden Dunwald | 84 | Twilight Highlands | 交任务方不存在：Cayden Dunwald |
| 27646 | Finding Beak | 84 | Twilight Highlands | 交任务方不存在：Donnelly Dunwald |
| 27647 | Anything But Water | 84 | Twilight Highlands | 交任务方不存在：Eoin Dunwald |
| 27648 | Once More Into The Fire | 84 | Twilight Highlands | 交任务方不存在：Cayden Dunwald |
| 27660 | Spirit of the Loch | 84 | Twilight Highlands | 交任务方不存在：Countess Verrall |
| 27661 | Fire the Cannon | 84 | Twilight Highlands | 交任务方不存在：Countess Verrall |
| 27712 | Back to the Elementium Depths | 84 | Twilight Highlands | 交任务方不存在：Initiate Goldmine |
| 27745 | A Fiery Reunion | 84 | Twilight Highlands | 交任务方不存在：Initiate Goldmine |
| 27788 | Skullcrusher the Mountain | 84 | Twilight Highlands | 交任务方不存在：Warlord Zaela |
| 28093 | Pressing Forward | 84 | Twilight Highlands | 交任务方不存在：Calen |
| 28109 | Pressing Forward | 84 | Twilight Highlands | 交任务方不存在：Calen |
| 28592 | Parting Packages | 84 | Twilight Highlands | 交任务方不存在：Ticker |
| 28595 | Krazz Works! | 84 | Twilight Highlands | 交任务方不存在：Captain Krazz |
| 28596 | Welcome to Highbank! | 84 | Twilight Highlands | 交任务方不存在：Lieutenant Fawkes |
| 28599 | Kurdran's Waitin' | 84 | Twilight Highlands | 交任务方不存在：Kurdran Wildhammer |
| 28832 | Twilight Shores | 84 | Twilight Highlands | 交任务方不存在：Lieutenant Fawkes |
| 28849 | Twilight Skies | 84 | Azshara | 交任务方不存在：Friz Groundspin |
| 29102 | To Fort Livingston | 85 | （任务分类 -380） | 交任务方不存在：Livingston Marshal |
| 29103 | Serpents and Poison | 85 | （任务分类 -380） | 交任务方不存在：Livingston Marshal |
| 29121 | Bury Me With Me Boots... | 85 | （任务分类 -380） | 交任务方不存在：Grent Direhammer |
| 29124 | Warn the Rebel Camp | 85 | （任务分类 -380） | 交任务方不存在：Lieutenant Doren |
| 29131 | Defend the Rebel Camp | 85 | （任务分类 -380） | 交任务方不存在：Lieutenant Doren |
| 29145 | Opening the Door | 85 | （任务分类 -379） | 交任务方不存在：Arch Druid Hamuul Runetotem |
| 29165 | The Call of the Pack | 85 | （任务分类 -379） | 交任务方不存在：Matoclaw |
| 29193 | On a Wing and a Prayer | 85 | Caverns of Time | 交任务方不存在：Tarecgosa |
| 29194 | Through a Glass, Darkly | 85 | Coldarra | 交任务方不存在：Tarecgosa |
| 29196 | To the Sanctuary! | 85 | （任务分类 -379） | 交任务方不存在：Matoclaw |
| 29197 | Caught Unawares | 85 | （任务分类 -379） | 交任务方不存在：Arch Druid Hamuul Runetotem |
| 29213 | How's the Hunter Holding Up? | 85 | （任务分类 -380） | 交任务方不存在：Grent Direhammer |
| 29220 | To Bambala | 85 | （任务分类 -380） | 交任务方不存在：Kil'karil |
| 29221 | Serpents and Poison | 85 | （任务分类 -380） | 交任务方不存在：Kil'karil |
| 29225 | Actionable Intelligence | 85 | The Nexus | 交任务方不存在：Kalecgos |
| 29231 | How's the Hunter Holding Up? | 85 | （任务分类 -380） | 交任务方不存在：Grent Direhammer |
| 29232 | Bury Me With Me Boots... | 85 | （任务分类 -380） | 交任务方不存在：Grent Direhammer |
| 29234 | Delegation | 85 | Mount Hyjal | 交任务方不存在：Kalecgos |
| 29239 | Nordrassil's Bough | 85 | Borean Tundra | 交任务方不存在：Branch of Nordrassil |
| 29244 | A Lieutenant of Flame | 85 | （任务分类 -379） | 交任务方不存在：Shalis Darkhunter |
| 29245 | The Mysterious Seed | 85 | （任务分类 -379） | 交任务方不存在：Avrilla |
| 29249 | Planting Season | 85 | （任务分类 -379） | 交任务方不存在：Avrilla |
| 29254 | Little Lasher | 85 | （任务分类 -379） | 交任务方不存在：Avrilla |
| 29265 | Fire Flowers | 85 | （任务分类 -379） | 交任务方不存在：Rayne Feathersong、Choluna |
| 29270 | Time Grows Short | 85 | Coldarra | 交任务方不存在：Kalecgos |
| 29285 | Alignment | 85 | Coldarra | 交任务方不存在：Kalecgos |
| 29311 | The Rest is History | 85 | （任务分类 -379） | 交任务方不存在：Malfurion Stormrage |
| 29327 | Elemental Bonds: Doubt | 85 | （任务分类 -381） | 交任务方不存在：Aggra |
| 29335 | Into Slashing Winds | 85 | （任务分类 -381） | 交任务方不存在：Cyclonas |
| 29387 | Guardians of Hyjal: Firelands Invasion! | 85 | （任务分类 -379） | 交任务方不存在：Matoclaw |
| 29388 | Guardians of Hyjal: Firelands Invasion! | 85 | （任务分类 -379） | 交任务方不存在：Matoclaw |
| 29389 | Guardians of Hyjal: Firelands Invasion! | 85 | （任务分类 -379） | 交任务方不存在：Matoclaw |
| 29552 | Critical Condition | 85 | The Jade Forest | 交任务方不存在：Mishka |
| 29622 | Your Training Starts Now | 85 | The Jade Forest | 交任务方不存在：Instructor Xann |
| 29623 | Perfection | 85 | The Jade Forest | 交任务方不存在：Instructor Xann |
| 29624 | Attention | 85 | The Jade Forest | 交任务方不存在：Instructor Xann |
| 29694 | Regroup! | 85 | The Jade Forest | 交任务方不存在：Sergeant Gorrok |
| 29749 | An Urgent Plea | 85 | The Jade Forest | 交任务方不存在：Pei-Zhi |
| 29751 | Ritual Artifacts | 85 | The Jade Forest | 交任务方不存在：Pei-Zhi |
| 29762 | Family Heirlooms | 85 | The Jade Forest | 交任务方不存在：Bold Karasshi |
| 29804 | Seein' Red | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 29889 | Borrowed Brew | 85 | The Jade Forest | 无交任务 NPC |
| 29894 | Spirits of the Water | 85 | The Jade Forest | 交任务方不存在：Bold Karasshi |
| 29895 | Trail of the White Pawn | 85 | The Jade Forest | 无交任务 NPC |
| 29927 | Mann's Man | 85 | The Jade Forest | 交任务方不存在：Hao Mann |
| 29931 | The Serpent's Heart | 85 | The Jade Forest | 交任务方不存在：Foreman Raike |
| 29932 | The Temple of the Jade Serpent | 85 | The Jade Forest | 交任务方不存在：Elder Sage Rain-Zhu |
| 29967 | Boom Goes the Doonamite! | 85 | The Jade Forest | 交任务方不存在：Rivett Clutchpop |
| 29997 | The Scryer's Dilemma | 85 | The Jade Forest | 交任务方不存在：Wise Mari |
| 30011 | A New Vision | 85 | The Jade Forest | 交任务方不存在：Elder Sage Rain-Zhu |
| 30015 | Dawn's Blossom | 85 | The Jade Forest | 交任务方不存在：Lorewalker Cho |
| 30098 | The Well of Eternity | 85 | Well of Eternity | 交任务方不存在：Nozdormu |
| 30099 | In Unending Numbers | 85 | Well of Eternity | 交任务方不存在：Nozdormu |
| 30100 | The Vainglorious | 85 | Well of Eternity | 交任务方不存在：Nozdormu |
| 30101 | The Path to the Dragon Soul | 85 | Well of Eternity | 交任务方不存在：Illidan Stormrage |
| 30484 | Gauging Our Progress | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 30485 | Last Piece of the Puzzle | 85 | The Jade Forest | 交任务方不存在：Lorewalker Cho |
| 30495 | Love's Labor | 85 | The Jade Forest | 交任务方不存在：Foreman Raike |
| 30498 | Get Back Here! | 85 | The Jade Forest | 交任务方不存在：Admiral Taylor |
| 30499 | Get Back Here! | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 31130 | A Visit with Lorewalker Cho | 85 | The Jade Forest | 交任务方不存在：Lorewalker Cho |
| 31736 | Envoy of the Alliance | 85 | The Jade Forest | 交任务方不存在：Sunke Khang |
| 31737 | The Cost of War | 85 | The Jade Forest | 交任务方不存在：Taran Zhu |
| 31740 | Koukou's Rampage | 85 | The Jade Forest | 交任务方不存在：Sunke Khang |
| 31765 | Paint it Red! | 85 | The Jade Forest | 交任务方不存在：Rivett Clutchpop |
| 31766 | Touching Ground | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 31767 | Finish Them! | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 31771 | Face to Face With Consequence | 85 | The Jade Forest | 无交任务 NPC |
| 31773 | Prowler Problems | 85 | The Jade Forest | 无交任务 NPC |
| 31774 | Seeking Zin'jun | 85 | The Jade Forest | 交任务方不存在：Zin'Jun |
| 31786 | Pristine Manacles of Rebellion | 85 | The Arboretum | 无交任务 NPC |
| 31787 | Pristine Mogu Runestone | 85 | The Arboretum | 无交任务 NPC |
| 31788 | Pristine Terracotta Arm | 85 | The Arboretum | 无交任务 NPC |
| 31789 | Pristine Petrified Bone Whip | 85 | The Arboretum | 无交任务 NPC |
| 31790 | Pristine Thunder King Insignia | 85 | The Arboretum | 无交任务 NPC |
| 31791 | Pristine Edicts of the Thunder King | 85 | The Arboretum | 无交任务 NPC |
| 31792 | Pristine Iron Amulet | 85 | The Arboretum | 无交任务 NPC |
| 31793 | Pristine Branding Iron | 85 | The Arboretum | 无交任务 NPC |
| 31794 | Pristine Mogu Coin | 85 | The Arboretum | 无交任务 NPC |
| 31795 | Pristine Pandaren Tea Set | 85 | The Arboretum | 无交任务 NPC |
| 31796 | Pristine Game Board | 85 | The Arboretum | 无交任务 NPC |
| 31797 | Pristine Twin Stein Set | 85 | The Arboretum | 无交任务 NPC |
| 31798 | Pristine Walking Cane | 85 | The Arboretum | 无交任务 NPC |
| 31799 | Pristine Empty Keg | 85 | The Arboretum | 无交任务 NPC |
| 31800 | Pristine Carved Bronze Mirror | 85 | The Arboretum | 无交任务 NPC |
| 31801 | Pristine Gold-Inlaid Figurine | 85 | The Arboretum | 无交任务 NPC |
| 31802 | Pristine Apothecary Tins | 85 | The Arboretum | 无交任务 NPC |
| 31803 | Pristine Pearl of Yu'lon | 85 | The Arboretum | 无交任务 NPC |
| 31804 | Pristine Standard of Niuzao | 85 | The Arboretum | 无交任务 NPC |
| 31805 | Pristine Monument Ledger | 85 | The Arboretum | 无交任务 NPC |
| 31999 | Nazgrim's Command | 85 | The Jade Forest | 交任务方不存在：General Nazgrim |
| 32686 | Pristine Banner of the Mantid Empire | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32687 | Pristine Ancient Sap Feeder | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32688 | Pristine Praying Mantid | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32689 | Pristine Sound Beacon | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32690 | Pristine Remains of a Paragon | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32691 | Pristine Mantid Lamp | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32692 | Pristine Pollen Collector | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 32693 | Pristine Kypari Sap Container | 85 | Vale of Eternal Blossoms | 无交任务 NPC |
| 29919 | Great Minds Drink Alike | 86 | Valley of the Four Winds | 交任务方不存在：Mudmug |
| 30049 | Doesn't Hold Water | 86 | Valley of the Four Winds | 交任务方不存在：Mudmug |
| 30080 | Finding Yi-Mo | 86 | Krasarang Wilds | 交任务方不存在：Yi-Mo Longbrow |
| 30132 | Going West | 86 | Krasarang Wilds | 交任务方不存在：Kor Bloodtusk |
| 30133 | Into the Wilds | 86 | Krasarang Wilds | 交任务方不存在：Koro Mistwalker |
| 30163 | For the Tribe | 86 | Krasarang Wilds | 交任务方不存在：Kor Bloodtusk |
| 30178 | Into the Wilds | 86 | Krasarang Wilds | 交任务方不存在：Koro Mistwalker |
| 30461 | Into the Wilds | 86 | Krasarang Wilds | 交任务方不存在：Koro Mistwalker |
| 30462 | Into the Wilds | 86 | Krasarang Wilds | 交任务方不存在：Koro Mistwalker |
| 30464 | Going West | 86 | Krasarang Wilds | 交任务方不存在：Kor Bloodtusk |
| 30669 | The Lorewalker on the Lake | 86 | Krasarang Wilds | 交任务方不存在：Wise Ana Wu |
| 30671 | Wisdom Has A Price | 86 | Krasarang Wilds | 交任务方不存在：Wise Ana Wu |
| 30487 | Comin' Round the Mountain | 87 | Kun-Lai Summit | 交任务方不存在：Lucky Bluestring |
| 30683 | One Traveler's Misfortune | 87 | Kun-Lai Summit | 交任务方不存在：Lucky Bluestring |
| 30684 | Seeker's Folly | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 30699 | To Winter's Blossom | 87 | Kun-Lai Summit | 交任务方不存在：Lin Silentstrike |
| 30723 | Honor, Even in Death | 87 | Kun-Lai Summit | 交任务方不存在：Lin Silentstrike |
| 30724 | To the Wall! | 87 | Kun-Lai Summit | 交任务方不存在：Suna Silentstrike |
| 30750 | Off the Wall! | 87 | Kun-Lai Summit | 交任务方不存在：Suna Silentstrike |
| 30816 | Checking In | 87 | Kun-Lai Summit | 交任务方不存在：Sage Liao |
| 30820 | A Funeral | 87 | Kun-Lai Summit | 交任务方不存在：Sage Liao |
| 30829 | The Tongue of Ba-Shon | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 30935 | Fisherman's Tale | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 30991 | Do a Barrel Roll! | 87 | Kun-Lai Summit | 交任务方不存在：Lao-Chin the Iron Belly |
| 30994 | Lao-Chin's Gambit | 87 | Kun-Lai Summit | 交任务方不存在：Lao-Chin the Iron Belly |
| 31306 | Seeker's Folly | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 31392 | Temple of the White Tiger | 87 | Kun-Lai Summit | 无交任务 NPC |
| 31393 | Temple of the White Tiger | 87 | Kun-Lai Summit | 交任务方不存在：Sunwalker Dezco |
| 31394 | A Celestial Experience | 87 | Kun-Lai Summit | 无交任务 NPC |
| 31395 | A Celestial Experience | 87 | Kun-Lai Summit | 交任务方不存在：Sunwalker Dezco |
| 31459 | Cho's Missive | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 31460 | Cho's Missive | 87 | Kun-Lai Summit | 交任务方不存在：Lorewalker Cho |
| 30814 | A Foot in the Door | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 30815 | The Death of Me | 88 | Townlong Steppes | 交任务方不存在：Orbiss |
| 30884 | Behind the Battlefront | 88 | Townlong Steppes | 交任务方不存在：Taoshi |
| 30887 | Unwelcome Intruders | 88 | Townlong Steppes | 交任务方不存在：Taoshi |
| 30901 | Along the Southern Front | 88 | Townlong Steppes | 交任务方不存在：Taoshi |
| 30926 | The Terrible Truth | 88 | Townlong Steppes | 交任务方不存在：Tai Ho |
| 30932 | Father's Footsteps | 88 | Townlong Steppes | 交任务方不存在：Ku-Mo |
| 30968 | The Sha of Hatred | 88 | Townlong Steppes | 交任务方不存在：Taoshi |
| 30970 | Enraged By Hatred | 88 | Townlong Steppes | 交任务方不存在：Taoshi |
| 30975 | The Taking of Dusklight Bridge | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 30979 | Devastation Below | 88 | Townlong Steppes | 交任务方不存在：Hawkmaster Nurong |
| 30981 | Taoshi and Korvexxis | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31063 | Lao-Chin and Serevex | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31064 | Nurong and Rothek | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31386 | The Shado-Pan Offensive | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31388 | The Shado-Pan Offensive | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31695 | Beyond the Wall | 88 | Townlong Steppes | 交任务方不存在：Taran Zhu |
| 31004 | Preserved in Amber | 89 | Dread Wastes | 交任务方不存在：Kil'ruk the Wind-Reaver |
| 31018 | Beneath the Heart of Fear | 89 | Dread Wastes | 交任务方不存在：Xaril the Poisoned Mind |
| 31019 | Amber Is Life | 89 | Dread Wastes | 交任务方不存在：Ancient Amber Chunk |
| 31087 | Extending Our Coverage | 89 | Dread Wastes | 交任务方不存在：Kor'ik |
| 31175 | Skeer the Bloodseeker | 89 | Dread Wastes | 交任务方不存在：Skeer the Bloodseeker |
| 31234 | Putting An Eye Out | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 31271 | Bad Genes | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 31354 | Mazu's Bounty | 89 | Dread Wastes | 交任务方不存在：Master Angler Ju Lien |
| 31458 | Damage Control | 89 | Dread Wastes | 交任务方不存在：Hisek the Swarmkeeper |
| 31465 | Extracting Answers | 89 | Dread Wastes | 交任务方不存在：Hisek the Swarmkeeper |
| 31502 | Wing Clip | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 31503 | Shortcut to Ruin | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 31508 | Specimen Request | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 31509 | Fear Takes Root | 89 | Dread Wastes | 交任务方不存在：Rik'kal the Dissector |
| 30258 | Mung-Mung's Vote I: A Hozen's Problem | 90 | Valley of the Four Winds | 交任务方不存在：Mung-Mung |
| 30259 | Mung-Mung's Vote II: Rotten to the Core | 90 | Valley of the Four Winds | 交任务方不存在：Mung-Mung |
| 30319 | Pest Problems | 90 | Valley of the Four Winds | 交任务方不存在：Haohan Mudclaw |
| 30470 | A Gift For Tina | 90 | Valley of the Four Winds | 交任务方不存在：Tina Mudclaw |
| 30475 | A Gift For Fung | 90 | Valley of the Four Winds | 交任务方不存在：Farmer Fung |
| 30477 | A Gift For Haohan | 90 | Valley of the Four Winds | 交任务方不存在：Haohan Mudclaw |
| 30517 | Farmer Fung's Vote I: Yak Attack | 90 | Valley of the Four Winds | 交任务方不存在：Farmer Fung |
| 30518 | Farmer Fung's Vote II: On the Loose | 90 | Valley of the Four Winds | 交任务方不存在：Farmer Fung |
| 30521 | Haohan's Vote I: Bungalow Break-In | 90 | Valley of the Four Winds | 交任务方不存在：Haohan Mudclaw |
| 30529 | Growing the Farm III: The Mossy Boulder | 90 | Valley of the Four Winds | 交任务方不存在：Haohan Mudclaw |
| 31016 | The Lorewalkers | 90 | Vale of Eternal Blossoms | 无交任务 NPC |
| 31325 | A Very Nice Necklace | 90 | Valley of the Four Winds | 交任务方不存在：Tina Mudclaw |
| 31326 | Tina's Tasteful Tiara | 90 | Valley of the Four Winds | 交任务方不存在：Tina Mudclaw |
| 31328 | An Exquisite Earring | 90 | Valley of the Four Winds | 交任务方不存在：Tina Mudclaw |
| 31329 | A Beautiful Brooch | 90 | Valley of the Four Winds | 交任务方不存在：Tina Mudclaw |
| 31372 | The Tillers | 90 | Valley of the Four Winds | 交任务方不存在：Farmer Yoon |
| 31374 | The Tillers | 90 | Valley of the Four Winds | 交任务方不存在：Farmer Yoon |
| 31454 | A Legend in the Making | 90 | （任务分类 -344） | 无交任务 NPC |
| 31488 | Stranger in a Strange Land | 90 | （任务分类 -344） | 无交任务 NPC |
| 31489 | Stranger in a Strange Land | 90 | （任务分类 -344） | 无交任务 NPC |
| 32118 | Taking Advantage | 90 | （任务分类 -396） | 交任务方不存在：Kaelis Sunsoar |
| 32135 | Hero Killer | 90 | （任务分类 -396） | 无交任务 NPC |
| 32161 | Beastmaster's Hunt: The Crane | 90 | （任务分类 -396） | 无交任务 NPC |
| 32162 | Beastmaster's Hunt: The Tiger | 90 | （任务分类 -396） | 无交任务 NPC |
| 32163 | Beastmaster's Hunt: The Crab | 90 | （任务分类 -396） | 无交任务 NPC |
| 32190 | To Mogujia | 90 | （任务分类 -397） | 无交任务 NPC |
| 32200 | Dangers of Za'Tual | 90 | Isle of Thunder | 交任务方不存在：Halduron Brightwing |
| 32212 | The Assault on Zeb'tula | 90 | Isle of Thunder | 交任务方不存在：Lor'themar Theron |
| 32242 | Buried Secrets | 90 | （任务分类 -397） | 无交任务 NPC |
| 32246 | Meet the Scout | 90 | （任务分类 -397） | 无交任务 NPC |
| 32251 | Dagger in the Dark | 90 | （任务分类 -397） | 无交任务 NPC |
| 32256 | Rise Of An Empire | 90 | （任务分类 -397） | 无交任务 NPC |
| 32257 | Voice of the Gods | 90 | （任务分类 -397） | 无交任务 NPC |
| 32284 | Someone You Should See | 90 | （任务分类 -397） | 无交任务 NPC |
| 32307 | Reader for the Dead Tongue | 90 | （任务分类 -61） | 无交任务 NPC |
| 32318 | Regeneration Takes Time | 90 | （任务分类 -397） | 无交任务 NPC |
| 32326 | Insertion | 90 | （任务分类 -397） | 无交任务 NPC |
| 32327 | The Darnassus Mission | 90 | （任务分类 -397） | 无交任务 NPC |
| 32330 | What's in the Box? | 90 | （任务分类 -397） | 无交任务 NPC |
| 32351 | Echoes of Thunder | 90 | （任务分类 -397） | 无交任务 NPC |
| 32352 | A Gathering Storm | 90 | （任务分类 -397） | 无交任务 NPC |
| 32363 | The Kun-Lai Expedition | 90 | （任务分类 -397） | 无交任务 NPC |
| 32376 | To the Valley! | 90 | （任务分类 -397） | 无交任务 NPC |
| 32391 | The Ruins of Korune | 90 | （任务分类 -397） | 无交任务 NPC |
| 32392 | The Divine Bell | 90 | （任务分类 -397） | 无交任务 NPC |
| 32398 | The Bell Speaks | 90 | （任务分类 -397） | 无交任务 NPC |
| 32399 | Breath of Darkest Shadow | 90 | （任务分类 -397） | 无交任务 NPC |
| 32402 | The Situation In Dalaran | 90 | （任务分类 -397） | 无交任务 NPC |
| 32403 | It Starts in the Sewers | 90 | （任务分类 -397） | 无交任务 NPC |
| 32404 | Violence in the Arena | 90 | （任务分类 -397） | 无交任务 NPC |
| 32405 | Hand of the Silver Covenant | 90 | （任务分类 -397） | 无交任务 NPC |
| 32406 | A Tactical Assault | 90 | （任务分类 -397） | 无交任务 NPC |
| 32449 | The Ruins of Ogudei | 90 | （任务分类 -396） | 无交任务 NPC |
| 32450 | The Time Is Now! | 90 | （任务分类 -396） | 无交任务 NPC |
| 32621 | Lightning Steel | 90 | The Thunder Forges | 无交任务 NPC |
| 32643 | Work Order: Dominance Offensive II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32646 | Work Order: Operation: Shieldwall II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32648 | Work Order: Golden Lotus II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32650 | Work Order: Shado-Pan II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32657 | Work Order: The August Celestials II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32659 | Work Order: The Klaxxi II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32680 | The Storm Gathers | 90 | Isle of Thunder | 交任务方不存在：Lor'themar Theron |
| 32681 | The Storm Gathers | 90 | Isle of Thunder | 无交任务 NPC |
| 32684 | You Want Fish? | 90 | The Halfhill Market | 无交任务 NPC |
| 32709 | Allies in the Shadows | 90 | Isle of Thunder | 交任务方不存在：Taran Zhu |
| 32729 | Za'Tual | 90 | Isle of Thunder | 交任务方不存在：Halduron Brightwing |
| 32943 | Work Order: Sunreaver Onslaught II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 32945 | Work Order: Kirin Tor Offensive II | 90 | Valley of the Four Winds | 无交任务 NPC |
| 33020 | The Lost Secret of the Secret Ingredient | 90 | （任务分类 -304） | 无交任务 NPC |
| 33105 | Judgment of the Black Prince | 90 | （任务分类 -344） | 无交任务 NPC |
| 33138 | Why Do We Fight? | 90 | Siege of Orgrimmar | 无交任务 NPC |
| 33147 | The Last Gasp of Y'Shaarj | 90 | Siege of Orgrimmar | 无交任务 NPC |
| 33248 | Proving Grounds | 90 | （任务分类 -400） | 交任务方不存在：Tiger Temple Monk |
| 33249 | Proving Grounds | 90 | （任务分类 -400） | 交任务方不存在：Tiger Temple Monk |
| 33354 | Den Mother's Demise | 90 | （任务分类 -364） | 无交任务 NPC |

</details>

### 4.7 批次三：任务物品的"标记法术"没人接

这是从审计结果里找出来的一个可以自动修的模式，和 25841 信号弹、13509 War Supplies 一样：

- 任务目标是一个隐形的计数 NPC（带免疫或不可选中标志），除了"杀掉它"以外没有任何计数方式；
- 任务给的物品，法术是对单位的空效果（DUMMY 或 DUMMY 光环），本来应该由计数 NPC 收到法术后给玩家计数；
- 现在两样都缺：法术没有限定目标，会随便打中附近最近的单位；计数 NPC 身上也没有"被命中就计数"的脚本。

`tools/fix_pattern_c.py` 按规则生成修复：

- 给"按编号挑目标"的法术加条件（`conditions` 类型 13），只能打中这些计数 NPC，原本已有条件的不动；
- 给计数 NPC 加 SAI：被这个法术命中时，给施法者计数。

跳过的情况：计数 NPC 已经有 AI 或脚本的，标记法术挂着 C++ 法术脚本的（可能已经在代码里处理了），物品法术不是无害标记的（比如即死、伤害类，需要另想办法）。最后 76 个任务符合条件，涉及 128 个计数 NPC、67 个法术，加了 131 条 SAI、60 条条件。

重启后启动日志里有 15 条提示"这个 NPC 另有一个计数法术"（`There is a killcredit spell for creatureEntry ...`）。意思是库里本来有一个专门给它计数的法术，但审计确认没有任何东西会施放它，所以这里直接计数，不会重复计数。

文件：`sql-custom/2026_11_13_14_audit_pattern_c_mark_spells.sql`，备份：`backup/audit_pattern_c_20261113.tsv`。

<details>
<summary>76 个修复的任务（按等级排序）</summary>

| 任务 | 名称 | 计数标记 NPC | 物品法术 |
|---|---|---|---|
| 14031 | Capturing the Unknown | Capturing The Unknown - Bunny 1（37872）、Capturing The Unknown - Bunny 2（37895）、Capturing The Unknown - Bunny 3（37896）、Capturing The Unknown - Bunny 4（37897） | 68280 |
| 13509 | War Supplies | Shatterspear Supplies Credit Bunny（33056） | 62624 |
| 14308 | When Science Attacks | Secret Lab Fires（36025） | 68283 |
| 13595 | Of Their Own Design | Bathran's Corpse（33183） | 62506 |
| 13815 | Making Stumps | Ashenvale Oak Bunny（34138） | 64605 |
| 13849 | Astranaar's Burning! | Astranaar's Burning! Fire Bunny（34123） | 64558 |
| 13944 | Small Hands, Short Fuse | Broken-down Wagon Bunny（34424） | 65433 |
| 28556 | Breaking the Hand | Sofera's Naze Credit（48862）、Corrahn's Dagger Credit（48864）、The Headland Credit（48865）、Gavin's Naze Credit（48867） | 91085 |
| 25939 | For Peat's Sake | Marsh Fire Bunny（41628） | 77571 |
| 25622 | Burn, Baby, Burn! | Warsong Stockpile（40957） | 65308、76419 |
| 25811 | Shuttin Her Down | Support Clamp Trigger 01（41314）、Support Clamp Trigger 02（41315）、Support Clamp Trigger 03（41316）、Support Clamp Trigger 04（41317） | 77416 |
| 24631 | Flightmare | Wildhammer Mercenary（37977） | 70885 |
| 26531 | Summoning Shadra | Shadra'Alor Northwest Altar Bunny（43067）、Shadra'Alor Southwest Altar Bunny（43068）、Shadra'Alor East Altar Bunny（43069） | 80469 |
| 26558 | Summoning Shadra | Shadra'Alor Northwest Altar Bunny（43067）、Shadra'Alor Southwest Altar Bunny（43068）、Shadra'Alor East Altar Bunny（43069） | 80469 |
| 26922 | The Endless Flow | Scourge Bone Animus Bunny（44360） | 83108 |
| 26978 | Who Needs Cauldrons? | Who Needs Cauldrons: Windmill Credit（44622）、Who Needs Cauldrons: Silo Credit（44623）、Who Needs Cauldrons: Ranch House Credit（44624）、Who Needs Cauldrons: Barn Credit（44625） | 83230 |
| 27161 | The Endless Flow | Scourge Bone Animus Bunny（44360） | 83108 |
| 27296 | Raze Direhorn Post! | North Tent（23751）、Northeast Tent（23752）、East Tent（23753） | 42356 |
| 27429 | Raze Direhorn Post! | North Tent（23751）、Northeast Tent（23752）、East Tent（23753） | 42356 |
| 28047 | Freezing the Pipes | "Freezing the Pipes" Bunny 1（47423）、"Freezing the Pipes" Bunny 2（47424）、"Freezing the Pipes" Bunny 3（47425）、"Freezing the Pipes" Bunny 4（47426） | 88452 |
| 27421 | Amidst Death, Life | Necropolis Flower Controller SE（45486）、Necropolis Flower Controller NE（45487）、Necropolis Flower Controller W（45488） | 84964 |
| 24928 | To The Ground! | Lost Rigger Building 01 Bunny（38660）、Lost Rigger Building 02 Bunny（38662）、Lost Rigger Building 03 Bunny（38665） | 72520 |
| 28615 | Turning the Earth | Winterfall Earth Totem（49177） | 91647 |
| 25720 | The Downfall of Marl Wormthorn | Marl Wormthorn（42334） | 78985 |
| 26187 | The Downfall of Marl Wormthorn | Marl Wormthorn（42334） | 78985 |
| 10087 | Burn It Up... For the Horde! | Invis Alliance Siege Engine - East（18849）、Invis Alliance Siege Engine - West（19008） | 33067 |
| 10129 | Mission: Gateways Murketh and Shaadraz | Legion Transporter: Alpha（19291）、Legion Transporter: Beta（19292） | 33655 |
| 10146 | Mission: The Murketh and Shaadraz Gateways | Legion Transporter: Alpha（19291）、Legion Transporter: Beta（19292） | 33655 |
| 9720 | Balance Must Be Preserved | Umbrafen Steam Pump Credit Marker（17998）、Lagoon Steam Pump Credit Marker（17999）、Marshlight Steam Pump Credit Marker（18002） | 31736 |
| 10913 | An Improper Burial | Slain Auchenai Warrior（21846）、Slain Sha'tar Vindicator（21859） | 39189 |
| 9910 | Standards and Practices | Burning Blade Pyre (01)（18305）、Burning Blade Pyre (02)（18306）、Burning Blade Pyre (03)（18307） | 32205 |
| 10011 | Forge Camp: Annihilated | Fel Cannon: Hate（19067）、Fel Cannon: Fear（19210） | 33531、33532 |
| 10240 | Building a Perimeter | Invis East KV Rune（19866）、Invis NE KV Rune（19867）、Invis West KV Rune（19868） | 34646 |
| 10427 | Creatures of the Eco-Domes | Invis Talbuk Credit（20982） | 35771 |
| 9824 | Arcane Disturbances | Underground Well Credit Marker（18161）、Underground Pond Credit Marker（18162） | 32042 |
| 10408 | Nexus-King Salhadaar | Nexus-King Salhadaar（20454） | 35683 |
| 11232 | Guide Our Sights | Westguard Cannon Credit Trigger East（23957）、Westguard Cannon Credit Trigger West（23972） | 43076 |
| 11245 | Towers of Certain Doom | Skorn Tower NW Bunny（24087）、Skorn Tower E Bunny（24092）、Skorn Tower SW Bunny（24093）、Skorn Tower SE Bunny（24094） | 49634 |
| 11247 | Burn Skorn, Burn! | Skorn Longhouse NW Bunny（24098）、Skorn Longhouse NE Bunny（24100）、Skorn Barracks Bunny（24102） | 43057 |
| 11258 | Burn Skorn, Burn! | Skorn Longhouse NW Bunny（24098）、Skorn Longhouse NE Bunny（24100）、Skorn Barracks Bunny（24102） | 43057 |
| 11259 | Towers of Certain Doom | Skorn Tower NW Bunny（24087）、Skorn Tower E Bunny（24092）、Skorn Tower SW Bunny（24093）、Skorn Tower SE Bunny（24094） | 49625 |
| 11285 | Baleheim Must Burn! | Winterskorn Dwelling Credit（24182）、Winterskorn Watchtower Credit（24183）、Winterskorn Barracks Credit（24184）、Winterskorn Bridge Credit（24185） | 43233 |
| 11330 | Absholutely... Thish Will Work! | Dragonflayer Vrykul Prisoner（24284） | 43386 |
| 11568 | A Return to Resting | Rodin the Reckless（24876） | 45323 |
| 11617 | Hampering Their Escape | North Platform（25441）、East Platform（25442）、West Platform（25443） | 45583 |
| 11796 | Emergency Protocol: Section 8.2, Paragraph D | Northwest Crash（25845）、South Crash（25846）、East Crash（25847） | 46171 |
| 11913 | Take No Chances | Farshire Grain Credit（26161） | 46574 |
| 11314 | The Fallen Sisters | Lurielle（24117） | 43340 |
| 11348 | The Rune of Command | Captive Stone Giant（24345） | 49859 |
| 11352 | The Rune of Command | Captive Stone Giant（24345） | 49859 |
| 11582 | Monitoring the Rift: Sundered Chasm | Borean - Westrift Chasm Anomaly（25308） | 45414 |
| 12728 | Monitoring the Rift: Winterfin Cavern | Borean - Westrift Cavern Anomaly（25309） | 45414 |
| 11547 | Know Your Ley Lines | Sunwell - Quest Bunny - Shrine（25154）、Sunwell - Quest Bunny - Portal（25156）、Sunwell - Quest Bunny - Sunwell（25157） | 45191 |
| 11982 | Raining Down Destruction | Boulder Target（26264） | 47005 |
| 12094 | Latent Power | East Stone（26855）、North Stone（26856）、South Stone（26857） | 47542 |
| 12213 | The Darkness Beneath | Vordrassil's Heart Credit（27263）、Vordrassil's Limb Credit（27264）、Vordrassil's Tears Credit（27265） | 48218 |
| 12267 | Neltharion's Flame | Neltharion's Flame Control Bunny（27450） | 48790 |
| 12154 | Blackout | Dun Argol Power Core（27075） | 47935 |
| 12184 | Cultivating an Image | Mountaineer Kilian（26885） | 48046 |
| 12202 | Cultivating an Image | Mountaineer Kilian（26885） | 48046 |
| 12220 | A Dark Influence | Vordrassil's Heart Credit（27263）、Vordrassil's Limb Credit（27264）、Vordrassil's Tears Credit（27265） | 48218 |
| 12502 | Troll Patrol: High Standards | Drakkari Pedestal 02（28304）、Drakkari Pedestal 03（28305） | 51247 |
| 12588 | Troll Patrol: Can You Dig It? | Ancient Dirt KC Bunny（28330） | 51333 |
| 12591 | Troll Patrol: Throwing Down | Nethurbian Crater KC Bunny（28352） | 51381 |
| 12598 | Throwing Down | Nethurbian Crater KC Bunny（28352） | 51381 |
| 12647 | An End to the Suffering | Rhunok（28416） | 51964 |
| 12669 | So Far, So Bad | Blight Cauldron Bunny 00（28739） | 52227 |
| 12988 | Destroy the Forges! | North Lightning Forge（30209）、Central Lightning Forge（30211）、South Lightning Forge（30212） | 56275 |
| 13119 | Destroying the Altars | First Summoning Altar（30742）、Second Summoning Altar（30744）、Third Summoning Altar（30745）、Fourth Summoning Altar（30950） | 57852 |
| 26375 | Loose Stones | Quartz Rockling（42900） | 80351 |
| 26411 | Apply and Flash Dry | Flint Oremantle（43036） | 80413 |
| 26861 | Block the Gates | Twilight Gate Credit（44930）、Elemental Gate Credit（44931） | 83883 |
| 29966 | Burning Down the House | Alliance Camp（56509） | 106243 |
| 30084 | Borderlands | Red Beacon Bunny（58161）、Green Beacon Bunny（58173） | 110027 |
| 31200 | Fumigation | Building 3 Credit（63708）、Building 6 Credit（63711） | 124301 |
| 31709 | Lingering Doubt | Sha Bunny 1（65663）、Sha Bunny 2（65666） | 129089 |

</details>

### 4.8 批次四：1–19 级的掉落表（模式 A）

审计里"要收集的物品没有来源"这一类，很多其实是掉落表空了：掉这件物品的怪还在、也刷着，只是掉落表里没有这一行。比如贫瘠之地的 King Reaperclaw 有刷新点，可他的 `lootid` 是 0，任务要的角永远掉不出来。

原始的掉落数据找不回来了，但有一个可靠的线索：**客户端缓存里，每个生物和物体都带着一份"身上可能有的任务物品"列表**，在库里是 `creature_template` / `gameobject_template` 的 `questItem1..6`（库里分别有 4366 个生物、1588 个物体填了这份列表）。`tools/fix_pattern_a.py` 就按这份列表还原：

- 列表里有这件物品、并且**有刷新点**的生物：把物品加进它的掉落表，设成任务掉落（掉率写成负数，只有身上有这个任务的玩家才会掉）。任务只要 1 件，或者这个生物刷新点不超过 3 个（多半是有名字的头目），掉率给 100%；其他给 50%。原本 `lootid` 是 0 的，顺手设成自己的编号；
- 列表里有这件物品、并且有刷新点的宝箱类物体：加进宝箱的掉落表，100%；
- 物品本来有别的获取方式（比如对尸体或物体使用道具），只是那个法术没人施放的，不当成掉落问题处理，留给人工。

1–19 级段（扣掉已禁用的任务）的结果：还原了 **40 件物品、93 条掉落**，写库后逐条核对过；**53 条**需要人工处理。

文件：`sql-custom/2026_11_13_15_audit_pattern_a_loot_1_19.sql`，备份：`backup/audit_pattern_a_1_19_20261113.tsv`（相关生物/宝箱原来的 `lootid`/`data1` 和原有的掉落行）。改了模板，所以重启后才生效（已重启）。

有两处值得一提：

- **Elemental Goo（52506）**是珠宝加工日常要的材料，缓存里有 40 个深岩之洲的元素生物带着它，这次都加上了掉落。这个日常的最低等级是 1，所以落在这一段里。
- **Kaja'Cola Zero-One（52483）**的缓存来源同时有怪和三种宝箱，两边都还原了。

<details>
<summary>还原的 40 件物品（按任务编号排序）</summary>

| 任务 | 物品 | 掉落来源（编号，刷新点，掉率） |
|---|---|---|
| 865 | King Reaperclaw's Horn（46850） | King Reaperclaw（34829，1 个刷新点，100%） |
| 13558 | Aetherion's Essence（44929） | Aetherion（33041，1 个刷新点，100%） |
| 13582 | Elune's Torch（46692） | Horoo the Flamekeeper（34385，1 个刷新点，100%） |
| 14056 | Glomp's Booty（46834） | Glomp（34747，1 个刷新点，100%） |
| 14118 | Slab of Venison（47038） | Weakened Mosshoof Stag（35096，48 个刷新点，50%） |
| 14241 | Gyrochoppa Keys（49424） | SI:7 Operative（36103，40 个刷新点，100%）；Gyrochoppa Pilot（36129，3 个刷新点，100%）；SI:7 Operative（36348，10 个刷新点，100%） |
| 14249 | Pristine Thunderhead Feather（49068） | Thunderhead Hippogryph（6375，67 个刷新点，50%）；Thunderhead Stagwing（6377，11 个刷新点，50%） |
| 14401 | Chance the Cat（49281） | Lucius the Cruel（36461，1 个刷新点，100%） |
| 14429 | Attuned Runestone（49359） | Apprentice Investigator（36592，15 个刷新点，50%）；Apprentice Illuminator（36593，13 个刷新点，50%） |
| 14431 | Blackmaw Intelligence（49364） | Talrendis Biologist（36611，13 个刷新点，100%） |
| 14433 | Ambassador's Robes（49366） | Talrendis Ambassador（36614，8 个刷新点，100%） |
| 14464 | Grunwald's Head（49540） | Captain Grunwald（36680，1 个刷新点，100%） |
| 24439 | The Head of Jarrodenus（49674） | Commander Jarrodenus（36884，1 个刷新点，100%） |
| 24675 | Side of Stag Meat（50219） | Brown Stag（37786，28 个刷新点，50%） |
| 24816 | Shark Parts（50381） | Ravenous Lurker（36681，34 个刷新点，50%） |
| 24859 | Intact Naga Hide（50437） | Vashj'elan Warrior（38359，34 个刷新点，50%）；Vashj'elan Siren（38360，37 个刷新点，50%） |
| 24954 | Fire Gland（52035） | Child of Volcanoth（38845，42 个刷新点，50%） |
| 24981 | Urgent Scarlet Memorandum（52077） | Scarlet Missionary（1536，15 个刷新点，100%）；Scarlet Zealot（1537，22 个刷新点，100%）；Captain Perrine（1662，1 个刷新点，100%）；Slain Scarlet Zealot（39086，16 个刷新点，100%） |
| 25056 | Plagued Bruin Hide（52270） | Plagued Bruin（39049，42 个刷新点，50%） |
| 25093 | Commander Arrington's Head（52346） | Commander Arrington（39141，2 个刷新点，100%） |
| 25093 | Darkblade Cyn's Head（52347） | Darkblade Cyn（39142，3 个刷新点，100%） |
| 25110 | Kaja'Cola Zero-One（52483） | Brute Overseer（39193，35 个刷新点，100%）；宝箱 Kaja'Cola Zero-One（202552，15 个刷新点，100%）；宝箱 Kaja'Cola Zero-One（202553，12 个刷新点，100%）；宝箱 Kaja'Cola Zero-One（202554，16 个刷新点，100%） |
| 25156、25162 | Elemental Goo（52506） | Sun-Touched Servant（39366，2 个刷新点，100%）；Sun-Touched Speaker（39373，1 个刷新点，100%）；Ascended Windwalker（39414，2 个刷新点，100%）；Ascended Flameseeker（39415，2 个刷新点，100%）；Spatial Flux（39612，2 个刷新点，100%）；Flux Animator（40033，2 个刷新点，100%）；Spatial Anomaly（40170，2 个刷新点，100%）；Ascended Rockbreaker（40272，3 个刷新点，100%）；Ascended Waterlasher（40273，3 个刷新点，100%）；Void Lord（41364，1 个刷新点，100%）；Compelled Elemental（42210，22 个刷新点，50%）；Fungal Behemoth（42475，45 个刷新点，50%）；Irestone Rumbler（42527，150 个刷新点，50%）；Gorged Gyreworm（42766，10 个刷新点，50%）；Irestone Rumbler（42780，34 个刷新点，50%）；Stonecore Magmalord（42789，10 个刷新点，50%）；Crystalspawn Giant（42810，3 个刷新点，100%）；Ravenous Tunneler（42925，7 个刷新点，50%）；Deepstone Elemental（43026，28 个刷新点，50%）；Living Blood（43123，49 个刷新点，50%）；Mercurial Ooze（43158，39 个刷新点，50%）；Energized Geode（43254，65 个刷新点，50%）；Lodestone Elemental（43258，42 个刷新点，50%）；Pulsing Geode（43374，48 个刷新点，50%）；Corborus（43438，1 个刷新点，100%）；Temperamental Rumbler（43480，24 个刷新点，50%）；Defaced Earthrager（44076，28 个刷新点，50%）；Earthbound Rumbler（44078，54 个刷新点，50%）；Jade Rager（44220，72 个刷新点，50%）；Gyreworm（44257，46 个刷新点，50%）；Gorged Gyreworm（44259，29 个刷新点，50%）；Desecrated Earthrager（44683，30 个刷新点，50%）；Maziel（44967，2 个刷新点，100%）；Greater Quicksilver Ooze（44988，15 个刷新点，50%）；Elemental Overseer（45084，11 个刷新点，50%）；Scion of Al'Akir（45755，24 个刷新点，50%）；Sweeping Winds（51672，29 个刷新点，50%） |
| 25193 | Durotar Crocolisk Tooth（60615） | Dreadmaw Crocolisk（3110，47 个刷新点，50%）；Dreadmaw Toothgnasher（39452，69 个刷新点，50%） |
| 25202 | Still-Beating Heart（52531） | Chip Endale（39363，2 个刷新点，100%） |
| 25232 | Burning Blade Spellscroll（52564） | Burning Blade Thug（3195，5 个刷新点，50%）；Burning Blade Neophyte（3196，5 个刷新点，50%）；Burning Blade Cultist（3199，4 个刷新点，50%） |
| 25243 | Fickle Heart（52559） | Candy Cane（39426，3 个刷新点，100%） |
| 26220 | Swine Belly（57758） | Mature Swine（42504，22 个刷新点，50%）；Wild Mature Swine（42859，44 个刷新点，50%） |
| 26445、26449 | Seeker's Fel Spear（45476） | Diathorus the Seeker（6072，1 个刷新点，100%） |
| 26445、26449 | Gorgannon's Flaming Blade（45477） | Gorgannon（17300，1 个刷新点，100%） |
| 26560 | Jorgensen's Cage Key（58969） | Utroka the Keymistress（43350，1 个刷新点，100%） |
| 26562 | Blackrock Lever Key（59033） | Overlord Barbarius（43369，1 个刷新点，100%） |
| 26571 | Keeshan's Bow（58953） | Murdunk（43327，1 个刷新点，100%） |
| 26571 | Keeshan's Survival Knife（58954） | Homurk（43329，1 个刷新点，100%） |
| 26862 | Searing Binding（60499） | Molten Elemental（11321，8 个刷新点，50%） |
| 27082 | Diseased Organ（60793） | Rabid Worg（1766，96 个刷新点，50%）；Giant Rabid Bear（1797，104 个刷新点，50%） |
| 27575 | Dempsey's Torso（61506） | Marsh Crocolisk（45896，24 个刷新点，100%） |
| 27575 | Dempsey's Appendages（61507） | Marsh Crocolisk（45896，24 个刷新点，100%） |
| 27575 | Dempsey's Giblets（61508） | Marsh Crocolisk（45896，24 个刷新点，100%） |
| 28199 | Flesh Sample（63254） | Risen Hillsbrad Farmer（47859，21 个刷新点，50%）；Risen Hillsbrad Peasant（47861，31 个刷新点，50%） |

</details>

<details>
<summary>53 条需要人工处理的物品</summary>

| 任务 | 名称 | 物品 | 原因 |
|---|---|---|---|
| 13566 | Ritual Materials | Moonstalker Whisker（44969） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 13566 | Ritual Materials | Thistle Bear Fur（45885） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 13626 | Respect for the Fallen | Feero's Holy Hammer（45042） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 13626 | Respect for the Fallen | The Purifier's Prayer Book（45043） | 缓存里没有任何来源 |
| 13842 | Dread Head Redemption | Durak's Head（60638） | 缓存里的来源没有刷新点（2 个生物, 0 个物体） |
| 13871 | Security! | Kaldorei Assassin's Head（46147） | 缓存里的来源没有刷新点（1 个生物, 0 个物体） |
| 14034 | Club Foote | Ship Schematics（46827） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14050 | Gazlowe's Fortune | Gazlowe's Treasure Chest（46833） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14109 | The New You | Shiny Bling（47045） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14109 | The New You | Hip New Outfit（47046） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14109 | The New You | Cool Shades（47047） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14110 | The New You | Shiny Bling（47045） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14110 | The New You | Hip New Outfit（47046） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14110 | The New You | Cool Shades（47047） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14121 | Robbing Hoods | Stolen Loot（47530） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14122 | The Great Bank Heist | Personal Riches（46858） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14123 | Waltz Right In | Maldy's Falcon（48937） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14123 | Waltz Right In | The Goblin Lisa（48939） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14123 | Waltz Right In | The Ultimate Bomb（48941） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14124 | Liberate the Kaja'mite | Kaja'mite Chunk（48766） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14134 | The Captain's Logs | Azshara Lumber（47050） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14323 | Absorbent | Simmering Water Droplet（49172） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 14324 | Full of Hot Water | Globe of Boiling Water（49174） | 缓存里的来源没有刷新点（1 个生物, 0 个物体） |
| 14385 | Azsharite Experiment Number One | Giant-Sized Laxative（49230） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 14469 | Hand-me-downs | Military Supplies（49599） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 25260 | Fizzled | Fizzle's Orb（52580） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 26177 | Feeling Crabby? | Canal Crab（57175） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 26414 | Hitting a Walleye | Hardened Walleye（58503） | 缓存里没有任何来源 |
| 26420 | Diggin' For Worms | Crystal Bass（58787） | 缓存里没有任何来源 |
| 26536 | Thunder Falls | Violet Perch（58899） | 缓存里没有任何来源 |
| 26556 | No Dumping Allowed | Toxic Puddlefish（58945） | 缓存里没有任何来源 |
| 26557 | A Staggering Effort | Sandy Carp（58946） | 缓存里没有任何来源 |
| 26588 | A Furious Catch | Giant Furious Pike（58951） | 缓存里没有任何来源 |
| 26858 | Taragaman the Hungerer | Taragaman the Hungerer's Heart（14540） | 缓存里的来源没有刷新点（1 个生物, 0 个物体） |
| 27577 | 7th Legion Battle Plans | 7th Legion Battle Plan（61510） | 缓存里的来源没有刷新点（2 个生物, 0 个物体） |
| 28114 | Glorious Harvest | Creeper Egg（63029） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 28799 | Might of the Earthen | Dwarf Rune Stone（52843） | 缓存里没有任何来源 |
| 28801 | Tol'vir Heiroglyphics | Tol'vir Hieroglyphic（64397） | 缓存里没有任何来源 |
| 29261 | Zul'Aman Voodoo | Troll Tablet（63128） | 缓存里没有任何来源 |
| 29317 | Fish Head | Severed Abomination Head（69901） | 缓存里没有任何来源 |
| 29319 | Tadpole Terror | Giant Flesh-Eating Tadpole（69905） | 缓存里没有任何来源 |
| 29320 | Like Pike? | Corpse-Fed Pike（69909） | 缓存里没有任何来源 |
| 29323 | Stocking Up | Lake Whitefish（69912） | 缓存里没有任何来源 |
| 29342 | Cold Water Fishing | Arctic Char（69931） | 缓存里没有任何来源 |
| 29345 | Pond Predators | Azshara Snakehead（69934） | 缓存里没有任何来源 |
| 29348 | The Race to Restock | Randy Smallfish（69964） | 缓存里没有任何来源 |
| 29348 | The Race to Restock | Amorous Mud Snapper（69967） | 缓存里没有任何来源 |
| 29352 | A Fowl Shortage | Dun Morogh Chicken（69982） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 29353 | Keepin' the Haggis Flowin' | Bag o' Sheep Innards（69984） | 缓存里没有任何来源 |
| 29401 | Blown Away | Windswept Balloon（71034） | 缓存里的来源没有刷新点（0 个生物, 2 个物体） |
| 29402 | Taking Precautions | Blood Nettle（71035） | 缓存里的来源没有刷新点（0 个生物, 1 个物体） |
| 29509 | Putting the Crunch in the Frog | Crunchy Frog（72058） | 本来靠法术获得（对物体/尸体使用道具等），该法术没人施放 |
| 29513 | Spoilin' for Salty Sea Dogs | Great Sea Herring（73269） | 缓存里没有任何来源 |

</details>

### 4.9 批次五：1–19 级"目标不存在"，先修矮人路线

这一类没有统一的模式，几乎每个任务都是一个独立的机制：对话、坐载具、演出事件、伪装潜入……一个个查。名单里标成"联盟"的 42 个任务也不全准：银松森林、贫瘠之地、艾萨拉、科赞的发任务 NPC 是中立阵营，被误算成了联盟。我按小朋友的路线排了顺序，先修矮人会经过的这几个。

**名字对应的计数（模式 C2，`tools/fix_pattern_c2.py`）。** 查 26868 时发现了第三批的一个变种：任务计数用的是一个叫"某某 Credit"的隐形 NPC（没有刷新点），而真正要标记的是同名的那个刷新着的 NPC；任务物品的法术是无害的标记，却没有限定目标，被标记的 NPC 身上也没有给计数的脚本。规则：计数 NPC 名字去掉 Credit 之类的后缀后，正好对应唯一一个有刷新点、没有 AI 的 NPC，就给法术加目标条件，再给那个 NPC 加"被命中就给计数"的 SAI。1–19 级段命中 2 个任务（全库只有 4 个），文件 `sql-custom/2026_11_13_16_audit_pattern_c2_1_19.sql`，备份 `backup/audit_pattern_c2_1_19_20261113.tsv`。

| 任务 | 名称 | 修法 |
|---|---|---|
| 26868 | Axis of Awful（洛克莫丹） | 信息素法术 82799 只能打中 Mosshide Representative（44262）；它被打中时给计数 44266（模式 C2） |
| 14348 | You Can't Take 'Em Alone（吉尔尼斯） | 火药桶法术 68555 打中 Horrid Abomination（36231）时给计数 36233（模式 C2） |
| 26727 | The Embalmer's Revenge（暮色森林） | 真正的 Stitches（412）没有刷新点，被打死也不给计数。改成：从 Lord Ello Ebonlocke 接任务时，在暮色镇南入口（守夜人 Watcher Mocarski 旁边）召唤 Stitches 冲向玩家；把 412 的 `KillCredit1` 设成计数 NPC 43862。脱战 2 分钟后消失。召唤点是我们选的 |
| 29347 | Live Bait（铁炉堡钓鱼日常） | 两个目标都靠区域触发点给，但触发点没绑脚本。用 `SmartTrigger` 补上：带着诱饵光环 99435 跳进 Helm's Bed 湖（触发点 6854）→"抓到小龙虾"；走到 Cook Ghilm 身边（触发点 6853，他正好站在上面）→"交给 Cook Ghilm"，条件是上一个目标已完成（条件类型 48，任务目标进度） |
| 29356 | I Need to Cask a Favor（铁炉堡烹饪日常） | 扛起酒桶的法术 99491 自带第一个目标的计数；扛着酒桶走到铁炉堡的 Daryl Riknussun 身边（触发点 6855）→"送达"，同时卸下酒桶 |

文件：`sql-custom/2026_11_13_17_embalmers_revenge_stitches.sql`（备份 `backup/stitches_20261113.tsv`）、`sql-custom/2026_11_13_18_ironforge_dailies_areatriggers.sql`。重启后启动日志提示库里另有一个给"抓到小龙虾"计数的法术 99424，但同样没有任何东西施放它。

### 4.10 批次六：1–19 级事件型任务，先修西部荒野

"事件型任务没有触发"这一类里，有一大半是节日任务（万圣节灭火、仲夏节抛火炬、儿童周），平时本来就接不到，先不动。剩下的联盟任务里，最重要的是西部荒野 10 级左右的主线剧情。

这几段剧情的演出 NPC（Lou 的旧房子 42500、往日幻象 42693、Helix Gearbreaker 42655、Vanessa VanCleef 42371/42372……）**没有脚本、没有刷新点，`creature_text` 里也一条原版台词都没有**，`zone_westfall.cpp` 里同样没有。要还原演出只能自己编台词，那就不是原版了。所以和新手岛的 30767 一样做最小修复：**保留玩家要做的动作，跳过演出，任务事件直接完成。**

| 任务 | 名称 | 修法 |
|---|---|---|
| 26228 | Livin' the Life | 道具 Two-Shoed Lou's Old House（法术 79262）要求附近有施法焦点 1672，但**整个库里没有任何物体提供这个焦点**，道具在哪都用不了。新建了一个隐形的焦点物体（模板 910100，半径 15 码），刷在 Jangolode 矿洞深处：洞里的狗头人刷新点比地表低十几到五十码，挑的是头顶岩层最厚的那一簇（−9938, 1458, 40），位置是我们推测的。召唤出来的旧房子给召唤者完成任务，10 秒后消失 |
| 26290 | Secrets of the Tower | 隐身药水（79528）只能在 Mortwake's Tower 里喝（区域组 2661 只含这座塔）。用 `spell_linked_spell` 让喝药水时联动施放 79534（对 25 码内的单位完成任务）。塔是建筑模型，地形数据里查不到它的范围，附近也没有可用的区域触发点，所以用这个办法代替"找到 Helix" |
| 26320 | A Vision of the Past | 死亡矿井里的焦点物体是有的；召唤出来的往日幻象给召唤者完成任务，10 秒后消失 |
| 26322 | Rise of the Brotherhood | 这个任务本身就只是"见证"哨兵岭的一段剧情。剧情不存在，改成从 Marshal Gryan Stoutmantle 接任务时直接完成，然后去暴风城找 King Varian Wrynn 交 |

文件：`sql-custom/2026_11_13_19_westfall_events.sql`，备份：`backup/westfall_events_20261113.tsv`。

同一类里还有两个护送任务（黑海岸 5713、秘血岛 9759），以及部落那边的几个，留到后面。

### 4.11 批次七：两个护送任务

两个任务的发任务 NPC 都在，但没有脚本、没有路径点，上游 git 历史里也从来没有过对应代码。用 SAI 重建（文件 `sql-custom/2026_11_13_20_escorts_aynasha_legoso.sql`，备份 `backup/escorts_aynasha_legoso_20261113.tsv`）：

| 任务 | 名称 | 修法 |
|---|---|---|
| 5713 | One Shot. One Kill.（黑海岸） | 进攻 Aynasha 的 Blackwood Tracker（11713）和 Marosh the Devious（11714）没有刷新点。改成：接任务后先冲上来 2 个 Tracker，25 秒后再来 2 个，50 秒后 Marosh 出场；Marosh 死后，60 码内接了任务的玩家都算完成。Aynasha 站在坡底（脚下 87，12 码外的地面有 90–105），直接按她的位置加偏移召唤会把敌人埋进山里，所以召唤点是从地图高度里挑的西北侧平地。波数、间隔是我们定的 |
| 9759 | Ending Their World（秘血岛） | Sironas（17678）有刷新、能打，周围的 Sunhawk 守卫和线圈也都在，只是没有东西给完成。改成：接任务后 Legoso 跟着玩家走（10 分钟没完成就回原位）；Sironas 死后，60 码内接了任务的玩家都算完成，Legoso 离开。原版"在线圈上安放炸药"的演出没有重做 |

### 4.12 批次八：侏儒、黑海岸、狼人新手区

为了加快速度写了个检查工具 `tools/qinspect.py`：给一个任务编号，一次列出任务目标、计数 NPC 以及谁能给它计数、任务物品和它的整条法术链（含施法焦点和区域限制）、发任务/交任务 NPC 和它们的刷新/脚本状态。

这一批里，**有原版机制可以接上的就接上；载具或整段剧情根本不存在的，按前面的做法跳过演出**。

| 任务 | 名称 | 原因 | 修法 |
|---|---|---|---|
| 26318 | Finishin' the Job（侏儒） | 要启动的引爆器 204042 没有刷新点 | 刷在 Frostmane Hold 洞底 Boss Bruggor 旁边（位置我们定的）；点击即计数 |
| 26205 | A Job for the Multi-Bot（侏儒） | 召唤清洁机器人的法术没人施放；召唤属性 2980 是"小宠物"类型，核心只对真的战斗宠物做跟随；机器人也没有清洁脚本 | 接任务时对玩家施放 79419 召唤机器人；机器人跟随主人，靠近有毒水池 6 码时给主人计数（79422），水池消失后正常重刷 |
| 26364 | Down with Crushcog!（侏儒） | 大军围攻 83 级、20 倍血的 Crushcog，整场战斗没有脚本 | 对 Mekkatorque 选"I'm ready to start the assault."（库里原有的对话选项）直接计数，只对任务未完成的人显示 |
| 13547 | Coaxing the Spirits（黑海岸） | 4 具遗体和召唤灵魂的法术都在，就是不能点 | 加右键点击：遗体对点击者施放各自的法术（计数 + 召唤灵魂），要接了任务 |
| 13910 | A New Home（黑海岸） | 建房道具发出事件 21678，没有事件脚本 | `event_scripts` 加一条给施法者计数（命令 8） |
| 13925 | An Ounce of Prevention（黑海岸） | 树苗法术没有目标限制，动物没有脚本 | 只能对任务里写的四种动物用；被打中时给施法者计数 |
| 13580 | Soothing the Elements（黑海岸） | 图腾要求的施法焦点 1610 没有物体；图腾没有 AI | 新建隐形焦点 910101，放在 Blazing Strand 最高的礁石上（任务说的 Jagged Reef 在地形数据里查不到，半径放宽到 20 码）；图腾召唤后 8 秒、25 秒各来 2 个 Unbound Fire Elemental 攻击图腾，撑到 45 秒就给召唤者计数（波数、时间是我们定的） |
| 13892、13948 | Leave No Tracks、Stepping Up Surveillance（黑海岸） | 侦察计数法术没人施放 | Master's Glaive 里本来就有两个区域触发点：地面的 5456 和高处平台的 5455，带着黑豹伪装（65426）进去分别计数 |
| 13518 | The Last Wave of Survivors（黑海岸） | 4 个幸存者都没有刷新点 | 刷在奥伯丁废墟里 13547 那 4 具遗体旁边（位置按地图高度挑的）；接了任务的玩家走到 10 码内就算找到 |
| 13514 | The Ancients' Ire（黑海岸） | 杀巨魔能计数；摧毁建筑要驾驶复仇守护者，但它不是载具、也不能点 | 退一步：接了任务的玩家走到营地建筑 8 码内就算摧毁一座（48 个计数标记，消失后重刷） |
| 13885 | In Defense of Darkshore（黑海岸） | 角鹰兽不是载具，空中事件不存在 | 跳过演出：对 Orseus 选"借角鹰兽"的对话选项，直接给齐 3×8 计数 |
| 14386 | Leader of the Pack（吉尔尼斯） | 不卡任务（Thyala 自己能打）；哨子召唤的猎犬出现在玩家身边 | 给法术加条件，猎犬出现在 Thyala 身边 |
| 14395 | Gasping for Breath（吉尔尼斯） | 能点溺水守卫，但没有"救起"的计数 | 点过的守卫跟着玩家（阶段 1），走到 Prince Liam 10 码内计数，取消玩家身上的载人状态，守卫离开 |
| 14416 | The Hungry Ettin（吉尔尼斯） | 山地马能骑，送到 Lorna 那里没有计数 | 骑着马（上车切到阶段 1，下车回到 0）走到 Lorna 10 码内，计数 1 次并放走马；任务要 5 匹，所以要跑 5 趟 |
| 24904、26706 | The Battle for Gilneas City、Endgame（吉尔尼斯） | 两场大战都没有脚本 | 跳过演出：从 Lorna Crowley 接任务时直接计数，交任务的人在别处，仍要走过去交 |

文件（各自都有 `backup/*_20261113.tsv` 备份）：`sql-custom/2026_11_13_21_gnome_start_quests.sql`、`2026_11_13_22_down_with_crushcog.sql`、`2026_11_13_23_darkshore_quests.sql`、`2026_11_13_25_darkshore_part2.sql`、`2026_11_13_24_gilneas_quests.sql`。重启后启动日志只有"另有计数法术但没人施放"的提示。

**"跳过演出"的任务一览**（到这里为止）：26322、26364、13885、24904、26706，以及 26228/26290/26320 这几个只保留了动作的。以后如果找到原版的台词和流程，这些都值得回头补。

### 4.13 批次九：1–19 级任务物品的人工清单

4.8 那批里留下的"靠别的方式获得"的物品，按联盟这边逐个接上（文件 `sql-custom/2026_11_13_26_item_sources_1_19.sql`，备份 `backup/item_sources_1_19_20261113.tsv`）。

**钓鱼日常。** 这些任务鱼在库里没有任何钓鱼掉落。核心钓鱼时先查小区域（subzone）的表，没有才退回大区（`GameObject::getFishLoot`），所以给每个钓点单独建一张小区域表：抄一份大区原有的普通鱼，再加上任务鱼（任务掉落，50%）。这样只有在那片水里才钓得到，别处不受影响。

| 任务 | 名称 | 鱼 | 钓点 |
|---|---|---|---|
| 29342 | Cold Water Fishing（铁炉堡） | Arctic Char | Helm's Bed Lake（212） |
| 26536 | Thunder Falls（暴风城） | Violet Perch | Thunder Falls（61） |
| 26414 | Hitting a Walleye（暴风城） | Hardened Walleye | Stormwind Lake（5314） |
| 26420 | Diggin' For Worms（暴风城） | Crystal Bass | Olivia's Pond（5316），而且要挂着鱼饵光环 80534（掉落条件） |
| 29323 | Stocking Up（达纳苏斯） | Lake Whitefish | 达纳苏斯全城（加进大区 1657 的表） |

**点击拾取。** 这几样东西都是"玩家先对目标用一个空标记法术，目标再把物品交给玩家"，但目标既不能点、也没有反应：

| 任务 | 名称 | 目标 | 修法 |
|---|---|---|---|
| 29352 | A Fowl Shortage（铁炉堡） | Dun Morogh Chicken（69 只） | 点鸡 → 99486 → 鸡对玩家施放 99487（给鸡）后消失 |
| 26177 | Feeling Crabby?（暴风城） | Canal Crab（20 只） | 点螃蟹 → 78974 → 78975（给螃蟹）后消失 |
| 13626 | Respect for the Fallen（灰谷） | Feero Ironhand、Delgren the Purifier 的遗体 | 点 Feero → 62837 → 62838（给锤子）；点 Delgren → 62839 → 库里没有"给书"的法术，用 SAI 直接把祈祷书放进背包 |

都只对接了任务、未完成的人生效。

**13566 Ritual Materials（黑海岸）。** 月夜猎手胡须和蓟熊毛皮只能从"Force ..."法术（62512、64116，把物品直接交给目标）拿到，没人施放。改成：这几种动物被打死时，对凶手施放（凶手要接了任务）。

**还剩的：** 29353 Keepin' the Haggis Flowin' 的 Bag o' Sheep Innards 在库里和客户端缓存里都查不到来源，暂时没修；暗月马戏团的两个任务和 29412 Blown Away（气球物体没有刷新点）只在活动期间出现，先放着。

### 4.14 批次十：20–29 级

**掉落表（模式 A）。** 这一段跑出来时发现规则要补一条：荆棘谷那本书的散页（Green Hills of Stranglethorn - Page 14）在客户端缓存里挂在荆棘谷**一百四十多种怪**身上，按"只要 1 件就给 100%"会变成任何怪都必掉。原版这类散页是全区随机低概率掉落，所以加了一条：**一件物品挂在 8 种以上的怪身上，掉率统一给 10%**。1–19 级那批里的 Elemental Goo（挂在 40 种怪上）也一并改回 10%。这一段还原了 32 件物品、205 条掉落，逐条核对过（`sql-custom/2026_11_13_27_audit_pattern_a_loot_20_29.sql`）。

<details>
<summary>20–29 级还原的 32 件物品</summary>

| 任务 | 物品 | 掉落来源 |
|---|---|---|
| 13967 | Furbolg Ear（46741） | Foulweald Warrior（3743，11 个刷新点，50%）；Foulweald Pathfinder（3745，3 个刷新点，100%）；Foulweald Totemic（3750，12 个刷新点，50%）；Foulweald Pathfinder（52161，14 个刷新点，50%） |
| 24513 | Captain Peake's Eyeballs（49771） | Captain Peake（37157，1 个刷新点，100%） |
| 24571 | Writhing Seed（49876） | Lashvine（37093，45 个刷新点，50%） |
| 24574 | Squirming Heart（49883） | Outgrowth（37092，27 个刷新点，100%） |
| 25730, 26043 | Cragjaw's Huge Tooth（55239） | Cragjaw（41064，1 个刷新点，100%） |
| 25741 | Deepmoss Venom Sac（55280） | Deepmoss Creeper（4005，35 个刷新点，50%）；Deepmoss Webspinner（4006，14 个刷新点，50%）；Deepmoss Venomspitter（4007，21 个刷新点，50%）；Queen Silith（41185，1 个刷新点，100%） |
| 25837 | Ram Haunch（56040） | Stonetalon Ram（34894，95 个刷新点，50%） |
| 25837 | Boulderslide Cheese（56042） | Boulderslide Rock Keeper（11915，10 个刷新点，50%）；Boulderslide Geomancer（11917，13 个刷新点，50%）；Boulderslide Stonepounder（11918，11 个刷新点，50%） |
| 25913 | Sentinel's Glaive（56187） | Corrupted Sentinel（34969，16 个刷新点，50%） |
| 25935 | Black Dragon Whelp Filet（56223） | Black Dragon Whelp（34898，100 个刷新点，50%） |
| 26060 | Stormer Heart（56796） | Cliff Stormer（4008，20 个刷新点，100%） |
| 26061 | Stonetalon Ram Horns（56797） | Stonetalon Ram（34894，95 个刷新点，50%） |
| 26269 | Green Hills of Stranglethorn - Page 14（57990） | 144 种怪（全区随机掉落，10%） |
| 26330 | Gan'zulah's Body（58179） | Gan'zulah（1061，1 个刷新点，100%） |
| 26332 | Skullsplitter Mojo（58201） | Skullsplitter Warrior（667，6 个刷新点，50%）；Skullsplitter Axe Thrower（696，16 个刷新点，50%）；Skullsplitter Mystic（780，9 个刷新点，50%） |
| 26360 | Braddok's Big Brain（58225） | Braddok（42858，1 个刷新点，100%） |
| 26485 | Snapjaw Gizzard（58867） | Saltwater Snapjaw（2505，81 个刷新点，50%） |
| 26730 | Sea Salt（60274） | Murkgill Forager（4457，6 个刷新点，50%）；Murkgill Hunter（4458，10 个刷新点，50%）；Murkgill Coldbringer（4460，3 个刷新点，100%）；Murkgill Warrior（4461，11 个刷新点，50%） |
| 26733 | Crystal Spine Basilisk Blood（60213） | Crystal Spine Basilisk（689，40 个刷新点，50%） |
| 26734 | Whispering Blue Stone（60263） | 9 种怪（全区随机掉落，10%） |
| 26823 | Ironjaw Humour（60380） | Ironjaw Behemoth（44113，6 个刷新点，100%） |
| 27337, 27343 等 11 个 | Deathless Sinew（60874） | Frantic Geist（47131，25 个刷新点，50%）；Dark Creeper（47132，12 个刷新点，50%）；Corpse Eater（47134，10 个刷新点，50%）；Fetid Ghoul（47135，3 个刷新点，100%）；Unstable Ravager（47136，4 个刷新点，50%） |
| 27337, 27365 | Silverlaine Family Sword（60885） | Baron Silverlaine（3887，1 个刷新点，100%） |
| 27343, 27361 等 11 个 | Commander's Holy Symbol（60879） | Commander Springvale（4278，1 个刷新点，100%） |
| 27344, 27395 | Godfrey's Crystal Scope（60877） | Lord Godfrey（46964，1 个刷新点，100%） |
| 27351, 27396 | Springvale's Sharpening Stone（60880） | Commander Springvale（4278，1 个刷新点，100%） |
| 27353, 27354 等 14 个 | Ghostly Essence（60875） | Tormented Officer（3873，5 个刷新点，50%）；Haunted Servitor（3875，12 个刷新点，50%）；Wailing Guardsman（3877，10 个刷新点，50%）；Shadowy Attendant（47231，9 个刷新点，50%）；Ghostly Cook（47232，4 个刷新点，50%） |
| 27353, 27397 | Walden's Talisman（60881） | Lord Walden（46963，1 个刷新点，100%） |
| 27355, 27402 | Tenebrous Orb（60882） | Lord Godfrey（46964，1 个刷新点，100%） |
| 27356, 27404 | Walden's Elixirs（60876） | Lord Walden（46963，1 个刷新点，100%） |
| 28484 | Beating Yeti Heart（64380） | Cave Yeti（2248，18 个刷新点，50%）；Ferocious Yeti（48628，16 个刷新点，50%） |
| 28489 | Juicy Stag Meat（64410） | Hill Stag（48184，15 个刷新点，50%） |

</details>

**名字对应的计数（模式 C2）。** 只命中 1 个：28495 A Fighting Chance（奥特兰克山脉的小鹿，`2026_11_13_28_audit_pattern_c2_20_29.sql`）。

**逐个修的：**

| 任务 | 名称 | 原因 | 修法 |
|---|---|---|---|
| 25867 | Gnoll Escape（湿地） | 钥匙能打开笼子（机关），但笼子的事件编号是 0 | 给笼子一个自定义事件 910001，事件脚本给开笼者计数 |
| 26128 | The Battle of Thandol Span（湿地） | Calamoth Ashbeard 没有刷新点，模板还是占位数据（1 级、友好） | 改成黑铁阵营 24 级、3 倍血，刷在大桥那头的暮光信徒旁边（任务说明："逃向大桥的那个黑铁矮人"）。位置和等级是我们定的 |
| 26546 | Razorbeak Friends（辛特兰） | 饲料没有目标限制，狮鹫没有反应 | 只能喂训练过的狮鹫，喂到就计数 |
| 26739 | I Think She's Hungry（北荆棘谷） | 迅猛龙宝宝没有 AI，从来不吃 | 宝宝跟随主人；接了任务的玩家每杀一只水晶脊蜥蜴算宝宝吃 5 口（原版大约杀 8 只，共 40 口） |
| 13913 | They Took Our Gnomes（灰谷） | Thundrak 和两个侏儒都在，就是没有完成触发 | 打死 Painmaster Thundrak，40 码内接了任务的玩家都算完成 |
| 13928 | Recover the Fallen（灰谷） | 遗体物品没有任何来源 | 点笑面姐妹的遗体，直接放进背包，遗体消失后重刷 |
| 14213、14358 | Ten Pounds of Flesh（凄凉之地，联盟/部落两版） | 献祭法术要的施法焦点 1626 没有物体，被献祭的火盆标记也没刷 | 在 Elune 火盆旁边新建隐形焦点 910102、刷出标记，标记被献祭就计数 |
| 25662 | Free Our Sisters（石爪山脉） | 钥匙能开笼子（按钮类机关），笼子没有脚本 | 开锁时核心会先调用物体 AI 的 `GossipHello`，所以给 15 种笼子挂物体 SAI：被打开就计数，里面的女猎手离开 |
| 25809 | Leave No Man Behind!（石爪山脉） | 67 个矿工带"不可选中"标志，点不到 | 去掉这个标志，加点击：矿工对点击者施放 77408 计数，然后跑掉 |
| 24566 | Sowing a Solution（南贫瘠之地） | 种子没有目标限制，动物没反应 | 只能对异种恐牙/平原陆行鸟用，打中就计数 |
| 24570 | Adder Subtraction（南贫瘠之地） | 衰弱毒蛇没法拾取 | 点击毒蛇 → 70441 → 毒蛇对玩家施放 70442（给物品）后消失 |
| 13853、13886、13935 | Return Fire、Vortex、Defend the Tree!（灰谷） | 都靠载具战斗：投石车不能上、没技能；旋风和影子形态不可用；13935 要打的 50 个战歌入侵者根本没刷 | 跳过演出：接任务即给计数 |
| 25891、24601、24939 | Last Ditch Effort、The Nightmare Scar、Run Out the Guns | 剧情、Naralex 的仪式、岸防炮载具都没有脚本 | 跳过演出：接任务即完成 |

文件：`sql-custom/2026_11_13_29_dwarf_route_20_29.sql`、`2026_11_13_30_ashenvale_20_29.sql`、`2026_11_13_31_desolace_brazier.sql`、`2026_11_13_32_stonetalon_barrens_20_29.sql`，各自都有 `backup/*_20261113.tsv`。

查 14213 时顺带确认了一件事：核心选法术目标时不检查"不可选中"标志（`SpellInfo::CheckTarget` 里没有），所以带这个标志的计数标记也能被打中。灭火任务那些标记就带这个标志，已经在游戏里确认能用。

**没修的：** 荆棘谷海角的祖尔格拉布系列（26550–26555），要进入祖尔格拉布的一段幻象，后几环的发任务人（Jeklik、Venoxis）都没刷，链条中间就断了，先跳过；灰谷 13982 In a Bind 要的 Kaliva 没有刷新点，原版位置不知道；凄凉之地 5943 Gizelton Caravan 的发任务人和交任务人都没刷，玩家接不到。另外这一段还有一批部落任务（奥特兰克山脉的"植物大战僵尸"小游戏等），矮人路线用不到，暂时没管。

### 4.15 批次十一：30–39 级（第一部分）

**掉落表（模式 A）。** 还原 41 件物品、58 条掉落，逐条核对过（`sql-custom/2026_11_13_33_audit_pattern_a_loot_30_39.sql`）。

<details>
<summary>30–39 级还原的 41 件物品</summary>

| 任务 | 物品 | 掉落来源（编号，刷新点，掉率） |
|---|---|---|
| 24606 | Blood Shard Trinket（49934） | Razormane Pathfinder（37560，14，50%）；Razormane Warfrenzy（37660，15，50%）；Razormane Seer（37661，14，50%） |
| 24620 | Enormous Kodo Heart（49946） | Landquaker Bull（37556，11，100%） |
| 24621 | Fresh Brain（49947） | Triumph Captain（37926，5，100%） |
| 25042 | Fresh Stormsnout Steak（52198） | Stormsnout（3240，43，50%） |
| 25079 | Keg of Blast-O Powder（52290） | Sapper Specialist（37925，22，100%） |
| 25080 | Humming Electrogizard（52305） | Thunderhead（37208，22，100%） |
| 25627, 25628 | Rusted Cage Key（55160） | Tony Two-Tusk（40958，1，100%） |
| 25661 | Evil Dolly's Heart（55196） | Evil Dolly（41076，1，100%） |
| 25661 | Seadog Fajardo's Lungs（55197） | Seadog Fajardo（41081，1，100%） |
| 25661 | Lilly Landlubber's Liver（55199） | Lilly Landlubber（41082，1，100%） |
| 25873, 25874 | Longhorn's Horn（56139） | Cliffwatcher Longhorn（41458，1，100%） |
| 26366, 26518 | Umboda's Head（58236） | Umboda Three-Heads（42724，1，100%） |
| 26368 | Shadra-Spawn Venom Sample（58239） | Spawn of Shadra（42879，8，50%） |
| 26595 | Fitztittle's Ratcheting Torque Wrench（59034） | Freewheelin' Juntz Fitztittle（43376，1，100%） |
| 26595 | Ephram's Jeweled Mirror（59035） | Ephram "Midriff" Moonfall（43377，1，100%） |
| 26605 | Poobah's Tiara（59057） | Skymane Gorilla（2521，12，100%）；Skymane Bonobo（43417，8，100%） |
| 26605 | Poobah's Scepter（59058） | Skymane Gorilla（2521，12，100%）；Skymane Bonobo（43417，8，100%） |
| 26605 | Poobah's Slippers（59059） | Skymane Gorilla（2521，12，100%）；Skymane Bonobo（43417，8，100%） |
| 26605 | Poobah's Diary（59060） | Skymane Gorilla（2521，12，100%）；Skymane Bonobo（43417，8，100%） |
| 26612 | Bloodsail Orders（59145） | Bloodsail Orders（2087，1，100%） |
| 26999 | Plague Lurker Sample（60760） | Plague Lurker（1824，21，50%） |
| 26999 | Venom Mist Lurker Sample（60761） | Venom Mist Lurker（1822，11，50%） |
| 26999 | Hulking Plaguebear Sample（60762） | Hulking Plaguebear（44482，36，50%） |
| 26999 | Diseased Wolf Sample（60763） | Diseased Wolf（1817，32，50%） |
| 27012 | Redpine Stave（60747） | Redpine Shaman（44479，17，50%） |
| 27012 | Redpine Club（60748） | Redpine Gnoll（44478，28，50%） |
| 27167 | Side of Bear Meat（60851） | Shaggy Black Bear（44473，63，50%） |
| 27229 | Broodqueen Pedipalp（60883） | Darkmist Broodqueen（45227，1，100%） |
| 27368 | Crypt Bile（60983） | Crypt Stalker（8555，6，50%）；Crypt Walker（8556，4，50%）；Crypt Horror（8557，8，50%）；Crypt Slayer（8558，4，50%） |
| 27372 | Plaguehound Blood（60986） | Plaguehound Runt（8596，103，50%）；Frenzied Plaguehound（8598，56，50%） |
| 27452 | Death Cultist Headwear（61280） | Vile Tutor（8548，14，100%）；Dark Summoner（8551，14，100%） |
| 27452 | Death Cultist Robes（61281） | Vile Tutor（8548，14，100%）；Dark Summoner（8551，14，100%） |
| 27458 | Browman's Wrappings（62028） | Stephen Browman（46167，1，100%） |
| 27479 | Mossflayer Eye（61313） | Mossflayer Scout（8560，11，50%）；Mossflayer Shadowhunter（8561，23，50%）；Mossflayer Cannibal（8562，16，50%）；Warlord Thresh'jin（10822，1，100%） |
| 27539 | Stinking Skull（61372） | Scourge Soldier（8523，27，50%）；Cursed Mage（8524，39，50%） |
| 27614 | Crimson Boar（61959） | Battered Chest（205878，1，100%） |
| 27614 | Lihanna's Strand（61960） | Battered Chest（205879，1，100%） |
| 27614 | Shroud of Uther（61961） | Battered Chest（205880，1，100%） |
| 27614 | Gavinrad's Sigil（61962） | Battered Chest（205881，1，100%） |
| 28087 | Trapper Net（62924） | Twilight Trapper（47479，38，50%） |
| 28125 | Twilight's Hammer Armor（63035） | Bulwark Defender（47583，19，50%）；Twilight Magus（47585，11，50%） |

</details>

**同名换编号（模式 B，新规则）。** 30–39 级里常见的一种情况：任务要杀的有名字的敌人，这个编号没有刷新点，但库里另有一个**同名、刷着的编号**（同一个 NPC 在不同版本里换过编号）。规则（`tools/fix_pattern_b.py`）：只看敌对、可攻击、还没设 `KillCredit1` 的同名编号，把它的 `KillCredit1` 设成任务目标，杀它就算数。全库只命中 11 个任务（覆盖各个等级），一次应用（`sql-custom/2026_11_13_34_audit_pattern_b_killcredit_twins.sql`）。

<details>
<summary>模式 B 修复的 11 个任务</summary>

| 任务 | 名称 | 目标（没刷新的编号） | 改成算数的同名编号（刷新点） |
|---|---|---|---|
| 12240 | A Means to an End | Foreman Kaleiki（27238） | 28552（1） |
| 13161 | The Rider of the Unholy | Rokir（31160） | 30954（1） |
| 13163 | The Rider of Blood | Baelok（31159） | 30953（1） |
| 13164 | The Fate of Bloodbane | Orbaz Bloodbane（31283） | 29204（1） |
| 26700 | The Damsel's (Bad) Luck | Bloodsail Corsair（43726） | 43636（15） |
| 26938 | Combat Training | Opengut Behemoth（45098） | 44562（32） |
| 27145 | Plagued Hatchlings...For Now | Rattlegore（11622） | 44318（1） |
| 27202 | Brother Against Brother | Forsaken Trooper（45240） | 44791（25）、44792（17）、46053（8）、46054（16） |
| 27770 | Lifting the Veil | Nyxondra（46658） | 46861（1） |
| 28320 | Assault on Dreadmaul Rock | Blackrock Invader（48432） | 42937（46） |
| 29827 | Acid Rain | Hozen Gutripper（55707） | 58943（29） |

</details>

**辛特兰（鹰巢山一线，`sql-custom/2026_11_13_35_hinterlands_30_39.sql`）：**

| 任务 | 名称 | 原因 | 修法 |
|---|---|---|---|
| 26517 | Summit of Fate | 蜘蛛神像在库里、在客户端缓存里都没有来源 | 按任务说明"从 Jintha'Alor 山顶的邪枝巨魔身上收集"，加到平均刷新高度在 195 以上的 5 种邪枝巨魔掉落里，40% |
| 26523 | All That Skitters | 小蜘蛛不能拾取 | 和抓螃蟹一样：点击 → 79588 → 79591（给物品）→ 消失 |
| 26532 | Shadra the Venom Queen | Shadra 没有刷新点，模板是占位数据 | 改成 33 级怪物阵营、4 倍血，刷在 Shadra'Alor 西北神庙的祭坛旁边（祭坛建在建筑上，地形高度只有 75–88，所以直接用祭坛标记的高度 116.7）。位置和等级是我们定的 |
| 27625 | In Defense of Quel'Danil | 要杀的 16 个亡灵潜伏者没有刷新点，模板是占位数据 | 改成 Undercity 阵营 30–31 级，在营地守卫周围一圈刷 8 个（按地图高度），60 秒重刷 |

**还没修的：** 27626 The Highvale Documents 的 3 个文件物体模板是空壳（类型 0，名字"unk name"），也不知道原版位置。30–39 级剩下的大多是整段剧情或载具战（东瘟疫之地血色十字军的一串头目、荆棘谷海角的 Brashtide 海盗船系列、千针石林、西瘟疫之地 Andorhal 的攻防战），而且要杀的敌人普遍没有刷新点、模板是占位数据，重建要大量猜位置。

### 4.16 批次十二：30–39 级（第二部分）

这一段剩下的大多是整段剧情或载具战，要杀的敌人没有刷新点、模板是占位数据（1 级、友好阵营）。我问了一下处理方式，定下来的是：**全部逐个重建**，位置、等级靠推测也要把玩法还原出来；只有内容已经被版本删掉的才禁用。

**禁用旧版通灵学院的 3 个任务。** 27140 Alexi's Gambit、27142 The Lich, Ras Frostwhisper、27143 Barov Family Fortune：通灵学院在熊猫人版本里改版了，这些 Boss 和宝箱都不在了（`sql-custom/2026_11_13_36_disable_old_scholomance.sql`，热加载生效）。

**刷新高度的教训。** 这一批我先验证了地形高度工具：拿 Andorhal 防御者、Quel'Danil 守卫、卡拉诺斯 NPC 的实际刷新高度去对比，空地上都吻合（误差 0.5 码以内）；但 27171 那个任务物体周围的破武器箱都在 z 31，比地形低 30 码——那里在山体下面。所以以后在建筑里、洞里刷东西，一律用附近已有物体的高度，不用地形。

**西瘟疫之地（`sql-custom/2026_11_13_37_western_plaguelands_30_39.sql`）：**

| 任务 | 名称 | 原因 | 修法 |
|---|---|---|---|
| 27173、27199、27201 | This Is Our Army、Ashes to Ashes、Val'kyr Incursion（Andorhal） | 被遗忘者骑手、死亡卫士战争队长、小瓦格里都没刷，阵营是占位的 | 改成 Undercity 阵营（队长 37 级、3 倍血），在 Andorhal 的联盟防御者（44328）身边穿插刷 10 / 3 / 6 个，让前线两边都有人；高度按地形（已验证），120 秒重刷 |
| 27171 | Ambushed! | 两种骷髅（旧版 50 级）没刷 | 改成 34–35 级，在任务物体周围的破武器箱旁各刷 4 个（高度用箱子的 31），按缓存加上两件物品的掉落（50%） |
| 26953 | Zen'Kiki, the Druid | 跟着 Zen'Kiki 杀染疫动物没有计数 | 四种染疫动物被接了任务的玩家打死时计数（Zen'Kiki 这个跟班没有重做） |
| 26954 | A Different Approach | 染病的鹰（22 只）带免疫玩家标志 | 去掉标志，可以打了 |
| 26955 | Zen'Kiki and the Cultists | 笼子打开没有反应 | 三个 Cultist Cage（门类物体，使用时同样会调用 `GossipHello`）挂物体 SAI：打开就计数，熊离开 |
| 27001 | This Means WAR | 野马不是载具，"嘶鸣赶蜘蛛"做不出来 | 退一步：杀北脊蜘蛛计数 |

26938 Combat Training 是部落任务，没有动。

### 4.17 实测反馈：Solanian's Belongings（一次误判）

在游戏里随手抽查了血精灵新手村的 **8330 Solanian's Belongings**：三件物品之一 Solanian's Scrying Orb，地图标记的位置不对。

**我先误判了。** 我只看了数据：水晶球刷在 z 16.67，那里的地形（池底）是 5.1，地图文件里的水面是 11.77，于是认定它悬在水面上方 5 码，把它连同头上的黄色光柱挪到了 12.3。结果到了现场——让服务器 `saveall` 后读出实时位置——角色就站在水晶球旁边、高度 16.2：池塘中间有一块岩石平台，是模型，地形数据里看不到。原来的高度是对的，我反而把水晶球埋进了平台里，只剩光柱。已经恢复原位（`sql-custom/2026_11_13_38_solanian_scrying_orb.sql` 现在就是这次恢复）。

**教训：** 只凭地形和水面数据，判断不了物体脚下有没有东西（建筑、岩石、巨型蘑菇、船都是模型）。我顺手写的高度扫描（`tools/go_height_audit.py`）也因为这个原因误报太多，不可用。以后挪物体之前，要么请玩家报实地位置，要么用服务端的碰撞数据（vmap）。

**地图标记的真正原因：** 这个任务 `quest_poi` 里三件物品的 `objIndex` 是 4、5、6，这是旧版的编号（0–3 是要杀/互动的目标槽，4–9 是物品槽），而熊猫人客户端认的是 `quest_objective.index`（这里是 0、1、2）；服务端原样发出（`QueryHandler.cpp:617`），客户端就对错了标记。全库有 **3289 个任务**是这种情况，换算脚本已经写好，还没执行。

**另一个怪现象：** 东西都拿齐后交不了任务。服务器记录里"日记"那一条进度不见了（背包里有日记）。核心登录时只在内存里按背包重数物品（`AdjustQuestReqItemCount`），不更新任务日志上的计数，也不重新判断任务是否完成，所以一直卡在"未完成"。扔掉日记再捡一次就好了。这条进度是怎么丢的还没查清楚，期间我在玩家在线时重启过两次，暂时先放着。

### 4.18 批次十三：地图标记编号全局换算

接着 4.17 的发现做了全局换算（`tools/fix_poi_index.py`，`sql-custom/2026_11_13_39_quest_poi_objindex_remap.sql`，原值备份在 `backup/quest_poi_objindex_20261113.tsv`）。

**先空跑，再验证。** 一开始的规则是"旧版第 k 个物品槽 → 新表里第 k 个物品目标"。用实际位置验证（地图标记的区域离哪个目标的真实位置最近：怪的刷新点、掉这个物品的怪、宝箱）时，揪出了问题：**转换后的任务目标是按物品/生物编号从小到大排的，不是旧版的槽位顺序**。比如 101 The Totem of Infliction，说明里是"食尸鬼尖牙、骷髅手指、蜘蛛毒液"，新表却是尖牙（1129）、毒液（1130）、手指（2378）。Solanian 那个任务恰好编号顺序和原顺序一致，所以看不出来。

**最后的判断顺序：**

1. 同类目标只有一个，直接对应（1999 组）；
2. 任务说明（Objectives）里能找到所有同类目标的名字（允许复数和 "Chunks of" 这类变形），按出现的先后对应旧槽位（380 组）——说明的顺序基本就是旧版的槽位顺序；
3. 说明里找不全，才按地理：在所有一一对应方式里，选标记区域到真实目标总距离最小的那种（64 组）。

说明顺序和地理判断在 84% 的槽位上一致；不一致的多在怪物混居的区域（比如丹莫罗到处都有野猪和熊，317 Stocking Jetsteam 用地理就会配反），那种情况下说明顺序更可靠。

**结果：** 3289 个对不上的任务里，2225 个、3993 条标记换算好了；924 个没动：650 个根本没有任务目标（多是废弃的旧任务），其余用的是 10、16 这类含义不明的编号。`reload quest_poi` 热加载，不用重启；客户端可能要重新登录才会重新请求标记。

### 4.19 碰撞数据检查工具

Solanian 那次误判以后，补了一个能看到"模型"的位置检查工具。

**vmapcheck（`tools/vmapcheck/`）。** 一个独立的小程序，直接复用服务端自己的碰撞代码：只编译 `VMapManager2`、`MapTree`、`ModelInstance`、`WorldModel`、`BoundingIntervalHierarchy` 和 G3D 数学库；服务端其他部分用 4 个几行的替身头文件代替（日志、断言、`DisableMgr` 永远"不禁用"、液体类型），`TileAssembler.cpp` 里的 `readChunk` 照抄一份。单独的 Dockerfile 第一步和主 Dockerfile 完全相同，直接复用缓存的编译环境，一分钟编完，镜像 119 MB。输入"地图 x y z"，输出这一点脚下最近的碰撞面、头顶的碰撞面，以及一条短视线是否被挡。

**先用已知的点验证：**

| 测试点 | 结果 |
|---|---|
| Solanian 水晶球原位（16.67） | 脚下碰撞面 16.67，正好放在池中的平台上 |
| 当时角色站的位置 | 脚下 16.23 |
| 西瘟疫之地破武器箱（30.8） | 脚下 30.69，头顶 56.09（山体下的洞） |
| Andorhal 空地上的 NPC | 没有碰撞面（只有地形） |
| 水晶球上方 10 码 | 脚下仍是 16.67，判定悬空 |
| 我挪错的位置（12.3） | 脚下没有碰撞面，**头顶 16.58**——埋在平台下，当时有这个工具就能发现 |

**poscheck（`tools/poscheck.py`）。** 把三样东西合起来判断：地形高度、水面高度（都从 `.map` 文件读，注意 −500 表示"没有水"）、碰撞面。离最近的支撑面（不在头顶上的最高的那个）超过 2.5 码算悬空，低于地形或被模型压着、附近又没有可站的面算被埋；会飞的生物和水里的生物不算悬空。

**用它复查我们自己刷的 73 个 NPC 和物体，查出 3 处错误：**

- 26228 Jangolode 矿洞的施法点在两条矿道之间的岩体里（脚下没有碰撞面，地形在头顶 80 码）。原来是按狗头人的平均位置算的点。改放到最深处那只狗头人挖掘者的位置——工具显示所有狗头人都正好踩在矿道地面上，头顶 7–8 码是矿道顶；
- 26532 Shadra 悬空 3 码：我照抄的祭坛标记本身就比神庙地面高 3 码，降到 113.8；
- 27171 的 8 个骷髅里有 5 个在山体里：在破武器箱周围按 2 码网格采样，找到洞底那片平地（x 1046–1074，y −1912 到 −1898，高 30.7–31.1），8 个都挪进去。

修正后复查，73 个全部通过（`sql-custom/2026_11_13_40_poscheck_fixes.sql`）。以后每次刷新东西之前都先过一遍这个工具。

### 4.20 怪物掉落太多：掉落表全库整理（实测抽检）

熊猫人新手岛打几只小怪就把背包捡满了。掉落倍率配置全是 1，问题在掉落表本身：很多怪的掉落行全部放在"不分组"（groupid 0）里，每一行都**独立**判定。以 Plump Virmen 为例：药水、泉水、苹果、亚麻布、孔雀石各 100%，30 多件灰色武器护甲各 35–58%，概率加起来 1835%，平均每只掉十几件。全库有 1397 张这样的表（不分组的概率加起来超过 150%）。

修法（`tools/fix_loot_overflow.py`，`sql-custom/2026_11_13_41_creature_loot_overflow.sql`）：

- **范围**：只改刷在野外地图、不刷在任何副本里、不是 Boss 的怪用的表，一共 469 张。副本、Boss，以及没有刷新点的表都不动；
- **灰色物品和白色武器护甲**并成一组，每只最多掉一件，总概率 = min(原合计, 100%) × 50%；
- **其他普通物品**（药水、食物、布、矿石、绿色物品）另成一组，每只最多掉一件，单行先封顶 50%，总概率 = min(原合计, 100%) × 40%；
- **蓝色/紫色物品**一般不动。只有一种情况例外：这些物品本身合计就超过 100%，这时并成一组，总概率 10%。永恒岛上的怪就是这样，每件永恒套装部件都是 100%；
- 任务物品、引用表、金币都不动；组内各物品之间的相对比例保持原样。

结果：这 469 张表平均每只怪的期望掉落从 6.6 件降到 0.67 件（不算任务物品和金币），最高的一张约 1.45 件。原数据整表备份在 `backup/creature_loot_overflow_20261113.tsv`。掉落表支持热加载（`reload creature_loot_template`），不用重启。

### 4.21 实测反馈：Pie for Billy 掉率太低

艾尔文森林的 **86 Pie for Billy** 要 4 块 Chunk of Boar Meat（60401），只有接了任务才掉。数据库里的掉率：

| 怪 | 等级 | 刷新点 | 原掉率 | 现掉率 |
|---|---|---|---|---|
| Stonetusk Boar（113） | 5 | 47 | 21% | 50% |
| Rockhide Boar（524） | 7 | 87 | 12% | 50% |

原来平均要杀 19–33 只，现在约 8 只。这不算 bug，是按玩家要求调的。`sql-custom/2026_11_14_01_pie_for_billy_drop_rate.sql`，原值备份在 `backup/pie_for_billy_loot_20261114.tsv`，`reload creature_loot_template` 热加载，不用重启。

### 4.22 实测反馈：Livin' the Life 的施法点放错了（又一次是我的错）

**26228 Livin' the Life**：玩家走到 Jangolode 矿洞尽头，道具 Two-Shoed Lou's Old House 用不了，客户端红字提示 "Requires you to be at the end of the Jangolode Mine."（这句话就是施法焦点 1672 在客户端里的名字）。

原因在我们自己：这个焦点物体（模板 910100，刷新点 9100101）是批次六新建的，4.19 复查时又"挪到最深处那只狗头人的位置"——但我挑的是**高度最低**的那只（−9942.6, 1473.2），不是**走得最远**的那只。这次用寻路工具（navpath）从洞口算到每只狗头人挖掘者的步行距离：旧位置只有约 212 码，矿道后面还有一个洞室（x −9985 到 −10026，y 1435 到 1497），最远处约 265 码。玩家站在真正的尽头，离焦点 50–85 码，半径 15 码当然够不着。

修复：焦点挪到最后那个洞室的中心（−10003, 1463, 41.1，高度取自寻路网格的地面），半径 15 → 20 码，盖住整个洞室。`sql-custom/2026_11_14_02_livin_the_life_focus_end_of_mine.sql`，刷新点的移动要重启才生效，已重启。

**结果还是报错，而且这次错得更离谱。** 玩家两次都站在 (−9850, 1388)，就在精英怪 Master Digger 旁边。查了每个点比头顶地表低多少：

| 位置 | 比地表低 |
|---|---|
| 玩家站的地方（Master Digger 洞室） | 13.5 码 |
| 第一次放的点 (−9943, 1473) | 31 码（矿洞中段） |
| 第二次放的点 (−10003, 1463) | 0 码，**在洞外** |

我把洞口和尽头搞反了：西边那片"洞室"其实是入口外的空地，矿道从西往东延伸，尽头是 Master Digger 守着的洞室。第三次改到 (−9846, 1393, 38.3)，半径 20 码（`sql-custom/2026_11_14_03_livin_the_life_focus_master_digger.sql`），重启生效。教训：判断"尽头"之前，先用"比地表低多少"确认哪边是洞口；玩家实际站的位置比我推算的更可信。

### 4.23 实测反馈：Lou's Parting Thoughts 的偷听事件是空壳

**26232 Lou's Parting Thoughts**：任务要求去农舍后面偷听几个暴徒说话，玩家走到 NPC 旁边什么都没发生。

- 任务目标是 1 个 Furlbrow Murder Info 004（42417）的击杀记录，本该由法术 79184 Hobo Information 给出，但数据库和 C++ 里都没有东西会施放这个法术。
- 农舍后面的 4 个 Thug（42387）围着一个隐形的 Lou's Parting Thoughts Trigger（42562），它显然是负责感应玩家、播对话、给记录的，可它没有 AI，Thug 也一句台词都没有。上游源码历史里也查不到，SkyFire 从来没做过这个事件。

修法跟 Westfall 前面几条一样，保留结果、跳过演出：给触发器加一段 SmartAI，接了任务还没完成的玩家走进 15 码内（看得到）就直接记一次 42417。原版台词库里没有，所以没编台词。`sql-custom/2026_11_14_04_lous_parting_thoughts_trigger.sql`。触发器原来没有 AI，要重启 worldserver 才会换上，当时有 5 人在线，等大家下线后才重启。

**第一版没生效。** 重启后脚本加载正常，玩家带着任务走到 Thug 中间，什么都没发生。我把这条链路从头查了一遍：AI 选择、反应状态（只有 REACT_AGGRESSIVE 的生物才会收到"有人进入视野"的通知）、视线、事件计时、条件表、给记录的动作，每一环单独看都没问题，但就是不触发，原因没找到。

**第二版换了思路**，不再依赖视野通知：触发器每 2 秒扫一遍 20 码内的玩家（`SMART_EVENT_UPDATE_OOC` + `SMART_TARGET_PLAYER_DISTANCE`），给每个人记一次。没接任务或已经完成的玩家记了也没有任何效果，所以条件表那行也去掉了（`sql-custom/2026_11_14_06_lous_parting_thoughts_trigger_scan.sql`）。重启后实测通过。教训：隐形触发器要感应玩家，用定时扫描比 OOC_LOS 可靠。

### 4.23b 实测反馈：Feeding the Hungry and the Hopeless 喂了没反应

**26271 Feeding the Hungry and the Hopeless**：要用 Westfall Stew 喂 20 个流浪汉。物品会在面前召唤一碗炖肉（42617），但这碗炖肉没有 AI，流浪汉的 C++ 脚本 `npc_transient` 也只处理 26209（问谁杀了 Furlbrow 一家），所以没人给记录。

修法同样是保留动作、跳过演出：炖肉被召唤时（`SMART_EVENT_JUST_SUMMONED`），如果 10 码内有三种流浪汉之一（条件表 type 29，ElseGroup 0/1/2 做"或"），就给召唤者记一次；不管有没有喂到，5 秒后炖肉消失（`sql-custom/2026_11_14_07_feeding_the_hungry_stew.sql`）。流浪汉走过来吃的演出没做，同一个流浪汉也能重复喂。炖肉是每次新召唤的，`.reload creature_template 42617`、`.reload smart_scripts`、`.reload conditions` 热加载就生效，不用重启。实测通过。

### 4.24 实测反馈：Still Assessing the Threat 的地图标记挂错目标

**26503 Still Assessing the Threat**（赤脊山）：要偷 Gnoll Battle Plans、Gnoll Orders、Gnoll Strategy Guide 三样东西。玩家拿到了 Battle Plans，另外两样找不到，以为没刷出来。

- 三个箱子的刷新点都在，数据跟拿到的那个完全一样，没有相位，也没有脚本干扰。
- 问题在任务地图标记：三块区域位置都对，但 `quest_poi.objIndex` 全是 0，都挂在第 1 个目标 Battle Plans 名下。拿到 Battle Plans 后，这个目标完成，三块区域一起收起来，Orders 和 Guide 在地图上就没有任何标记了。
- 修法：把第 2、3 块区域改挂到目标 1、2 上（`sql-custom/2026_11_14_05_still_assessing_the_threat_poi.sql`），`.reload quest_poi` 热加载，不用重启。

插曲：玩家照我给的坐标（Orders 28.0, 74.9；Guide 30.6, 62.7）去了一趟，说还是没有。我在服务器上把能查的都查了，找不出这两个箱子不在的理由，就请玩家用 GM 角色 `.go object` 过去看。GM 角色看到了，换回原角色也看到了。之前为什么没看到，没能复现，原因不明。可能当时站的位置还差一点，也可能是重新登录后客户端重新加载了周围的物体。

### 4.25 实测反馈：Secrets of the Tower 塔顶是空的

**26290 Secrets of the Tower**：任务要你进 Mortwake's Tower "找到 Helix Gearbreaker"，玩家爬到塔顶，什么都没有。塔顶那段剧情的 NPC（Helix 42655、Glubtok 42755、Oaf 42654）一个刷新点都没有，脚本和台词也没有。11-13 的修法是"在塔里喝下 Potion of Shrouding 就完成"，但这要靠服务器判断出玩家在塔的建筑区域 5289 里，这一点从没验证过，玩家的药水也还没喝。

这次换成不依赖药水和区域判断的做法：

- 先找塔。区域 5289 在地形网格里一格都没有，只存在于建筑模型内部。解析 vmap 地图块，找到 `Westfall_Magetower.wmo` 放在 (−11127, 570)，范围大约是 x −11182..−11098、y 505..594、z 31..108。玩家之前报的两个位置其实都在塔外。
- 再找塔顶。在塔的范围内取点，从上往下探测碰撞地板：最高那些点呈圆锥形分布，是尖顶屋面；尖顶下面那层地板在 z≈88.4，塔中心是空的，一直通到 z 66 那层。
- 复制 Lou's Parting Thoughts 的触发器模板，建了一个新的隐形触发器 910002，放在 (−11138, 550, 88.6)：每 2 秒对 16 码内的玩家触发一次任务事件 26290（`sql-custom/2026_11_14_08_secrets_of_the_tower_top_trigger.sql`）。重启后实测通过。

### 4.26 实测反馈：The Dawning of a New Day 的集会没有开始

**26297 The Dawning of a New Day**：去 Moonbrook 偷听流浪汉集会。任务要 1 个 Shadowy Figure（42680）的记录，它没有刷新点，召唤它的法术 79551 也没有任何东西施放；演讲的人、台词、脚本全没有。只剩 Moonbrook 流浪汉人群中间一个没有 AI 的隐形触发器 Moonbrook Player Trigger（43515），周围是流浪汉、Thug 和推车，这就是集会的位置。

给它加同样的 2 秒扫描，20 码内的玩家记一次 42680（`sql-custom/2026_11_14_09_dawning_of_a_new_day_rally.sql`），没有演讲。重启后实测通过。

**26320 A Vision of the Past** 顺带实测通过：Incense Burner 要在死亡矿井副本里、施法点 "Entrance of the Deadmines"（204039）30 码内使用，这个施法点离进副本的落点只有约 9 码。11-13 加的"用了就完成"实测有效。

### 4.27 实测反馈：死亡矿井熔炉的坡走不下去

玩家在大熔炉上层走道往下走，坡下不去，也跳不起来。服务器的碰撞数据里这条坡是连续的（沿东边往南，再沿南墙往西，从 z 51 降到熔炉底层 z 21），玩家身上也没有定身之类的效果。

处理：玩家下线后，在 `game_tele` 里加一个临时传送点，用控制台 `.tele name Frank <点名>` 把她挪到坡底（离线也能用，会直接改存档坐标），然后删掉临时点。

玩家随后补充了关键线索：卡住是在骑过门口的机器人 Prototype Reaper（49208，载具）、下来之后才开始的，骑着机器人下坡是正常的。症状很像客户端在下载具后没恢复重力：服务器的 `Unit::_ExitVehicle` 会发恢复重力和解除定身的消息，相关消息编号看起来也都定义了，原因没查到。这台机器人只跟可选成就 Prototype Prodigy 有关，Foe Reaper 的脚本只定义了它的编号、没有用到，所以按玩家的意思直接删掉刷新点（`sql-custom/2026_11_14_10_deadmines_remove_prototype_reaper.sql`），玩家打完副本后重启生效。别的载具可能也有同样的问题，记为未解决。

### 4.28 实测反馈：In Search of Bravo Company 的 Messner 看不见

**26586 In Search of Bravo Company**（赤脊山）：任务要你去 Alther's Mill 找 Messner（43270），玩家到了地方什么也没有。

- Messner 有刷新点，但身上挂着 Apply Quest Invis Zone 5（81003），这是"任务隐身"：只有带着对应的 Detect: Quest Invis Zone 5（81004）的玩家才看得见。
- 通常由 `spell_area` 在接了任务之后自动给玩家上这个探测光环。81004 一条 `spell_area` 都没有，所以 Messner 对谁都是隐形的。
- 修法：区域 97 内，从接 26586 起到交 26587 为止，自动给玩家 81004（`sql-custom/2026_11_14_11_in_search_of_bravo_company_detect.sql`）。实测通过。

这是一类通病：带 "Apply Quest Invis Zone N" 的 NPC，如果没有对应的 "Detect" 规则，就永远看不见。下一节马上又碰到了三个。

### 4.29 实测反馈：Bravo 小队营救链断在第一环

玩家交完 26587 Breaking Out is Hard to Do 之后，"赤脊山的任务突然就没了"。查下来是三处问题叠在一起：

1. **救出来的人不会跟着你。** 这条链的设计是：救出笼子里的 Messner，他变成跟随者（43300），由跟随者给下一个任务 Jorgensen；救出 Jorgensen，跟随版 Jorgensen（43305）给 Krakauer，以此类推到 Danforth（43302）给 Return of the Bravo Company。四个跟随者都没有刷新点，召唤它们的法术（80893、80940、80941、80943）也没有任何东西施放，所以交完 26587 就没人给下一个任务。
   修法：给四个笼子里的 NPC 加 SmartAI，交任务时让玩家施放对应的召唤法术。这里不能用 `spell_area` 的自动施放：服务器只用"身上有没有这个光环"判断要不要再放一次，召唤法术不留光环，每次换区域都会再召唤一个。
2. **后面三个笼子里的人也看不见。** Jorgensen、Krakauer、Danforth 分别挂着 Quest Invis Zone 6/7/8（81009/81018/81079），跟 Messner 同一个毛病。补了 81010/81019/81080 三条 `spell_area`，各自从接任务到交任务期间生效。
3. **John J. Keeshan 不存在。** 他是 26567 John J. Keeshan 和 26607 They Drew First Blood 的交任务人。11-13 的审计因为"没有能到达的交任务人"把这两个任务禁用了。任务文字说他在 Lakeshire 旅店地下室的地下格斗场，地图标记 (−9202, −2154) 正好落在地下室的两个格斗者 Dumpy 和 Big Earl 身上。于是把 Keeshan 刷在擂台边上，解除禁用。

文件：`sql-custom/2026_11_14_12_bravo_company_rescue_chain.sql`、`sql-custom/2026_11_14_13_keeshan_lakeshire_inn_spawn.sql`。玩家交 26587 时还没有召唤脚本，所以在重启的空档直接把 26560 Jorgensen 加进了她的任务日志。重启后实测通过：三个营救任务和旅店的 Keeshan 都交了。

留了一个已知问题，暂时不改：26563 Return of the Bravo Company 在数据里要求先交 Troteman 的 26571 Weapons of War，而它唯一的发放人是临时召唤的跟随版 Danforth，下线就消失。跳过 Weapons of War 的玩家实际上拿不到这个任务。好在它不挡主线（26607 也可以从 26573 进入）。

### 4.30 赤脊山后半段重建（第一期）

从 26616 It's Never Over 开始，赤脊山后半段的 NPC 基本都没有刷新点。我先去翻了 TrinityCore 的 Cataclysm Classic（4.4.2）世界数据库（TDB 442，赤脊山就是那个版本重做的），结果那边这一段也没做：只有旅店的 Keeshan 和 Foreman Oslow 有刷新点，其余没有刷新点，也没有脚本。所以位置只能自己定：交任务人放在任务地图标记的交任务点上，高度用寻路网格（mmaps）吸附。把起点和终点设成几乎同一点去寻路，返回的第一个点就是网格上的地面高度，建筑里面也能用。

TDB 是 350 MB 的 SQL 文本。没导入数据库，写了个只读的小工具 `tools/tdbgrep.py`，直接在 SQL 文本里按表名和列值查行。

第一期修了这些（`sql-custom/2026_11_14_14_redridge_second_half_phase1.sql`）：

| 任务 | 问题 | 修法 |
|---|---|---|
| 26569 Surveying Equipment | Foreman Oslow 没刷；Blackrock Spyglass 没有掉落来源 | Oslow 按 TDB 位置刷；任务文字说望远镜在 Blackrock 追踪者身上，加到 Blackrock Tracker（615）掉落，50% |
| 26616 It's Never Over | 坐 Keeshan 的船去 Camp Everstill，船和沿途触发法术全没脚本 | 保留"出发"这一步，省掉船：码头的 Keeshan 加对话选项，选了就算完成事件并传送到对岸营地 |
| 26636–26640 | 营地的 Keeshan、Krakauer、Messner、Danforth 和 Brubaker 都没刷 | 刷在各自的交任务点上；Muckdweller 的掉落表编号是 0，补上 Muckdweller Gland |
| 26646 Prisoners of War | 钥匙袋打开是空的；牢笼打开后没有进度 | 钥匙袋的掉落编号是 0。MoP 的宝箱类物体 data0 是锁、data1 才是掉落表，补上 Holding Pen Key。三个牢笼加 SmartAI：用钥匙打开时给 Prisoner of War 进度 |
| 26651 To Win a War... | Field Kit 里的 Plant Seaforium 没有目标，也没人给进度 | 法术目标限定为军火库和塔；两个目标被它击中时给施法者进度 |
| 26668 Detonation | 没有目标，"炸掉山谷"的事件没有脚本 | 接任务时直接完成事件（任务描述就是按一下按钮） |
| 26693 / 26694 | Key of Ilgalar 没有掉落来源 | 任务文字说钥匙在 General Fangore 身上，加 100% 任务掉落；塔门 Ward of Ilgalar 的锁本来就认这把钥匙 |

另外解除了 11-13 审计禁用的 26651、26694。重启后实测：坐船、营地四个任务、Brubaker 都正常，玩家已经做到 26640。

### 4.31 赤脊山后半段重建（第二期）

剩下的三个任务数据基本是空壳：入侵者和 Darkblaze 是友好的 1 级 NPC，攻城坦克不是载具，任务说要用的 Horn of Summoning 这个物品根本不存在。这一期是替代设计，动手前先定好了方案（`sql-custom/2026_11_14_15_redridge_second_half_phase2.sql`）：

- **Colonel Troteman**（43733）刷两个：Shalewind Canyon 发 26708，Keeshan's Post 收 26708、26713、26714。
- **26708 AHHHHHHHHHHHH! AHHHHHHHHH!!!**（开坦克杀 200 个 Blackrock 兵）：Bravo Company Siege Tank（43714）补上 TDB 的载具编号 987，接了任务才能上车，配两门炮：Heavy Cannon（79776，点地面，20 码，约 3000 伤害）和 Fiery Boulder（72051）。在两地之间的任务区域里随机刷了 40 个敌对的 Blackrock Invader（17–18 级普通怪，30 秒刷新），生成脚本 `tools/gen_invaders.py`。坦克如果有问题，步行杀也算进度。
- **26713 Showdown at Stonewatch**：Tharil'zun 和 Gath'Ilzogg 刷在 Stonewatch Keep 的两个任务标记点上（原版就有的 20 级精英和技能脚本）。
- **26714 Darkblaze**：在 Keeshan's Post 的 Troteman 那里接任务时，旁边召唤出 22 级精英的敌对 Darkblaze。打输了可以跟 Troteman 对话"吹号角"再叫一次。解除了 26714 的禁用。

这一期上线了，还在等玩家做到这里。

### 4.32 旅行者的猛犸象：商人被"留在原地"

这一节是这次最有意思的一个 bug，前后改了四版才找到真正的原因，过程值得完整记下来。

**现象。** 召唤 Traveler's Tundra Mammoth（联盟 61425）后，背上的两个商人 Hakmud of Argus 和 Gnimo 一出来就"掉下去"了：猛犸象走开，他们留在原地，走近了还能买东西。

**数据。** 这个坐骑是"载具坐骑"：坐骑光环指向生物 32633，它的载具编号是 312，两个商人是 `vehicle_template_accessory` 里的乘客（1 号、2 号座位）。服务器在 `Unit::Mount` 里给玩家创建载具，再调用 `InstallAllAccessories` 把两个商人召唤出来、安排上车。顺带发现部落版（61447 → 32640）的载具编号是 0，等于根本不是载具，部落版的商人从来没出现过。按 TDB 补成 313（`sql-custom/2026_11_14_16_travelers_mammoth_horde_vehicle.sql`）。

#### 第一步：服务器到底有没有把他们踢下去

先打开载具调试日志（`Logger.entities.vehicle=2`）。这里还顺手发现：服务器的日志文件一直没写出来过，因为工作目录 `/opt/skyfire` 是 root 的，服务进程没权限建文件。把 `LogsDir` 改到容器的 `/tmp` 才有了日志。

第一份日志看着像抓到了凶手：两个商人安排上车之后，紧接着出现 `Vehicle::Uninstall`，两人随之"下车"。但第二次召唤的日志里，只有上车，没有任何下车记录。回头一想，第一次的 Uninstall 其实是玩家测完下坐骑留下的。

为了确认，我用宿主机上的 gdb 直接挂到 worldserver 进程上。正式版二进制没有剥离符号，函数名都在。在"乘客下车"和"拆载具"上下断点，命中时打印时间和调用栈，然后继续运行：

```
break Vehicle::RemovePassenger
commands
  silent
  shell date +%T.%N
  bt 12
  continue
end
```

时间线很干净：21:29:51 两个商人上车，21:30:12 玩家下坐骑，`Unit::Dismount` → `RemoveVehicleKit` → 两人下车。中间这 21 秒，服务器里两个商人一直好好坐在猛犸象上，跟着玩家移动。

所以问题不在服务器逻辑，而是**客户端从来没把他们挂到坐骑上**。

#### 第二步：三次失败的猜测

**第一版：重新载入。** 推测是商人先被召唤出来、客户端已经收到一个"站在地上"的商人，之后上车只靠一个"走向座位"的移动包，客户端没认。那就在上车后让附近客户端重新载入商人（`DestroyForNearbyPlayers` + `UpdateObjectVisibility`），让初次显示的数据直接带上"坐在哪个载具几号座位"。没用。

**第二版：等客户端确认。** 再用 gdb 把载具相关的收发包都打上时间戳：

| 时间 | 事件 |
|---|---|
| 22.497 | 服务器发 `SMSG_MOVE_SET_VEHICLE_REC_ID`："你现在是 312 号载具" |
| 22.517 / 22.529 | 两个商人上车（`VehicleJoinEvent::Execute`），发出走向座位的移动路径 |
| 22.600 | 客户端回 `CMSG_SET_VEHICLE_REC_ID_ACK`："知道了" |

商人上车比客户端确认早了 80 毫秒，而且客户端没发过任何"踢乘客"的请求。看起来非常像时序问题，于是把重新载入挪到收到确认之后。gdb 确认重新载入确实在确认后 10 毫秒发出去了，还是没用。

**玩家的关键发现。** 这时玩家反复试了很多次，发现一个规律：**骑上去马上走，商人会跟上来坐好；原地站超过大约 1 秒，商人就永远留在地上。**

这一下就清楚了：服务器让乘客上车时，发的是一段带 transport-enter 标志的移动路径（spline），客户端要过大约 1 秒才把它走完。路径还在进行中、坐骑又在动，客户端就把乘客挂上去了；路径走完时坐骑还没动，客户端就把乘客定在那个世界坐标上，之后再也不管。第二版的重新载入发生在路径还没走完的时候，初次显示数据里带的仍是这段路径，结果一样。

**第三版：等路径走完再重新载入。** 想法是路径结束后再发初次显示数据，里面就只有"坐在几号座位"，跟生物载具上的乘客平常显示一样。结果更糟：连"马上走"也挂不上了。这反而是最有价值的一次失败，它证明了**对坐在玩家坐骑上的生物，5.4.8 客户端根本不认初次显示数据里的座位信息**，唯一认的就是"transport-enter 路径进行中 + 坐骑在动"。

#### 第三步：顺着客户端的规律来

第四版放弃重新载入。商人上车后，每 200 毫秒检查一次：

- 上车路径已经走完、坐骑还没动过：再发一段走向座位的 transport-enter 路径，让它一直处在"进行中"。
- 路径进行中、坐骑动了：客户端此刻会挂上乘客，停止检查。
- 一直站着不动，最多坚持约 10 分钟，避免无限发包。

```cpp
bool moved = std::fabs(base->GetPositionX() - _lastX) > 0.1f || std::fabs(base->GetPositionY() - _lastY) > 0.1f;
if (moved && !_passenger->movespline->Finalized())
    return true; // 坐骑在上车路径进行中移动 -> 客户端已挂上乘客

if (_passenger->movespline->Finalized())
{
    Movement::MoveSplineInit init(_passenger);
    init.DisableTransportPathTransformations();
    init.MoveTo(seat->m_attachmentOffsetX, seat->m_attachmentOffsetY, seat->m_attachmentOffsetZ, false, true);
    init.SetFacing(0.0f);
    init.SetTransportEnter();
    init.Launch();
}
```

只对"玩家载具上的生物乘客"生效（`Vehicle.cpp` 里的 `PlayerVehiclePassengerBoardEvent`），普通生物载具和玩家坐别人的载具都不受影响。实测：召唤后马上走、站 5 秒以上再走，两种情况商人都会跟上来坐好。

#### 收尾：下马时别砸在玩家身上

下坐骑时，乘客的落点直接用的是坐骑（玩家）的位置，三个人叠在一起落地。猛犸象两个座位的挂点偏移都是 0（位置由模型上的挂点 13/14 决定），所以按座位号分：单数座位往左、双数座位往右，各离玩家 3 码，落点高度取那里的地面；如果地面跟玩家脚下差 5 码以上（陡坡、悬崖），退回原来的落法（`Unit::_ExitVehicle`）。

玩家同时测了另一个带商人的坐骑 Grand Expedition Yak（122708 → 62809，载具 2273）：它的商人上车本来就正常，下马也有同样的重叠问题。它的两个商人在 0 号和 1 号座位，同一条规则就把他们分到了两边，不用单独改。实测两个坐骑都通过。

补丁：`patches/2026_11_14_01_vehicle_player_mount_passenger_keep_boarding.patch`（`Vehicle.cpp` + `Unit.cpp`）。

回头看，这个 bug 能解决，一半靠工具，一半靠玩家。工具方面，正式版二进制带符号，gdb 挂上去打时间戳就能看清服务器的每一步，比加日志、重新编译快得多。但服务器日志只能证明"服务器没错"，客户端怎么想看不到。真正撬开问题的是玩家那句"马上走就能跟上"，三次失败的猜测都是在补这一块看不见的拼图。

### 4.33 吉尔尼斯城：两段骑马任务和一个相位 bug

狼人新手村之前只修过零散的几个任务（`2026_11_13_24`）。这次用狼人角色 Shen 实际往下玩，卡在三个地方：交不了 Time to Regroup（14294），Save Krennan Aranas（14293）接了没有马，Sacrifices（14212）的马骑不上去。后两个都是"骑在马上沿街跑"的任务，修的过程中又挖出一个服务器核心的 bug。

#### 相位：只配了第一个

吉尔尼斯城的 NPC 按剧情进度分在好几个相位里：170（城市沦陷）、171（Josiah Avery 变身之后）、172（Greymane Court 之战），以及后面 Duskhaven 用的 179～194。`phase_area` 里却只配了 170。171 只靠 Josiah Avery 的脚本在交任务时临时加一下，重新登录就没了。172 没有任何办法进入，而 14294 要交给的国王恰好就在 172。

按任务链补了两条规则（`sql-custom/2026_11_14_18_gilneas_phases_171_172.sql`），覆盖城区的各个子区域：

- 171：交了 14159 The Rebel Lord's Arsenal 之后一直有，直到 14294 交掉为止；
- 172：接了 14294 就有，之后一直保持。

179 以后的相位还是空的，等角色走到 Duskhaven 再补。

#### Save Krennan Aranas：整套都缺

原版流程：接任务后国王的马出现，玩家骑上去，马自己跑到 Krennan 被困的树下，玩家点载具技能 Rescue Krennan，Krennan 坐到身后，马再跑回 Lord Godfrey 那里。数据库里这一套全缺：

- 国王的马（35905）没有载具编号，也没有脚本；
- Rescue Krennan（68219）要求附近有"Krennan 的树"这个施法焦点（spell focus 1630），地图上根本没有放。

修法：

- 接任务时让玩家施放召唤马的法术 68221。法术本身是"召唤载具并骑上"，前提是马得是载具。马的载具编号原数据和 TDB 4.4.2 里都没有，按 Vehicle.dbc 选了一个没人用、两个座位、编号也落在吉尔尼斯那批载具范围里的 494。实测座位位置正常。
- 马的脚本 `npc_greymane_horse`：用寻路网格（`tools/navpath`）算出两段路线写死在脚本里，一段到树下，一段从树下回到 Godfrey。救下 Krennan 后让他坐进 1 号座位。
- 在 Krennan 的位置放一个隐形的施法焦点 910103，放在他的 171 相位里（`sql-custom/2026_11_14_17_save_krennan_aranas.sql`）。

载具的 0 号座位在 DBC 里是"驾驶座"，玩家可以自己操控。我在脚本里用 `SetClientControl(me, 0)` 收回了操控权，让马按路线自己跑，和原版一样。

#### Sacrifices：骑马扔火把

任务要求骑在 Crowley 的马上穿过城区，用火把点燃 30 只 Bloodfang Stalker，把它们引离幸存者。数据的问题是：

- Greymane Court 和终点 Tobias Mistmantle 旁各停着一匹 Crowley's Horse（44427 / 44429），点它们触发的是一个什么都不做的占位法术 56685；
- 真正用来骑的那匹马 35231（自带 Throw Torch 技能，由 67001 召唤）没有载具编号，也没有脚本；
- Throw Torch（67063）是"落点范围内指定生物"类型的法术，没有配置能打中谁；
- 没有任何东西负责给任务计数（35582）。

修法：两匹停着的马改成点击后施放 67001，只有接了任务才能点；35231 用同一个载具 494，Crowley 坐 1 号座位；马按写死的路线从 Greymane Court 跑到 Tobias 那里，从终点那匹马出发就反着跑回来，没凑够可以来回跑；Throw Torch 加上目标条件（`sql-custom/2026_11_15_01_sacrifices_crowley_horse.sql`）。

这一段实测了五六轮才跑通，每轮暴露一个问题：

1. **骑上去马不动。** gdb 显示马的脚本只在召唤时跑了一次，之后完全没有被调用。原因是玩家坐上驾驶座时，服务器默认的 `CreatureAI::OnCharmed` 会关掉原来的 AI，换成通用的 `PossessedAI`。修法是 TrinityCore 里同类载具的常规写法：在脚本里重载 `OnCharmed`，什么都不做。国王那匹马碰巧没受影响，也一并加上了。
2. **马穿过路障。** 寻路网格里没有路障这类摆放物。用 `tools/vmapcheck` 沿路线每隔一码查一次碰撞，在 (-1625, 1665) 找到了路障，路线改成从南边绕过去。
3. **马跑一段就停。** 火把引来的狼人会打马，马一进战斗，默认逻辑就会停下来去追敌人，或者脱战后"回家"，原定的路线就被打断了。脚本里把 `AttackStart`、`MoveInLineOfSight`、`EnterEvadeMode` 都重载成空的。狼人实在太多（原数据就有 406 个刷新点），马还被打死过一次。玩家建议干脆让马无敌，于是给两匹马都加了全系伤害免疫。狼人照样会追，只是打不出伤害。
4. **火把不计数。** 计数原来写在马的 `SpellHitTarget` 里，只有马自己施放时才会触发，而实际施放者是骑手。改成挂在法术上的脚本 `spell_sacrifices_throw_torch`：不管谁施放，砸中一只 Stalker 就交给马的脚本，同一只一趟只算一次。
5. **每次都在同一个地点被弹下来。** 这个是核心 bug，单独说。

#### 核心 bug：换相位就把人从马上弹下来

玩家每次都在差不多的位置被弹下来，最开始以为是马被打死了。gdb 在"骑乘光环被移除"上下断点，调用栈是这样的：

```
AuraEffect::HandleAuraControlVehicle
...
Unit::RemoveNotOwnSingleTargetAuras(unsigned int, bool)
Unit::SetPhased(unsigned int, bool, bool)
WorldObject::UpdateAreaPhase()
Player::UpdateArea(unsigned int)
```

马从 Greymane Court（子区域 4758）跑进旁边的街区（4755）时，170 号相位在 4755 有配置，在 4758 没有。玩家的相位一变，`SetPhased` 就会调用 `RemoveNotOwnSingleTargetAuras(0, true)`，清掉"对方已经看不见了"的单目标光环。这个函数分两段：第一段处理别人施放在自己身上的光环，判断写得对；第二段处理自己施放在别人身上的光环，还在用老式的相位掩码：

```cpp
if (aura->GetUnitOwner() != this && !aura->GetUnitOwner()->InSamePhase(newPhase))
```

改成相位编号之后，这里传进来的 `newPhase` 是 0，`InSamePhase(0)` 永远不成立。结果就是相位只要一变，玩家施放在别人身上的所有单目标光环都会被清掉，骑乘光环正好是其中之一。

第一次修复让第二段照第一段那样判断"对方是否还看得见"，结果玩家还是在同一个地方被弹了下来。原因是马的相位是召唤那一刻从玩家身上复制的，之后不会跟着变，所以服务器真的认为两者已经互相看不见了。最后改了两层：

- 核心代码：玩家正骑着的那个载具，一律不清；
- 两匹马的脚本：每半秒把马的相位同步成骑手当前的相位。

补丁：`patches/2026_11_15_01_phase_change_keeps_single_target_auras.patch`（`UnitAuraState.cpp`），吉尔尼斯的脚本都在 `patches/2026_11_14_02_gilneas_krennan_and_sacrifices.patch`。这个 bug 影响所有跨区域时会换相位的载具和单目标光环，不只是这两个任务。

实测：Time to Regroup、Save Krennan Aranas、Sacrifices 都能完成。玩家的评价是"路线有点奇怪"，因为路线是按寻路网格和路障手工定的，不是原版的路线。

#### Last Stand 和去 Duskhaven

再往下两步又卡住了。

**Last Stand（14222）找不到要杀的怪。** 8 只 Frenzied Stalker（35627，共 39 个刷新点）和几个 Northgate Rebel 都在 179 号相位，分布在大教堂周围（子区域 4761），这个相位没有配置。补了一条规则：接了 Last Stand 还没交的时候生效（`sql-custom/2026_11_15_02_gilneas_phase_179_last_stand.sql`）。这次没有重启，用控制台 `reload conditions` 热加载：这个命令会顺带重新读取 `phase_area`，玩家重新登录后就生效了。

**交完 Last Stand 走不了。** 原版流程是：交任务时播放变身动画，玩家在 Duskhaven 的 Krennan 家醒来，找国王交掉没有目标的 Last Chance at Humanity（14375），学会 Darkflight 等狼人种族技能，炉石绑定到 Duskhaven。我们这里只剩动画：

- 没有任何东西把玩家传送到 Krennan 家；
- 14375 的发放人兼交付人 King Genn Greymane（36332）没有刷新点；
- 传送和绑定法术（68630、72788、72799）都没有目标坐标；
- Duskhaven 的 181 号相位没有配置。

补法（`sql-custom/2026_11_15_03_gilneas_last_stand_to_duskhaven.sql`）：

- 交 Last Stand 时，Crowley 的 SmartAI 把玩家传送到 Krennan 家，坐标取自 TDB 4.4.2 的 `spell_target_position`；
- 在屋里放一个 Genn，负责 14375；
- 交 14375 时让玩家施放原版的 Last Stand Complete（72799），学会种族技能并绑定炉石。14375 自带的奖励法术 68639 只有一个屏幕效果；
- 交了 Last Stand 之后，Duskhaven 的各个子区域都启用 181 号相位。

#### Kill or Be Killed：交任务的王子看不见

Gwen Armstead 的 Kill or Be Killed（14336）要去镇外找 Prince Liam Greymane 交，但那里什么人都没有。这个 Liam（36140）在 182 号相位，也就是被遗忘者入侵 Duskhaven 的那一层：要杀的 Forsaken Invader、要炸的 Horrid Abomination、火药桶、Two By Sea 的两位船长、Save the Children 的三个孩子、Leader of the Pack 的 Dark Ranger Thyala 都在这一层，可它跟 179 一样没有配置。

把后面紧接着要用的几层按任务顺序一起补上（`sql-custom/2026_11_15_04_gilneas_phases_182_183_184.sql`，181 原来的条件备份在 `backup/phase181_conditions_20261115.tsv`）：

| 相位 | 内容 | 生效条件 |
|---|---|---|
| 181 | 地震前的 Duskhaven | 原来是"交了 14222"，现在加一条：还没接 As the Land Shatters（14396） |
| 182 | 被遗忘者入侵 | 交了 Invasion（14321），还没接 14396 |
| 183 | 地震以后（Liam 36451、Gwen 36452、Grandma Wahl、Hayward 兄弟、Lorna） | 接了、完成了或交了 14396 |
| 184 | 灰鬃庄园（Queen Mia，To Greymane Manor 的交付人） | 接了、完成了或交了 To Greymane Manor（14465） |

每层用到的子区域是把这一层所有刷新点的坐标放到地图文件里查出来的。183 什么时候结束要等配 186 号相位（Exodus 以后）时再定。这次同样只用 `reload conditions` 热加载，没有重启；角色身上挂着 14336，重新登录后应该就能看到 Liam。还没在游戏里验证。

#### The Allens' Storm Cellar：地窖门是关着的

下一个任务要去 Allen 农场的地窖找 Lord Godfrey（36290），但地窖门打不开。入口（-1880.5, 2545.8）在同一个位置、同一个朝向叠了两扇门：开着的 Basement Door（196404）和关着的 Doodad_Worgen_Cellar_Door_02（206693，默认就是关闭状态）。两扇都属于相位组 379，也就是城里的 169～172 号相位。这几个相位是按整个吉尔尼斯区域（4714）配的，所以在 Duskhaven 也会生效，关着的那扇就一直显示，把路堵死了。

修法是删掉关着的那一扇（guid 90387），原来那一行备份在 `backup/gameobject_90387_20261115.tsv`，SQL 文件是 `sql-custom/2026_11_15_05_allens_storm_cellar_door.sql`。游戏物件没法热删除，所以这次重启了世界服。

#### 地窖里的四个任务：地震任务能提前接

Godfrey 和 Melinda Hammond 在地窖里给了 Save the Children!（14368）、Unleash the Beast（14369）、Two By Sea（14382）、Leader of the Pack（14386），结果一个都做不了：怪、孩子、投石车全都不见了。原因是 Godfrey 同时还给出了 As the Land Shatters（14396）。这个任务一接就进入地震后的 183 号相位，入侵那一层（182）随之关闭。数据库里它没有任何前置任务，所以可以抢先接了交掉，后面四个任务的目标就都没了。

把四个任务做完前其实还有几处是坏的，一起修了（`sql-custom/2026_11_15_06_duskhaven_invasion_quests.sql`）：

- **14396 加前置**：用条件（类型 19/20）要求四个任务都已交付，才能看到和接 As the Land Shatters。
- **Save the Children!**：点孩子用的三个法术（68596～68598）只有 SCRIPT/DUMMY 效果，没有脚本，点了不给进度。改成孩子被这个法术命中时给点击者记一次，然后消失，60 秒后重刷；只有接了任务才能点。
- **Leader of the Pack**：Dark Ranger Thyala 和召唤出来的獒犬没有 AI。照 TDB 4.4.2 补上 SmartAI，獒犬的攻击目标从 TDB 写死的生物 guid 改成"100 码内最近的 Thyala"。
- **Two By Sea**：船长站在海上的船里（脚下的地形在水下 15～35 码），只能坐投石车过去。投石车的 Launch（68659）只有一个 DUMMY 效果，加上一个"让 0 号乘客施放 96114"的强制施法，实际什么也不做。在 `gilneas.cpp` 里加了法术脚本 `spell_two_by_sea_catapult_launch`：发射时把玩家从投石车上放下来，0.2 秒后按瞄准点做一次约 3 秒的抛物线跳跃。落点由玩家自己瞄，打偏了就掉进海里，这一点保持原样。源码改动在 `patches/2026_11_15_03_gilneas_cumulative_incl_two_by_sea_catapult.patch`。
- **重复刷新**：三个孩子、两个船长和一辆投石车各在同一位置刷了两份，删掉多出来的（备份 `backup/duskhaven_dup_spawns_20261115.tsv`）。孩子重刷改成 60 秒，船长改成 120 秒（原来是 2 小时）。

测试角色已经提前交了 14396，把这条交付记录删掉（备份 `backup/shen_q14396_rewarded_20261115.tsv`）后，它就回到了入侵相位。服务器在 0 人在线时重新编译并重启。还没在游戏里验证。

游戏里测下来的结果：Leader of the Pack 和 Unleash the Beast 都能做完；Save the Children! 只看到两个孩子，第三个 Ashley 刷在 Hammond 农舍二楼（脚下的地板在 12.7 码高，一楼在 3.6 码），这是原本的位置，不是缺刷新，所以不动。

投石车上不去。六辆 Forsaken Catapult（36283）都带着 NOT_SELECTABLE 和 IMMUNE_TO_PC 标志，阵营还是敌对的 1735，客户端根本点不中。原版里投石车由 Forsaken Machinist（36292）驾驶，打掉驾驶员才能用，可这个生物在 SFDB 和 TDB 里都没有刷新点，也就永远没人来"释放"投石车。改成投石车直接可用：阵营改为友好的 35，去掉这两个标志，原有的点击上车法术 46598 不变（`sql-custom/2026_11_15_07_two_by_sea_catapult_clickable.sql`，备份 `backup/catapult_36283_template_20261115.tsv`）。生物模板要重启才生效，已在征得同意后重启，等游戏里验证。

另外，测试角色任务日志里的 Gasping for Breath（14395）也看不到目标。这是地震后的任务，溺水守卫和交任务的 Liam 都在 183 号相位，要等接了 As the Land Shatters 才会出现。之前提前交了 14396 时顺手接了它，删掉 14396 的交付记录以后它就暂时没有目标了，这个不用修。

投石车改完后在游戏里确认能上车，两个船长也打掉了；Ashley 在二楼找到了，四个任务都已交付。

#### 地震后的地形从来没切换过

查 Gasping for Breath 时发现，溺水守卫（36440，50 个）的刷新高度在 -2～-25 码，而地图 654 在这些位置的地面是 1 码左右，等于把他们埋在地下 12～25 码。客户端隔着地面能看到人，一点却点在地面上：用 gdb 在 `WorldSession::HandleSpellClick` 下断点，玩家怎么点都没有触发，说明客户端根本没发点击请求。

原因是地震后应该换成塌陷的海岸地形。这类"地形替换"在 Map.dbc 里是独立的地图：638 是地震前的默认地形（`terrain_swap_defaults` 里配了），655（Gilneas_terrain1）是地震后塌陷、被水淹的地形，在 655 上这些守卫正好漂在海床上方的水里。而 `terrain_phase_info`（哪个相位用哪块替换地形）整张表是空的，所以不管进到哪个相位，服务器发给客户端的永远只有 638。补上"183 号相位 → 655"（`sql-custom/2026_11_15_08_gilneas_quake_terrain_swap.sql`）。`reload conditions` 会顺带重载这张表，不用重启；玩家要重新登录。服务器自己算高度时不看替换地形，只有客户端显示和寻路会用到。

第一次重新登录还是不对。在 `WorldSession::SendSetPhaseShift` 下断点看实际发出的包：相位是 171/181/182，地形只有 638。原来测试角色还没接 As the Land Shatters，根本没进 183 号相位，日志里的 Gasping for Breath 是之前提前接的。地形配置本身没问题，等接了地震任务再验证。

后来发现 Godfrey 不给 As the Land Shatters，是因为服务器的 `SatisfyQuestNextChain`：任务链里的下一个任务（14395）已经在日志里，就不让接上一个。这是之前给测试角色撤销 14396 时只删了交付记录、没把 14395 一起清掉留下的。放弃 14395、接 14396 之后，地形正确切换成塌陷的海岸，守卫可以点了；把守卫带到岸上 Prince Liam 身边 10 码内就计数，任务已在游戏里完成。个别守卫跟随时会卡住（服务器算高度和寻路用的还是地图 654 原始地形，不是 655），不影响进度，暂不处理。

#### 每次登录都重放狼人 CG

测试角色每次进游戏都会先放一段狼人剧情动画。同一次 gdb 抓到了来源：`Player::SendMovieStart(21)` ← `Spell::cast` ← `Player::learnQuestRewardedSpells` ← `Player::_LoadQuestStatusRewarded`。

Last Stand（14222）的奖励施法是 93477，这个法术有三个效果：学会 94293（Enable Worgen Altered Form，狼人/人形切换）、播放 21 号动画、还有一个相位效果。登录时服务器会对每个已交付任务检查一遍：奖励法术要教的技能还没学会，就把整个法术重新施放一次（本意是补学技能）。而 94293 同时也是狼人的种族默认技能（`playercreateinfo_spell`），这类技能不存进 `character_spell`，每次登录由 `learnDefaultSpells()` 重新学。问题出在 `Player::LoadFromDB` 的顺序：先检查任务奖励，后学默认技能。检查那一刻角色总是"没学会 94293"，于是每次登录都重放一遍动画。所有做过 Last Stand 的狼人都会这样。

修法：在加载任务状态之前先调用一次 `learnDefaultSpells()`（原来那次保留，重复调用不会重复学）。补丁 `patches/2026_11_15_04_player_cumulative_incl_default_spells_before_quest_rewards.patch`。编译后经同意重启，游戏里确认登录不再重放动画。

顺带记一个坑：`Player.cpp` 是 CRLF 换行，用 Python 文本模式改写会全部变成 LF，`git diff` 一下子变成四万多行。改这类文件要按字节读写。

#### 地震后的两个收集任务

- **I Can't Wear This（14400）**：Grandma's Good Clothes（GO 196472）刷在 181 号相位（地震前），而任务和 Grandma Wahl 都在地震后的 183 号相位，衣服对玩家来说根本不存在。改成 183 号相位。
- **Not Quite Shipshape（14404）**：Coal Tar、Planks of Wood、Shipwright's Tools 三个 GO 都刷了，但掉落写的是普通 100% 掉落，不是任务掉落。服务器只在 GO 有"该玩家需要的任务掉落"时才让它闪光（`GameObject::ActivateToQuest`），所以三样东西都不闪，很难找。改成任务掉落（-100）。另外每样在同一位置重复刷了两份，删掉多余的。
- 这几个 GO 原来要 2 小时才重刷，改成 120 秒。

文件 `sql-custom/2026_11_15_09_wahl_hayward_quest_items.sql`，备份 `backup/duskhaven_quest_gos_20261115.tsv`。掉落表热加载，相位和刷新点经同意重启后生效，游戏里确认衣服找到、三样东西都在闪光。

- **Washed Up（14412）**：13 个 Forsaken Castaway 刷新时间 2 小时，其中一半就站在 Sebastian Hayward 和卫兵身边，被 NPC 打死不给玩家计数，结果整片营地 2 小时空着。刷新改成 60 秒，并清掉当时的刷新倒计时（`sql-custom/2026_11_15_10_washed_up_castaway_respawn.sql`，备份 `backup/forsaken_castaway_respawn_20261115.tsv`）。刷新数据缓存在内存里，经同意重启后生效。

#### Greymane Manor 的两扇铁门

庄园大门前同一个位置叠着两扇门：一扇是庄园自己的门（196864，184 号相位），能正常打开；另一扇是城里那几个相位用的门（196401，相位组 379 = 169～172）。打开以后仍然有一堵空气墙，就是后者的碰撞。它能出现在这里，是因为狼人身上的 Worgen Bite（72870）光环会把玩家永久放进 171 号相位，跟之前地窖门是同一个原因。删掉城里那扇（`sql-custom/2026_11_15_11_greymane_manor_dup_gate.sql`，备份 `backup/gameobject_90384_20261115.tsv`）。附近还有两扇同类的门（Hammond 农舍旁的地下室门、Krennan 房子那里），没人报告问题，先不动。

删掉以后只剩一扇，打开了还是进不去。剩下这扇 196864 的类型是**按钮**（type 1），不是门：点击会播放开门动画，但客户端只对真正的门（type 0）在打开时去掉碰撞，按钮的碰撞一直在，而且 5 秒后就自动关上。改成在同一位置放城里那扇真门 196401，挂到 184 号相位，**刷出来就是开着的**（state 0），删掉按钮（`sql-custom/2026_11_15_13_greymane_manor_gate_open.sql`，备份 `backup/gameobject_90231_20261115.tsv`）。

这样能进去了，又冒出两个问题：

- **门只能点一次**：从里面点了一下就把门关上了，之后再也点不动。这种门的自动复原时间是 0（data2 = 3 毫秒），核心把它切到关闭后就停在那里不再复原。给模板加 GO_FLAG_NOT_SELECTABLE（0x10），门常开、点不到（`sql-custom/2026_11_15_15_greymane_manor_gate_unclickable.sql`）。
- **交任务的 Queen Mia 一走近就消失**：庄园内部是另一个区域 4817（WMO 区域 "Greymane Manor"），而 183/184 号相位只配了庄园外围 6545。一进门相位就掉了，挂在 184 上的 Queen Mia、183 上的国王 Genn 都跟着消失。给 4817 补上和 6545 相同的相位和条件（`sql-custom/2026_11_15_14_greymane_manor_interior_phases.sql`，热加载）。

出庄园时外面那道铁门（-1817.8, 2333.4）是一模一样的情况：184 号相位的按钮门 196863，加上漏过来的城里真门 196399，开了还是空气墙，人被关在里面。同样改成一扇常开、点不到的真门（`sql-custom/2026_11_15_16_greymane_estate_outer_gate.sql`，备份 `backup/gameobject_90232_90390_20261115.tsv`）。Allen 农场地窖入口的两扇地下室门（196404/196411）都是开着的，不挡路，但同样一点就会卡在关闭状态，也加了 0x10（`sql-custom/2026_11_15_17_allens_cellar_doors_unclickable.sql`）。都经同意重启后生效，等游戏里验证。

#### 下载具后不能跳

这次在吉尔尼斯又遇到了：下马后不能跳，也走不下斜坡。Deadmines 的机器人下来也是同样的表现。gdb 显示下马时服务器发了 `SMSG_MOVE_GRAVITY_ENABLE`，客户端也回了确认（`CMSG_MOVE_GRAVITY_ENABLE_ACK`），而重新登录就能恢复，说明服务器这边的状态是对的，卡住的是客户端。

我的猜测是：`Unit::_ExitVehicle` 先发"恢复重力"，紧接着给玩家启动一段"从载具上下来"的移动路径，客户端在这段路径结束时，又把开始时的无重力状态还原了回去。按这个猜测加了一个保险：玩家下载具 1.5 秒后，如果没有坐上别的载具，也没有悬浮或飞行光环，就再发一次"恢复重力"（`patches/2026_11_15_02_unit_cumulative_incl_exit_vehicle_gravity_resend.patch`）。还要等下次骑载具来验证。

#### Exodus：马车没有，相位 186 也没有

Exodus（24438）原版是在庄园下方坐马车离开，中途翻车，落在沼泽边的 Prince Liam（37065）身边。数据库里马车（Stagecoach Harness 38755、Stagecoach Carriage 44928）在 SFDB 和 TDB 4.4.2 里都没有刷新点和脚本，乘车这段整个缺失；更糟的是 Liam 所在的 186 号相位（Exodus 之后整片乡下，579 个刷新）没有任何 `phase_area`，跑过去也看不到人。

按 186 号相位全部刷新所在的 12 个区域配上相位，条件是接了 / 完成 / 交了 Exodus（`sql-custom/2026_11_15_18_gilneas_phase_186.sql`，热加载）。测试角色跑到翻车地点交了任务。马车剧情暂时不做；187～191、194 号相位也还没配置，做到时再补。

#### Exodus 之后的三个任务

- **Stranded at the Marsh（24468）**：要"救 5 个幸存者"，实际目标是杀 5 只 Swamp Crocolisk（37078）。11 个 Crash Survivor（37067）没有任何可交互标志和脚本，37078 一只都没刷（TDB 也一样）。改成：接了任务和幸存者对话，就在玩家身边召唤一只鳄鱼扑过来，幸存者 3 秒后离开、60 秒重刷（`sql-custom/2026_11_15_19_stranded_at_the_marsh.sql`）。第一版鳄鱼能出来却不计数：击杀计数要求玩家打出至少一半血量的伤害（`Creature::IsDamageEnoughForLootingAndReward`），旁边的 NPC 经常抢掉。按用户的意思改成"参与就算"：召唤一只复制出来的替身鳄鱼 910003，它死时（不管谁杀的）给 30 码内的玩家记 37078，替身本身不是任务目标，所以不会重复计数（`sql-custom/2026_11_15_20_stranded_at_the_marsh_shared_credit.sql`）。
- **Preparations（24628）**：月叶（GO 201914）能采，读条结束却什么都没有。gdb 显示服务器生成了掉落、也走到了任务物品那一步，但月叶从没进过掉落列表：掉落表这一行的 `lootmode` 是 0，而 `LootTemplate::Process` 只放入 `lootmode & 1` 不为 0 的条目。全库查到 19 行同样问题（9 个游戏物件掉落，含奥特兰克 Frostwolf Maps、Dusty Journal、Borrowed Tabard；10 张感恩节食谱），全部改成 1 并热加载（`sql-custom/2026_11_15_21_lootmode0_rows.sql`）。
- **Losing Your Tail（24616）**：要打的 Dark Scout（37953）没有刷新，也没有东西施放"召唤 Dark Scout"（70795），阵营还是友好的 35。阵营改成 TDB 的 118，接任务时在玩家身边召唤一个攻击玩家，死时给 30 码内的玩家计数（`sql-custom/2026_11_15_22_losing_your_tail.sql`）。原版用护符挣脱定身的一段没有重做。

三个任务都已在游戏里完成。

### 4.34 夜色镇的缝合怪

之前（4.9）给 The Embalmer's Revenge（26727）补的是简化版：接任务时 Lord Ello Ebonlocke 在镇子南面入口召唤 Stitches 攻击玩家。实际测试接了任务什么也没看到，只是人物进入战斗又马上脱离。原因是服务器的 `ThreatRadius`（60 码）：怪物的目标离它的出生点超过这个距离就立即放弃战斗。召唤点离市政厅里的玩家大约 95 码，Stitches 一出来就把玩家当目标、又立刻放弃，原地站 2 分钟后消失。

这次按原版事件重做（`sql-custom/2026_11_15_12_stitches_road_event.sql`，备份 `backup/stitches_event_20261115.tsv`）：

- **接任务立刻触发**：召唤点改到市政厅门前的广场，离 Ebonlocke 约 38 码。
- **平时也有**：乌鸦岭墓地加一个常驻的 Stitches（guid 9100141，5 分钟重刷），只给这个刷新点写的 SmartAI：刷出后设为常驻激活（没人在附近也继续走）、3 秒后沿 412 号路线走、到最后一个点在广场上游荡，由夜色镇守卫迎战。路线用的是 AzerothCore 里原版事件的 91 个路点，逐个和 MoP 地形核对过，高度差都在 3 码以内。
- Stitches 原来的阵营 29 是一个部落阵营，改成 TDB 4.4.2 的 93（对玩家敌对的怪物）。做任务的玩家在路上截住常驻的这只，杀掉同样计数（KillCredit 43862）。

经同意重启后生效，启动日志没有报错，等游戏里验证。

### 4.35 接下来

30–39 级段继续逐个重建：东瘟疫之地、荆棘谷海角、千针石林、南贫瘠之地、菲拉斯、尘泥沼泽、凄凉之地，以及辛特兰的 27626。

## 还没解决的问题

- **重建会丢修复。** 数据库修复都在 `sql-custom/`，重新导入世界库后必须按顺序重跑一遍。源码改动只在工作区和 `patches/` 里，`git pull` 之前要先想好怎么合并。
- **多人同时做同一个任务从没测过。** 每个修复都只用一个角色验证过，像 29799 这种全场共用的事件，中途加入或者几个人进度不同步，都还是未知数。
- **其他种族已知做不了的任务：** 地精的 14113、14153 Life of the Party（派对客人一个刷新点都没有），14110 The New You（物品没有任何来源）。这些暂时搁置。
- **攒着等下一批编译的小 bug：** 放弃 29423 后，Huo 还会一直跟着玩家，重新登录可以解决。
- **赤脊山 26563 Return of the Bravo Company：** 前置任务和临时跟随者组合在一起，跳过 Weapons of War 的玩家拿不到（见 4.29），不挡主线，先不改。
- **赤脊山第二期替代设计还没实测：** 坦克能不能开、炮能不能打、Darkblaze 的强度都还是未知数（见 4.31）。
- **下载具后不能跳。** Deadmines 的机器人和吉尔尼斯的马都出现过：下来以后不能跳，也走不下斜坡，重新登录可以恢复。已经上线"下载具 1.5 秒后补发恢复重力"的修复，还没验证（见 4.33）。
- **吉尔尼斯 186 号以后的相位没有配置。** 182～184 已经补上（见 4.33），吉尔尼斯之战往后的任务很可能还会碰到 NPC 看不见的问题。
- **全局审计剩下的问题。** 联盟这边还有约 1000 个任务需要重建内容（第四章），按等级段从低到高逐批修。
- **11 月 9 日那次崩溃还没有结论。** 后来抓到的两个 core 都是关机时的另一个 bug（见 1.8 节，已修复）。`GetQuestStatus` 那次一直没有再出现，还在等它的 core。

熊猫人岛和矮人这两条新手线目前都能完整做完。接下来继续往后玩，遇到问题再接着修，这篇文章也会跟着更新。
