---
layout: post
title: 建造自己的魔兽世界
category: 计算机
tags: [计算机, 软件]
---


----------

## 写在前面

笔者是多年的铁杆WoWer，对于十几年前开始的那个漫长的升级、冲技能、攒金币，天昏地暗的团队副本开荒的荒唐日子至今念念不忘，在这个游戏中也结识了很多好基友，拓展了自己的社交圈子，甚至于后来娶到的老婆都是在游戏中认识的。

随着年龄的增长，玩游戏的时间越来越少，生活的重心开始逐渐转向事业和家庭，然而当年那个屠龙的少年还一直深藏在心里。

## AzerothCore介绍

在开始动手之前，可以先简单了解一个叫AzerothCore的开源项目，[点击这里可以进入这个项目的主页][1]，以及[点击这里可以进入该项目在GitHub上的主页][2]。在项目网站的[wiki首页][3]上他们是这么介绍自己项目的（英文不好，佛系翻译了一下）：

### 项目概述
AzerothCore是一个完整的MMO开源和模块化解决方案。（MMO - 大型多人在线，魔兽世界就是一款典型的MMORPG，即：大型多人在线角色扮演游戏）

### 坚实的基础
AzerothCore经过多年的发展，拥有雄厚的基础:以芒果、triitycore、SunwellCore为基础。我们正在改进这种可靠性，提供一个遵循特定版本规则的项目，允许您以正确的方式开发。

### 良好的可玩性
我们的主要目标是提供一个完全可工作和可玩的服务器应用程序。我们将把稳定的修订重点放在最终用户体验上，而不是像我们的前辈那样遵循严格的开发模式。当然，我们将在每个处于开发阶段的新版本中改进代码。

### 开放源代码
AzerothCore模块是在GNU AGPL 3.0和GNU GPL 2.0下发布的，这两个许可证都是完全免费和开源的。我们相信自由软件，我们热爱合作。

### 经过测试，稳定可靠，持续更新
AzerothCore的前身SunwellCore，在数千名玩家陪伴下运行了数年。AzerothCore的目标是保持这个游戏应用程序的更新，继续它的开发。

### 社区驱动
AzerothCore的主要优势是它的社区。用户可以通过改进代码库或提交任何bug报告来帮助我们。如果你想做出贡献，我们会很乐意的！

### 模块化
我们尽量使我们的软件模块化，因为模块化软件更容易扩展。

***这听起来是不是很酷？把开源精神带到电子游戏的世界里来，只有内心Free的人，才能玩得开心，这简直太棒了。***

## 配置需求

笔者的服务器是一台运行在OpenStack云平台上的虚拟机，配置如下：

- vCPU：16
- MEM：32GB
- Disk: 300GB

根据操作系统和游戏服务装好后跑起来的空载资源消耗情况看，4 x vCPU，8GB MEM，150GB Disk也是足够的，实际运行的话根据玩家数量以及对性能的追求可对此配置进行扩展，如：增加vCPU，增大内存，更换速度更快的SSD……建议在实际的运维过程中追加一套监控平台对游戏服务器的资源进行实时监控，监控平台选型在这里也不赘述了，Zabbix，Promithues，甚至是自己编写的一系列Shell脚本……都可以。

## 准备操作系统

既然是开源的项目，操作系统的选型上肯定首选开源操作系统 - Linux。然后狭义上来讲Linux只是一个操作系统内核（Kernel），它并不像大多数用户所认为的操作系统的样子，而广义上讲，所有基于Linux内核衍生出来的操作系统都可以统称为Linux操作系统，如大家比较常见的桌面发行版：Ubuntu-desktop, Fedora-desktop, openSUSE……以及企业发行版：Ubuntu-server, Redhat Enterprise Linux, SUSE Linux Enterprise……等等这些，除了列举的这些之外，Linux的发行版成千上万，开源爱好者也遍及全球各地，开源精神最酷的地方就是，它能让不同文化、不同语言的人们一起合作完成一些软件行业里的伟大的壮举，创造不得了的软件，Make the world a better place.

笔者在操作系统选型上，选择了Debian 10 "Buster"，操作系统细节上就不做赘述了，太复杂了，三言两语的说不完。现在先到Debian社区去下载带有Debian 10 installer的光盘镜像（ISO）文件，或者如果基础设施并不是运行在本地的物理计算机上，而是运行在一些公有云（如：AWS、DigitalOcean、AliCloud……）或私有云上，也可以使用云供应商提供的云镜像或选择下载Debian 10专为云计算环境准备的云镜像系统。相关链接如下：

- [点击这里进入Debian下载首页][4]
- [64位的第一张DVD系统安装盘的下载种子][5]
- [64位运行于OpenStack之上的云镜像（QCOW2）][6]

拿到安装盘或云镜像后就可以开始安装、启动服务器了。操作系统的安装在这里也不赘述，Debian installer提供友好的用户界面，根据提示一步步进行操作即可。


## 配置软件环境

系统安装好后，开始进行一些必要的设置：

