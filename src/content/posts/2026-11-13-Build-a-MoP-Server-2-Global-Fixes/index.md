---
title: "建造自己的魔兽世界（熊猫人之谜）（二）：全局修复"
date: 2026-11-13
slug: "Build-a-MoP-Server-2-Global-Fixes"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "熊猫人服务器的全局修复：写审计脚本扫全库任务，按批次修复和禁用，以及实测中发现的影响全服的问题。"
---

这是《建造自己的魔兽世界（熊猫人之谜）》系列的第二篇。

这个系列一共五篇，按大地图分篇，篇内按地图区域分章：

1. [选型与部署](/Build-a-MoP-Server/)：服务器选型、部署、配置和客户端设置，以及修复进度和待办
2. **全局修复**（本篇）：全库任务审计、批量修复，以及影响全服的问题
3. [新手村](/Build-a-MoP-Server-3-Starter-Zones/)：熊猫人、矮人、狼人、德莱尼、侏儒、死亡骑士的新手村任务修复
4. [东部王国](/Build-a-MoP-Server-4-Eastern-Kingdoms/)：东部王国各地图的任务修复
5. [卡利姆多](/Build-a-MoP-Server-5-Kalimdor/)：卡利姆多各地图的任务修复

## 第一章　全库审计与批量修复

