---
title: "建造自己的魔兽世界（熊猫人之谜）（四）：东部王国"
date: 2026-11-13
slug: "Build-a-MoP-Server-4-Eastern-Kingdoms"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "熊猫人服务器东部王国的任务修复：西部荒野、赤脊山、暮色森林、荆棘谷、洛克莫丹、暴风城、东瘟疫之地、湿地、阿拉希高地。"
---

这是《建造自己的魔兽世界（熊猫人之谜）》系列的第四篇。

这个系列一共五篇，按大地图分篇，篇内按地图区域分章：

1. [选型与部署](/Build-a-MoP-Server/)：服务器选型、部署、配置和客户端设置，以及修复进度和待办
2. [全局修复](/Build-a-MoP-Server-2-Global-Fixes/)：全库任务审计、批量修复，以及影响全服的问题
3. [新手村](/Build-a-MoP-Server-3-Starter-Zones/)：熊猫人、矮人、狼人、德莱尼、侏儒、死亡骑士的新手村任务修复
4. **东部王国**（本篇）：东部王国各地图的任务修复
5. [卡利姆多](/Build-a-MoP-Server-5-Kalimdor/)：卡利姆多各地图的任务修复

## 第一章　艾尔文森林与西部荒野

### 1.1 实测反馈：Pie for Billy 掉率太低

艾尔文森林的 **86 Pie for Billy** 要 4 块 Chunk of Boar Meat（60401），只有接了任务才掉。数据库里的掉率：

| 怪 | 等级 | 刷新点 | 原掉率 | 现掉率 |
|---|---|---|---|---|
| Stonetusk Boar（113） | 5 | 47 | 21% | 50% |
| Rockhide Boar（524） | 7 | 87 | 12% | 50% |

原来平均要杀 19–33 只，现在约 8 只。这不算 bug，是按玩家要求调的。`sql-custom/2026_11_14_01_pie_for_billy_drop_rate.sql`，原值备份在 `backup/pie_for_billy_loot_20261114.tsv`，`reload creature_loot_template` 热加载，不用重启。

### 1.2 实测反馈：Livin' the Life 的施法点放错了（又一次是我的错）

**26228 Livin' the Life**：玩家走到 Jangolode 矿洞尽头，道具 Two-Shoed Lou's Old House 用不了，客户端红字提示 "Requires you to be at the end of the Jangolode Mine."（这句话就是施法焦点 1672 在客户端里的名字）。