### 第一步：先更新一下操作系统

```
# apt-get update
# apt-get upgrade -y
```
### 第二步：安装必要的软件包

需安装的软件包清单如下：

- git
- cmake
- make
- gcc
- g++
- clang
- default-libmysqlclient-dev
- libssl-dev
- libbz2-dev
- libreadline-dev
- libncurses-dev
- mariadb-server
- mariadb-client
- libace-6.4.5
- libace-dev
- autoconf
- automake
- gettext
- unzip
- zip
- bison
- flex
- net-tools
- tcpdump
- build-essential

安装命令：

```
# apt-get install -y git \
cmake \
make \
gcc \
g++ \
clang \
default-libmysqlclient-dev \
libssl-dev \
libbz2-dev \
libreadline-dev \
libncurses-dev \
mariadb-server \
mariadb-client \
libace-6.4.5 \
libace-dev \
autoconf \
automake \
gettext \
unzip \
zip \
bison \
flex \
net-tools \
tcpdump \
build-essential
```

### 第三步：创建一个普通用户并授权

```
# useradd -m -d /home/wow wow
# passwd wow
New password:
Retype new password:
passwd: password updated successfully
# usermod -aG sudo wow
```

其中***passwd***命令之后需要输入两次新建的密码，原因不用多解释了吧。

如果是通过Debian官方的云镜像启动的系统，这一步默认也可以省略，因为云镜像默认就创建了一个名为debian的用户，并默认给予了sudo的授权。

### 第四步：重启系统并用新用户登录

```
# reboot
```

## 获取服务端程序的源代码

重新登录系统后，用刚才建好的普通用户登录并通过git命令从GitHub拉取服务端程序的源代码：

```
$ git clone https://github.com/azerothcore/azerothcore-wotlk.git --branch master --single-branch azerothore
```

主意这个地方提示符的变化，接下来的所有操作都强烈建议大家以这个普通用户来执行。

## 编译并安装服务端程序

代码下载完毕，开始编译服务端程序：

```
$ cd ~/azerothcore
$ mkdir build
$ cd build
$ cmake ../ -DCMAKE_INSTALL_PREFIX=$HOME/azeroth-server/ \
-DCMAKE_C_COMPILER=/usr/bin/clang \
-DCMAKE_CXX_COMPILER=/usr/bin/clang++ \
-DTOOLS=1 \
-DSCRIPTS=1
$ make -j 16
$ sudo make install
```

**主意：**倒数第二条***make***命令中的参数"16"是服务器的逻辑CPU数量，请根据实际情况设定这个值，理论上不能大于服务器真实的逻辑CPU数，可以通过***lscpu***命令的输出结果来确认这个数值，原则上讲，这个数越大，编译的速度就越快。

安装完成后，在用户的home目录里可以看到多出一个名为azerothcore-server的目录，查看目录下的文件结构：

```
$ tree ~/azerothcore-server
.
├── bin
│   ├── authserver
│   ├── mapextractor
│   ├── mmaps_generator
│   ├── vmap4assembler
│   ├── vmap4extractor
│   └── worldserver
└── etc
    ├── authserver.conf.dist
    └── worldserver.conf.dist
```

简单介绍一下服务器目录下两个二级目录的内容：

- **bin：**这个目录包含了6个二进制可执行文件，其中authserver是认证服务，worldserver是世界服务也就是游戏的核心服务，其余4个是接下来导入游戏地图和路径数据要用到的工具；
- **etc：**这个目录下是authserver和worldserver的相关配置文件。

然后需要手动创建一些目录及文件：

```
$ mkdir -p azerothcore-server/data/dbc \
azerothcore-server/data/maps \
azerothcore-server/data/mmaps \
azerothcore-server/data/vmaps \
azerothcore-server/logs \
azerothcore-server/pids

$ touch azerothcore-server/logs/Auth.log \
azerothcore-server/logs/Char.log \
azerothcore-server/logs/Chat.log \
azerothcore-server/logs/DBErrors.log \
azerothcore-server/logs/GM.log \
azerothcore-server/logs/Misc.log \
azerothcore-server/logs/RA.log \
azerothcore-server/logs/Server.log

$ touch azerothcore-server/pids/authserver.pid \
azerothcore-server/pids/worldserver.pid
```

在后续的操作中，将这些目录用于存放游戏地图数据、路径数据、日志文件等内容。

## 配置服务器参数

服务器参数主要就是通过修改etc目录下那4个配置文件来实现，下面展示一下笔者环境下的四个配置文件内容并简单加以说明。

### 认证服务配置

编辑认证服务配置文件

