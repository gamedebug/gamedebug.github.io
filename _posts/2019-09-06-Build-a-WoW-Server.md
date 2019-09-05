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

在开始动手之前，我们需要先简单了解一个叫AzerothCore的开源项目，[点击这里可以进入这个项目的主页][1]，以及[点击这里可以进入该项目在GitHub上的主页][2]。在项目网站的[wiki首页][3]上他们是这么介绍自己项目的：

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

这听起来是不是很酷？把开源精神带到电子游戏的世界里来，只有内心Free的人，才能玩得开心，这简直太棒了。

## 配置需求

笔者的服务器是一台运行在OpenStack云平台上的虚拟机，配置如下：

- vCPU：16
- MEM：32GB
- Disk: 300GB

根据操作系统和游戏服务装好后跑起来的空载资源消耗情况看，4 x vCPU，8GB MEM，150GB Disk也是足够的，实际运行的话根据玩家数量以及对性能的追求可对此配置进行扩展，如：增加vCPU，增大内存，更换速度更快的SSD……建议在实际的运维过程中追加一套监控平台对游戏服务器的资源进行实时监控，监控平台选型在这里也不赘述了，Zabbix，Promithues，甚至是自己编写的一系列Shell脚本……都可以。

## 准备操作系统

既然是开源的项目，操作系统的选型上肯定首选开源操作系统 - Linux。然后狭义上来讲Linux只是一个操作系统内核（Kernel），它并不像大多数用户所认为的操作系统的样子，而广义上讲，所有基于Linux内核衍生出来的操作系统我们都可以统称Linux操作系统，如大家比较常见的桌面级发行版：Ubuntu-desktop, Fedora-desktop, openSUSE……以及企业级发行版：Ubuntu-server, Redhat Enterprise Linux, SUSE Linux Enterprise……等等这些，除了列举的这些之外，Linux的发行版成千上万，开源爱好者也遍及全球各地，开源精神最酷的地方就是，它能让不同文化、不同语言的人们一起合作完成一些软件行业里的伟大的壮举，创造不得了的软件，Make the world a better place.

笔者在操作系统选型上，选择了Debian 10 "Buster"，操作系统细节上就不做赘述了，太复杂了，三言两语的说不完。我们需要到Debian社区去下载带有Debian 10 installer的光盘镜像（ISO）文件，或者如果我们的基础设施并不是运行在本地的物理计算机上，而是运行在一些公有云（如：AWS、DigitalOcean、AliCloud……）或私有云上，我们也可以使用云供应商提供的云镜像或选择下载Debian 10专为云计算环境准备的云镜像系统。相关链接如下：

- [点击这里进入Debian下载首页][4]
- [64位的第一张DVD系统安装盘的下载种子][5]
- [64位运行于OpenStack之上的云镜像（QCOW2）][6]

拿到安装盘或云镜像后我们就可以开始安装、启动我们的服务器了。操作系统的安装在这里也不赘述，Debian installer提供友好的用户界面，根据提示一步步进行操作即可。


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
apt-get install -y git \
cmake \
make \
gcc \
g++ \
clang \
default-libmysqclient-dev \
libssl-dev \
libbz2-dev \
libreadline-dev \
libncurses-dev \
mariadb-server \
mariadb-client \
libace-6.4.5 \
libace-dev \
autoconf \
automakt \
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
# useradd wow
# passwd wow
New password:
Retype new password:
passwd: password updated successfully
# 
```
如果是通过Debian官方的云镜像启动的系统，这一步默认也可以省略，因为云镜像默认就创建了一个名为debian的用户，并给予了sudo的授权。

### 第四步：重启系统并以新建的用户登录

```
# reboot
```

## 获取服务端源代码

重新登录系统后，用刚才建好的普通用户登录并通过git命令从GitHub拉取服务端程序的源代码：

```
$ git clone https://github.com/azerothcore/azerothcore-wotlk.git --branch master --single-branch azerothore
```

主意这个地方提示符的变化，接下来的所有操作都强烈建议大家以这个普通用户来执行。

## 编译并安装服务端

代码下载完毕，开始编译服务端程序：

```
$ cd ~/azerothcore
$ mkdir build
$ mkdir build
$ cd build
$ cmake ../ -DCMAKE_INSTALL_PREFIX=$HOME/azeroth-server/ -DCMAKE_C_COMPILER=/usr/bin/clang -DCMAKE_CXX_COMPILER=/usr/bin/clang++ -DTOOLS=1 -DSCRIPTS=1
$ make -j 16
$ sudo make install
```

**主意：**倒数第二条命令中的16是服务器的逻辑CPU数量，请根据实际情况设定这个值，理论上不能大于服务器真实的逻辑CPU数，可以通过***lscpu***命令的输出结果来确认这个数值，原则上讲，这个数越大，编译的速度就越快。

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

- **bin：**这个目录包含了6个二进制可执行文件，其中authserver是验证服务，worldserver是世界服务也就是游戏的核心服务，其余4个是接下来用于倒入游戏地图数据的工具；
- **etc：**这个目录下是authserver和worldserver的相关配置文件。

在后续的操作中，可能还需要在这个目录下手动创建一些其他的目录，用于存放游戏地图数据，日志文件等内容。

## 配置服务器参数

服务器参数主要就是通过修改etc目录下那4个配置文件来实现，下面展示一下笔者环境下的四个配置文件内容并加以说明。

### 验证服务器配置

编辑验证服务配置文件

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

创建验证服务启动脚本
```
$ egrep -v '^#|^$' ~/azeroth-server/etc/authserver.service
[Unit]
Description=AZeroThCore Auth service
After=network.target mysql.service
[Service]
Type=simple
User=debian
ExecStart=/home/debian/azeroth-server/bin/authserver -c /home/debian/azeroth-server/etc/authserver.conf
Restart=on-abort
[Install]
WantedBy=multi-user.target
```

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

创建世界服务启动脚本

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

## 准备数据库


  [1]: http://www.azerothcore.org/
  [2]: https://github.com/azerothcore/
  [3]: http://www.azerothcore.org/wiki/home
  [4]: https://www.debian.org/distrib/
  [5]: https://cdimage.debian.org/debian-cd/current/amd64/bt-dvd/debian-10.0.0-amd64-DVD-1.iso.torrent
  [6]: https://cloud.debian.org/cdimage/openstack/current-10/debian-10-openstack-amd64.qcow2