一个个任务边做边修，效率太低：小朋友卡住了，我才去查，查完再编译重启。做完矮人新手村后（见[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第二章），我们换了策略：**把前面修过的 bug 归类，每一类写成一个自动检测，扫一遍全库所有任务，提前把问题找出来批量处理。**

### 1.1 种族限制（全服）

这个问题是给两个 GM 角色批量标记任务时顺带发现的。`quest_template.RequiredRaces` 里有 2224 个联盟任务写的是 1101（人类、矮人、暗夜精灵、侏儒、德莱尼），2027 个部落任务写的是 690（兽人、亡灵、牛头人、巨魔、血精灵）。这些都是大灾变之前的老掩码，不包含**狼人、地精和两边的熊猫人**。核心的 `SatisfyQuestRace` 只是简单按位比较，所以这几个种族根本接不了这些任务。

修法是一条规则：只要掩码包含了某个阵营**全部**的老种族，就把这个阵营的新种族补上。按这个规则改了 4349 个任务和 30 条阵营区域光环（`spell_area`，比如达拉然的阵营设定、冰冠堡垒的阵营增益、冬拥湖）。

有两处要单独处理：

- `conditions.ConditionValue1` 是 MEDIUMINT，存不下熊猫人那几位的种族位。唯一受影响的是儿童周任务 558 的接取条件，改成了"阵营 = 联盟"。
- 13 个任务用的是"某阵营减去一个种族"的掩码（77 = 联盟减德莱尼，178 = 部落减血精灵，255 = 前 8 个老种族）。它们是故意排除那个种族的，因为那个种族有自己专用的一版任务。这些也补上了新种族，但原本排除的种族照旧排除，否则那个种族会看到两份重复的任务。

文件：`sql-custom/2026_11_13_07_faction_race_masks.sql`（可以重复执行）。

### 1.2 审计脚本

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

### 1.3 校准：先把误报压下去

第一轮跑出来的数字吓人：1416 个任务的发任务 NPC 不存在，2175 个交不了。抽样一看，误报的来源很清楚：

- **大灾变删掉的旧任务。** 凄凉之地、费伍德、丹莫罗的很多旧任务在库里还有记录，但发任务的 NPC 早就不在了。玩家根本接不到，不是 bug。于是加了"可接性"计算：发任务的 NPC/物体在场，或者起始物品拿得到，或者前置任务能做完，才算玩家能接到。只对能接到的任务报问题，另外单独找"前置能做、后续却接不到"的断链。
- **对立阵营。** 没有种族限制的任务，有不少其实是部落 NPC 发的。按发任务 NPC 的阵营模板（FactionTemplate）判断敌对，过滤掉。
- **物体施放的法术。** 熊猫人新手岛的铃铛、卷轴、火盆，计数法术是玩家点物体时由物体施放的（goober 的 data10、spellcaster 的 data0 等），一开始没算进去。
- **无害的标记法术。** 灭火这类"空效果命中计数 NPC"的法术，没条件也能工作，只是会顺带标记旁边的单位。只把伤害、缩小、变形、以及"放错位置"的情况算作问题。
- **载具。** `Vehicle::Vehicle` 会根据座位自动加上点击标记，218 个"缺点击标记"里绝大多数是载具，真正缺的只有十几个。

- **前置任务。** 后来修暴风城的 29399 Shopping Around 时才发现：发任务的 NPC 在场，不代表能接到。29399 要先做完 29398，而 29398 的发任务人根本没有刷新点。于是"可接性"又加了一条：前置任务（`PrevQuestId`，以及 `NextQuestId` 指向它的任务）也必须能接到，迭代到不再变化为止。能接到的任务从 8899 降到 8597，联盟剩余的阻塞任务从 846 降到 734。

校准的标准是：**玩家实际做完过的任务**（排除两个批量标记的 GM 角色）一定是好的，如果审计把它们标成有问题，就是误报。最后几类核心检测在这个对照上都是零误报。抽查剩下的条目，也都是真问题，比如黑海岸 13518 The Last Wave of Survivors 要救的 4 个幸存者全库都没有刷新点，贫瘠之地 King Reaperclaw 有刷新点但掉落表是空的，任务要的角永远拿不到。

### 1.4 审计结果

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

### 1.5 批次一：机械性修复

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

### 1.6 批次二：禁用交不了的任务

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

### 1.7 批次三：任务物品的"标记法术"没人接

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

### 1.8 批次四：1–19 级的掉落表（模式 A）

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

### 1.9 批次五：1–19 级"目标不存在"，先修矮人路线

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

### 1.10 批次六：1–19 级事件型任务，先修西部荒野

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

### 1.11 批次七：两个护送任务

两个任务的发任务 NPC 都在，但没有脚本、没有路径点，上游 git 历史里也从来没有过对应代码。用 SAI 重建（文件 `sql-custom/2026_11_13_20_escorts_aynasha_legoso.sql`，备份 `backup/escorts_aynasha_legoso_20261113.tsv`）：

| 任务 | 名称 | 修法 |
|---|---|---|
| 5713 | One Shot. One Kill.（黑海岸） | 进攻 Aynasha 的 Blackwood Tracker（11713）和 Marosh the Devious（11714）没有刷新点。改成：接任务后先冲上来 2 个 Tracker，25 秒后再来 2 个，50 秒后 Marosh 出场；Marosh 死后，60 码内接了任务的玩家都算完成。Aynasha 站在坡底（脚下 87，12 码外的地面有 90–105），直接按她的位置加偏移召唤会把敌人埋进山里，所以召唤点是从地图高度里挑的西北侧平地。波数、间隔是我们定的 |
| 9759 | Ending Their World（秘血岛） | Sironas（17678）有刷新、能打，周围的 Sunhawk 守卫和线圈也都在，只是没有东西给完成。改成：接任务后 Legoso 跟着玩家走（10 分钟没完成就回原位）；Sironas 死后，60 码内接了任务的玩家都算完成，Legoso 离开。原版"在线圈上安放炸药"的演出没有重做。11 月 18 日 Lizz 实测：Legoso 一路跟到山顶后不会有任何动作，要自己去打 Sironas，打死后任务完成 |

### 1.12 批次八：侏儒、黑海岸、狼人新手区

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

### 1.13 批次九：1–19 级任务物品的人工清单

[1.8](#18-批次四119-级的掉落表模式-a) 那批里留下的"靠别的方式获得"的物品，按联盟这边逐个接上（文件 `sql-custom/2026_11_13_26_item_sources_1_19.sql`，备份 `backup/item_sources_1_19_20261113.tsv`）。

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
| 13626 | Respect for the Fallen（灰谷） | Feero Ironhand、Delgren the Purifier 的遗体 | 点 Feero → 62837 → 62838（给锤子；战斗中点不了，见[《卡利姆多》2.3](/Build-a-MoP-Server-5-Kalimdor/#23-respect-for-the-fallen塔下的锤子拿不到)）；点 Delgren → 62839 → 库里没有"给书"的法术，用 SAI 直接把祈祷书放进背包 |

都只对接了任务、未完成的人生效。

**13566 Ritual Materials（黑海岸）。** 月夜猎手胡须和蓟熊毛皮只能从"Force ..."法术（62512、64116，把物品直接交给目标）拿到，没人施放。改成：这几种动物被打死时，对凶手施放（凶手要接了任务）。

**还剩的：** 29353 Keepin' the Haggis Flowin' 的 Bag o' Sheep Innards 在库里和客户端缓存里都查不到来源，暂时没修；暗月马戏团的两个任务和 29412 Blown Away（气球物体没有刷新点）只在活动期间出现，先放着。

### 1.14 批次十：20–29 级

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

### 1.15 批次十一：30–39 级（第一部分）

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

### 1.16 批次十二：30–39 级（第二部分）

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

### 1.17 实测反馈：Solanian's Belongings（一次误判）

在游戏里随手抽查了血精灵新手村的 **8330 Solanian's Belongings**：三件物品之一 Solanian's Scrying Orb，地图标记的位置不对。

**我先误判了。** 我只看了数据：水晶球刷在 z 16.67，那里的地形（池底）是 5.1，地图文件里的水面是 11.77，于是认定它悬在水面上方 5 码，把它连同头上的黄色光柱挪到了 12.3。结果到了现场——让服务器 `saveall` 后读出实时位置——角色就站在水晶球旁边、高度 16.2：池塘中间有一块岩石平台，是模型，地形数据里看不到。原来的高度是对的，我反而把水晶球埋进了平台里，只剩光柱。已经恢复原位（`sql-custom/2026_11_13_38_solanian_scrying_orb.sql` 现在就是这次恢复）。

**教训：** 只凭地形和水面数据，判断不了物体脚下有没有东西（建筑、岩石、巨型蘑菇、船都是模型）。我顺手写的高度扫描（`tools/go_height_audit.py`）也因为这个原因误报太多，不可用。以后挪物体之前，要么请玩家报实地位置，要么用服务端的碰撞数据（vmap）。

**地图标记的真正原因：** 这个任务 `quest_poi` 里三件物品的 `objIndex` 是 4、5、6，这是旧版的编号（0–3 是要杀/互动的目标槽，4–9 是物品槽），而熊猫人客户端认的是 `quest_objective.index`（这里是 0、1、2）；服务端原样发出（`QueryHandler.cpp:617`），客户端就对错了标记。全库有 **3289 个任务**是这种情况，换算脚本已经写好，还没执行。

**另一个怪现象：** 东西都拿齐后交不了任务。服务器记录里"日记"那一条进度不见了（背包里有日记）。核心登录时只在内存里按背包重数物品（`AdjustQuestReqItemCount`），不更新任务日志上的计数，也不重新判断任务是否完成，所以一直卡在"未完成"。扔掉日记再捡一次就好了。这条进度是怎么丢的还没查清楚，期间我在玩家在线时重启过两次，暂时先放着。

### 1.18 批次十三：地图标记编号全局换算

接着 [1.17](#117-实测反馈solanians-belongings一次误判) 的发现做了全局换算（`tools/fix_poi_index.py`，`sql-custom/2026_11_13_39_quest_poi_objindex_remap.sql`，原值备份在 `backup/quest_poi_objindex_20261113.tsv`）。

**先空跑，再验证。** 一开始的规则是"旧版第 k 个物品槽 → 新表里第 k 个物品目标"。用实际位置验证（地图标记的区域离哪个目标的真实位置最近：怪的刷新点、掉这个物品的怪、宝箱）时，揪出了问题：**转换后的任务目标是按物品/生物编号从小到大排的，不是旧版的槽位顺序**。比如 101 The Totem of Infliction，说明里是"食尸鬼尖牙、骷髅手指、蜘蛛毒液"，新表却是尖牙（1129）、毒液（1130）、手指（2378）。Solanian 那个任务恰好编号顺序和原顺序一致，所以看不出来。

**最后的判断顺序：**

1. 同类目标只有一个，直接对应（1999 组）；
2. 任务说明（Objectives）里能找到所有同类目标的名字（允许复数和 "Chunks of" 这类变形），按出现的先后对应旧槽位（380 组）——说明的顺序基本就是旧版的槽位顺序；
3. 说明里找不全，才按地理：在所有一一对应方式里，选标记区域到真实目标总距离最小的那种（64 组）。

说明顺序和地理判断在 84% 的槽位上一致；不一致的多在怪物混居的区域（比如丹莫罗到处都有野猪和熊，317 Stocking Jetsteam 用地理就会配反），那种情况下说明顺序更可靠。

**结果：** 3289 个对不上的任务里，2225 个、3993 条标记换算好了；924 个没动：650 个根本没有任务目标（多是废弃的旧任务），其余用的是 10、16 这类含义不明的编号。`reload quest_poi` 热加载，不用重启；客户端可能要重新登录才会重新请求标记。

### 1.19 碰撞数据检查工具

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

## 第二章　实测中发现的全服问题

### 2.1 怪物掉落太多：掉落表全库整理（实测抽检）

熊猫人新手岛打几只小怪就把背包捡满了。掉落倍率配置全是 1，问题在掉落表本身：很多怪的掉落行全部放在"不分组"（groupid 0）里，每一行都**独立**判定。以 Plump Virmen 为例：药水、泉水、苹果、亚麻布、孔雀石各 100%，30 多件灰色武器护甲各 35–58%，概率加起来 1835%，平均每只掉十几件。全库有 1397 张这样的表（不分组的概率加起来超过 150%）。

修法（`tools/fix_loot_overflow.py`，`sql-custom/2026_11_13_41_creature_loot_overflow.sql`）：

- **范围**：只改刷在野外地图、不刷在任何副本里、不是 Boss 的怪用的表，一共 469 张。副本、Boss，以及没有刷新点的表都不动；
- **灰色物品和白色武器护甲**并成一组，每只最多掉一件，总概率 = min(原合计, 100%) × 50%；
- **其他普通物品**（药水、食物、布、矿石、绿色物品）另成一组，每只最多掉一件，单行先封顶 50%，总概率 = min(原合计, 100%) × 40%；
- **蓝色/紫色物品**一般不动。只有一种情况例外：这些物品本身合计就超过 100%，这时并成一组，总概率 10%。永恒岛上的怪就是这样，每件永恒套装部件都是 100%；
- 任务物品、引用表、金币都不动；组内各物品之间的相对比例保持原样。

结果：这 469 张表平均每只怪的期望掉落从 6.6 件降到 0.67 件（不算任务物品和金币），最高的一张约 1.45 件。原数据整表备份在 `backup/creature_loot_overflow_20261113.tsv`。掉落表支持热加载（`reload creature_loot_template`），不用重启。

### 2.2 旅行者的猛犸象：商人被"留在原地"

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

### 2.3 职业训练师谁都能学

德鲁伊找法师训练师居然能学技能。查下来是全服性的：SkyFire 上游提交 `a7ca56e00c`（"Remove some no longer needed gossip code"）删掉了训练师的职业检查（原来的 `Creature::isCanTrainingOf`），`WorldSession::SendTrainerList` 和 `HandleTrainerBuySpellOpcode` 都不再看玩家职业；买技能时检查"等级够不够、学没学过、前置技能有没有"的那一行（`GetTrainerSpellState != TRAINER_SPELL_GREEN`）也被注释掉了。列表里倒是有一层 `IsSpellFitByClassAndRace` 过滤，但它挡不住这些技能，所以 1 级德鲁伊能在法师训练师那里直接买 24 级的传送术、42 级的传送门。数据库里 693 个职业训练师全都这样。

查了全部角色：另一位玩家的一个圣骑士已经买了 17 个德鲁伊技能（猎豹、熊、旅行形态、复生等）和 2 个术士技能，测试角色都没有。

修复（`patches/2026_11_15_06_trainer_class_check.patch`）：设了职业的职业训练师只给本职业打开技能列表，买的时候再查一次；把状态检查恢复，不是"可学"的一律拒绝。专业、骑术这类训练师，以及没设职业的训练师不受影响。那位圣骑士身上的 19 个外职业技能和指向它们的 3 个动作条按钮，经用户决定在角色离线时删掉（`sql-custom/2026_11_15_36_char39_remove_cross_class_spells.sql`，有备份）。编译后经同意重启上线，还没在游戏里试过。

### 2.4 任务物品打不出来：378 条缺失的任务掉落

Against the Wind（13542）要从风元素 Frenzied Cyclone（32985）身上拿 8 副护腕，再到月井用掉。打了一堆风元素一副都没掉。护腕的使用技能 62081 没问题（在月井旁给 32986 的击杀计数），问题在掉落：32985 的 `lootid` 是 0，掉落表里一条记录也没有。TDB 4.4.2 里它有一条 100% 的任务掉落。

顺着查了全库：把 TDB 4.4.2 里所有"任务专属"的生物掉落和这边比，只看现存任务还需要的物品（任务目标里的物品或任务的起始物品），有 384 条缺失，涉及 232 个任务、338 种怪，其中 196 个任务的物品在这边完全没有其他来源，也就是根本做不了。比如 Robbing Hoods、The Heads of the SI:7、Guts and Gore、Seek and Destroy、Freedom for Lydon 这些。

修复（`sql-custom/2026_11_15_39_against_the_wind_bracers_loot.sql`、`2026_11_15_40_restore_missing_quest_drops.sql`）：按 TDB 4.4.2 的几率补回这 378 条掉落（去掉 6 条挂在 GM 路点生物上的），全部设成负几率，也就是只给身上有这个任务的玩家掉；279 种 `lootid` 为 0 的怪设成 `lootid = entry`（它们原本都没有掉落记录，不会多出别的东西）。用控制台的 `reload creature_loot_template` 和逐个 `reload creature_template <entry>` 热加载，没有重启。

护腕能掉了，但站在月井边上用不掉。护腕的技能要的施法焦点是 1594（`SpellCastingRequirements` 4658），只有 194110 "Auberdine Moonwell" 提供；奥伯丁废墟那口月井上的焦点物件 177280 提供的是通用月井焦点 883，不算数。194110 在这边连模板都没有，TDB 4.4.2 也只有模板、没有刷新点。补了模板，放在 177280 同一个位置，沿用它的模型 1407，画面上不多出东西（`sql-custom/2026_11_15_41_auberdine_moonwell_focus.sql`）。物件模板只在启动时加载，经同意重启后生效。

重启后还是用不掉：没有读条，也没有红字。用 gdb 在 `HandleUseItemOpcode` 下断点，发现请求到了，但连物品查找都没走到。服务器日志里每用一次都有一条 `ByteBufferException ... CMSG_USE_ITEM ... Skipped packet`，也就是包解析越界、整个被丢掉。再用 gdb 把包的 44 个字节转出来，用 Python 按解析代码逐位解码，发现 `ReadUseItemRequest` 处理客户端附带的移动信息时有两处错误：

- 移动标志 30 位的读取条件写成了 `if (hasMovement)`，应为 `if (hasMovementFlags)`，不带标志时多读 30 位。
- 移动者 GUID 的字节读进了 `movementTransportGuid`（掩码全为 0），角色 GUID 的字节被漏读。

两处一改，44 个字节刚好读完，法术 62081、施法计数 5 都对上了。同一段里运输工具 GUID 的位读取把第 3 字节写成了第 4 字节，一并改掉（`patches/2026_11_15_07_use_item_movement_parse.patch`）。施法包 `CMSG_CAST_SPELL` 的同类代码是对的。这个 bug 影响所有带着移动信息发出的使用物品请求，不只是这个任务。编译后经同意重启上线。实测 8 副护腕都销毁了，任务完成。

### 2.5 骑着坐骑下线，上线后速度变回步行

骑在坐骑上下线，再上线时人还在坐骑上，但移动速度和步行一样，下来重新召唤才正常。坐骑速度来自单独的速度光环（比如 86461 "Mount Speed Mod"），`Unit::UpdateSpeed` 只在 `IsMounted()`（单位带 `UNIT_FLAG_MOUNT`）时才把它算进跑速和飞行速度。下线时坐骑光环和速度光环都会存进 `character_aura`，上线时按主键也就是法术 ID 从小到大加载：速度光环 86461 先生效，那时还没骑上，速度按步行算；坐骑光环（这里是 163025）随后挂上，`Unit::Mount` 只设置坐骑模型和标志，不重算速度。

修复（`patches/2026_11_16_01_mount_speed_after_login.patch`）：`Unit::Mount` 和 `Unit::Dismount` 结束时各重算一次跑速和飞行速度。正常召唤坐骑时速度值不变，`SetSpeed` 会直接返回。编译后经同意重启上线，等游戏里验证。

### 2.6 Fleetfoot 不掉羽毛：再补 134 条任务掉落

The Bear's Blessing 还要一份 Fleetfoot's Tailfeathers（44886）当材料。鼠标指向陆行鸟 Fleetfoot（32997）时客户端显示它会掉任务物品，打死却什么都没有：它的 `lootid` 是 0，TDB 4.4.2 里也没有它的掉落。客户端之所以显示，是因为 `creature_questitem`（客户端缓存里的"这只怪会掉哪些任务物品"）记着它掉 44886。[2.4](#24-任务物品打不出来378-条缺失的任务掉落) 那次只对比了参考库的掉落表，参考库自己缺的就漏掉了。

这次用参考库的 `creature_questitem` 再对一遍：现存任务需要、表里记着某种怪会掉、而这边那种怪不掉的有 803 条，涉及 174 个任务；其中 74 个"物品-任务"组合（65 个任务）的物品在这边没有任何怪或宝箱能拿到，任务做不了，例如 Oil Change、Hand-me-downs、Rokar's Test、Pro-liberation、The Forest Heart。

这张表只说"会掉"，没有掉率，参考库里也没有。掉率影响难度，由用户决定：只刷 1–2 只的怪（稀有、首领）100%，成群的怪 40%，都只给有任务的玩家掉。修复（`sql-custom/2026_11_16_05_fleetfoot_tailfeathers.sql`、`2026_11_16_06_restore_quest_drops_from_questitem.sql`）共 134 条怪物掉落（同一物品可能由几种怪掉），24 种原来没有掉落表的怪设成 `lootid = entry`。热加载，没有重启。另外 114 条的物品已经能从别处拿到，暂不处理。

### 2.7 打完怪脱不了战斗

很多地方都碰到过：打完怪以后人一直处在战斗状态，不能骑马、不回血，只有小退重登才恢复，和是哪种怪没关系。

这次是在赤脊山碰到的，角色在 Everstill 湖边卡住。服务器是 Release 版，没有调试信息，所以先用同样的编译参数编了一个小程序，打印出 `Unit`、`HostileReference` 等结构里各字段的偏移，再用 gdb 挂上正在运行的 worldserver（断在 `Player::Update`，读完立刻脱离，前后不到一秒），顺着玩家的 `m_HostileRefManager` 把"谁的仇恨列表上还有她"列出来：

- 两只豺狼人（Redridge Mystic 430、Redridge Basher 446）还记着她，各 0.5 点仇恨。它们在 Lakeshire 旁边，离她大约 590 码。
- 两只都在打她的 Bravo 小队随从 Jorgensen（43305，见 [《东部王国》2.3](/Build-a-MoP-Server-4-Eastern-Kingdoms/#23-实测反馈bravo-小队营救链断在第一环)），随从被留在了那里。
- 隔 6 秒再读一次，三个单位的血量和位置一点都没变：那片区域已经不更新了。

原因：大陆地图的可视距离只有 90 码（`Visibility.Distance.Continents`），`Map::Update` 只更新玩家（和少数常驻对象）附近的格子。怪只有在自己被更新的时候才会判断脱战、回家；玩家这边，`Unit::Update` 只在仇恨引用全部清空后才倒计时退出战斗。于是只要一只记着你的怪被甩在一百多码以外（法师冰环、变羊之后跑开，或者随从留在原地打架），它就冻在战斗里，永远不会脱战，你也一直下不了战斗。小退时服务器会删掉玩家身上的所有仇恨引用，所以重登就好了。

修复（`patches/2026_11_17_01_unit_cumulative_incl_far_hostile_ref_drop.patch`，备份 `backup/Unit.cpp.bak-20261117`）：玩家在战斗中时，`Unit::Update` 检查每条仇恨引用，如果来源是非玩家控制的生物，而且离玩家超过可视距离加 100 码（大陆上是 190 码），就删掉这条引用。正常追着你打的怪不会离这么远；被删掉的怪下次被更新时仇恨列表是空的，会自己回家。没有改头文件，下次编译是增量的。和[《新手村》](/Build-a-MoP-Server-3-Starter-Zones/)第一章末尾补记的 Huo 修复一起在 11 月 17 日编译（这次因为编译环境的基础层重建过，是全量重编，约 17 分钟），0 人在线时重启上线，等游戏里验证。

### 2.8 被隐藏的对话选项：全库排查，30–42 级第一批

[《卡利姆多》1.7](/Build-a-MoP-Server-5-Kalimdor/#17-the-seeds-of-life三颗种子只有一颗能拿) 的 Onu、[《卡利姆多》1.9](/Build-a-MoP-Server-5-Kalimdor/#19-in-defense-of-darkshoreorseus-的选项看不见) 的 Orseus、[《东部王国》4.4](/Build-a-MoP-Server-4-Eastern-Kingdoms/#44-see-raptor--be-raptor女祭司的对话选项不显示) 的女祭司、[《东部王国》4.5](/Build-a-MoP-Server-4-Eastern-Kingdoms/#45-backdoor-dealings图腾点了没反应) 的图腾，坏法都一样：对话选项明明在库里，客户端却看不到。原因在 `Player::PrepareGossipMenu`：

- NPC 身上的选项，`OptionType` 是 0（`GOSSIP_OPTION_NONE`）或大于 20 的一律不显示；类型是 1（普通对话）但 `OptionNpcflag` 和 NPC 的 npcflag 没有交集的，也不显示。
- 物体身上只显示类型 1 的选项，而且物体本身得是"任务给予者"或"按钮"类。

库里这类选项大多是从别的版本导进来的，类型和 npcflag 都留成了 0。有些只是一段背景对话，藏了也无所谓；有些是任务流程的一步，比如传送、给物品、给计数，藏了任务就卡住。

**排查（11 月 17 日，只读）。** 写了 `tools/gossip_audit.py` 和 `tools/gossip_audit_group.py`，按上面的规则扫全库，排除挂了 C++ 脚本的 NPC 和物体：

- 一共 572 个被隐藏的选项，分布在 330 个 NPC 或物体上（`audit/gossip_hidden_all_20261117.txt`）。
- 和联盟能接到的任务有关的，有 101 个 NPC 或物体、142 个选项（`audit/gossip_hidden_quest_20261117.txt`）。

按影响分成三类：

1. **任务流程按钮**：约 60 个，会卡任务。
2. **服务入口**：约 30 个，买东西、修理、住店、飞行之类。
3. **剧情闲聊**：约 10 个，不影响任务。

修的顺序按 Mayo 的路线，从 30 级往上。只看联盟能走到的地方，部落 NPC（Krog、Gar'dul、Mankrik）先不动。每个任务按钮都对照了 TDB 4.4.2、客户端的法术表和任务文本，确认原本应该发生什么，再决定是照原样恢复，还是做替代。

**第一批：30–42 级**（`sql-custom/2026_11_18_01_tauren_pirate_gossip.sql`、`2026_11_18_02_hidden_gossip_30_42.sql`，备份 `backup/tauren_pirate_26630_20261118.tsv`、`backup/hidden_gossip_30_42_20261118.tsv`）。

Looks Like a Tauren Pirate to Me（26630）坏得最彻底：

- 这个任务在库里**一个目标都没有**，接下就能交。交任务的奖励是"Seahorn 的头"（59146），正好拿去完成海盗那边的 26629。
- 任务文本说要去拿两样东西：Rikqiz 养的牛 Bossy 身上的牛头，和 Narkk 卖的超大号海盗帽。两人的对话选项都是隐藏的，也没有任何脚本。客户端的法术表里倒是有现成的法术：81311 "Bossy's Sacrifice"（生成牛头）、81313 "Bossy Death"、81315 "Create Hat"，只是没有任何东西去施放它们。
- 修复：给 26630 补上牛头和帽子两个目标，交任务时会收走。Narkk 的拿帽子选项、Bossy 的两层对话（选 *Do the deed.* 就得到牛头，Bossy 倒下，2 分钟后重生），都只在接了任务、包里还没有那样东西时才显示。顺带把 Narkk 被一起藏掉的商店入口也恢复了。Seahorn 交任务前那段"把头弄旧一点，装得像打过一架"的对话，在任务完成后才显示。

其余的都是选项被藏、或者选了没反应，逐项见下表。

这一批改了 `AIName`、`gossip_menu_id` 和任务目标，必须重启才生效。11 月 18 日已重启，启动日志里没有和这些 NPC、菜单、条件相关的报错；游戏里的实际效果还没逐项验证。

<details>
<summary>30–42 级：恢复的 17 个对话选项</summary>

| 等级 | 地点 | NPC | 选项 | 原本应该发生什么 | 现在的做法 |
|---|---|---|---|---|---|
| 31 | 藏宝海湾 | Fleet Master Seahorn（2487） | Here's the head and the hat, Fleet Master. → You're the boss. | 交 26630 之前的一段对话 | 26630 完成后显示，选了关闭对话 |
| 31 | 藏宝海湾 | Narkk（2663） | I need an extra-large pirate hat. Seahorn's orders. | 拿到超大号海盗帽（59148） | 接了 26630、包里没帽子时显示；选了给帽子 |
| 31 | 藏宝海湾 | Narkk（2663） | What've you got? | 商店 | 恢复成商店入口 |
| 31 | 藏宝海湾 | Bossy（43505） | Bossy, I need to ask something great of you… / Moo. → Do the deed. / Chicken out. | 拿到牛头（59147），Bossy 牺牲 | 接了 26630、包里没牛头时显示；*Do the deed.* 给牛头并让 Bossy 倒下（2 分钟后重生），*Chicken out.* 关闭对话 |
| 35 | 藏宝海湾 | War-Mage Erallier（49635） | Yes. Please prepare the portal, Erallier. | 28749 The Battle for Andorhal：传送到安多哈尔 | 接了 28749 时显示；传送到法术 92581 的落点，Thassarian 旁边 |
| 37 | 壁炉谷 | Morris Vant（45148）、Outfitter Mendelev（45149）、High Cleric Alphus（45151） | 打听可疑的顾客、失窃的物资 | 27153 The Good People of Hearthglen 的谈话计数 | 接了 27153 时显示；选了给对应的计数，再显示原有的回答 |
| 37 | 壁炉谷 | Bree Ironstock（45150） | Hello, ma'am. Heard any interesting rumors lately? | 同上 | 她原来**连对话菜单都没有**（只有任务标志），这一项无论如何都完成不了。补上菜单 11938，接了 27153 时显示，选了给计数 |
| 37 | 壁炉谷 | Magus Bisp（45152） | 问他和南边豺狼人的关系 | 27154 Bagging Bisp：他被揭穿后动手。下一个任务 27155 开头就是"你在壁炉谷里杀了一名银色十字军成员" | 接了 27154 时显示；选了他变成敌对并攻击玩家，打倒他算完成；脱战或重生后恢复友好。战斗技能用 TDB 4.4.2 的（奥术冲击、近身时奥术爆炸） |
| 41 | 东瘟疫之地 | Argus Highbeacon（45451） | Are you interested in joining our caravan? | 27381 Traveling Companions：他答应加入 | 接了 27381 时显示；选了给计数 45501 |
| 41 | 东瘟疫之地 | Carlin Redpath（11063） | Are you interested in joining our caravan? | 他婉拒（剧情对话） | 接了 27381 时显示 |
| 41 | 东瘟疫之地 | Carlin Redpath（11063） | Carlin, do you have the extended Annals of Darrowshire? | 27388 Heroes of Darrowshire：拿到 Extended Annals of Darrowshire（13202） | 接了 27388、包里没有时显示；选了给书 |
| 35 | 塞拉摩 | Captain Garran Vimes（4944） | What have you heard of the Shady Rest Inn? | 背景对话 | 改成普通对话 |
| 30–42 | 各地 | Mystic Yayo'jin、Eliza Darkgrin、Morris Vant、Outfitter Mendelev、Fiona、Urk Gagbaz、Brivelthwerp | 购买类选项 | 商店 | 恢复成商店入口（这几个 NPC 都有商人标志和货物） |
| 41 | 东瘟疫之地 | Argus Highbeacon（45451） | Could you repair my gear, Argus? | 修理 | 恢复成修理入口 |

</details>

**这一段先不改的：**

- 荒芜之地（44–47 级）的 Theldurin、The Warden、The Sentinel：已在第二批处理，见 [2.9](#29-被隐藏的对话选项荒芜之地第二批)。
- Narain Soothfancy 的 "I'm ready to pilot our silithid."：24931 Gazer Tag 靠怪物掉落就能完成，这个选项只是另一种玩法。
- Betina Bigglezink 补发两件旧饰品的选项：和现在的任务无关。

### 2.9 被隐藏的对话选项：荒芜之地（第二批）

[2.8](#28-被隐藏的对话选项全库排查3042-级第一批) 留下的荒芜之地两件事，这次一起修了（`sql-custom/2026_11_18_03_badlands_gossip.sql`，备份 `backup/badlands_gossip_20261118.tsv`）。两件事的坏法一样：原本都是一段专门写的小剧情，库里只剩下任务本身和几个计数 NPC，剧情脚本一行都没有，TDB 4.4.2 里也没有。所以这次不是"把选项改成可见"就完，而是要做替代。11 月 18 日已重启生效，还没在游戏里验证。

**守望者之墓（Dustwind Dig 的 Lead Prospector Durdin）。** 把库里的数据拼起来，原来的流程是这样的：

1. Durdin 给 The Warden's Pawn（27796）和 The Sentinel's Pawn（27797）。接任务时自动给棋子（62489 玉色、62490 红色），交任务后棋子留在包里。
2. 两个任务分别在墓里的 Stone Slab（206335）、Marble Slab（206336）上交。石板随后发下一个任务：The Warden's Game（27693）和 The Sentinel's Game（27709）。这是两个解谜小游戏，一个是把八个分身全转成"面朝里"，一个是"让两座红色雕像看见彼此"。游戏用的 NPC（46339、46398）没有刷新点，也没有脚本，**根本做不了**。
3. Ancient Protectors（27793）：把棋子放进 The Warden（46768）和 The Sentinel（46769）的凹槽，雕像会活过来，打倒两座雕像算完成。放棋子的选项是隐藏的。雕像身上挂着 Guardian Freeze Aura（87134），是"石化"状态。
4. The Titans' Trove（27912）："第二个守卫倒下时，房间深处出现一个箱子"。但箱子 Trove of the Watchers（206374）在库里没有刷新点，27912 也没有任何发放者，11 月 13 日的审计把它禁用了。
5. 箱子发 Return to Blam（27794），拿着 Eye of the Watchers 回 Agmond's End 交给 Dr. Hieronymus Blam。

修法：

- **两个解谜改成石板上的一个选项。** 接了游戏任务后，点石板会多出一个选项：Stone Slab 是 *Turn each of the jade pawns until they all face inward.*，Marble Slab 是 *Move the stone statues aside until the two red statues can see each other.*。选了就给游戏的完成计数。选项文字是按任务说明里的谜题写的，原版没有这一步。
- **雕像恢复原来的流程。** 要同时满足三个条件才显示 *Place the pawn in the indentation.*：接了 27793、对应的游戏已经交了、包里有对应的棋子。放进去以后，雕像解除石化、变成敌对并攻击玩家，打倒就给 27793 的计数。脱战或重生后，雕像恢复石化和友好。拿着棋子时，雕像的描述也会换成原版"你看到一个和棋子大小相符的凹槽"那一段。
- **箱子固定刷在中央墓室，** 两座雕像北边 16 码，地面高度参照了旁边甲虫的位置。箱子同时负责发放和收回 27912（前置是 27793），然后照原样发 27794。27912 取消禁用。和原版的区别是：箱子一直都在，不是打完第二座雕像才出现。

部落版的 Ancient Protectors（27887）结构一样，这次没有动。

**The Day that Deathwing Came（死亡之翼毁灭者之疤）。** 三个人各讲一个版本，一个比一个夸张：

| 任务 | NPC | 原本的计数 |
|---|---|---|
| 27713 The Day that Deathwing Came | Theldurin the Lost（2785） | 打 5 个 Dang-Blasted Rock Elemental、一拳打在死亡之翼脸上 |
| 27714 The Real Story | Lucien Tosselwrench（2920） | 变大到够得着云层、搜 5 朵云、找到胆小的死亡之翼 |
| 27715 What Really Happened | Martek the Exiled（4618） | 选一位要救的仰慕者、骑到峡谷尽头、找到死亡之翼、和它拼刀子 |

原版里，玩家要变身成讲故事的人，亲身把故事演一遍。演出用的 NPC 都没有刷新点，没有对白，也没有脚本。Theldurin 的 *Tell me that story again, Theldurin.* 是隐藏的；Lucien 和 Martek 连选项都没有。

替代：接了任务后，三人各有一个"讲讲吧"的选项。Theldurin 用的是原来那句，Lucien 和 Martek 的是新加的。选了就一次给齐这个任务的全部计数，再打开一页故事。三页故事（`npc_text` 9100004–9100006）是我按计数的名字写的英文短文，不是原版台词。

<details>
<summary>荒芜之地：改动的 7 个对话选项</summary>

| 等级 | 地点 | 对象 | 选项 | 原本应该发生什么 | 现在的做法 |
|---|---|---|---|---|---|
| 46 | 守望者之墓 | Stone Slab（206335） | 新加：Turn each of the jade pawns… | 27693 The Warden's Game 解谜 | 接了 27693 时显示，选了给计数 46339 |
| 46 | 守望者之墓 | Marble Slab（206336） | 新加：Move the stone statues aside… | 27709 The Sentinel's Game 解谜 | 接了 27709 时显示，选了给计数 46398 |
| 46 | 守望者之墓 | The Warden（46768） | Place the pawn in the indentation. | 27793：雕像活过来，打倒 | 接了 27793、交了 27693、有玉色棋子时显示；选了雕像变敌对 |
| 46 | 守望者之墓 | The Sentinel（46769） | Place the pawn in the indentation. | 同上 | 接了 27793、交了 27709、有红色棋子时显示；选了雕像变敌对 |
| 47 | 毁灭者之疤 | Theldurin the Lost（2785） | Tell me that story again, Theldurin. | 27713：变身演一遍故事 | 接了 27713 时显示；给全部计数，打开故事页 |
| 47 | 毁灭者之疤 | Lucien Tosselwrench（2920） | 新加：All right, Lucien. How did it really happen? | 27714：同上 | 接了 27714 时显示；给全部计数，打开故事页 |
| 47 | 毁灭者之疤 | Martek the Exiled（4618） | 新加：All right, Martek. Tell me what really happened. | 27715：同上 | 接了 27715 时显示；给全部计数，打开故事页 |

另外：箱子 Trove of the Watchers（206374）新刷在中央墓室（guid 9100122），并成为 27912 的发放者；27912 取消禁用。

</details>

### 2.10 节日任务一年到头都能接

Lizz（德莱尼萨满，7 级）在 Azure Watch 从德莱尼平民（Draenei Commoner，19171）那里接到了两个任务：仲夏火焰节的 11970 The Master of Summer Lore，和复活节（Noblegarden）的 13484 Spring Collectors。两个任务的交付人（Festival Loremaster 16817、Spring Collector 32799）都标在主城里，到了却找不到人，因为他们只在节日期间刷新。而库里这两个节日的日程在 2020 年就结束了，所以不会再出现。

原因：节日任务本来应该放在"节日期间才发放"的表里（`game_event_creature_quest` / `game_event_gameobject_quest`），由节日系统在节日开始时加上、结束时撤掉。我们的库里，`game_event_seasonal_questrelation` 列出的 126 个节日任务，有 147 条 NPC 发放记录和 61 条物体发放记录放在了常驻的 `creature_queststarter` / `gameobject_queststarter` 里，涉及各族平民、火焰节的火焰守护者、万圣节和儿童周的 NPC 等 110 个 NPC。结果就是一年到头都在发。其中 44 条在节日表里本来就有一份，相当于重复了。全局审计（[1.1](#11-种族限制全服)）不统计节日任务，所以当时没查出来。

修复（`sql-custom/2026_11_18_04_holiday_quest_starters.sql`，备份 `backup/holiday_quest_starters_20261118.tsv`）：照 TrinityCore 的做法，把这些发放记录按任务所属的节日挪进节日表，常驻表里删掉；交任务的一方不动。全服只有 Lizz 身上有节日任务，这两个任务让她自己放弃就行。任务关系只在启动时加载，11 月 18 日玩家下线后已重启，启动日志显示节日表里的 NPC 发放记录 430 条、物体发放记录 248 条都已载入。

节日日程过期是另一回事：库里除了暗月马戏团（排到 2037 年），其余 28 个节日的结束时间都是 2020 年，所以现在任何节日都不会开。重新排节日日程以后再慢慢修。

### 2.11 飞行管理员：站错地方，或者干脆不存在

Lizz 要在 Exodar 交任务时发现找不到飞行管理员。Exodar 的 Stephanos（17555）其实在库里，但站在 TBC 时的老位置，也就是飞船外面的地面上（-4057, -11789, 9）。客户端地图上的飞行点（TaxiNodes 94）在飞船里面（-3868, -11641, -138），两者相距 281 码。TDB 4.4.2 里他就站在飞行点旁边。把他挪到 TDB 的位置（`sql-custom/2026_11_18_05_exodar_flight_master.sql`，备份 `backup/exodar_flight_master_20261118.tsv`），位置检查通过。

接着扫了全服：用客户端的 TaxiNodes.dbc，对每个联盟或部落能用的飞行点，看 40 码内有没有带飞行标记（npcflag 8192）的 NPC，再拿 TDB 4.4.2 对照。结论是**一大批飞行管理员在我们的库里根本没有刷新点**：TDB 里有刷新的飞行管理员共 289 个，我们缺 52 个。去掉同一位置不同相位的重复版本，补了 48 个刷新点（`sql-custom/2026_11_18_06_missing_flight_masters.sql`，guid 9100300 起）。位置照搬 TDB，一律设为常驻（相位 0），48 个位置检查全部通过。

<details>
<summary>补上的飞行管理员（48 个刷新点）</summary>

| 区域 | 飞行点 / NPC |
|---|---|
| 灼热峡谷 | Thorium Point：Lanie Reed（联盟）、Grisha（部落）；Iron Summit：Doug Deepdown |
| 凄凉之地 | Nijel's Point：Baritanas Skyriver；Thargad's Camp：Moira Steelwing；Karnum's Glade：Lastrea Greengale；Thunk's Abode：Thunk's Wyvern；Ethel Rethor：Korrah's Hippogryph；部落：Narimar |
| 安戈洛环形山 | Marshal's Stand：Gryfe；Mossy Pile：Flizzy Coilspanner |
| 希利苏斯 | Cenarion Hold：Cloud Skydancer（联盟）、Runk Windtamer（部落） |
| 费伍德 | Talonbranch Glade：Mishellena；Emerald Sanctuary：Gorrim；Whisperwind Grove：Hanah Southsong；Wildheart Point：Chyella Hushglade；Irontree Clearing：Dirzak Pryocrank |
| 菲拉斯 | Feathermoon：Irela Moonfeather；Shadebough：Seyala Nightwisp；Dreamer's Rest：Selor；Tower of Estulan：Aryenda；部落：Shyn、Tono、Mergek |
| 海加尔山 | Nordrassil：Fayran Elthas；Grove of Aessina：Elizil Wintermoth；Shrine of Aviana：Dinorae Swiftfeather；Gates of Sothann：Althera；Sanctuary of Malorne：Ranela Featherglen |
| 暮光高地 | Highbank：Glenn Arbuckle；Victor's Point：Angus Stillmountain、Desmond Chadsworth；Firebeard's Patrol：Farstad Stonegrip；Thundermar：Doran Talonheart；Kirthaven：Shaina Talonheart；Vermillion Redoubt：Aquinastrasz；Dragonmaw / Bloodgulch / Crushblow 等部落点：Gorthul、Bramok Gorewing、San'shigo、Jon-Jon Jellyneck、Tokrog、Harpo Boltknuckle |
| 永歌森林 / 银月城 | Skymaster Brightdawn、Skymaster Skyles |
| 艾萨拉 | Friz Groundspin |
| 银松森林 / 吉尔尼斯（部落） | Bat Handler Maggotbreath、Bat Handler Doomair |

</details>

TDB 里这些 NPC 有一部分挂在任务相位上（暮光高地、海加尔、吉尔尼斯的几处）。我们的库基本不用这些相位，所以统一设成常驻：好处是飞行点永远有人，代价是剧情上可能"提前出现"。

剩下 14 个飞行点附近仍然没有飞行管理员，要逐个看，暂时没动：藏宝海湾（Gyll 离飞行点 264 码，TDB 也一样，可能只是飞行点坐标偏了）、Southshore、Teldrassil 的 Fishing Village、月光林地的 Nighthaven、Skettis 和 Ogri'La（声望才能用的点）、瓦斯琪尔的三处海马点、潘达利亚的 4 个联盟点（Paw'Don Village、Pearlfin Village、白虎寺、Lion's Landing，TDB 4.4.2 里没有潘达利亚，得另找来源）。

两个文件都已写进数据库，11 月 18 日重启生效，等游戏里验证。

**挪完以后，Exodar 反而一条航线都没有了。** Lizz 在 Stephanos 那里打开飞行地图，连 Azure Watch 都飞不了。原因是服务器打开飞行地图时，会先用 `ObjectMgr::GetNearestTaxiNode` 找离 NPC 最近的飞行点，当作"你现在所在的点"。Exodar 飞行点旁边，客户端数据里还留着 4 个废弃的任务飞行点（名字是 "Quest Path ... zzzThe Exodar -> ..."），它们唯一的航线是飞到自己，也没有任何法术用到，所以服务器把它们当成了正常的飞行点。我照 TDB 坐标放下的 Stephanos，离其中一个废弃点 1.1 码，离真正的 Exodar 点 2.5 码。结果飞行地图打开在废弃点上，一条航线都没有，玩家还会"学会"这个废弃点。

查了全服飞行管理员，同样的情况还有两个，都在潘达利亚翡翠林：Dawn's Blossom 的 Keg Runner Lee（离废弃点 3.0 码，离真点 4.0 码）和 Emperor's Omen 的 Supplier Towsa（0.9 码对 4.8 码）。三个都挪了 2–4 码，让真正的飞行点至少近出 1.2 码（`sql-custom/2026_11_18_07_flight_masters_nearest_node.sql`，备份 `backup/flight_masters_nearest_node_20261118.tsv`），位置检查通过。11 月 18 日重启后，Lizz 在 Exodar 确认能正常飞了。

### 2.12 部落去潘达利亚：传送门没有目的地

用户想让部落角色 Nolan（血精灵盗贼，90 级）去潘达利亚，先查了部落去潘达利亚的两条路，结果两条都走不通。

**传送门。** 奥格瑞玛荣誉谷（Valley of Honor）有一扇 "Portal to Honydew Village"（物体 215424），旁边站着 Ji Firepaw 和几个 Huojin 武僧。点门会施放 130698，它再让玩家施放 130696 Portal: Honydew Village。130696 的效果是"传送到数据库里登记的坐标"（`SPELL_EFFECT_TELEPORT_UNITS`，目标类型 `DEST_DB`），但 `spell_target_position` 里没有它的坐标，所以点了没反应。蜜露村回奥格瑞玛的门（物体 210804，法术 123074 → 123073 Portal: Orgrimmar）缺的是同一样东西，也是坏的。

修复（`sql-custom/2026_11_19_01_pandaria_portal_destinations.sql`，原来没有这两条记录，所以不用备份）：给两个法术补上落点，都放在对面那扇门旁边 3–4 码，地形高度查过了，这两处地面上没有建筑模型。

| 法术 | 去向 | 落点 |
| --- | --- | --- |
| 130696 Portal: Honydew Village | 翡翠林蜜露村 | 870, 3004.5, -543.0, 248.4（村里那扇回程门旁边，Horde 法师 Ethan Graveborn 附近） |
| 123073 Portal: Orgrimmar | 奥格瑞玛荣誉谷 | 1, 2018.5, -4702.5, 28.9（去潘达利亚那扇门旁边） |

这张表可以热加载，11 月 19 日在控制台执行 `reload spell_target_position` 就生效了（载入 522 条，比之前多 2 条），没有重启。

**门本身也看不见。** 补完落点后，Nolan 站在荣誉谷还是找不到门。原因是 215424 的模板里缩放（`size`）是 0，门缩成了一个点，看不见也点不到；AIName / ScriptName 也被填成了字符串 "0"，而不是空。改成缩放 1、两个脚本名清空（`sql-custom/2026_11_19_02_honeydew_portal_visible.sql`，原值写在文件注释里）。物体模板不能热加载，等联盟这边修完后一起重启。全库缩放为 0 的物体模板一共 9 个，有刷新点的除了两个本来就该隐形的陷阱，就是这扇门和下面联盟那扇。

**任务路线还是不通，这次没动：**

- 引导任务 29612 The Art of War 没有任何发放者。它只是个引子，不影响后面。
- 31853 All Aboard! 能在格罗姆高找 General Nazgrim（54870）接，但交任务的 Nazgrim（55054）一个人飘在刃拳海湾上空 444 码，**库里根本没有"地狱咆哮之拳号"这艘炮舰**。他的对话菜单 14988 一个选项都没有，而 SmartAI 里"选了选项 → 给 29690 计数并传送到翡翠林"这一步要靠选项触发，所以 29690 Into the Mists 做不完，也到不了潘达利亚。
- 到了翡翠林以后，部落开场的蜜露村战斗（31765 Paint it Red! 到 31770、29694 Regroup!）缺 Rivett Clutchpop（66667）、两个 Nazgrim（66190、66646）和 Sergeant Gorrok（66845），一个刷新点都没有。其中 5 个任务在全局审计（[1.6](#16-批次二禁用交不了的任务)）时已经被禁用。
- 翡翠林全图 232 个由 NPC 发的任务里，有 87 个的发放 NPC 一个刷新点都没有。这里的任务也都没有标阵营。

Nolan 的任务之前已经全部直接写成完成，所以他只需要能过去，修门就够了。任务路线和翡翠林的部落线等有部落角色真正从 85 级开始做时再重建。

**联盟这边坏得更多。** 暴风城的 "Portal to Paw don Village"（物体 215457）在 Tushui 熊猫人那一片，Alliance 法师 Ang the Wise 旁边。它同样缩放为 0，而且 data0 是 1，根本没挂传送法术。去程法术 130702 Portal: Paw'don Village、回程法术 123071 Portal: Stormwind 都缺落点。Paw'Don 村本身是空的：飞行点（TaxiNodes 966）90 码内一个 NPC、一个物体都没有，所以也就没有回暴风城的门。

修复（`sql-custom/2026_11_19_03_pawdon_portals.sql`，旧值备份 `backup/pawdon_portal_before_20261119.tsv`）：

| 改动 | 内容 |
| --- | --- |
| 暴风城的门 215457 | 缩放 0 → 1，data0 1 → 130703 Portal Effect: Paw'don Village（再由它让玩家施放 130702），脚本名清空，做法和奥格瑞玛那扇一样 |
| 130702 去程落点 | 870, -303.5, -1761.5, 61.8（Paw'Don 村飞行点旁边） |
| 123071 回程落点 | 0, -8197.0, 524.0, 117.1（暴风城那扇门旁边） |
| Paw'Don 回程门 | 新刷一扇 210805 Portal to Stormwind，guid 9100400，位置 (-300, -1758, 61.6)，离飞行点 8 码 |

123071 也被武僧职业大厅 Peak of Serenity 里的 "Portal to Stormwind" 用，那扇门之前也是坏的，这次一起好了；那里去奥格瑞玛的门用的是 123073，前面已经补过。所有落点和新门的地面高度都查过，位置检查通过。

11 月 19 日没人在线时重启了世界服，启动日志干净，落点坐标载入 524 条。

**鼠标放上去是个黑方块。** 重启后 Nolan 在荣誉谷看到了门，但鼠标指针移上去变成黑色方块。原因是这两扇门的模板行（WDBVerified 15595，比其他 18414 的行老）字段错位了：鼠标图标（IconName）填的是 "1735" / "1819"，客户端找不到叫这个名字的指针，就画了一个黑方块；施法条文字（castBarCaption）是 "0"，unk1 是 "1"；联盟那扇的 questItem4 里还放着本该在 data0 的法术 130703。前面那个缩放为 0、脚本名为 "0" 也是同一个错位的结果。把这几个字段都清空，和正常的 210804 保持一致（`sql-custom/2026_11_19_04_pandaria_portal_icon.sql`，原值写在文件注释里），11 月 19 日经用户同意再次重启。查过全库，其他模板 unk1 里的数字是 18414 版的正常数据，只有这两行错位。

四扇门都还没上号走一趟验证。

联盟的任务路线和部落一样不通：Sky Admiral Rogers（66292）飘在暴风城上空，对话菜单 14971 一个选项也没有，库里也没有"天火号"炮舰。落地后的 Paw'Don 村整个联盟据点都没有 NPC，翡翠林的联盟线要整片重建。

### 2.13 骑在马上施法要点两次

和巫妖王及更早的版本不一样：坐骑站在地面上（地面坐骑，或者已经落地的飞行坐骑）时，点一个要读条的动作，比如施法、采草、开箱子、用任务物品，第一下只会下马，要再点一次才开始读条。

原因在服务端。`Spell::CheckCast` 发现玩家在坐骑上、法术又没有"可骑乘施放"属性，就直接返回 `SPELL_FAILED_NOT_MOUNTED`。客户端收到这个错误后自己发 `CMSG_CANCEL_MOUNT_AURA` 下马，但原来那次施法请求已经被拒，不会重发。SkyFire 只在点击 NPC 或载具（`HandleSpellClick` 的 `tryAutoDismount`）时替玩家下马，普通施法没有这一步。采集、开锁本质上也是施法，所以表现一样。

修复（`patches/2026_11_20_01_auto_dismount.patch`）：新增 `Spell::CanAutoDismount`，条件是玩家自己发起的、非触发的施法；不在出租车航线上、不在载具里、没在空中飞、也没在下落；法术不能骑乘施放，本身也不是坐骑法术（骑着马点另一个坐骑，还是像原来那样只下马）。满足时 `CheckCast` 不再因为骑乘拒绝，`Spell::prepare` 在其他检查都通过以后、开始读条之前移除坐骑光环。所以如果因为距离、目标不对之类的原因施法失败，人不会被白白拉下马。在空中飞的时候行为不变，不会把人从天上摔下来。

改动前的源码打包在 `backup/SkyFire_548_src_pre_autodismount_20261120.tgz`（另有 `git diff` 存在同名的 `.diff` 文件），旧镜像打了标签 `skyfire548:pre-autodismount-20261120`。效果不对的话，把 compose 的镜像换回这个标签就能回滚，不用重新编译。这次改了 `Spell.h`，加上编译环境的基础层又重建了一遍，是全量重编，约 50 分钟。11 月 20 日 0 人在线时重启上线。

**实测：地面坐骑好了，落地的飞行坐骑还不行。** 我起初以为是飞行坐骑落地后，服务器仍把人当成在天上，于是做了第二版（`patches/2026_11_20_02_auto_dismount_v2_landed_flyer.patch`）：标志显示"在飞"或"在下落"时，再查一次地面高度（`Map::GetHeight`，含建筑模型），离地不超过 1.5 码就照样自动下马。这个判断留着当保险，但没解决问题。

用户注意到两种报错不一样：在空中施法报 "You are mounted"，落地后施法报的却是 "You can't do that while moving"。也就是说，落地时自动下马的判断已经通过，人也已经下马了，卡在后面的"正在移动不能读条"检查。加了一行临时日志，每次被拒时移动标志都只有 `0x800`（`MOVEMENTFLAG_FALLING`），人已经不在坐骑上，高度和地面完全一样。

来源在 `Unit::SetCanFly(false)`：下马时移除飞行能力，它不管人是不是站在地上，都会调用 `SetFall(true)`，在服务端加上"下落"标志，要等客户端发来下一个移动包才清掉。`Spell::prepare` 紧接着检查 `isMoving()`，下落标志算在"移动"里，于是施法被拒；点第二次时客户端的新移动包已经到了，就能读条。地面坐骑没有飞行能力，不会走到这一步。

第三版（`patches/2026_11_20_03_auto_dismount_v3_clear_fall.patch`）：自动下马时，如果下落标志是下马这一步刚加上的，而且人离地面不超过 1.5 码，就 `SetFall(false)` 清掉。实测还是一样的报错。

再加了一组临时日志，记录下马前、下马后、施法被拒和读条被打断这几个时刻。用三种飞行坐骑试，被拒时都是 `mounted 0`，而"下马前"那一行一次都没出现。原来飞行坐骑走的是另一条路：客户端自己先发 `CMSG_CANCEL_MOUNT_AURA` 下马，紧接着再发施法请求，服务器的自动下马代码根本没走到。地面坐骑则是客户端带着坐骑直接发施法请求，所以第一版就管用了。前面那句"判断通过、人也下马了"，下马的其实是客户端。

第四版，也就是最终版：把修复放到 `Unit::SetCanFly(false)` 本身。单位已经在地图里、离地面（`Map::GetHeight`，含建筑模型）不超过 0.5 码时，不再调用 `SetFall(true)`；在空中失去飞行能力时照旧往下掉。第三版那段清标志的代码和所有临时日志都删了。补丁 `patches/2026_11_20_04_auto_dismount_final_spell.patch`（`Spell.cpp`/`Spell.h`）和 `patches/2026_11_20_05_setcanfly_no_fall_on_ground.diff`（`Unit.cpp`，备份 `backup/Unit.cpp.bak-20261120`）。每版都是增量编译，约半分钟。中间各版的镜像打了标签（`skyfire548:autodismount-v1-20261120`、`skyfire548:autodismount-v3-20261120`）。后几次重启时有人在线，都先经过用户同意。11 月 20 日实测确认：地面坐骑、落地的飞行坐骑都是点一下就下马并开始读条。

### 2.14 两个阵营的任务谁都能接：1988 个任务缺种族限制

阿拉希高地的 Stone of Inner Binding（物体 2702）上，Evan 接到了两个 Myzrael's Tale：26346 交给 Refuge Pointe 的 Skuerto，26911 交给 Hammerfall 的 Zaruk，一个联盟版一个部落版。两个任务的 `RequiredRaces` 都是 0，也就是不限种族。TrinityCore 4.4.2 里 26346 只限联盟、26911 只限部落，部落版的后续 26912 The Princess Unleashed 也只限部落。

拿全库对比后，同样的情况有 **1988 个任务**：我们库里写的是 0，参考库里只限一个阵营，或者只限个别种族。它们平时不显眼，因为大部分部落任务由部落 NPC 发，联盟角色本来就靠近不了；但从物体（约 90 个）、物品（19 个）或中立 NPC（约 150 个）接的那部分，联盟角色就会接到部落版，像这块石头一样同时出现两个。

和 [1.1](#11-种族限制全服) 的规则一致：参考库掩码包含某个阵营全部的老种族，就写成我们库里这个阵营的完整掩码（含熊猫人：联盟 18875469、部落 33555378）；只限个别种族的（比如只限牛头人的图腾任务）照抄参考库，去掉高位的新种族位。只改仍然是 0 的行。

| 类型 | 任务数 |
| --- | ---: |
| 只限联盟 | 999 |
| 只限部落 | 884 |
| 只限个别种族 | 105 |

修复：`sql-custom/2026_11_21_07_quest_faction_races_from_tdb.sql`，备份和完整清单在 `backup/quest_requiredraces_0_tdb_faction_20261121.tsv`（修复前全是 0）。`reload quest_template` 会先删掉内存里所有任务对象再重新加载，在线玩家身上可能还留着指向旧对象的指针，所以没有热加载，经用户同意重启了一次。重启后 Evan 交的是联盟版 26346，正在做后续的 26049。

这次修复之后，修复进度统计的范围（联盟能接到的普通任务）从 5596 个降到 5348 个，基数从 1446 降到 1352：原来被算成"联盟能接"的部落任务被排除了。

### 2.15 看不见的 NPC 和用不了的任务物品：全库审计（20–39 级）

灰谷连着三个任务（[《卡利姆多》2.4](/Build-a-MoP-Server-5-Kalimdor/#24-astranaars-burning看不到起火)、[2.5](/Build-a-MoP-Server-5-Kalimdor/#25-a-trip-to-the-moonwell泪滴在月亮井里用不了)、[2.6](/Build-a-MoP-Server-5-Kalimdor/#26-he-who-would-be-forgiven雷恩斯伍德塔里找不到交任务的人)）都是两类问题之一，于是写了个全库扫描（`tools/invis_focus_audit.py`，只读，结果在 `audit/invis_focus_20261122.json`）：

- **任务隐身**：NPC 身上挂着 N 号隐身光环，而玩家在那个地方拿不到 N 号、数值足够的侦测光环。侦测的来源都算上：`spell_area`、任务给的法术、物品、SAI、点击、物体、联动法术，以及它们触发的法术，并按区域定位。按"某个联盟能接的任务，唯一的发布人或交付人看不见"统计，有 151 个任务、48 个 NPC。
- **施法焦点**：任务物品的法术要求附近有某种施法焦点，但没有任何刷出来的物体提供它。联盟能做的有 135 个物品、182 个任务。

**为什么两个库都缺：** 施法焦点是服务器端的隐形物体，抓包抓不到。TDB 4.4.2 里 106 个只有模板没有刷新点，所以每个都得手工找位置。任务隐身的侦测光环也一样，由服务器直接加在玩家身上，参考库里同样没有。

**清单里的误报：**

- 自动接受、自动完成的任务不需要找 NPC。比如 29414，有 8 个普通角色交过。
- 一部分部落任务没有阵营限制，混了进来。这批按发布 NPC 的阵营模板剔除。
- Adam、Eve、Nolan 的任务是 GM 批量交的，不能证明能做。

这一节先修 20–39 级。按规则只补坏掉的环节：焦点放在任务文本和地图标记指的位置（看得见的物体、事件召唤点或计数用的隐形生物），范围用参考库或抓包得到的数值。召唤出来的首领原来都是占位模板（1 级、友好），阵营按参考库填，等级按任务等级填。

<details>
<summary>任务隐身：4 处侦测光环</summary>

| 等级 | 地点 | NPC | 隐身 | 侦测（`spell_area`） | 什么时候看得见 |
|---|---|---|---|---|---|
| 34 | 西瘟疫之地 Writhing Haunt（3197） | Thurman Grant（45165），6 个任务 | 49414，7 号 | 49416 | 接了 27172 The Writhing Haunt 起，一直可见 |
| 39 | 东瘟疫之地 Thondroril River（2619） | Gidwin Goldbraids（45428） | 80852，18 号 | 88957 | 接 27367 起，到交完 27368 Just Encased |
| 39 | 东瘟疫之地 Death's Step（5446） | Tarenar Sunstrike（45429） | 83305，19 号 | 88958 | 接 27370 起，到交完 27381 Traveling Companions |
| 39 | 圣光之愿礼拜堂（2268） | Rimblat Earthshatter（16134） | 80852，18 号 | 88957 | 一直可见（他的任务没有前置，也查不到引过去的任务；那里没有别的 18 号隐身生物） |

文件 `sql-custom/2026_11_22_10_quest_invis_20_39.sql`。18 号侦测本来更像该用 96876 "See Quest Invis 10"，但它的施法要求限定在荆棘谷（区域组 2663），在瘟疫之地会被核心当场移除，所以用了没有区域限制的 88957。

</details>

<details>
<summary>施法焦点：17 个任务</summary>

| 等级 | 地图 | 任务 | 原来缺什么 | 补了什么 |
|---|---|---|---|---|
| 30 | 尘泥沼泽 | 27429 Raze Direhorn Post! | 焦点 1460 | 三个帐篷的计数生物上各放一个 Grimtotem Tent（186310） |
| 30 | 尘泥沼泽 | 27291 Peace at Last | 焦点 1461，事件 15385 | Hyal 家族墓碑上放焦点（186324）；照 TDB 补事件：召唤 Lynn 和 Jimmy Hyal（Lynn 的 SAI 原来就会给计数） |
| 30 | 尘泥沼泽 | 27190 Cleansing Witch Hill | 焦点 1464 | 码头尽头（Zelfrax 的落点，不是半空的起飞点）放 Swamplight Dock（186424） |
| 32 | 南贫瘠之地 | 25044 Diplomacy By Another Means | 焦点 1637，事件 22771 | 挑战场放焦点（201732）；号角召唤 Sabersnout，去掉模板上的"玩家不能攻击"，补上 TDB 的战斗技能 |
| 32 | 南贫瘠之地 | 25082 Working the Bugs Out | 焦点 1642，计数链 | 22 个虫穴标记上各放 Silithid Mound（201943）；沥青打中虫穴放出 3 只 Silithid Swarmer（同一个虫穴 20 秒后才能再用） |
| 33 | 尘泥沼泽 | 27243 Unleash the Raptors | 焦点 1459，事件 15363 | 照 TDB 刷新点放 Blackhoof Village Windmill（186299）；事件补计数（TDB 里另外 9 只迅猛龙的路径点这里没有，没加） |
| 34 | 菲拉斯 | 25654 Dark Heart | 焦点 343 | Hatetalon Stones 上放焦点（144569），召唤 Edana 的事件原来就有 |
| 35 | 尘泥沼泽 | 27411 Challenge to the Black Flight | 焦点 1463 | 奥妮克希亚巢穴门口（召唤 Smolderwing 的位置）放焦点（186336） |
| 37 | 菲拉斯 | 25368 Verinias the Twisted | 焦点 1652，事件 24189，首领模板 | 暗雾废墟放焦点（202873）；召唤 Verinias（阵营 14，37 级，TDB 的两个法术） |
| 38 | 千针石林 | 25524 In the Outhouse | 焦点 1654 | 沉在水下的厕所上放焦点（202995，范围用抓包模板的 11） |
| 41 | 千针石林 | 25798 Defend the Drill | 焦点 1666，整个防守 | 油池放焦点（203233）；钻井架召出后分三波来 Galak Stormer 和 Mauler，第三波后 25 秒判定守住（40 码内的玩家），任务改成由事件完成 |
| 42 | 千针石林 | 25762 The Ancient Brazier | 焦点 1665，事件 24689，Aquarian 模板 | 火盆上放焦点（203223，范围放宽到 5 码）；点燃给火盆计数，并召唤 Aquarian（掉 The Sacred Flame） |
| 42 | 东瘟疫之地 | 27464 Argent Call: The Trial of the Crypt | 焦点 1685，事件 26356，首领模板 | 地穴放焦点（205535）；读卷轴召唤 Lord Raymond George，3 秒后变敌对开打 |
| 43 | 千针石林 | 27329 Invoking the Serpent | 焦点 1683，事件 26323 | Arikara's Circle 放焦点（205424）；召唤 Arikara（阵营 14，TDB 的闪电箭） |
| 39 | 东瘟疫之地 | 27421 Amidst Death, Life | 焦点 1684 | 三个花朵控制点上各放焦点（205434），计数原来就有 |
| 39 | 东瘟疫之地 | 27482 Into the Flames | 焦点 1686，计数 | 祖玛沙金字塔顶的篝火放焦点（205536）和计数生物；法术 85327 的第 0 个效果打中它就计数（第 1 个效果触发的 85335 在这个客户端里不存在） |
| 29 | 石爪山 | 14311 Taking Part | 焦点 1631，计数 | 照 TDB 刷 14 个 Fertile Mound Bunny，各放一个焦点；种子打中给计数，60 秒后才能再用。**但发布人 Botanist Ferrah 没有刷新点，任务目前接不到**，见下 |

文件：`sql-custom/2026_11_22_08_spell_focus_20_39_part1.sql`、`_09_..._part2.sql`、`_11_..._part3.sql`。改过的生物模板备份在 `backup/focus_part2_templates_20261122.tsv`、`backup/focus_part3_templates_20261122.tsv`，其余都是新加的行。所有新刷新点都过了位置检查（`tools/poscheck.py`）。

</details>

**这一档没修的：**

- **石爪山卡塔克里斯姆版的大片区域没有刷怪**：武器架、萨特、燕巢一带，TDB 有约 276 个刷新点，我们只有 3 个；Cenarion Wildlands 315 对 15；雷斧堡垒 73 对 0。To the Hilt!、Early Adoption、Putting Their Heads Together、Taking Part 的发布人都不在。这是整片区域的问题，要单独处理。
- **Ghost-o-plasm Round Up**（凄凉之地）：发布人 Hornizz Brimbuzzle、Magrami Spectre 都没有刷新点，磁铁的陷阱也没挂法术，要整个重新设计。
- **The Battle of Darrowshire**（东瘟疫之地）：多波怪物，还要保护好几个 NPC 的大型战斗，两个库都没有脚本。
- **Unto Dust Thou Shalt Return**：副本里的任务，以后单独看。

全部在 0 人在线时重启生效（Into the Flames 的修正后来热加载），都还没在游戏里验证。

### 2.16 物体名字显示成 unk name：补上 557 个

2026-11-23 有玩家报告：熊猫人新手岛上的卷轴，鼠标移上去名字显示 unknown name，但能点，任务也能计数。查下来，SFDB 的 `gameobject_template` 里有 8989 个物体模板的名字写的是占位用的 `unk name`，客户端就直接把它当名字显示出来。29408 The Lesson of the Burning Scroll 用到的东西都正常：任务物品 The Master's Flame（80212）和要点的 Edict of Temperance（210986）名字都对。报告里说的卷轴应该是 29778 Rewritten Wisdoms 的 Defaced Scroll of Wisdom（209656/209660/209661/209663，新手岛一共刷了 40 个）。玩家已经下线，还没确认。

修复（`sql-custom/2026_11_23_01_go_unk_names.sql`）：只改名字。如果我们库里施法条文字是空的，就一起补上。类型和 data 都没动。
- 547 个按编号对照 TDB 4.4.2 补上名字。其中只有 2 个在游戏里有刷新点（205033 Stove、209276 Staked Skin），其余都没刷新，只有被法术召唤出来时才看得到。
- TDB 里没有的熊猫人时期物体：只看游戏里真刷出来、能交互的（宝箱、按钮、任务物体、传送门、邮箱、椅子之类），一共 25 种。按编号去 Wowhead 查到 10 个名字。剩下 15 个（209575-209577、209685、209924，还有 215802 等 10 把椅子）Wowhead 上也查不到，保持原样。
- 还剩 8432 个 `unk name`，几乎都是门、装饰这类玩家看不到名字或者没刷新的东西，没动。
- 已经缓存过旧名字的客户端，要删掉 Cache 文件夹才能看到新名字。

备份 `backup/go_unk_name_20261123.tsv`（修改前全部 8989 行）。已重启生效（当时没人在线），没有逐个验证。

另外发现：209276 Staked Skin 是 29519 Tan My Hide（暗月岛）的任务目标。我们库里它的类型是 0（门），TDB 里是 10（可点击物体），这个任务可能做不了，以后另查。

<details><summary>逐项清单（557 条）</summary>

| 编号 | 名字 | 来源 |
|---|---|---|
| 4 | Bonfire Damage | TDB442 |
| 129 | Naxx Teleporter trap | TDB442 |
| 3645 | Ripe Watermelon | TDB442 |
| 3692 | Food Crate | TDB442 |
| 3698 | Food Crate | TDB442 |
| 12653 | Ghost Saber Trap | TDB442 |
| 56817 | Campfire | TDB442 |
| 128972 | Shallow Grave TRAP | TDB442 |
| 136924 | Bench | TDB442 |
| 146087 | Bonfire | TDB442 |
| 147075 | Doodad_GeneralChairLoEnd02 | TDB442 |
| 147076 | Doodad_GeneralChairLoEnd04 | TDB442 |
| 147077 | Doodad_GeneralChairLoEnd05 | TDB442 |
| 148500 | Suzi Test Object 1 | TDB442 |
| 175295 | Doodad_MediumBrazierNoOmni68 | TDB442 |
| 175296 | Doodad_MediumBrazierPurple14 | TDB442 |
| 175297 | Doodad_SmallBrazierPurple02 | TDB442 |
| 175299 | Doodad_MediumBrazierPurple02 | TDB442 |
| 175301 | Doodad_MediumBrazierPurple04 | TDB442 |
| 175303 | Doodad_OrcSign_RekkulsPoisons | TDB442 |
| 175304 | Doodad_OrcSign_ShadowswiftBrotherhood | TDB442 |
| 175309 | Mighty Blaze | TDB442 |
| 175339 | Doodad_SmallPortcullis04 | TDB442 |
| 175340 | Doodad_SmallPortcullis03 | TDB442 |
| 175341 | Doodad_SmallPortcullis02 | TDB442 |
| 175590 | Spire Spider Egg Trap | TDB442 |
| 175622 | Rookery Egg Spawner | TDB442 |
| 176094 | Andorhal Tower One | TDB442 |
| 176096 | Andorhal Tower Three | TDB442 |
| 176097 | Andorhal Tower Four | TDB442 |
| 176453 | Meat Rack | TDB442 |
| 176592 | Shellfish Trap | TDB442 |
| 176750 | Kodo Bones | TDB442 |
| 178188 | Molten Core Circle BARON | TDB442 |
| 178547 | Jeztor's Beacon | TDB442 |
| 178549 | Mulverick's Beacon | TDB442 |
| 178644 | Ryson's All Seeing Eye Trap | TDB442 |
| 178664 | Steamsaw | TDB442 |
| 178665 | Steamsaw | TDB442 |
| 179527 | Warpwood Pod - Root | TDB442 |
| 179530 | Warpwood Pod - Spore | TDB442 |
| 179531 | Warpwood Pod - Summon | TDB442 |
| 179675 | Warlock Mount Quest Portal Spell Focus | TDB442 |
| 179688 | Ritual Candle Aura | TDB442 |
| 179971 | Elf Crate 01 | TDB442 |
| 180574 | Wickerman Guardian Ember | TDB442 |
| 180589 | MetalBars01Truesilver | TDB442 |
| 180609 | Doodad_GeneralChairLoEnd02 | TDB442 |
| 180610 | Doodad_GeneralChairLoEnd04 | TDB442 |
| 180611 | Doodad_GeneralChairLoEnd05 | TDB442 |
| 180670 | Bay of Storms Lightning Storm | TDB442 |
| 180671 | Xandivious' Demon Bag | TDB442 |
| 180672 | Demon Summoning Torch | TDB442 |
| 181074 | Arena Spoils | TDB442 |
| 181207 | Runed Demonic Blade | TDB442 |
| 181751 | Remote Mail Terminal | TDB442 |
| 181831 | Sealed Tome | TDB442 |
| 181838 | Sealed Tome | TDB442 |
| 181840 | Sealed Tome | TDB442 |
| 181842 | Sealed Tome | TDB442 |
| 181844 | Sealed Tome | TDB442 |
| 184600 | Felcannon Ammunition (DEPRECATED) | TDB442 |
| 184601 | Felcannon Ammunition (DEPRECATED) | TDB442 |
| 184602 | Felcannon Ammunition (DEPRECATED | TDB442 |
| 184603 | Felcannon Ammunition 4 | TDB442 |
| 184633 | Forge | TDB442 |
| 184654 | Hellfire Fire - Quest - Felcannon Explosion | TDB442 |
| 184981 | Poodad Trap | TDB442 |
| 185001 | Shadow Council Tent 01 | TDB442 |
| 185002 | Shadow Council Tent 02 | TDB442 |
| 185003 | Shadow Council Torch | TDB442 |
| 186421 | Syndicate Documents | TDB442 |
| 186462 | Holiday - Brewfest - Mole Machine | TDB442 |
| 186471 | Holiday - Brewfest - Dark Iron - Mug Trap | TDB442 |
| 187191 | Standing, Exterior, Medium - Xmas | TDB442 |
| 188093 | Temple City Transport Orb | TDB442 |
| 188094 | Naxxanar Transport Orb | TDB442 |
| 188095 | Naxxanar Transport Orb | TDB442 |
| 188097 | Portal to Lower Naxxanar | TDB442 |
| 188098 | Portal to Upper Naxxanar | TDB442 |
| 188099 | Portal to the Temple City | TDB442 |
| 188110 | Glacial Stone | TDB442 |
| 188124 | Ice Chest | TDB442 |
| 188130 | Ice Stone | TDB442 |
| 188134 | Ice Stone | TDB442 |
| 188135 | Ice Stone | TDB442 |
| 188139 | Ice Stone | TDB442 |
| 188146 | Ice Stone | TDB442 |
| 188216 | Armor Stand | TDB442 |
| 188427 | Portal to Upper Naxxanar | TDB442 |
| 188509 | Dark Iron Mole Machine (Minion Summoner Trap) | TDB442 |
| 188597 | Lightwell | TDB442 |
| 188598 | Lightwell | TDB442 |
| 188602 | Honeycone | TDB442 |
| 188603 | Quickpoppy | TDB442 |
| 188714 | Orb of the Nexus | TDB442 |
| 190217 | Forsaken Tent 04 | TDB442 |
| 190485 | Wintergrasp Tower Banner | TDB442 |
| 190486 | Wintergrasp Tower Banner | TDB442 |
| 190631 | The Eye of Acherus | TDB442 |
| 190816 | Drakuru's Platform | TDB442 |
| 190897 | Drakuru's Stairs | TDB442 |
| 191146 | Ensnaring Trap | TDB442 |
| 191319 | [PH] Guild Vault | TDB442 |
| 191367 | Dominion Over Acherus Generator | TDB442 |
| 192055 | Rockfin Grouper School | TDB442 |
| 192076 | The Guardian's Charge | TDB442 |
| 192409 | Alliance Banner | TDB442 |
| 192552 | Horn of Elemental Fury | TDB442 |
| 193417 | Sewer Healing Potion | TDB442 |
| 193418 | Sewer Mana Potion | TDB442 |
| 193419 | Sewer Noggenfogger Elixir | TDB442 |
| 193788 | Cultist's Cauldron | TDB442 |
| 195102 | Ethel Rethor | TDB442 |
| 195103 | Karnum's Glade | TDB442 |
| 195104 | Nijel's Point | TDB442 |
| 195493 | Kaja'mite Deposit Trap A | TDB442 |
| 195499 | Kaja'mite Deposit Trap B | TDB442 |
| 195500 | Kaja'mite Deposit Trap C | TDB442 |
| 200301 | Impaling Spine | TDB442 |
| 201294 | Uther's Draenei Tribute | TDB442 |
| 202109 | Orc Table | TDB442 |
| 202111 | Mighty Blaze | TDB442 |
| 202127 | Embers | TDB442 |
| 202137 | Kaldorei Artifact | TDB442 |
| 202140 | Barricade | TDB442 |
| 202248 | Naga Banner | TDB442 |
| 202276 | Big Blue Bonfire | TDB442 |
| 202401 | Mole Machine | TDB442 |
| 202453 | Big Haunch of Stormsnout Meat | TDB442 |
| 202461 | Captured Tower Banner - Alliance | TDB442 |
| 202463 | Land Mine | TDB442 |
| 202516 | Emerald Portal | TDB442 |
| 202547 | Tablets of the Earth | TDB442 |
| 202548 | Mysterious Crystal | TDB442 |
| 202555 | Tauren Wind Break | TDB442 |
| 202562 | Emergency Fire Valve | TDB442 |
| 202565 | Mysterious Crystal | TDB442 |
| 202566 | Tablets of Fire | TDB442 |
| 202567 | Keg of Ol' Barkerstout | TDB442 |
| 202570 | Mysterious Cheese | TDB442 |
| 202571 | Bael'dun Fortress Schematics | TDB442 |
| 202617 | Orgrimmar Crate | TDB442 |
| 202649 | Elemental Fire for the Soul | TDB442 |
| 202650 | What Does 'The End of All Things' Mean for Me? | TDB442 |
| 202651 | Finding Security and Comfort in a Doomed World | TDB442 |
| 202663 | Beware: Dangerous Cultists | TDB442 |
| 202700 | Beware: Dangerous Cultists | TDB442 |
| 202707 | Cultist Tent | TDB442 |
| 202708 | Cultist Tent 2 | TDB442 |
| 202720 | Cultist Crate | TDB442 |
| 202721 | Cultist Barrel | TDB442 |
| 202722 | Cultist Table | TDB442 |
| 202726 | Cultist Altar | TDB442 |
| 202730 | Cultist Elemental Device | TDB442 |
| 202735 | Elemental Device | TDB442 |
| 202755 | Tablet Quest Smoke | TDB442 |
| 202789 | Elemental Device | TDB442 |
| 202986 | Cultist Banner | TDB442 |
| 202987 | Cultist Banner 2 | TDB442 |
| 203302 | STAND ON ME TO GET OUT | TDB442 |
| 203307 | Wiggleweed | TDB442 |
| 203404 | Nespirah Abscess | TDB442 |
| 203414 | Krom'gar "Elf Killer" | TDB442 |
| 203462 | Council Table | TDB442 |
| 203463 | Council Chair | TDB442 |
| 203632 | Doodad_StratholmeFloatingEmbers38 | TDB442 |
| 203633 | Doodad_StratholmeFloatingEmbers39 | TDB442 |
| 203726 | Doodad_StratholmeFloatingEmbers48 | TDB442 |
| 203727 | Doodad_StratholmeFloatingEmbers44 | TDB442 |
| 203728 | Doodad_StratholmeFloatingEmbers49 | TDB442 |
| 203754 | Sandbag Stack | TDB442 |
| 203761 | Barricade Box | TDB442 |
| 203797 | Gates of Gnomeregan Tent | TDB442 |
| 203798 | Council Table | TDB442 |
| 203861 | Display Base | TDB442 |
| 203923 | Command Tent Light | TDB442 |
| 203971 | Prickly Pear Fruit Trap | TDB442 |
| 203991 | Doodad_StratholmeFloatingEmbers61 | TDB442 |
| 203994 | Doodad_StratholmeFloatingEmbers64 | TDB442 |
| 203995 | Doodad_StratholmeFloatingEmbers66 | TDB442 |
| 204020 | Barricade Box | TDB442 |
| 204023 | Makeshift Cage | TDB442 |
| 204024 | Makeshift Cage | TDB442 |
| 204025 | Makeshift Cage | TDB442 |
| 204026 | Makeshift Cage | TDB442 |
| 204027 | Makeshift Cage | TDB442 |
| 204028 | Makeshift Cage | TDB442 |
| 204029 | Makeshift Cage | TDB442 |
| 204030 | Makeshift Cage | TDB442 |
| 204031 | Makeshift Cage | TDB442 |
| 204032 | Makeshift Cage | TDB442 |
| 204033 | Makeshift Cage | TDB442 |
| 204034 | Makeshift Cage | TDB442 |
| 204035 | Makeshift Cage | TDB442 |
| 204036 | Makeshift Cage | TDB442 |
| 204037 | Makeshift Cage | TDB442 |
| 204038 | Makeshift Cage | TDB442 |
| 204040 | Tauren Wind Break Post | TDB442 |
| 204565 | Pirate Ship (Damsel's Luck) | TDB442 |
| 204566 | Pirate Ship (Riptide) | TDB442 |
| 204567 | Pirate Ship | TDB442 |
| 204568 | Pirate Ship | TDB442 |
| 204569 | Pirate Ship | TDB442 |
| 204570 | Pirate Ship | TDB442 |
| 204571 | Pirate Ship | TDB442 |
| 204572 | Pirate Ship | TDB442 |
| 204585 | Blackwater Rope | TDB442 |
| 204586 | Bloodsail Rope | TDB442 |
| 204587 | Narkk's Handbombs | TDB442 |
| 204927 | Ozumat Tentacle (Down Angle) | TDB442 |
| 204944 | Ozumat Tentacle (Up Angle) | TDB442 |
| 204945 | Explosive Trap | TDB442 |
| 205006 | Anvil | TDB442 |
| 205007 | Anvil | TDB442 |
| 205010 | Forge | TDB442 |
| 205014 | Campfire | TDB442 |
| 205016 | Bonfire | TDB442 |
| 205033 | Stove | TDB442 |
| 205051 | Gyromechanic Gear | TDB442 |
| 205055 | Restabilization Cog | TDB442 |
| 205471 | Cauldron | TDB442 |
| 205473 | Campfire | TDB442 |
| 205474 | Cauldron | TDB442 |
| 205475 | Campfire | TDB442 |
| 205555 | Waterworks Banner | TDB442 |
| 205556 | Mine Banner | TDB442 |
| 205557 | Lighthouse Banner | TDB442 |
| 205577 | Fire | TDB442 |
| 205578 | Fire | TDB442 |
| 205890 | Highvale Report | TDB442 |
| 205891 | Highvale Records | TDB442 |
| 205892 | Highvale Notes | TDB442 |
| 206076 | Wreath scale 0.25 | TDB442 |
| 206077 | Christmas Tree (Small) | TDB442 |
| 206078 | XMasGift02 scale 1.5 | TDB442 |
| 206079 | XMasGift06 scale 1.5 | TDB442 |
| 206080 | XMasGift03 scale 1.5 | TDB442 |
| 206082 | XMasGift05 scale 1.5 | TDB442 |
| 206083 | XMasGift01 scale 1.5 | TDB442 |
| 206084 | XMasGift04 scale 1.5 | TDB442 |
| 206104 | Christmas Tree (Medium) | TDB442 |
| 206106 | Wreath scale 0.5 | TDB442 |
| 206115 | Lights x3 | TDB442 |
| 206205 | Wreath scale 2.5 | TDB442 |
| 206308 | Cultist Candle | TDB442 |
| 206323 | Cultist Ritual Circle | TDB442 |
| 206324 | Cultist Rune | TDB442 |
| 206567 | Cult Initiate Robes | TDB442 |
| 206568 | Cult Initiate Robes | TDB442 |
| 206676 | Horde Banner | TDB442 |
| 206696 | Doodad_OrcBrazierStreetLamp01 | TDB442 |
| 206786 | Windspeaker Pylon | TDB442 |
| 207201 | Hobo Christmas Tree | TDB442 |
| 207202 | XMasGift01 scale 0.5 | TDB442 |
| 207203 | XMasGift02 scale 0.5 | TDB442 |
| 207204 | XMasStocking01 scale 0.5 | TDB442 |
| 207205 | Flames scale 0.05 | TDB442 |
| 207228 | Hanging, Streamer x3 - Brewfest (scale 1.5) | TDB442 |
| 207229 | Hanging, Streamer x3 - Xmas (scale 1.5) | TDB442 |
| 207230 | Hanging, Streamer x3 - MFF (scale 1.5) | TDB442 |
| 207329 | Cauldron | TDB442 |
| 207356 | Big Cauldron of Battle | TDB442 |
| 207358 | Big Cauldron of Battle | TDB442 |
| 207620 | Elemental Fire for the Soul | TDB442 |
| 207621 | What Does 'The End of All Things' Mean for Me? | TDB442 |
| 207622 | Finding Security and Comfort in a Doomed World | TDB442 |
| 207677 | Spare Initiate Robes | TDB442 |
| 207678 | Spare Initiate's Robes | TDB442 |
| 207700 | (TESTING) Placeholder x3 Fishing Node [DND] | TDB442 |
| 207707 | Campfire | TDB442 |
| 207891 | Heart of Wind | TDB442 |
| 207893 | Heart of Wind | TDB442 |
| 207894 | Heart of Wind | TDB442 |
| 208077 | Web Wide | TDB442 |
| 208120 | Candy Bucket | TDB442 |
| 208780 | Lighthouse Banner | TDB442 |
| 208781 | Lighthouse Banner | TDB442 |
| 208861 | 'Young' Ironjaw | TDB442 |
| 208933 | Fandral's Flame | TDB442 |
| 208934 | Fandral's Flame | TDB442 |
| 208949 | Test Object | TDB442 |
| 208980 | Netherstorm Flag | TDB442 |
| 208982 | Mage Tower Banner | TDB442 |
| 208983 | Draenei Ruins Banner | TDB442 |
| 208984 | Blood Elf Banner | TDB442 |
| 208985 | Fel Reaver Banner | TDB442 |
| 209059 | Blood Nettle | TDB442 |
| 209100 | Branch of Nordrassil | TDB442 |
| 209107 | Anvil of Conflagration Portal | TDB442 |
| 209254 | Lava Bridge | TDB442 |
| 209261 | Cache of the Fire Lord | TDB442 |
| 209276 | Staked Skin | TDB442 |
| 209364 | The Dimming Flame | Wowhead |
| 209465 | Greench Stash | TDB442 |
| 209473 | Metzen Cage Segment | TDB442 |
| 209474 | Metzen Cage Post | TDB442 |
| 209497 | Stolen Treats | TDB442 |
| 209506 | Stolen Treats | TDB442 |
| 209626 | Break Gong | Wowhead |
| 209656 | Defaced Scroll of Wisdom | Wowhead |
| 209660 | Defaced Scroll of Wisdom | Wowhead |
| 209661 | Defaced Scroll of Wisdom | Wowhead |
| 209663 | Defaced Scroll of Wisdom | Wowhead |
| 209833 | Silk Patch | TDB442 |
| 209894 | Greater Cache of the Aspects | TDB442 |
| 209896 | Greater Cache of the Aspects | TDB442 |
| 209925 | Brazier | TDB442 |
| 209927 | Convenient Rope | TDB442 |
| 209928 | Unsecured Vent | TDB442 |
| 209967 | Methane Bomb Pile | TDB442 |
| 209974 | Barrel of Slickies | TDB442 |
| 210083 | Horde Banner | TDB442 |
| 210160 | Lesser Cache of the Aspects | TDB442 |
| 210161 | Lesser Cache of the Aspects | TDB442 |
| 210162 | Lesser Cache of the Aspects | TDB442 |
| 210217 | Elementium Fragment | TDB442 |
| 210219 | Elementium Fragment | TDB442 |
| 210389 | Nala's Bucket | TDB442 |
| 210395 | Dezco's Baby | TDB442 |
| 210396 | Leza's Pyre | TDB442 |
| 210401 | Leza's Flowers | TDB442 |
| 210587 | Paw'don Village | TDB442 |
| 210926 | Fresco Panel 1 | TDB442 |
| 211271 | Blanche's Lightning Lager | TDB442 |
| 211272 | Blanche's Lightning Lager Keg Stand | TDB442 |
| 211320 | Mok Mok's Idol | TDB442 |
| 211584 | Ancient Control Console | TDB442 |
| 212038 | Ancient Amber Chunk | TDB442 |
| 212039 | Amplification Crystal | TDB442 |
| 212040 | Amplification Crystal | TDB442 |
| 212041 | Amplification Crystal | TDB442 |
| 212042 | Amplification Crystal | TDB442 |
| 212076 | Mogu Crypt Doors (phased) | TDB442 |
| 212150 | Honeydew Village | TDB442 |
| 212225 | Shan'ze Cage | TDB442 |
| 212248 | Unga Keg | TDB442 |
| 212262 | Slippery Banana | TDB442 |
| 212268 | Banana | TDB442 |
| 212269 | Barrel | TDB442 |
| 212278 | Protected Unga Keg | TDB442 |
| 212508 | Frenzy Fish | TDB442 |
| 212989 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212991 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212992 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212993 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212994 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212995 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212996 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212997 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212998 | Grookin Hill Phased Horde Supplies | TDB442 |
| 212999 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213000 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213001 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213002 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213003 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213005 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213006 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213007 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213008 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213009 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213010 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213025 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213026 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213027 | Grookin Hill Phased Horde Supplies | TDB442 |
| 213253 | Horde Crate | TDB442 |
| 213266 | Amplification Crystal | TDB442 |
| 213313 | Mogu'Shan Palace - Placeholder Doors Large | TDB442 |
| 213326 | Amber Pot | TDB442 |
| 213362 | Ship's Locker | TDB442 |
| 213363 | Wodin's Mantid Shanker | TDB442 |
| 213364 | Ancient Pandaren Mining Pick | TDB442 |
| 214354 | Liu Lang's Final Rest | Wowhead |
| 214429 | Worn Tracks | TDB442 |
| 214430 | Barely-Visible Tracks | TDB442 |
| 214431 | Muddy Tracks | TDB442 |
| 214432 | Mysterious Tracks | TDB442 |
| 214433 | Heavy Tracks | TDB442 |
| 214434 | Puzzling Tracks | TDB442 |
| 214435 | Dusty Tracks | TDB442 |
| 214437 | Flooded Tracks | TDB442 |
| 214500 | Instance Portal (Party + Heroic) | TDB442 |
| 214501 | Instance Portal (Party + Heroic) | TDB442 |
| 214502 | Instance Portal (Party + Heroic) | TDB442 |
| 214503 | Instance Portal (Party + Heroic) | TDB442 |
| 214507 | Instance Portal (Party + Heroic) | TDB442 |
| 214517 | Instance Portal (Party + Heroic) | TDB442 |
| 214523 | Instance Portal (Raid 10/25 No Heroic) | TDB442 |
| 214524 | Instance Portal (Raid 10/25 No Heroic) | TDB442 |
| 214528 | Instance Portal (Raid 10/25 No Heroic) | TDB442 |
| 214536 | Instance Portal (Raid 10/25 No Heroic) | TDB442 |
| 214538 | Instance Portal (Raid 10/25 No Heroic) | TDB442 |
| 214794 | Ancient Mogu Treasure | TDB442 |
| 215833 | Kril'mandar's Emblem | TDB442 |
| 215852 | Portal to Orgrimmar | TDB442 |
| 215873 | Candy Bucket | TDB442 |
| 216083 | Speed | TDB442 |
| 216097 | Armor | TDB442 |
| 216100 | Mailbox | Wowhead |
| 216232 | Wooden Spikes | TDB442 |
| 216233 | Boiling Bubbles | TDB442 |
| 216257 | Bomb Wagon | TDB442 |
| 216272 | Heavily-Chewed Silkweed | TDB442 |
| 216313 | Cackleberry Trap | TDB442 |
| 216368 | Campfire | TDB442 |
| 216369 | Forge | TDB442 |
| 216370 | Anvil | TDB442 |
| 216371 | Bonfire | TDB442 |
| 216372 | Brazier | TDB442 |
| 216373 | Brazier | TDB442 |
| 216374 | Brazier | TDB442 |
| 216375 | Brazier | TDB442 |
| 216376 | Brazier | TDB442 |
| 216377 | Bonfire | TDB442 |
| 216378 | Brazier | TDB442 |
| 216379 | Brazier | TDB442 |
| 216380 | Brazier | TDB442 |
| 216381 | Brazier | TDB442 |
| 216382 | Forge | TDB442 |
| 216383 | Anvil | TDB442 |
| 216384 | Brazier | TDB442 |
| 216385 | Bonfire | TDB442 |
| 216386 | Brazier | TDB442 |
| 216387 | Mailbox | TDB442 |
| 216388 | Brazier | TDB442 |
| 216389 | Brazier | TDB442 |
| 216390 | Brazier | TDB442 |
| 216391 | Bonfire | TDB442 |
| 216393 | Brazier | TDB442 |
| 216410 | Mailbox | TDB442 |
| 216411 | Brazier | TDB442 |
| 216412 | Brazier | TDB442 |
| 216413 | Brazier | TDB442 |
| 216464 | Barrel Ramp | TDB442 |
| 216466 | Campfire | TDB442 |
| 216467 | Anvil | TDB442 |
| 216468 | Forge | TDB442 |
| 216469 | Chair | TDB442 |
| 216470 | Chair | TDB442 |
| 216471 | Chair | TDB442 |
| 216472 | Chair | TDB442 |
| 216473 | Chair | TDB442 |
| 216474 | Chair | TDB442 |
| 216475 | Campfire | TDB442 |
| 216482 | Barrel Ramp | TDB442 |
| 216486 | Flame Cannon | TDB442 |
| 216487 | Keg Stand | TDB442 |
| 216489 | Blast-Brew Keg | TDB442 |
| 216490 | Unfinished Keg | TDB442 |
| 216492 | Portal to Sparkrocket Outpost | TDB442 |
| 216621 | Flame Cannon | TDB442 |
| 216667 | Portal Back | Wowhead |
| 216722 | Glaivethrower | TDB442 |
| 216724 | Barrel of Rockets | TDB442 |
| 216725 | Reaver Bombs | TDB442 |
| 216737 | Elven Table | TDB442 |
| 216738 | Mound of Soil | TDB442 |
| 216759 | Lever-Action Boomsticks | TDB442 |
| 216880 | Horde Flag | TDB442 |
| 218101 | Campfire | TDB442 |
| 218102 | Campfire | TDB442 |
| 218105 | Campfire | TDB442 |
| 218106 | Campfire | TDB442 |
| 218143 | ITK Beastmaster Straw | TDB442 |
| 218144 | ITK Beastmaster Straw | TDB442 |
| 218145 | ITK Beastmaster Straw | TDB442 |
| 218146 | ITK Beastmaster Straw | TDB442 |
| 218147 | ITK Beastmaster Straw | TDB442 |
| 218148 | ITK Beastmaster Straw | TDB442 |
| 218149 | ITK Beastmaster Pot | TDB442 |
| 218150 | ITK Beastmaster Pot | TDB442 |
| 218151 | ITK Beastmaster Pot | TDB442 |
| 218152 | ITK Beastmaster Pot | TDB442 |
| 218153 | ITK Beastmaster Grain | TDB442 |
| 218154 | ITK Beastmaster Grain | TDB442 |
| 218155 | ITK Beastmaster Grain | TDB442 |
| 218156 | ITK Beastmaster Drum | TDB442 |
| 218157 | ITK Beastmaster Drum | TDB442 |
| 218158 | ITK Beastmaster Straw | TDB442 |
| 218159 | ITK Beastmaster Straw | TDB442 |
| 218160 | ITK Beastmaster Straw | TDB442 |
| 218161 | ITK Beastmaster Straw | TDB442 |
| 218162 | ITK Beastmaster Straw | TDB442 |
| 218163 | ITK Beastmaster Straw | TDB442 |
| 218164 | ITK Beastmaster Straw | TDB442 |
| 218165 | ITK Beastmaster Straw | TDB442 |
| 218166 | ITK Beastmaster Straw | TDB442 |
| 218167 | ITK Beastmaster Straw | TDB442 |
| 218168 | ITK Beastmaster Straw | TDB442 |
| 218169 | ITK Beastmaster Straw | TDB442 |
| 218170 | ITK Beastmaster Straw | TDB442 |
| 218171 | ITK Beastmaster Straw | TDB442 |
| 218172 | ITK Beastmaster Straw | TDB442 |
| 218173 | ITK Beastmaster Straw | TDB442 |
| 218174 | ITK Beastmaster Straw | TDB442 |
| 218428 | For Council and King | TDB442 |
| 218437 | The Curse and the Silence | TDB442 |
| 218460 | Sunreaver Portal | TDB442 |
| 218486 | Sunreaver Portal | TDB442 |
| 218513 | Forge | TDB442 |
| 218515 | Anvil | TDB442 |
| 218517 | Brazier | TDB442 |
| 218558 | Sunreaver Ballista | TDB442 |
| 218559 | Sunreaver Ballista | TDB442 |
| 218560 | Sunreaver Ballista | TDB442 |
| 218561 | Sunreaver Ballista | TDB442 |
| 218562 | Sunreaver Ballista | TDB442 |
| 218563 | Sunreaver Ballista | TDB442 |
| 218564 | Sunreaver Ballista | TDB442 |
| 218565 | Sunreaver Ballista | TDB442 |
| 218566 | Sunreaver Ballista | TDB442 |
| 218567 | Sunreaver Ballista | TDB442 |
| 218568 | Sunreaver Ballista | TDB442 |
| 218569 | Sunreaver Ballista | TDB442 |
| 218570 | Sunreaver Ballista | TDB442 |
| 218627 | Ice Tomb | TDB442 |
| 218651 | Large Pool of Sha-Touched Spinefish | TDB442 |
| 218737 | Zandalari Caster Spell Focus Cauldron | TDB442 |
| 218738 | Zandalari Caster Spell Focus Eyeball | TDB442 |
| 218742 | Bonfire | TDB442 |
| 218782 | Coming of Age | TDB442 |
| 218783 | For Council and King | TDB442 |
| 218784 | Shadows of the Loa | TDB442 |
| 218785 | The Dark Prophet Zul | TDB442 |
| 218786 | Lei Shen | TDB442 |
| 218787 | The Sacred Mount | TDB442 |
| 218788 | Unity at a Price | TDB442 |
| 218789 | The Pandaren Problem | TDB442 |
| 218812 | Campfire | TDB442 |
| 218813 | Bonfire | TDB442 |
| 218817 | Portal to Dawnseeker Promontory | TDB442 |
| 218838 | Teleport to the Seabolt | TDB442 |
| 218840 | Teleport to the Crimson Treader | TDB442 |
| 219135 | Brazier | TDB442 |
| 219136 | Brazier | TDB442 |
| 219137 | Brazier | TDB442 |
| 219153 | Doodad_OrcPVPBonfireLarge19 | TDB442 |
| 219154 | Doodad_OrcPVPBonfireLarge20 | TDB442 |
| 219172 | Rekkul's Poisons | TDB442 |
| 219174 | Shadowswift Brotherhood | TDB442 |
| 220170 | Slightly Smelly Pile of Money | TDB442 |
| 220348 | Amber | TDB442 |
| 221027 | Conspicuously Empty Shell | TDB442 |
| 221529 | Kor'kron Cannon | TDB442 |
| 221530 | Cannonball Stack | TDB442 |
| 221613 | 5.4 - Cooking - Noodle Cart - S1 - Q3 - Boss Fight Doors | TDB442 |
| 222768 | Zarhym's Body | TDB442 |
| 223081 | Wrathion's Hoard | Wowhead |
| 223212 | Portal to Vale of Eternal Blossoms | TDB442 |
| 223230 | Gold Coins | TDB442 |
| 223283 | Campfire | TDB442 |
| 223284 | Campfire | TDB442 |
| 223285 | Campfire | TDB442 |
| 223286 | Campfire | TDB442 |
| 223288 | Noodles | TDB442 |
| 223464 | Sunstrider Ship (Garrosh Raid) | TDB442 |
| 223534 | Alliance Ramp | TDB442 |

</details>

### 2.17 看不见的 NPC 和用不了的任务物品：全库审计（40–49 级）

2026-11-26，接着 [2.15](#215-看不见的-npc-和用不了的任务物品全库审计2039-级) 的 20–39 级批次往下做。先用当前数据库重跑了审计（`tools/invis_focus_audit_run.py` → `audit/invis_focus_20261126.json`），再用 `tools/band2.py 40 49` 只挑出联盟能接、没被禁用的任务。判定规则和 2.15 一样：任务相关的 NPC 身上有任务隐身光环，但服务器里没有任何地方会给玩家对应的侦测光环（TDB 4.4.2 也一样缺，说明正式服的侦测是服务器端按区域给的，抓包没抓到）。

<details>
<summary>已修：5 处（4 个看不见的 NPC 和 1 个点了没反应的控制器）</summary>

| 任务 | NPC / 物体 | 问题 | 修法 |
|---|---|---|---|
| 27446 Tanaris is Calling、28507 Hero's Call: Tanaris!、25048–25050、25121 | Kelsey Steelspark 38535（加基森） | 带 Generic Quest Invisibility 1（49414），没人看得见 | 去掉光环（只有一个刷新点；部落那边的 Megs 没动） |
| 25021、25025、25026、25032 | Mazoga 38927（Sandsorrow Watch，塔纳利斯） | 同上 | 去掉光环 |
| 27764 A Strange Request 起整条 Rhea 任务线 | Rhea 46654（荒芜之地 Lethlor Ravine） | Generic Quest Invisibility 10（80852） | 去掉光环 |
| 27827 The Swift, the Fierce, and the Stout 及三矮人各自的任务 | Eric 46852、Baelog 46853、Olaf 46854（Dragon's Mouth） | Generic Quest Invisibility 2（49415） | 接了 27827 后在 Dragon's Mouth（区域 5564）给侦测 49417，之后一直有效 |
| 28140 The Elder Crone | Magatha's Bonds Controller 206767、被锁的 Magatha 47718（千针石林 The Bulwark） | 控制器点了施放 88865，这个法术在 5.4.8 客户端里不存在，所以不给计数；被锁的 Magatha 也一直隐身 | 控制器加 SAI：点了直接给计数 47718，并在原地召出获救的 Magatha 47736（60 秒）；任务进行中在区域 5590 给侦测 49416，完成后她自然消失 |

文件：`sql-custom/2026_11_26_01_audit_40_49_invis.sql`、`2026_11_26_02_the_elder_crone.sql`；备份 `backup/audit_40_49_invis_20261126.tsv`（另外两处改动前本来没有数据）。

</details>

**没修，原因：**

- 三矮人后面的 27828 / 27834 / 27835 要整条重写，见下面。
- 费伍德森林（Felwood）：28044、28119、28229 缺施法焦点，但更大的问题是整个大地图变迁版的费伍德森林几乎没刷怪（我们约 320 个刷新点，TDB 约 2430 个），38 个任务给予者没有刷新。和石爪山（见 [2.15](#215-看不见的-npc-和用不了的任务物品全库审计2039-级)）是同一类问题，要单独处理。
- 992、1948、7029/7041：没有任务给予者，接不到。27390 达罗郡之战：照旧跳过。
- 部落的 Megs Dreadshredder 38534：只有部落能接，没动。

**三矮人任务（失落的维京人）：整条重写**

27828 Eric, the Utility Dwarf / 27834 Baelog, the Glass Cannon / 27835 Olaf, the Big Fella'：任务要"用一遍"三兄弟的技能，交给跟着你的那三个矮人（46855–46857）。SFDB 和 TDB 里什么都没有：没人召唤他们，没有技能按钮，也没有给计数的地方。从客户端法术数据看，正式服是 Eric 当可控随从（有宠物技能栏），Baelog 和 Olaf 当跟班。

- 交 27827 给营地里的 Eric（或接三个任务里任意一个）时，三兄弟一起召出来（87262/87263/87264）。猎人或术士的宠物会先收起来，因为 Eric 要占宠物栏。
- 宠物栏只有 4 格：Eric 冲锋、Eric 的口袋药水、Baelog 的瓦尔哈拉射击（Baelog 射你选中的目标）、Olaf 的强力怒吼（嘲讽）。Baelog 的战吼在每场战斗开始时自动放，Olaf 的盾墙在他掉到八成血以下时自动放（30 秒一次）。每个技能用到一次就给对应的计数（46862–46867）。
- 下线、死亡或传送走以后矮人不见了：找营地里任意一个兄弟对话，选 "Come on, boys…" 就能叫回来（三个任务都交完后这个选项就不出现了）。
- 核心改动：SummonProperties 3039（Eric）按 TrinityCore 的做法当成可控随从。只对这一个属性生效，其他 25 个同类召唤不受影响。

文件：`sql-custom/2026_11_26_03_lost_vikings.sql`；C++ 在 `spell_quest.cpp`（npc_lost_vikings_camp、npc_lost_viking_brother、spell_lost_vikings_eric_ability、spell_lost_vikings_command）和 `TemporarySummon.cpp`；备份 `backup/lost_vikings_20261126.tsv`、`backup/spell_quest.cpp.bak-20261126`、`backup/TemporarySummon.cpp.bak-20261126`。

全部在 0 人在线时重启生效（三矮人的 C++ 和 11 月 22 日攒下的 Avrus 光环刷新改动一起编译），按批量修复的做法没有逐个上号验证。

### 2.18 看不见的 NPC 和用不了的任务物品：全库审计（50–59 级）

2026-11-26，接着 [2.17](#217-看不见的-npc-和用不了的任务物品全库审计4049-级) 往下做。这一档审计列出来的施法焦点问题，几乎都出在发布人根本没有刷新点的任务上（安戈洛、费伍德森林），光补焦点没用，见 [2.19](#219-整片区域没刷怪按-tdb-补刷新点先补菲拉斯)。真正能修的是三处：

| 任务 | NPC | 问题 | 修法 |
|---|---|---|---|
| 燃烧平原 Morgan's Vigil 整个任务点（28311–28326） | John J. Keeshan（48306）、Colonel Troteman（48307） | 带 Generic Quest Invisibility 3（60921，9 号）/ 7（85096，15 号），哪里都拿不到侦测 | 去掉光环（各只有一个刷新点） |
| 28314 Blood Tour、28315 Draconic Vanguard、28316 A Deal With a Dragon | 跟着你走的 Keeshan（48346） | 这三个任务要 Keeshan 陪着你巡游，交任务也交给跟着你的这个他。但没有任何东西会召唤他（客户端里有 89869 "Summon Personal Guardian (Keeshan 03)"） | C++：接三个任务里任意一个就召唤他，他会跟着你一起打；下线或死亡后丢了，回 Morgan's Vigil 找 Keeshan 对话就能叫回来 |
| 悲伤沼泽 Harborage 整条任务线（27875–27919） | Anchorite Avuun（17127） | Generic Quest Invisibility 1（49414） | 去掉光环 |

文件：`sql-custom/2026_11_26_04_audit_50_59.sql`；C++ 在 `spell_quest.cpp`（npc_keeshan_morgans_vigil，跟随的 Keeshan 用三矮人那套跟随 AI）；备份 `backup/audit_50_59_20261126.tsv`。0 人在线时重启生效，没有逐个验证。

**没修的：** 28320 Assault on Dreadmaul Rock 是载具任务（杀 200 个黑石入侵者，丢了载具可以用 Horn of the Callers 再叫一个），载具在两个库里都找不到，而它又是燃烧平原后面任务的前置。先放着，等快练到 50 级再说。

### 2.19 整片区域没刷怪：按 TDB 补刷新点，先补菲拉斯

做 50–59 级审计时发现，好多任务的发布人根本没有刷新点。于是查了全库：联盟（或两个阵营都能接）的任务里，有 **344 个发布人在我们库里没有刷新点，而 TDB 4.4.2 里有**，一共涉及 791 个任务。按地区数，最多的是暮光高地（87 个发布人）、海加尔山（43）、费伍德森林（31）、凄凉之地（26）、菲拉斯（24）、安戈洛环形山（18）、灼热峡谷（13），另外还有一些副本。石爪山（[2.15](#215-看不见的-npc-和用不了的任务物品全库审计2039-级)）也是同一类问题。看样子这些大地图变迁时改版的地区，SFDB 压根没有刷怪。

菲拉斯最严重：整个区我们只有 35 个生物、30 个物体，TDB 里有 2243 个生物、810 个物体，梦行者之憩、羽月要塞、石槌要塞的发布人和野外的怪基本都没有。Mayo 和 Evan 马上要练到这里，所以先补菲拉斯，之后照她们的路线一个区一个区补。

做法（两个新脚本，都可以给别的区重复用）：

- `tools/zone_gap.py <地图> <区域>`：用地图文件算出每个刷新点属于哪个区域，再对比 TDB 和我们的库。同一个生物 15 码内已经有的就算已有。结果在 `audit/zone_gap_feralas_20261126.json`。
- `tools/gen_zone_import.py`：生成导入 SQL。位置照抄 TDB（抓包来的）。会跳过三类：分相位才出现的、节日活动专用的（比如万圣节的南瓜，256 个物体）、在 TDB 刷新池里的。同时带上 TDB 的装备、`creature_addon`（坐骑、站姿、表情、光环，但去掉隐身光环，免得又出现看不见的 NPC）、巡逻路线（32 个会巡逻的生物，2648 个路径点）。宝箱类物体照[《新手村》里箱子"已被使用"那次修复](/Build-a-MoP-Server-3-Starter-Zones/#24477-dwarven-artifacts箱子已被使用全服修复)的规矩，把状态设成 1。

结果：补了 **2214 个生物**（guid 9200001–9202214，其中 114 个带 addon）和 **538 个物体**（guid 9200001–9200538：矿点和草药约 300 个、陷阱、营火、装饰等）。顺便按 TDB 修了两个模板：General Skessesh（40051，25458 的目标）原来是 1 级友好的占位模板，改成阵营 2205、37 级；Gnarl Leafbrother（5354）改成 TDB 的阵营和等级。

补完以后，菲拉斯只剩两个发布人还没有刷新点：Sensiria（40131）和 Khan Shodo（36487）。TDB 里也没有他们，应该是事件里召唤出来的，以后再看。

文件 `sql-custom/2026_11_26_05_feralas_spawns_from_tdb.sql`；TDB guid 和我们 guid 的对照在 `audit/zone_gap_feralas_20261126_guidmap.json`；改过的模板备份在 `backup/feralas_templates_20261126.tsv`。要撤销，删掉上面的 guid 范围就行。0 人在线时重启生效，启动日志没有相关报错，没有逐个验证。

### 2.20 补刷新点：凄凉之地、费伍德森林、安戈洛环形山、石爪山

2026-11-26，照 [2.19](#219-整片区域没刷怪按-tdb-补刷新点先补菲拉斯) 的办法，按 Mayo 和 Evan 接下来的路线再补四个区。四个区补完后一起重启（当时 0 人在线），启动日志没有相关报错，没有逐个验证。

| 区域 | 原来（生物 / 物体） | TDB 4.4.2 | 补了生物 | 补了物体 | 文件 |
|---|---|---|---|---|---|
| 凄凉之地 | 48 / 38 | 2654 / 695 | 2598（巡逻路线 3174 个点） | 495 | `2026_11_26_06_desolace_spawns_from_tdb.sql` |
| 费伍德森林 | 8 / 15 | 1717 / 854 | 1551 + 34 | 216 | `2026_11_26_07_felwood_spawns_from_tdb.sql`、`_10_felwood_deadwood_pools.sql` |
| 安戈洛环形山 | 6 / 2 | 1450 / 407 | 1445（巡逻路线 1089 个点） | 370 | `2026_11_26_08_ungoro_spawns_from_tdb.sql` |
| 石爪山 | 2971 / 468 | 3028 / 830 | 51 | 0 | `2026_11_26_09_stonetalon_spawns_from_tdb.sql` |

几个和菲拉斯不一样的地方：

- **费伍德森林有相位。** 导入脚本加了相位映射。169 号是默认相位，当普通刷新点导入。316 号是喝 Phaseblood Potion（28044 Touch the Untouchable）后进的"Shifted"相位，329 号是戴 Sindweller Blindfold 后看到的，客户端里都有对应法术，按原相位导入。339 号的 56 个生物找不到任何东西会让玩家进那个相位，跳过了。
- **Deadwood 巢穴的熊怪在 TDB 刷新池里。** 同一个位置三种熊怪（7156/7157/7158）轮流刷，一共 34 个池子。导入脚本默认跳过刷新池，这批是任务要打的怪，所以单独补上：每个位置一只，三种轮着放。费伍德森林另外 522 个在刷新池里的物体是矿点，没导。
- **石爪山其实不缺怪。** 之前（[2.15](#215-看不见的-npc-和用不了的任务物品全库审计2039-级)）说接不到的几个任务，发布人现在都有刷新点。这里只缺 51 个生物；缺的 409 个物体全是节日专用的，没导。
- **模板修正（照 TDB）：** 凄凉之地 9 个（Furien、Jorreth、Kherrah、Brendol、Doomguard Invader 这些原来是 1 级友好的占位模板，还有 Magram Pack Runner、Nijel's Point Guard 等的阵营）；费伍德森林 5 个（发布人 Impsy 原来 1 级，Vorlus、Shadowsworn Netherguard、Jadefire Defender 原来是 1 级友好，Lord Banehollow 的阵营）；安戈洛 2 个（满地的 Ravasaur 原来是 1 级，改成 48–49 级；Marshal Expeditions Mercenary 的阵营）。备份在 `backup/desolace_templates_20261126.tsv`、`backup/felwood_ungoro_templates_20261126.tsv`。

补完以后还没有刷新点的发布人：

| 区域 | 发布人 | 原因 |
|---|---|---|
| 凄凉之地 | Cork / Rigger Gizelton（车队护送）、Khan Kammah、Khan Leh'Prah、Lord Hydronis、Jinar'Zillen | TDB 里也没有刷新点，应该是事件召唤出来的，以后逐个看 |
| 费伍德森林 | Seedling / Sapling / Flourishing Protector（28219–28228） | 同上，像是种下树苗后才出现 |
| 费伍德森林 | Arathandris Silversky（4103–4112 药膏系列） | 老版本的任务，TDB 里也没有 |
| 安戈洛 | Un'Goro Examinant（24694） | TDB 里也没有 |

guid 范围：生物 9202215–9207893，物体 9200539–9201619；每个区的 TDB guid 对照都在 `audit/zone_gap_<区>_20261126_guidmap.json`。

### 2.21 看不见的 NPC 和用不了的任务物品：全库审计（60 级以上）

2026-11-26，审计的最后一档。这一档的任务大多在外域、诺森德、大地变迁地区和潘达利亚。先用 `tools/obtain.py` 筛掉接不到的任务（没有发布人，或发布人没有刷新点），剩下的按 NPC 逐个看。0 人在线时重启生效，没有逐个验证。

<details>
<summary>任务隐身：19 个 NPC</summary>

| 地点 | NPC | 修法 |
|---|---|---|
| 暴风城王宫 | Anduin Wrynn（1747） | 去掉光环 82804 |
| 暴风城港口 | Fargo Flintlocke（44806） | 去掉光环 93307 |
| 瓦斯琪尔 闪光平原 | Fiasco Sizzlegrin（40918） | 去掉光环 83080 |
| 奥丹姆 | Sullah（48203） | 去掉光环 82358 |
| 海加尔山 诺达希尔 | Thrall（54313） | 去掉光环 60921 |
| 翡翠林 | High Elder Cloudfall（54914），侦察兵 Shademaster Kiryn / Shokia / Riko（55646–55648） | 去掉光环 |
| 四风谷 | Li Li（56138，两个农庄各一个） | 去掉光环 94224 |
| 时光之穴 | Alurmi（57864） | 去掉光环 49414 |
| 昆莱山 东、西歇脚处 | Rivett Clutchpop、Shademaster Kiryn、Sully McLeary、Mishka（59448–59451） | 去掉光环 84667 |
| 瓦斯琪尔 海藻森林 Seafarer's Tomb（5051） | Erunak Stonespeaker（36915）、Mack Fearsen（40983）、46 个 Drowning Soldier（39663） | 客户端里就有对应的侦测：接了 14482 Call of Duty 后给 75974 "Kelp Forest Quest Invisibility Detection Erunak"（一直有效）；做 25281 Pay It Forward 时给 77823 "See Drowning Soldiers"（只限联盟） |
| 暮光高地（5584） | The Hammer of Twilight（46717） | 光环 87266 同时管锤子的外观，不能去掉。改成接了 27784 后给 81010 "Detect: Quest Invis Zone 6" |
| 龙骨荒野 天谴之门 | Highlord Bolvar Fordragon（27872） | 照 TDB 补 46999 的 8 条 `spell_area`（4169–4172 区域，联盟 12499 / 部落 12500 交任务前可见），种族掩码换成我们的 |

前面那批"去掉光环"的都只有一个刷新点，附近也没有同名的其他版本，去掉不会出现两个同样的人站在一起。

没修：Talonpriest 三兄弟（斯克提斯）本来就要喝 Elixir of Shadows 才看得见，是正常设计；Caladis Brightspear 两个刷新点只有一个隐身，另一个看得见；Panther Cub、An Windfur、潘达利亚的 Anduin Wrynn 这几个任务的发布人或交付人没有刷新点。

</details>

<details>
<summary>施法焦点：8 个任务</summary>

| 地图 | 任务 | 修法 |
|---|---|---|
| 虚空风暴 | 10173 The Archmage's Staff | 照 TDB 刷新点放 Arklon Brazier（184143） |
| 卡拉赞 | 9824 Arcane Disturbances | 计数标记（18161、18162）和 SAI 本来就有，每个标记上放一个焦点（224025，10 码） |
| 龙骨荒野 | 12277 Leave Nothing to Chance | 爆炸计数已经有 C++ 脚本，在上下两个矿井口的标记上放 Wintergarde Mine Entrance（188711） |
| 翡翠林 | 29966 Burning Down the House | Alliance Camp 标记上放 Alliance Campfire（209913） |
| 翡翠林 | 31709 Lingering Doubt | 焦点 1783 哪个库都没有模板，自建 910104，放在 3 个 Sha Bunny 上；Sha Bunny 3 补上被打中给计数的 SAI 和目标条件 |
| 昆莱山 | 30614 Oil Stop | 两个 Yaungol Oil Derrick 上放焦点（我们库里现成的 230146，20 码） |
| 恐惧废土 | 31200 Fumigation | 5 栋建筑各放一个 Sra'vess Structure（213312）。5 个计数标记只刷了 2 个，另外 3 个（63706、63713、63714）按地图标记补上刷新点、SAI 和目标条件 |
| 锦绣谷 | 31948 Nana's Vote II: The Sacred Springs | 在地图标记处放 Golden Falls（215727，20 码） |

文件 `sql-custom/2026_11_26_12_spell_focus_60_plus_part1.sql`、`_13_..._part2.sql`。高度取自地形（`tools/height.py`，误差 3–6 码，焦点范围有 10–20 码）或者取自焦点下面的标记，22 个新刷新点都过了位置检查。另外，184143 和 188711 的模型编号 1287 在 5.4.8 客户端里不存在，服务器会直接不加载，所以改成焦点通用的隐形模型 327。12981 Hot and Cold 是误报：它的焦点由计数生物刷出来时自己召唤。

</details>

**没修，先放着（缺的是脚本，不是焦点）：** 10806 Showdown（召唤 Goc 的事件 14525 不存在）、27135 Something that Burns、30504 / 31319 Emergency Response（Cho's Fireworks）、29939 Boom Bait、29936 Instant Messaging、29637 The Rumpus、30331 The Mile-High Grub、31705 Needle Me Not；还有 29718、29732、29856 这几个正式服里进区域就自动接的任务，我们这边没有东西会触发它们。都是 70–90 级的内容，等练到那里再逐个重做。

到这里，审计清单从 20 级到 90 级都过了一遍。