```
$ egrep -v '^#|^$' ~/azeroth-server/etc/authserver.conf
[authserver]
LogsDir = "/home/debian/azeroth-server/logs"
MaxPingTime = 30
RealmServerPort = 3724
BindIP = "0.0.0.0"
PidFile = "/home/debian/azeroth-server/pids/authserver.pid"
LogLevel = 0
LogFile = "Auth.log"
DebugLogMask = 64
SQLDriverLogFile = ""
SQLDriverQueryLogging = 0
LogTimestamp = 0
LogFileLevel = 0
LogColors = ""
EnableLogDB = 0
DBLogLevel = 1
UseProcessors = 0
ProcessPriority = 0
RealmsStateUpdateDelay = 20
WrongPass.MaxCount = 0
WrongPass.BanTime = 600
WrongPass.BanType = 0
WrongPass.Logging = 0
LoginDatabaseInfo = "127.0.0.1;3306;test;123456;acore_auth"
LoginDatabase.WorkerThreads = 1
LoginDatabase.SynchThreads = 1
```

这个配置文件中大多数参数暂时可以不需要去修改，只需根据环境修改一下***LogsDir***，***PidFile***，***LogFile***以及***LoginDatabaseInfo***这几个字段的值，涉及到路径的请使用绝对路径描述，***LoginDatabaseInfo***的值由分号隔开的四个字段组成，他们分别是***数据库服务器IP地址;数据库服务端口;数据库账户账号;数据库账户密码;库名称***。（此处信息笔者进行了脱敏处理:)，大家根据自己的数据库实际情况修改）

创建认证服务启动文件

```
$ egrep -v '^#|^$' ~/azeroth-server/etc/authserver.service
[Unit]
Description=AZeroThCore Auth service
After=network.target mysql.service
[Service]
Type=simple
User=wow
ExecStart=/home/debian/azeroth-server/bin/authserver -c /home/debian/azeroth-server/etc/authserver.conf
Restart=on-abort
[Install]
WantedBy=multi-user.target
```

这个服务启动文件中，暂时只需修改**[Service]**区段下的***User***和***ExecStart***两个字段的值即可，***User***的值请填写刚才创建的操作系统普通用户，***ExecStart***字段的值由空格符分割的三段组成，他们分别是***服务执行程序文件绝对路径 启动参数 服务程序配置文件绝对路径***。

### 世界服务配置

编辑世界服务配置文件