原因在我们自己：这个焦点物体（模板 910100，刷新点 9100101）是批次六新建的，[《全局修复》1.19](/Build-a-MoP-Server-2-Global-Fixes/#119-碰撞数据检查工具) 复查时又"挪到最深处那只狗头人的位置"——但我挑的是**高度最低**的那只（−9942.6, 1473.2），不是**走得最远**的那只。这次用寻路工具（navpath）从洞口算到每只狗头人挖掘者的步行距离：旧位置只有约 212 码，矿道后面还有一个洞室（x −9985 到 −10026，y 1435 到 1497），最远处约 265 码。玩家站在真正的尽头，离焦点 50–85 码，半径 15 码当然够不着。

修复：焦点挪到最后那个洞室的中心（−10003, 1463, 41.1，高度取自寻路网格的地面），半径 15 → 20 码，盖住整个洞室。`sql-custom/2026_11_14_02_livin_the_life_focus_end_of_mine.sql`，刷新点的移动要重启才生效，已重启。

**结果还是报错，而且这次错得更离谱。** 玩家两次都站在 (−9850, 1388)，就在精英怪 Master Digger 旁边。查了每个点比头顶地表低多少：

| 位置 | 比地表低 |
|---|---|
| 玩家站的地方（Master Digger 洞室） | 13.5 码 |
| 第一次放的点 (−9943, 1473) | 31 码（矿洞中段） |
| 第二次放的点 (−10003, 1463) | 0 码，**在洞外** |

我把洞口和尽头搞反了：西边那片"洞室"其实是入口外的空地，矿道从西往东延伸，尽头是 Master Digger 守着的洞室。第三次改到 (−9846, 1393, 38.3)，半径 20 码（`sql-custom/2026_11_14_03_livin_the_life_focus_master_digger.sql`），重启生效。教训：判断"尽头"之前，先用"比地表低多少"确认哪边是洞口；玩家实际站的位置比我推算的更可信。

### 1.3 实测反馈：Lou's Parting Thoughts 的偷听事件是空壳

**26232 Lou's Parting Thoughts**：任务要求去农舍后面偷听几个暴徒说话，玩家走到 NPC 旁边什么都没发生。

- 任务目标是 1 个 Furlbrow Murder Info 004（42417）的击杀记录，本该由法术 79184 Hobo Information 给出，但数据库和 C++ 里都没有东西会施放这个法术。
- 农舍后面的 4 个 Thug（42387）围着一个隐形的 Lou's Parting Thoughts Trigger（42562），它显然是负责感应玩家、播对话、给记录的，可它没有 AI，Thug 也一句台词都没有。上游源码历史里也查不到，SkyFire 从来没做过这个事件。

修法跟 Westfall 前面几条一样，保留结果、跳过演出：给触发器加一段 SmartAI，接了任务还没完成的玩家走进 15 码内（看得到）就直接记一次 42417。原版台词库里没有，所以没编台词。`sql-custom/2026_11_14_04_lous_parting_thoughts_trigger.sql`。触发器原来没有 AI，要重启 worldserver 才会换上，当时有 5 人在线，等大家下线后才重启。

**第一版没生效。** 重启后脚本加载正常，玩家带着任务走到 Thug 中间，什么都没发生。我把这条链路从头查了一遍：AI 选择、反应状态（只有 REACT_AGGRESSIVE 的生物才会收到"有人进入视野"的通知）、视线、事件计时、条件表、给记录的动作，每一环单独看都没问题，但就是不触发，原因没找到。

**第二版换了思路**，不再依赖视野通知：触发器每 2 秒扫一遍 20 码内的玩家（`SMART_EVENT_UPDATE_OOC` + `SMART_TARGET_PLAYER_DISTANCE`），给每个人记一次。没接任务或已经完成的玩家记了也没有任何效果，所以条件表那行也去掉了（`sql-custom/2026_11_14_06_lous_parting_thoughts_trigger_scan.sql`）。重启后实测通过。教训：隐形触发器要感应玩家，用定时扫描比 OOC_LOS 可靠。

### 1.4 实测反馈：Feeding the Hungry and the Hopeless 喂了没反应

**26271 Feeding the Hungry and the Hopeless**：要用 Westfall Stew 喂 20 个流浪汉。物品会在面前召唤一碗炖肉（42617），但这碗炖肉没有 AI，流浪汉的 C++ 脚本 `npc_transient` 也只处理 26209（问谁杀了 Furlbrow 一家），所以没人给记录。

修法同样是保留动作、跳过演出：炖肉被召唤时（`SMART_EVENT_JUST_SUMMONED`），如果 10 码内有三种流浪汉之一（条件表 type 29，ElseGroup 0/1/2 做"或"），就给召唤者记一次；不管有没有喂到，5 秒后炖肉消失（`sql-custom/2026_11_14_07_feeding_the_hungry_stew.sql`）。流浪汉走过来吃的演出没做，同一个流浪汉也能重复喂。炖肉是每次新召唤的，`.reload creature_template 42617`、`.reload smart_scripts`、`.reload conditions` 热加载就生效，不用重启。实测通过。

### 1.5 实测反馈：Secrets of the Tower 塔顶是空的

**26290 Secrets of the Tower**：任务要你进 Mortwake's Tower "找到 Helix Gearbreaker"，玩家爬到塔顶，什么都没有。塔顶那段剧情的 NPC（Helix 42655、Glubtok 42755、Oaf 42654）一个刷新点都没有，脚本和台词也没有。11-13 的修法是"在塔里喝下 Potion of Shrouding 就完成"，但这要靠服务器判断出玩家在塔的建筑区域 5289 里，这一点从没验证过，玩家的药水也还没喝。

这次换成不依赖药水和区域判断的做法：

- 先找塔。区域 5289 在地形网格里一格都没有，只存在于建筑模型内部。解析 vmap 地图块，找到 `Westfall_Magetower.wmo` 放在 (−11127, 570)，范围大约是 x −11182..−11098、y 505..594、z 31..108。玩家之前报的两个位置其实都在塔外。
- 再找塔顶。在塔的范围内取点，从上往下探测碰撞地板：最高那些点呈圆锥形分布，是尖顶屋面；尖顶下面那层地板在 z≈88.4，塔中心是空的，一直通到 z 66 那层。
- 复制 Lou's Parting Thoughts 的触发器模板，建了一个新的隐形触发器 910002，放在 (−11138, 550, 88.6)：每 2 秒对 16 码内的玩家触发一次任务事件 26290（`sql-custom/2026_11_14_08_secrets_of_the_tower_top_trigger.sql`）。重启后实测通过。

### 1.6 实测反馈：The Dawning of a New Day 的集会没有开始

**26297 The Dawning of a New Day**：去 Moonbrook 偷听流浪汉集会。任务要 1 个 Shadowy Figure（42680）的记录，它没有刷新点，召唤它的法术 79551 也没有任何东西施放；演讲的人、台词、脚本全没有。只剩 Moonbrook 流浪汉人群中间一个没有 AI 的隐形触发器 Moonbrook Player Trigger（43515），周围是流浪汉、Thug 和推车，这就是集会的位置。

给它加同样的 2 秒扫描，20 码内的玩家记一次 42680（`sql-custom/2026_11_14_09_dawning_of_a_new_day_rally.sql`），没有演讲。重启后实测通过。

**26320 A Vision of the Past** 顺带实测通过：Incense Burner 要在死亡矿井副本里、施法点 "Entrance of the Deadmines"（204039）30 码内使用，这个施法点离进副本的落点只有约 9 码。11-13 加的"用了就完成"实测有效。

### 1.7 实测反馈：死亡矿井熔炉的坡走不下去

玩家在大熔炉上层走道往下走，坡下不去，也跳不起来。服务器的碰撞数据里这条坡是连续的（沿东边往南，再沿南墙往西，从 z 51 降到熔炉底层 z 21），玩家身上也没有定身之类的效果。

处理：玩家下线后，在 `game_tele` 里加一个临时传送点，用控制台 `.tele name Frank <点名>` 把她挪到坡底（离线也能用，会直接改存档坐标），然后删掉临时点。

玩家随后补充了关键线索：卡住是在骑过门口的机器人 Prototype Reaper（49208，载具）、下来之后才开始的，骑着机器人下坡是正常的。症状很像客户端在下载具后没恢复重力：服务器的 `Unit::_ExitVehicle` 会发恢复重力和解除定身的消息，相关消息编号看起来也都定义了，原因没查到。这台机器人只跟可选成就 Prototype Prodigy 有关，Foe Reaper 的脚本只定义了它的编号、没有用到，所以按玩家的意思直接删掉刷新点（`sql-custom/2026_11_14_10_deadmines_remove_prototype_reaper.sql`），玩家打完副本后重启生效。别的载具可能也有同样的问题，记为未解决。

## 第二章　赤脊山

### 2.1 实测反馈：Still Assessing the Threat 的地图标记挂错目标

**26503 Still Assessing the Threat**（赤脊山）：要偷 Gnoll Battle Plans、Gnoll Orders、Gnoll Strategy Guide 三样东西。玩家拿到了 Battle Plans，另外两样找不到，以为没刷出来。

- 三个箱子的刷新点都在，数据跟拿到的那个完全一样，没有相位，也没有脚本干扰。
- 问题在任务地图标记：三块区域位置都对，但 `quest_poi.objIndex` 全是 0，都挂在第 1 个目标 Battle Plans 名下。拿到 Battle Plans 后，这个目标完成，三块区域一起收起来，Orders 和 Guide 在地图上就没有任何标记了。
- 修法：把第 2、3 块区域改挂到目标 1、2 上（`sql-custom/2026_11_14_05_still_assessing_the_threat_poi.sql`），`.reload quest_poi` 热加载，不用重启。

插曲：玩家照我给的坐标（Orders 28.0, 74.9；Guide 30.6, 62.7）去了一趟，说还是没有。我在服务器上把能查的都查了，找不出这两个箱子不在的理由，就请玩家用 GM 角色 `.go object` 过去看。GM 角色看到了，换回原角色也看到了。之前为什么没看到，没能复现，原因不明。可能当时站的位置还差一点，也可能是重新登录后客户端重新加载了周围的物体。

### 2.2 实测反馈：In Search of Bravo Company 的 Messner 看不见

**26586 In Search of Bravo Company**（赤脊山）：任务要你去 Alther's Mill 找 Messner（43270），玩家到了地方什么也没有。

- Messner 有刷新点，但身上挂着 Apply Quest Invis Zone 5（81003），这是"任务隐身"：只有带着对应的 Detect: Quest Invis Zone 5（81004）的玩家才看得见。
- 通常由 `spell_area` 在接了任务之后自动给玩家上这个探测光环。81004 一条 `spell_area` 都没有，所以 Messner 对谁都是隐形的。
- 修法：区域 97 内，从接 26586 起到交 26587 为止，自动给玩家 81004（`sql-custom/2026_11_14_11_in_search_of_bravo_company_detect.sql`）。实测通过。

这是一类通病：带 "Apply Quest Invis Zone N" 的 NPC，如果没有对应的 "Detect" 规则，就永远看不见。下一节马上又碰到了三个。

### 2.3 实测反馈：Bravo 小队营救链断在第一环

玩家交完 26587 Breaking Out is Hard to Do 之后，"赤脊山的任务突然就没了"。查下来是三处问题叠在一起：

1. **救出来的人不会跟着你。** 这条链的设计是：救出笼子里的 Messner，他变成跟随者（43300），由跟随者给下一个任务 Jorgensen；救出 Jorgensen，跟随版 Jorgensen（43305）给 Krakauer，以此类推到 Danforth（43302）给 Return of the Bravo Company。四个跟随者都没有刷新点，召唤它们的法术（80893、80940、80941、80943）也没有任何东西施放，所以交完 26587 就没人给下一个任务。
   修法：给四个笼子里的 NPC 加 SmartAI，交任务时让玩家施放对应的召唤法术。这里不能用 `spell_area` 的自动施放：服务器只用"身上有没有这个光环"判断要不要再放一次，召唤法术不留光环，每次换区域都会再召唤一个。
2. **后面三个笼子里的人也看不见。** Jorgensen、Krakauer、Danforth 分别挂着 Quest Invis Zone 6/7/8（81009/81018/81079），跟 Messner 同一个毛病。补了 81010/81019/81080 三条 `spell_area`，各自从接任务到交任务期间生效。
3. **John J. Keeshan 不存在。** 他是 26567 John J. Keeshan 和 26607 They Drew First Blood 的交任务人。11-13 的审计因为"没有能到达的交任务人"把这两个任务禁用了。任务文字说他在 Lakeshire 旅店地下室的地下格斗场，地图标记 (−9202, −2154) 正好落在地下室的两个格斗者 Dumpy 和 Big Earl 身上。于是把 Keeshan 刷在擂台边上，解除禁用。

文件：`sql-custom/2026_11_14_12_bravo_company_rescue_chain.sql`、`sql-custom/2026_11_14_13_keeshan_lakeshire_inn_spawn.sql`。玩家交 26587 时还没有召唤脚本，所以在重启的空档直接把 26560 Jorgensen 加进了她的任务日志。重启后实测通过：三个营救任务和旅店的 Keeshan 都交了。

留了一个已知问题，暂时不改：26563 Return of the Bravo Company 在数据里要求先交 Troteman 的 26571 Weapons of War，而它唯一的发放人是临时召唤的跟随版 Danforth，下线就消失。跳过 Weapons of War 的玩家实际上拿不到这个任务。好在它不挡主线（26607 也可以从 26573 进入）。

### 2.4 赤脊山后半段重建（第一期）

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

### 2.5 赤脊山后半段重建（第二期）

剩下的三个任务数据基本是空壳：入侵者和 Darkblaze 是友好的 1 级 NPC，攻城坦克不是载具，任务说要用的 Horn of Summoning 这个物品根本不存在。这一期是替代设计，动手前先定好了方案（`sql-custom/2026_11_14_15_redridge_second_half_phase2.sql`）：

- **Colonel Troteman**（43733）刷两个：Shalewind Canyon 发 26708，Keeshan's Post 收 26708、26713、26714。
- **26708 AHHHHHHHHHHHH! AHHHHHHHHH!!!**（开坦克杀 200 个 Blackrock 兵）：Bravo Company Siege Tank（43714）补上 TDB 的载具编号 987，接了任务才能上车，配两门炮：Heavy Cannon（79776，点地面，20 码，约 3000 伤害）和 Fiery Boulder（72051）。在两地之间的任务区域里随机刷了 40 个敌对的 Blackrock Invader（17–18 级普通怪，30 秒刷新），生成脚本 `tools/gen_invaders.py`。坦克如果有问题，步行杀也算进度。
- **26713 Showdown at Stonewatch**：Tharil'zun 和 Gath'Ilzogg 刷在 Stonewatch Keep 的两个任务标记点上（原版就有的 20 级精英和技能脚本）。
- **26714 Darkblaze**：在 Keeshan's Post 的 Troteman 那里接任务时，旁边召唤出 22 级精英的敌对 Darkblaze。打输了可以跟 Troteman 对话"吹号角"再叫一次。解除了 26714 的禁用。

  **11 月 17 日补记：**实际玩到这里时龙没出来。26713 是远程完成任务（`QUEST_FLAGS_AUTOCOMPLETE`），交完会顺着 `NextQuestIdChain` 当场弹出 26714；26714 又带自动接受标记（0x80000），于是直接进了任务日志，根本没经过 Troteman，挂在"从 Troteman 接任务"上的召唤也就没触发。玩家回 Troteman 那里重接后完成了。按用户要求改成必须找 Troteman 接（`sql-custom/2026_11_17_03_darkblaze_accept_at_troteman.sql`）：26713 的 `NextQuestIdChain` 清零，不再远程弹出 26714（前置关系靠 26714 的 `PrevQuestId` 保留）；26714 去掉自动接受标记。下次重启后生效。

这一期上线了，还在等玩家做到这里。

### 2.6 To Win a War, You Gotta Become War：炸药放不下去

赤脊山 26651 要用 Bravo Company Field Kit 在 Blackrock 弹药小屋和塔里各放一个炸药。拿出工具包后，"Plant Seaforium"（82585）一按就报 "Requires %s"。

11 月 14 日重建赤脊山后半段时（[2.4](#24-赤脊山后半段重建第一期)），我给 82585 加了目标条件（只能对弹药小屋 43589 / 塔 43590 这两个计数 NPC 放），也加了"被命中就计数"的脚本，但漏了一点：这个法术还要求附近有法术焦点 1676（`SpellCastingRequirements` 5800）。我们的库里没有任何带这个焦点的物体；TDB 4.4.2 里只有模板 204448 "Plant Seaforium Here"，也没有刷新点。所以无论站在哪里都放不了，和 [《卡利姆多》1.11](/Build-a-MoP-Server-5-Kalimdor/#111-the-titans-terminal哪里都-requires-) 的 Titans' Terminal 是同一类问题。

修复（`sql-custom/2026_11_17_01_win_a_war_seaforium_focus.sql`）：补上模板 204448，在两个计数 NPC 的原始位置（小屋里、塔顶）各刷一个焦点物体，作用半径 10 码，和法术射程一致。位置检查通过。新刷的物体要重启后才出现，已在玩家下线后重启。已在游戏里确认：塔顶和弹药小屋的炸药都能放下，任务完成。

## 第三章　暮色森林

### 3.1 夜色镇的缝合怪

之前（[《全局修复》1.9](/Build-a-MoP-Server-2-Global-Fixes/#19-批次五119-级目标不存在先修矮人路线)）给 The Embalmer's Revenge（26727）补的是简化版：接任务时 Lord Ello Ebonlocke 在镇子南面入口召唤 Stitches 攻击玩家。实际测试接了任务什么也没看到，只是人物进入战斗又马上脱离。原因是服务器的 `ThreatRadius`（60 码）：怪物的目标离它的出生点超过这个距离就立即放弃战斗。召唤点离市政厅里的玩家大约 95 码，Stitches 一出来就把玩家当目标、又立刻放弃，原地站 2 分钟后消失。

这次按原版事件重做（`sql-custom/2026_11_15_12_stitches_road_event.sql`，备份 `backup/stitches_event_20261115.tsv`）：

- **接任务立刻触发**：召唤点改到市政厅门前的广场，离 Ebonlocke 约 38 码。
- **平时也有**：乌鸦岭墓地加一个常驻的 Stitches（guid 9100141，5 分钟重刷），只给这个刷新点写的 SmartAI：刷出后设为常驻激活（没人在附近也继续走）、3 秒后沿 412 号路线走、到最后一个点在广场上游荡，由夜色镇守卫迎战。路线用的是 AzerothCore 里原版事件的 91 个路点，逐个和 MoP 地形核对过，高度差都在 3 码以内。
- Stitches 原来的阵营 29 是一个部落阵营，改成 TDB 4.4.2 的 93（对玩家敌对的怪物）。做任务的玩家在路上截住常驻的这只，杀掉同样计数（KillCredit 43862）。

经同意重启后生效，启动日志没有报错，等游戏里验证。

### 3.2 Bear In Mind：熊脑掉率

夜色森林 26787 要收集 8 个 Black Bear Brain（60334），只有 Coalpelt Bear（44016）掉。数据本身没坏：掉落表、刷新点、拾取代码都正常，Frank 也确实捡到了。但掉率只有 53.7%，而熊身上除了熊脑没有别的东西（也没有钱），没掉的尸体根本不能拾取，玩起来像"大多数时候什么都不掉"。

用户要求调高。修复（`sql-custom/2026_11_16_12_bear_in_mind_drop_rate.sql`）：改成 TDB 4.4.2 里的 90%，仍然只掉给有任务的玩家。热加载，没有重启。

### 3.3 Cry For The Moon：剧情演完不计数

夜色森林 26760 接了以后，Oliver Harris、Jitters 和被关着的狼人会演一段剧情（C++ 脚本 `npc_oliver_harris` 调度，三个演员 43858/43859/43950 用 SmartAI），剧情能完整演完，但任务不计数。

剧情最后一步是演员 Oliver 对 100 码内的玩家放法术 82286 "Cry For The Moon - Regain Quest Invis Detection"。这个法术的三个效果（计数 43969 和两个 Raven Hill Questgiver Vision 光环）目标都是 `TARGET_UNIT_SUMMONER`，只作用于"召唤了施法者的人"，而 Oliver 是数据库里的固定刷新点，没有召唤者，于是三个效果都落空。两个视野光环在库里没有任何 NPC 依赖，丢了没影响。

修复（`sql-custom/2026_11_16_13_cry_for_the_moon_credit.sql`）：这一步改成直接给 100 码内的玩家计数 43969，只对身上有这个任务的玩家生效。注意 `reload smart_scripts` 只更新内存里的脚本表，已经刷在世界里的 NPC 要等重新创建才会用新脚本，所以经同意重启了一次。已在游戏里确认：放弃重接后看完剧情，任务计数。

### 3.4 Morbent Fel：整条线没有起点

Cry For The Moon 之后查 Frank 的暮色森林完成度，发现 Morbent Fel 这条六个任务的线（26723 The Fate of Morbent Fel → 26724 → 26725 → 26753 → 26722 → 26754 Morbent's Bane）从头就接不到：

- **Sven Yorgen（43861）没有刷新点。** 他发 26723/26724，也收 26723/26754，TDB 4.4.2 里同样没有。26754 因此在 11 月 13 日的审计里被禁用（"没有能到达的交任务者"）。
- **Morbent's Bane 打不动 Morbent Fel。** 道具法术 82130 Sacred Cleansing 是 `TARGET_UNIT_NEARBY_ENTRY` 加一个空的 dummy 效果，没有目标条件也没有处理；Morbent Fel（43761）身上挂着 Unholy Shield（8909，各系抗性 +10000），也没有 AI。

修复（`sql-custom/2026_11_16_14_morbent_fel_chain.sql`）：

- Sven Yorgen 刷在 26723/26754 的交任务标记点 (-10762, 338)，就在 Oliver Harris 的营地里，位置检查通过。原版里他就是 Cry For The Moon 里被治好的狼人，所以 26723 改成要先交 26760。
- 82130 的目标限定为 Morbent Fel；Morbent 被它命中时去掉 Unholy Shield，并补上参考库里他的两个技能（Touch of Death、Presence of Death）。击杀计数就是普通击杀。
- 26754 解除禁用。

新刷了 NPC，经同意重启后生效。已在游戏里确认整条线做完。之后 Frank 的暮色森林只剩三个不算缺的：暴风城布告板的引路任务 28564，以及旧版 Lightforge 链里接不到的 270 和已禁用的 325。

## 第四章　荆棘谷

### 4.1 Spared from Madness：营地里一个囚犯都没有

荆棘谷 26736 要在 Kurzen's Compound 里救出三个人：Berrin Burnquill、Emerine Junis、Osborn Obnoticus。到了营地一个都找不到：三个囚犯（计数用的 43919/43920/43921）在我们的库和 TDB 4.4.2 里都没有刷新点，也没有任何营救脚本。不光这个任务做不了，三人被救回叛军营地后各自发的任务链（Water Elementals 等 26729–26731、Bloodscalp Insight 等 26742–26743、A Nose for This Sort of Thing 等 26746–26747、26749）也全接不到，因为营地版本的三个人（43884/43885/43886）同样没有刷新点。

修复（`sql-custom/2026_11_17_05_spared_from_madness.sql`，备份 `backup/spared_from_madness_20261117.tsv`）：

- 三个囚犯刷在任务地图标记的营地小屋里，高度取自寻路网格，位置检查通过。和他们对话选"You're free. Head for the Rebel Camp."就给对应的营救计数（只在接了 26736 时出现），之后人消失，30 秒后重新出现。
- 叛军营地按交任务标记点刷出三人，发后续任务。几条链的第一个任务都加了条件：交了 Spared from Madness 才能接。

新刷了 NPC，已在玩家下线后重启。已在游戏里确认：三个囚犯都能救出，任务完成。

### 4.2 Favored Skull：联盟接到了部落版

荆棘谷的蜥蜴幼崽（Lashtail Hatchling，42736，前面任务召唤出来的，没有固定刷新点）同时发两个 Favored Skull：26323 交给 Grom'gol 的 Nimboya（部落），26745 交给叛军营地的 Osborn Obnoticus（联盟）。两个任务都没有限制种族，联盟角色也会接到部落版，交任务标记就出现在部落营地里。联盟版的交任务人 Osborn 直到 [4.1](#41-spared-from-madness营地里一个囚犯都没有) 才刷出来。

修复（`sql-custom/2026_11_17_07_favored_skull_faction_split.sql`，备份 `backup/favored_skull_20261117.tsv`）：26323 只给部落，26745 只给联盟，用的是库里通用的部落/联盟种族掩码。已经接了部落版的联盟角色，在离线时把存档里的 26323 换成"可交付"状态的 26745（这个任务没有目标，只要回去交），没有让玩家放弃重接，因为幼崽是召唤出来的，放弃后不一定还能再接。重启后生效。

### 4.3 The Mosh'Ogg Bounty：两个一模一样的任务抢同一个物品

荆棘谷的 The Mosh'Ogg Bounty 每个阵营各有两份：联盟 26782/26783 都由 Fort Livingston 的 Wulfred Harrys 发和收，文本只差一个词；部落 26399/26412。四个任务都要宝箱里的同一个 Mosh'Ogg Bounty（58205）。我们的库里它们都没设互斥组，联盟角色可以把两份都接下：交第一份时物品被收走，第二份还留在日志里要同一个物品，只能再去开一次箱子。TDB 4.4.2 给部落那对设了互斥组 26399，联盟那对两边都没设。

修复（`sql-custom/2026_11_17_08_mosh_ogg_bounty_exclusive.sql`，备份 `backup/mosh_ogg_bounty_20261117.tsv`）：部落那对照 TDB 设互斥组 26399，联盟那对设 26782，每个阵营只能接、只能做其中一份。等下次重启生效；已经两份都接了的玩家照常交掉第二份就行。

### 4.4 See Raptor / Be Raptor：女祭司的对话选项不显示

荆棘谷 Fort Livingston 的 Priestess Thaalia（44017）要主持两个仪式：26773 See Raptor（Mind Vision，计数 42840）和 26775 Be Raptor（Mind Control，计数 42881–42884）。她的对话菜单 11785 里两个选项都在，但选项类型和 NPC 标记都是 0，客户端根本不显示；而且选了也什么都不会发生，我们的库、TDB 4.4.2 和 C++ 里都没有对应脚本。原版是两段祖尔格拉布剧情：See Raptor 被传送进去看一段过场，Be Raptor 变成被抓的迅猛龙逃出来。传送、召唤迅猛龙和曼多基尔这些法术都还在，但没有东西把它们串起来。

按用户决定做了简单替代（`sql-custom/2026_11_17_09_see_raptor_be_raptor.sql`，备份 `backup/thaalia_rituals_20261117.tsv`）：两个选项只在接了对应任务时显示，选了直接给这个任务的全部计数并关闭对话。See Raptor 原本就只是看过场；Be Raptor 的逃跑玩法是用户要求简化的。部落版（Priestess Hu'rala 的 26359/26362）没有改。已在玩家下线后重启，等游戏里验证。

### 4.5 Backdoor Dealings：图腾点了没反应

Cape of Stranglethorn 的 Backdoor Dealings（联盟 26809 / 部落 26550）要把 Gurubashi Incense 放在 Totem of Hir'eek（物体 204361）前面，再偷听 Zanzil 的计划（计数 43252 + 43245）。图腾是"任务给予者"类型的物体，对话菜单 11711 里有 "Place the incense at the foot of the statue." 这个选项，但选项类型是 0；物体身上的对话选项只有"普通对话"类型才会显示，所以点了图腾什么都看不到。选了也没有任何脚本（我们的库、TDB 4.4.2、C++ 都没有）。原版是放下香后蝙蝠 Wings of Hir'eek 带玩家飞去看一段剧情。背包里的香本身没有使用效果，只是任务要带在身上的物品，所以用不了是正常的。

照 [4.4](#44-see-raptor--be-raptor女祭司的对话选项不显示) 的做法替代（`sql-custom/2026_11_17_11_backdoor_dealings.sql`，备份 `backup/backdoor_dealings_20261117.tsv`）：接了任意一个版本时，图腾的放香选项才会显示，选了两个计数一次给满并关闭对话。图腾挂上 SmartGameObjectAI，经同意重启，等游戏里验证。

## 第五章　洛克莫丹

### 5.1 Resupplying the Excavation：走到 Huldar 那里，任务不完成

Evan 做完丹莫罗进了洛克莫丹，从 Jern Hornhelm 接了 13639 Resupplying the Excavation，要去路边的商队找 Huldar、Miran 和 Saean。找到 Huldar 点开，对话窗口是空的，没有交任务的选项。

这个任务的目标在这边是占位类型（`quest_objective` type 10，对象 0），TDB 4.4.2 里它是"进入区域触发器 171"。171 正好在 Huldar 脚下（-5705.8, -3548.4，半径 50 码），走进去就该完成，之后 Huldar 才能交。11 月 16 日按 TDB 批量补"触发器 → 任务"关联时（见 [《卡利姆多》1.6](/Build-a-MoP-Server-5-Kalimdor/#16-consumed湖底的东西点不了)），171 被跳过了：它已经关联给了 273，同名的旧版任务（大地变迁前那条 301 → 302 → 273，TDB 里三个都没有起始 NPC，我们的库里却还留着）。SkyFire 这张表一个触发器只能对应一个任务，于是新版 13639 永远完不成。

修复（`sql-custom/2026_11_19_09_resupplying_excavation_at171.sql`，原数据备份 `backup/resupplying_at171_20261119.tsv`）：把 171 改关联到 13639，并给 13639 补上"探索/事件"标志（不补的话加载时核心也会自动补，但会报一条警告）。`reload areatrigger_involvedrelation` 热加载，没有重启。代价是旧版 273 从此完成不了；它本该随 301、302 一起下线。11 月 20 日按用户决定把 301、302、273 三个都禁用了（`sql-custom/2026_11_19_13_disable_old_ironband_chain.sql`，`reload disables` 热加载）：TDB 里三个都没有起始 NPC，我们的库里却和新版 13639 同时挂在 Jern Hornhelm 身上。Evan 已经交过 301、302，再往下就会接到 273，禁用正好挡在前面；现在没有角色日志里还挂着这三个任务。Evan 做完洛克莫丹后，同一批旧任务又剩两个：298 Excavation Progress Report（Prospector Ironband 还在发）和 454 After the Ambush（前置是 273），TDB 里同样没有起始 NPC，也按用户决定禁用了（`sql-custom/2026_11_20_01_disable_old_ironband_298_454.sql`）。已确认：Evan 回到 Huldar 身边完成并交掉了 13639。

### 5.2 Protecting the Shipment：接了任务什么都不发生

13639 交掉后 Huldar 给 309 Protecting the Shipment：保护 Huldar 和商队，再去告诉 Prospector Ironband。这是"事件"类任务，没有计数目标，要靠脚本在事件结束时通知完成。但 Huldar 没有任何 AI，TDB 4.4.2 里这个任务也没有脚本，接了以后什么都不会发生。

任务文字说得很清楚：车坏了走不了，"Miran 把火药搬去营地，你和我守着车"；交任务时 Ironband 说"谢谢你保护了 Huldar 和车"。所以这是一场原地守车的战斗，不是护送。按这个重建（`sql-custom/2026_11_19_10_protecting_the_shipment.sql`，原数据备份 `backup/protecting_the_shipment_20261119.tsv`）：

- Huldar 改用 SmartAI：有人接 309 时开始一段计时脚本；
- 3 秒、25 秒、47 秒各来一波，每波 2 个 Dark Iron Raider（2149，14 级，库里本来就有这个 NPC，但没有刷新点），从车的东、西北、西南三个方向出现，刷出来就冲最近的玩家；三个刷新点的地形高度都查过；
- 最后一波 25 秒后，给车旁 50 码内所有有这个任务的玩家完成。

完成条件没有做成"数击杀"：Huldar 自己也会参战，SkyFire 的 SmartAI 每次脱战都会把阶段和触发者清零，计数存不住；计时脚本不受脱战影响。打不过死掉的话，放弃任务重新接就会再来一次。

Huldar 原来没有 AI，已经刷出来的 Huldar 换不上新脚本，11 月 19 日经用户同意，在 Evan 在线时重启。Evan 接任务时事件还不存在，要放弃 309 再接一次。已确认：Evan 重新接任务后守住了车，交掉了 309。

### 5.3 Keep Your Hands Off The Goods!：挖掘场里找不到能点的文物

309 之后 Prospector Ironband 给 13650 Keep Your Hands Off The Goods!，要进挖掘场检查三件被巨魔占领时丢下的文物：Upturned Giant（倒地的巨人像）、Overdressed Woman（穿得很隆重的女人像）和 Broken Tablet（碎石板）。Evan 在挖掘场里转了一圈，找不到任何能点的东西。

本来就不该有能点的东西：三件文物是地图模型，任务目标是三个看不见、也选不中的计数 NPC（Ironband Sandal / Liberty / Tablet Artifact Bunny，33485～33487），刷新点就在雕像旁边。查客户端的 AreaTrigger.dbc，每个计数 NPC 脚下 1 码内正好各有一个区域触发器（5375、5376、5377，半径 11.3 码），客户端里还有三个对应的计数法术（63073～63075）。原版的做法是走到文物跟前、进入触发器就给计数。但服务器没给这三个触发器挂任何处理，TDB 4.4.2 里也没有，所以走到哪里都不会计数。

修复（`sql-custom/2026_11_19_11_keep_your_hands_off_artifacts.sql`，修复前两张表里都没有这三个触发器）：三个触发器挂上 `SmartTrigger`，各写一条 SmartAI，"进入触发器 → 给进入的玩家对应文物的计数"。玩家必须有这个任务才会记上。触发器脚本的对应关系只在启动时加载，11 月 19 日经用户同意，在 0 人在线时重启，启动日志正常。等 Evan 在游戏里确认。

### 5.4 Axis of Awful：任务说用伪装道具，可身上什么都没有

26868 Axis of Awful 要扮成植物，悄悄靠近和鱼人谈判的 Mosshide Representative，往他身上扔鱼人信息素。任务需要两件道具：Clever Plant Disguise Kit（60502）和 Potent Murloc Pheromones（60503）。Evan 接了任务，包里两样都没有。

接任务时服务器给的其实是 Cannary's Cache（60681），一个能打开的小箱子，两件道具应该装在里面。但这个箱子的掉落表是空的（TDB 4.4.2 里也没有），打开什么都拿不到，任务就做不了。两件道具本身没问题：伪装法术 82788 是正常的变形光环；信息素 82799 只能对 Mosshide Representative（44262）用，命中后给计数 44266，这一段在[《全局修复》](/Build-a-MoP-Server-2-Global-Fixes/)的批次里已经补过。

修复（`sql-custom/2026_11_19_12_cannarys_cache_loot.sql`，修复前掉落表为空）：给箱子加上两件道具，各 100%。`reload item_loot_template` 热加载，没有重启。已经开过空箱子的话，放弃任务再接一次，会重新拿到一个箱子。

全库查了"接任务给的物品可以打开、但掉落表是空的"：只剩暗月马戏团的 29361 Moat Monster!，只在活动期间出现，先放着。已确认：Evan 重新接任务拿到两件道具，伪装后靠近 Mosshide Representative 对他用信息素，拿到了计数。

## 第六章　暴风城

### 6.1 Hero's Call: Mount Hyjal!：暴风城的 Jademoon 送不过去

27726 Hero's Call: Mount Hyjal! 让玩家去暴风城要塞找 Cenarion Emissary Jademoon（15187），由她送去月光林地。Kiv 跟她对话，选 "Could you please send me to Moonglade, Emissary?" 以后什么都没发生。

在 TrinityCore 里，这个选项是这样接上的：只有接了 27726 才显示；选中后玩家自己施放 86587 Teleport to Moonglade，这个法术一个效果传送到月光林地的永夜港，另一个效果完成 27726 的目标。我们库里缺了三样：Jademoon 没有 SmartAI，选项没有响应；选项也没有显示条件，谁都看得到；86587 的传送效果要从 `spell_target_position` 读落点，而这一行也没有，就算施放了法术也不知道往哪儿传。部落那边的 Cenarion Emissary Blackhoof（15188，法术 86565）是完整的，坏的只有联盟这一边。

修复（`sql-custom/2026_11_21_03_jademoon_moonglade_teleport.sql`，修复前 15187 的 AIName 为空，其余几行都不存在）：按 TrinityCore 给 Jademoon 加上 SmartAI，选中选项时由玩家施放 86587；补上 86587 的落点（地图 1，7827.41, -2423.57, 488.81，和部落的 86565 几乎同一个位置）；加上"已接 27726 才显示"的条件。几张表都热加载过，但已经站在要塞里的 Jademoon 要重新刷出来才会换上 SmartAI，所以经用户同意重启了一次。已确认：Kiv 点这个选项后直接传到了月光林地。

## 第七章　东瘟疫之地

### 7.1 Hero's Call：Fiona 和 Gek 都是隐身的

暴风城英雄榜上的两个任务，28578 Hero's Call: Eastern Plaguelands! 和 28579 Hero's Call: Badlands!，分别要找东瘟疫之地 Thondroril 河东岸的 Fiona（45417）和圣光之愿礼拜堂的 Gek Nozzlerocket（48704）。Kiv 到了地方，两个人都找不到。

两人都有刷新点，位置也对，问题出在身上挂的光环：Fiona 是 49414 Generic Quest Invisibility 1（隐身类型 7），Gek 是 87871 Generic Quest Invisibility 21（类型 29）。这种"任务隐身"只有身上带着同类型侦测光环的玩家才看得见，侦测光环通常由 `spell_area` 在某个区域、某个任务状态下自动挂上。但整个东瘟疫之地没有任何一条 `spell_area` 会给类型 7 或 29 的侦测，接这两个任务时也不施放任何法术，TrinityCore 4.4.2 的数据也一样。结果就是普通角色永远看不见这两个 NPC。之前服务器上交过这两个任务的 3 个角色都是 GM，而 GM 能看见隐身单位，所以一直没发现。

影响比两个 Hero's Call 大：Fiona 是整条东瘟疫之地主线的起点（Into the Woods、Gidwin Goldbraids、Tarenar Sunstrike……一直到 Fuselight, Ho!），她看不见，这一整条线对普通角色都是断的。

修复（`sql-custom/2026_11_21_04_epl_fiona_gek_visible.sql`，修复前 `creature_template_addon` 里 45417 的光环是 `49414`、48704 是 `87871`）：清掉这两个光环。两人在全世界都只有一个刷新点，也没有单独的 `creature_addon`，不影响别处。这张表不能热加载，经用户同意重启了一次。已重启生效，还没上号验证。

## 第八章　湿地

### 8.1 The Threat of Flame：整张地图只有 6 只火元素

25927 The Threat of Flame 要杀 8 只 Rampant Fire Elemental（41449）。Evan 打到 5/8 以后发现怪太少：全世界只有 6 个刷新点，都在 Greenwarden's Grove 东北边那片着火的沼泽里，2 分钟刷新一次，也就是说地上最多同时只有 6 只，比任务要的还少。同一片火场里 Smouldering Ooze（41453）有 38 只。TrinityCore 4.4.2 只有 5 个刷新点，应该是当年抓包没抓全。

修复（`sql-custom/2026_11_21_05_threat_of_flame_spawns.sql`，guid 9100430–9100435）：按用户的要求翻倍到 12 只。新的 6 个点取自火场里 Smouldering Ooze 的位置（错开 4 码），每次挑离现有元素最远的那个，最后彼此相距都在 78 码以上，z 用地形高度加 0.2 码。其他字段照抄原有刷新点（120 秒刷新、不游走）。新刷新点要重启才会出现，经用户同意重启了一次。已确认：重启后 Evan 交了这个任务。

### 8.2 The Third Fleet：Fitzsimmons 不存在

顺着检查 Evan 在湿地的任务完成情况时发现，大地变迁版的湿地任务他几乎都做完了，只有米奈希尔港的 The Third Fleet 这一条线一个都没接过。原因是第一个发任务人 First Mate Fitzsimmons（1239）一个刷新点都没有，TrinityCore 4.4.2 里也没有。25815 The Third Fleet、25816 Cursed to Roam 都由他发，后面的 25817 The Cursed Crew → 25818 Lifting the Curse → 25819 The Eye of Paleth 全靠这两个前置，所以整条线接不到。任务要的蜜酒箱子（物体 203247）在旅店地窖里，这部分是好的。

修复（`sql-custom/2026_11_21_06_first_mate_fitzsimmons_spawn.sql`，guid 9100436）：在 Deepwater Tavern 一楼、Glorin Steelbrow 和 Kersok Prond 之间给他加一个刷新点。建筑里的地板不在地形数据里，z 取服务器导航网格上的高度（`tools/navpath`，0.7 码），朝向 Glorin。当时没人在线，直接重启生效，还没上号验证。

其余几个没做的湿地任务不是坏的：25736 The Floodsurge Core 是怪物掉落物品开始的可选任务（掉落正常），28565 Hero's Call: Wetlands! 和 26138 Ferilon Leafborn 是引导任务，Evan 是从别的路线进的湿地。

## 第九章　阿拉希高地

### 9.1 The Princess Unleashed：卷轴一用就"闪一下"

（同一条线上的 Myzrael's Tale 联盟、部落两个版本都能接，那是全库性质的问题，见[《全局修复》2.14](/Build-a-MoP-Server-2-Global-Fixes/#214-两个阵营的任务谁都能接1988-个任务缺种族限制)。）

26049 The Princess Unleashed 要在 Shards of Myzrael 用 Scroll of Myzrael（4472）召唤 Myzrael 并打败她。Evan 在碎片旁边用卷轴，施法条闪一下就没了，也没有报错。

卷轴施放的是 4141 Summon Myzrael。这个法术本身只发一个事件（420），由事件脚本在碎片那里召唤 Myzrael（2755），这部分我们库里是好的，和 TrinityCore 一致。卡住的是施法条件：4141 要求附近有一个"法术焦点 5"的物体，没有就直接拒绝施法。整个库里只有一个专门为此准备的焦点物体，是 SFDB 自己加的 300139 "TEMP Shards of Myzrael"（模型是个小苹果，作用半径 10 码），但它从来没有刷新点。TrinityCore 4.4.2 里连这个模板都没有。

修复（`sql-custom/2026_11_21_08_shards_of_myzrael_spell_focus.sql`，guid 9100401）：在 Shards of Myzrael 原位刷一个 300139，往下沉 0.6 码，让苹果藏在碎片模型里。新物体要重启才会出现，经用户同意重启了一次。已重启生效，还没上号验证。

另外，库里的 Myzrael 还是旧版本的数据：44 级精英，而大地变迁版这个任务是 28 级、建议 2 人。用户决定先让 Evan（33 级）试试，打不过再调。