```
$ egrep -v '^#|^$' ~/azeroth-server/etc/worldserver.conf
[worldserver]
RealmID = 1
DataDir = "/home/debian/azeroth-server/data"
LogsDir = "/home/debian/azeroth-server/logs"
LoginDatabaseInfo     = "127.0.0.1;3306;test;123456;acore_auth"
WorldDatabaseInfo     = "127.0.0.1;3306;test;123456;acore_world"
CharacterDatabaseInfo = "127.0.0.1;3306;test;123456;acore_characters"
LoginDatabase.WorkerThreads     = 1
WorldDatabase.WorkerThreads     = 1
CharacterDatabase.WorkerThreads = 1
LoginDatabase.SynchThreads     = 1
WorldDatabase.SynchThreads     = 1
CharacterDatabase.SynchThreads = 2
MaxPingTime = 30
WorldServerPort = 8085
BindIP = "0.0.0.0"
UseProcessors = 0
ProcessPriority = 1
Compression = 1
PlayerLimit = 100
SaveRespawnTimeImmediately = 1
MaxOverspeedPings = 2
GridUnload = 1
CloseIdleConnections = 1
SocketTimeOutTime = 900000
SocketTimeOutTimeActive = 60000
SessionAddDelay = 10000
GridCleanUpDelay = 300000
MapUpdateInterval = 100
ChangeWeatherInterval = 600000
PlayerSaveInterval = 900000
PlayerSave.Stats.MinLevel = 0
PlayerSave.Stats.SaveOnlyOnLogout = 1
vmap.enableLOS    = 1
vmap.enableHeight = 1
vmap.petLOS = 1
vmap.enableIndoorCheck = 1
DetectPosCollision = 1
CheckGameObjectLoS = 1
TargetPosRecalculateRange = 1.5
UpdateUptimeInterval = 1
LogDB.Opt.ClearInterval = 10
LogDB.Opt.ClearTime = 1209600
MaxCoreStuckTime = 0
AddonChannel = 1
MapUpdate.Threads = 1
CleanCharacterDB = 0
PersistentCharacterCleanFlags = 0
PidFile = "/home/debian/azeroth-server/pids/worldserver.pid"
LogLevel = 1
LogFile = "Server.log"
LogTimestamp = 0
LogFileLevel = 0
DebugLogMask = 0
PacketLogFile = ""
DBErrorLogFile = "DBErrors.log"
CharLogFile = "Char.log"
CharLogTimestamp = 0
CharLogDump = 0
CharLogDump.Separate = 0
CharLogDump.SeparateDir = ""
GmLogFile = "GM.log"
GmLogTimestamp = 0
GmLogPerAccount = 0
RaLogFile = "RA.log"
ArenaLogFile = ""
ArenaLog.ExtendedInfo = 0
SQLDeveloperLogFile = ""
SQLDriverLogFile = ""
SQLDriverQueryLogging = 0
LogColors = ""
EnableLogDB = 0
DBLogLevel = 2
LogDB.Char = 0
LogDB.GM = 0
LogDB.RA = 0
LogDB.World = 0
LogDB.Chat = 0
ChatLogFile = "Chat.log"
ChatLogTimestamp = 0
ChatLogs.Channel = 0
ChatLogs.Whisper = 0
ChatLogs.SysChan = 0
ChatLogs.Party = 0
ChatLogs.Raid = 0
ChatLogs.Guild = 0
ChatLogs.Public = 0
ChatLogs.Addon = 0
ChatLogs.BattleGround = 0
GameType = 16
RealmZone = 14
StrictPlayerNames = 0
StrictCharterNames = 0
StrictPetNames = 0
DBC.Locale = 5
DeclinedNames = 0
Expansion = 2
MinPlayerName = 2
MinCharterName = 2
MinPetName = 2
MaxWhoListReturns = 49
CharacterCreating.Disabled = 0
CharacterCreating.Disabled.RaceMask = 0
CharacterCreating.Disabled.ClassMask = 0
CharactersPerAccount = 50
CharactersPerRealm = 10
HeroicCharactersPerRealm = 1
CharacterCreating.MinLevelForHeroicCharacter = 1
SkipCinematics = 0
MaxPlayerLevel = 80
MinDualSpecLevel = 40
StartPlayerLevel = 1
StartHeroicPlayerLevel = 55
StartPlayerMoney = 100000000
MaxHonorPoints = 75000
StartHonorPoints = 75000
MaxArenaPoints = 10000
StartArenaPoints = 10000
RecruitAFriend.MaxLevel = 60
RecruitAFriend.MaxDifference = 4
InstantLogout = 1
DisableWaterBreath = 4
AllFlightPaths = 1
InstantFlightPaths = 1
AlwaysMaxSkillForLevel = 1
ActivateWeather = 1
CastUnstuck = 1
Instance.IgnoreLevel = 0
Instance.IgnoreRaid = 1
Instance.GMSummonPlayer = 0
Instance.ResetTimeHour = 4
Instance.UnloadDelay = 1800000
Quests.EnableQuestTracker = 0
Quests.LowLevelHideDiff = 4
Quests.HighLevelHideDiff = 7
Quests.IgnoreRaid = 1
Quests.IgnoreAutoAccept = 0
Quests.IgnoreAutoComplete = 0
Guild.EventLogRecordsCount = 100
Guild.ResetHour = 6
Guild.BankEventLogRecordsCount = 25
MaxPrimaryTradeSkill = 4
MinPetitionSigns = 0
MaxGroupXPDistance = 74
MaxRecruitAFriendBonusDistance = 100
MailDeliveryDelay = 3600
SkillChance.Prospecting = 0
SkillChance.Milling = 0
OffhandCheckAtSpellUnlearn = 1
ClientCacheVersion = 0
Event.Announce = 0
BeepAtStart = 1
Motd = "Make love no warcraft!"
Server.LoginInfo = 0
Command.LookupMaxResults = 0
AllowTickets = 1
DeletedCharacterTicketTrace = 0
DungeonFinder.OptionsMask = 1
AccountInstancesPerHour = 5
BirthdayTime = 1222964635
IsContinentTransport.Enabled = 1
IsPreloadedContinentTransport.Enabled = 0
Warden.Enabled = 1
Warden.NumMemChecks = 2
Warden.NumOtherChecks = 5
Warden.LogFile = ""
Warden.ClientResponseDelay = 600
Warden.ClientCheckHoldOff = 30
Warden.ClientCheckFailAction = 2
Warden.BanDuration = 259200
AllowTwoSide.Accounts = 1
AllowTwoSide.Interaction.Calendar = 0
AllowTwoSide.Interaction.Chat = 0
AllowTwoSide.Interaction.Channel = 0
AllowTwoSide.Interaction.Group = 0
AllowTwoSide.Interaction.Guild = 0
AllowTwoSide.Interaction.Auction = 0
AllowTwoSide.Interaction.Mail = 0
AllowTwoSide.WhoList = 0
AllowTwoSide.AddFriend = 0
AllowTwoSide.Trade = 0
TalentsInspecting = 1
ThreatRadius = 60
Rate.Creature.Aggro = 1
CreatureFamilyFleeAssistanceRadius = 30
CreatureFamilyAssistanceRadius = 10
CreatureFamilyAssistanceDelay = 1500
CreatureFamilyFleeDelay = 7000
WorldBossLevelDiff = 3
Corpse.Decay.NORMAL    = 60
Corpse.Decay.RARE      = 300
Corpse.Decay.ELITE     = 300
Corpse.Decay.RAREELITE = 300
Corpse.Decay.WORLDBOSS = 3600
Rate.Corpse.Decay.Looted = 0.5
Rate.Creature.Normal.Damage          = 1
Rate.Creature.Elite.Elite.Damage     = 1
Rate.Creature.Elite.RARE.Damage      = 1
Rate.Creature.Elite.RAREELITE.Damage = 1
Rate.Creature.Elite.WORLDBOSS.Damage = 1
Rate.Creature.Normal.SpellDamage          = 1
Rate.Creature.Elite.Elite.SpellDamage     = 1
Rate.Creature.Elite.RARE.SpellDamage      = 1
Rate.Creature.Elite.RAREELITE.SpellDamage = 1
Rate.Creature.Elite.WORLDBOSS.SpellDamage = 1
Rate.Creature.Normal.HP          = 1
Rate.Creature.Elite.Elite.HP     = 1
Rate.Creature.Elite.RARE.HP      = 1
Rate.Creature.Elite.RAREELITE.HP = 1
Rate.Creature.Elite.WORLDBOSS.HP = 1
ListenRange.Say = 40
ListenRange.TextEmote = 40
ListenRange.Yell = 300
ChatFakeMessagePreventing = 0
ChatStrictLinkChecking.Severity = 0
ChatStrictLinkChecking.Kick = 0
ChatFlood.MessageCount = 10
ChatFlood.MessageDelay = 1
ChatFlood.MuteTime = 10
Chat.MuteFirstLogin = 0
Chat.MuteTimeFirstLogin = 120
Channel.RestrictedLfg = 1
Channel.SilentlyGMJoin = 0
ChatLevelReq.Channel = 1
ChatLevelReq.Whisper = 1
ChatLevelReq.Say = 1
AllowPlayerCommands = 1
PreserveCustomChannels = 1
PreserveCustomChannelDuration = 14
GM.LoginState = 2
GM.Visible = 2
GM.Chat = 2
GM.WhisperingTo = 2
GM.InGMList.Level = 3
GM.InWhoList.Level = 3
GM.LogTrade = 1
GM.StartLevel = 1
GM.AllowInvite = 0
GM.AllowFriend = 1
GM.LowerSecurity = 0
GM.TicketSystem.ChanceOfGMSurvey = 50
Visibility.GroupMode = 1
Visibility.Distance.Continents = 90
Visibility.Distance.Instances = 120
Visibility.Distance.BGArenas = 180
Visibility.Notify.Period.OnContinents = 1000
Visibility.Notify.Period.InInstances  = 1000
Visibility.Notify.Period.InBGArenas   = 1000
Rate.Health            = 1
Rate.Mana              = 1
Rate.Rage.Income       = 1
Rate.Rage.Loss         = 1
Rate.RunicPower.Income = 1
Rate.RunicPower.Loss   = 1
Rate.Focus             = 1
Rate.Energy            = 1
Rate.Loyalty           = 1
Rate.Skill.Discovery = 1
Rate.Drop.Item.Poor             = 1
Rate.Drop.Item.Normal           = 1
Rate.Drop.Item.Uncommon         = 1
Rate.Drop.Item.Rare             = 1
Rate.Drop.Item.Epic             = 1
Rate.Drop.Item.Legendary        = 1
Rate.Drop.Item.Artifact         = 1
Rate.Drop.Item.Referenced       = 1
Rate.Drop.Money                 = 1
Rate.Drop.Item.ReferencedAmount = 1
Rate.XP.Kill    = 2
Rate.XP.Quest   = 2
Rate.XP.Explore = 2
Rate.XP.BattlegroundKill = 1
Rate.RepairCost = 1
Rate.Rest.InGame                 = 1
Rate.Rest.Offline.InTavernOrCity = 1
Rate.Rest.Offline.InWilderness   = 1
Rate.Damage.Fall = 1
Rate.Auction.Time    = 1
Rate.Auction.Deposit = 1
Rate.Auction.Cut     = 1
Rate.Honor = 1
Rate.ArenaPoints = 1
Rate.Talent = 1
Rate.Reputation.Gain = 1
Rate.Reputation.LowLevel.Kill = 1
Rate.Reputation.LowLevel.Quest = 1
Rate.Reputation.RecruitAFriendBonus = 0.1
Rate.MoveSpeed = 1
Rate.InstanceResetTime = 1
SkillGain.Crafting  = 1
SkillGain.Defense   = 1
SkillGain.Gathering = 1
SkillGain.Weapon    = 1
SkillChance.Orange = 100
SkillChance.Yellow = 75
SkillChance.Green  = 25
SkillChance.Grey   = 0
SkillChance.MiningSteps   = 0
SkillChance.SkinningSteps = 0
DurabilityLoss.InPvP = 0
DurabilityLoss.OnDeath = 10
DurabilityLossChance.Damage = 0.5
DurabilityLossChance.Absorb = 0.5
DurabilityLossChance.Parry = 0.05
DurabilityLossChance.Block = 0.05
Death.SicknessLevel = 11
Death.CorpseReclaimDelay.PvP = 1
Death.CorpseReclaimDelay.PvE = 0
Death.Bones.World               = 1
Death.Bones.BattlegroundOrArena = 1
Die.Command.Mode = 1
AutoBroadcast.On = 0
AutoBroadcast.Center = 0
AutoBroadcast.Timer = 60000
Battleground.CastDeserter = 1
Battleground.QueueAnnouncer.Enable = 0
Battleground.QueueAnnouncer.PlayerOnly = 0
BattleGround.PrematureFinishTimer = 300000
BattleGround.PremadeGroupWaitForMatch = 1800000
Battleground.GiveXPForKills = 0
Battleground.Random.ResetHour = 6
Battleground.StoreStatistics.Enable = 1
Battleground.TrackDeserters.Enable = 1
Wintergrasp.Enable = 1
Wintergrasp.PlayerMax = 120
Wintergrasp.PlayerMin = 0
Wintergrasp.PlayerMinLvl = 77
Wintergrasp.BattleTimer = 30
Wintergrasp.NoBattleTimer = 150
Wintergrasp.CrashRestartTimer = 10
Arena.MaxRatingDifference = 150
Arena.RatingDiscardTimer = 600000
Arena.AutoDistributePoints = 0
Arena.AutoDistributeInterval = 7
Arena.QueueAnnouncer.Enable = 0
Arena.ArenaSeason.ID = 8
Arena.ArenaSeason.InProgress = 1
Arena.ArenaStartRating = 0
Arena.ArenaStartPersonalRating = 0
Arena.ArenaStartMatchmakerRating = 1500
Arena.ArenaWinRatingModifier1 = 48
Arena.ArenaWinRatingModifier2 = 24
Arena.ArenaLoseRatingModifier = 24
Arena.ArenaMatchmakerRatingModifier = 24
Network.Threads = 1
Network.OutKBuff = -1
Network.OutUBuff = 65536
Network.TcpNodelay = 1
Console.Enable = 0
Ra.Enable = 0
Ra.IP = "127.0.0.1"
Ra.Port = 3443
Ra.MinLevel = 3
SOAP.Enabled = 0
SOAP.IP = "127.0.0.1"
SOAP.Port = 7878
CharDelete.Method = 0
CharDelete.MinLevel = 0
CharDelete.KeepDays = 30
PlayerStart.AllReputation = 0
PlayerStart.AllSpells = 0
PlayerStart.MapsExplored = 1
HonorPointsAfterDuel = 0
AlwaysMaxWeaponSkill = 1
PvPToken.Enable = 0
PvPToken.MapAllowType = 4
PvPToken.ItemID = 29434
PvPToken.ItemCount = 1
NoResetTalentsCost = 0
Guild.AllowMultipleGuildMaster = 0
ShowKickInWorld = 0
ShowBanInWorld = 0
RecordUpdateTimeDiffInterval = 60000
MinRecordUpdateTimeDiff = 100
PlayerStart.String = ""
LevelReq.Trade = 1
LevelReq.Ticket = 1
LevelReq.Auction = 1
LevelReq.Mail = 1
PlayerDump.DisallowPaths = 1
PlayerDump.DisallowOverwrite = 1
DisconnectToleranceInterval = 0
MonsterSight = 50.000000
StrictChannelNames = 0
Instance.SharedNormalHeroicId = 0
Instance.ResetTimeRelativeTimestamp = 1135814400
TeleportTimeoutNear = 25
TeleportTimeoutFar = 45
MaxAllowedMMRDrop = 500
EnableLoginAfterDC = 1
DontCacheRandomMovementPaths = 0
MoveMaps.Enable = 1
Minigob.Manabonk.Enable = 1

Allow.IP.Based.Action.Logging = 0
Calculate.Creature.Zone.Area.Data = 0
Calculate.Gameoject.Zone.Area.Data = 0
LFG.Location.All = 0
```

这个配置文件内容略多。。。。还是捡重点说，必须要修改的配置项有***DataDir***，***LogsDir***，***LoginDatabaseInfo***，***WorldDatabaseInfo***，***CharacterDatabaseInfo***。这些配置项的含义可以参考验证服务器配置文件的说明。此外，其他非必须修改的配置也会对服务器性能、网络安全、游戏初始规则……等带来不同程度的影响，请谨慎修改每一项的具体含义，并强烈建议先在配置文件本身的注释中去阅读和理解。

创建世界服务启动文件

```
$ egrep -v '^#|^$' ~/azeroth-server/etc/worldserver.service
[Unit]
Description=AZeroThcore World service
After=network.target mysql.service
[Service]
Type=simple
User=root
ExecStart=/home/debian/azeroth-server/bin/worldserver -c /home/debian/azeroth-server/etc/worldserver.conf
Restart=on-abort
```

这个文件的处理方式请参考验证服务启动文件的处理方式，核心服务的启动用户**User**选项请使用***root***。

另外，authserver.conf.dist和worldserver.conf.dist这两个文件可以理解为配置文件模版，因为这里面有大量的注释信息用于解释每一个配置项的含义，建议基于这两个配置模版编辑修改并另存一份配置文件作为服务启动时加载使用。

## 准备游戏数据

### 数据库

首先执行一下数据库的安全初始化：

```
$ sudo systemctl start mariadb
$ sudo mysql_secure_installation
```

安全初始化命令第一次执行时数据库的**root**用户时没有密码的，然后会提示创建一个**root**用户的密码，这个root和操作系统的root是两码事，然后接下来会有几个关键安全选项的选择，根据提示操作即可，不再赘述。

然后为游戏数据库创建管理用户：

```
$ sudo mysql -uroot -p123456 -e create user test identified by '123456'
$ sudo mysql -uroot -p123446 -e grant all privileges on *.* to 'test'@'%' identified by '123456'
$ sudo mysql -uroot -p123456 -e flush privileges
```

**"-p"**后面的***"123456"***就是刚才初始化的时候为数据库**root**用户创建的密码，**"identified by"**后面的***"123456"***是创建数据库的**test**用户的同时为该用户创建的密码。

接下来创建游戏数据库，输入以下命令，创建三个空数据库：

```
$ sudo mysql -uroot -p123456 -e create database acore_auth
$ sudo mysql -uroot -p123456 -e create database acore_characters
$ sudo mysql -uroot -p123456 -e create database acore_world
```

数据库命名可以按自己喜好来，但强烈建议按我这个来，因为接下来导入数据的脚本是按这个命名来进行导入的，如果用来自定义的库名称，就还得去修改源码目录下的数据导入脚本，太麻烦了。

最后开始导入数据：

```
$ sudo ~/azerothcore/apps/db_assembler/db_assembler.sh
```

这个脚本会输出一个简单的交互界面，并提供一系列选项，等待用户输入选项序号然后回车继续执行，这里输入**“5”**，回车继续，然后又会弹出提示要求输入数据库用户名，输入刚才创建的用户**test**，回车继续，这时候脚本开始进行数据导入的工作，这里需要稍事等待，当看到再次输出**“DONE”**字样并返回第一步菜单的时候，表示导入工作已经完成，只需输入**“9”**并回车，就退出脚本了。

最后可以在创建完数据库和数据导入完毕的时候，用以下命令分别验证操作的结果：

```
$ sudo mysql -uroot -p123456 -e show tables from acore_auth
$ sudo mysql -uroot -p123456 -e show tables from acore_character
$ sudo mysql -uroot -p123456 -e show tables from acore_world
```

倒入数据之前，三个数据库里都没有表，导入完成后**acore_auth**里有14张表，**acore_character**里有94张表，**acore_world**里有168张表。

至此，游戏数据库就准备妥当了，可以喝个咖啡抽根烟休息一下。:)

### 地图、路径数据

这部分的数据来源是游戏客户端，需要将客户端考到服务器上，目录随意，放在好找的位置即可，然后需要请出刚才编译出来的4个可执行程序（当前这个服务器版本支持的客户端版本是巫妖王之怒资料片v3.3.5，请核对你的客户端版本，否则地图和路径数据导入的时候会出错）：

```
$ ls -l ~/azeroth-server/bin/*map*
-rwxr-xr-x 1 debian debian  439400 Aug  6 15:19 /home/debian/azeroth-server/bin/mapextractor
-rwxr-xr-x 1 debian debian 1714120 Aug  6 15:19 /home/debian/azeroth-server/bin/mmaps_generator
-rwxr-xr-x 1 debian debian 1219832 Aug  6 15:19 /home/debian/azeroth-server/bin/vmap4assembler
-rwxr-xr-x 1 debian debian  122528 Aug  6 15:18 /home/debian/azeroth-server/bin/vmap4extractor
```

就是这4个文件，需要将他们复制到游戏客户端的一级目录下去依次执行。

假设我把游戏客户端考在了/home/wow/WoW目录下：

```
$ cp ~/azerothcore-server/bin/*map* ~/WoW
$ .~/WoW/mapextractor
$ .~/WoW/vmap4extractor
$ .~/WoW/vmap4assembler Buildings vmaps
$ .~/WoW/mmaps_generator
```

这几步耗时会比较长，因为数据量巨大，最终会在服务器目录***~/azerothcore-server/data/***里生成大约3GB的数据。这一步完成之后，刚才考过来的客户端可以删掉了，如果磁盘空间比较紧张的话。:)

## 启动你的魔兽世界吧

经过漫长的安装、配置和等待，终于完成了服务器的配置，最后一步就是启动整个世界：

```
$ sudo systemctl start authserver.service
$ sudo systemctl start worldserver.service
```

执行无误后，可以检查一下服务状态是否正常：

```
$ systemctl status  authserver.service worldserver.service
● authserver.service - AZeroThCore Auth service
   Loaded: loaded (/etc/systemd/system/authserver.service; disabled; vendor preset: enabled)
   Active: active (running) since Sat 2019-08-24 02:08:17 CST; 1 weeks 6 days ago
 Main PID: 5344 (authserver)
    Tasks: 2 (limit: 4915)
   Memory: 5.3M
   CGroup: /system.slice/authserver.service
           └─5344 /home/debian/azeroth-server/bin/authserver -c /home/debian/azeroth-server/etc/authserver.conf

Sep 05 20:14:21 wow authserver[5344]: Updating Realm List...
Sep 05 20:27:59 wow authserver[5344]: Updating Realm List...
Sep 05 20:52:49 wow authserver[5344]: Updating Realm List...
Sep 05 20:54:39 wow authserver[5344]: Updating Realm List...
Sep 05 21:51:31 wow authserver[5344]: Updating Realm List...
Sep 05 21:56:59 wow authserver[5344]: Updating Realm List...
Sep 05 22:16:35 wow authserver[5344]: Updating Realm List...
Sep 05 22:34:21 wow authserver[5344]: Updating Realm List...
Sep 05 22:41:22 wow authserver[5344]: Updating Realm List...
Sep 05 23:12:00 wow authserver[5344]: Updating Realm List...

● worldserver.service - AZeroThcore World service
   Loaded: loaded (/etc/systemd/system/worldserver.service; static; vendor preset: enabled)
   Active: active (running) since Mon 2019-08-26 17:55:47 CST; 1 weeks 3 days ago
 Main PID: 8514 (worldserver)
    Tasks: 9 (limit: 4915)
   Memory: 7.4G
   CGroup: /system.slice/worldserver.service
           └─8514 /home/debian/azeroth-server/bin/worldserver -c /home/debian/azeroth-server/etc/worldserver.conf

Sep 06 03:03:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:04:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:05:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:06:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:07:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:08:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:09:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:10:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:11:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
Sep 06 03:12:19 wow worldserver[8514]: Average update time diff: 10. Players online: 0.
```

如果你看到跟这个差不多的输出内容，恭喜，你的世界已经上线，还等什么呢？赶紧邀上三五个好基友，打开客户端去找寻年轻时像风一样自由的感觉吧！！！

## 特别感谢

- **二区瓦里马萨斯玩家：**漂缈孤鸿影，参与体验测试以及精神上的大力支持（公会头号热心肠奶骑，喜欢到处捡没有公会的散人安利入会，然后各种关爱，现已为人母，她闺女也是我闺女，咩哈哈哈哈哈哈哈～）
- **二区瓦里马萨斯玩家：**xx大龙虾，强力技术支持（是冰镇大龙虾还是麻辣大龙虾忘了，惠普多年的同事，后来大家各奔东西依然保持联系，经常交流技术，技术大拿，真名就不透露了，主号是个暗牧，黑的一批的那种）
- **二区瓦里马萨斯玩家：**碎碎，参与体验测试（江湖人称碎爷，游戏奇才，我转服过来第一次跟她RAID就给跪了，一身破烂的小猎人DPS甩了我几条街，我在原服公会里一号猎手的颜面荡然无存，而且特别会聊天，气死人不偿命那种）
- **二区瓦里马萨斯玩家：**风中的小德，参与体验测试（这个服务器开始就积极参与进来，之前在国服也是经常一起RAID的，狗熊2T）
- **二区瓦里马萨斯玩家：**Sabrina，参与体验测试（碎碎他哥，男版碎碎）
- **二区瓦里马萨斯玩家：**灵儿，参与体验测试（妹子，玩起游戏瘾大且一脸懵逼）
- **二区瓦里马萨斯玩家：**莫莫，参与体验测试（传说中的藏族妹子O_O）
- **一区奥蕾莉亚玩家：**枫儿，参与嘴炮式体验，偶尔上线聊下天（国服公测期间认识的基友，游戏中的妹子现实中的伪娘，在奥服的会长夫人身份至今广为流传，为人风骚，好耍贱）
- **一区奥蕾莉亚玩家：**神的半身，参与测试体验（枫儿的损友）
- **一区奥蕾莉亚玩家：**中央一～十四套等数人，参与体验测试（这里面好几个人。。都是高中的哥们，关系甚好，当时我们自己还组了个公会叫“央视国际”，后来连公会带会里一众会员都被官方和谐了，于是他们都跑路了。。。）
- **一区玩家：**darkfox，参与体验测试（大学同学，一起翘课打游戏那种也是个暴雪的脑残粉，当年星际争霸打遍九栋宿舍楼无敌手，无数大佬慕名来请吃饭学技术）
- **一区玩家：**冬仔，参与体验测试（大学同学，一起翘课打游戏那种，喜好皮卡丘等娘们唧唧的毛绒玩具以及日系卡通）
- **一区玩家：**豪斯医生，参与体验测试（初中同桌，当年的学霸，现在的妇科圣手）


  [1]: http://www.azerothcore.org/
  [2]: https://github.com/azerothcore/
  [3]: http://www.azerothcore.org/wiki/home
  [4]: https://www.debian.org/distrib/
  [5]: https://cdimage.debian.org/debian-cd/current/amd64/bt-dvd/debian-10.0.0-amd64-DVD-1.iso.torrent
  [6]: https://cloud.debian.org/cdimage/openstack/current-10/debian-10-openstack-amd64.qcow2