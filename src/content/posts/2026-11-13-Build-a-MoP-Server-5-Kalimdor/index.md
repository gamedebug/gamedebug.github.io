---
title: "建造自己的魔兽世界（熊猫人之谜）（五）：卡利姆多"
date: 2026-11-13
slug: "Build-a-MoP-Server-5-Kalimdor"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "熊猫人服务器卡利姆多的任务修复：黑海岸、灰谷。"
---

这是《建造自己的魔兽世界（熊猫人之谜）》系列的第五篇。

这个系列一共五篇，按大地图分篇，篇内按地图区域分章：

1. [选型与部署](/Build-a-MoP-Server/)：服务器选型、部署、配置和客户端设置，以及修复进度和待办
2. [全局修复](/Build-a-MoP-Server-2-Global-Fixes/)：全库任务审计、批量修复，以及影响全服的问题
3. [新手村](/Build-a-MoP-Server-3-Starter-Zones/)：熊猫人、矮人、狼人、德莱尼、侏儒、死亡骑士的新手村任务修复
4. [东部王国](/Build-a-MoP-Server-4-Eastern-Kingdoms/)：东部王国各地图的任务修复
5. **卡利姆多**（本篇）：卡利姆多各地图的任务修复

## 第一章　黑海岸

### 1.1 黑海岸：找不到的幸存者

The Last Wave of Survivors（13518）要找海岸边的 4 个幸存者，实测沿海岸跑了一个来回一个都没看到。原因是 11 月 13 日补刷新点时位置是我估的，放在了奥伯丁废墟里，离任务地图标记差了大约 1000 码。改成把每个幸存者放到对应目标的 `quest_poi` 标记点上（`sql-custom/2026_11_15_38_last_wave_of_survivors_positions.sql`），重启后 4 个都能找到并计数。以后补刷新点一律先看任务标记，不再估位置。

### 1.2 Call Down the Thunder：Boss 不下来

13558 要用码头尽头仪式平台上的 Aetherion Ritual Orb（194145）把元素领主 Aetherion（33041）召下来打。实测没看到 Boss。Aetherion 其实一直在：站在码头外约 70 码、高约 55 码的一处结构上，带着"对玩家免疫"。宝珠被使用时会触发事件 20898，但这个事件在这边和 TDB 4.4.2 里都没有任何脚本，用了宝珠什么也不发生。

补了一个简化版事件（`sql-custom/2026_11_15_42_call_down_the_thunder_aetherion.sql`）：宝珠的 SmartAI 在事件 20898 时通知 Aetherion；Aetherion 解除免疫，飞到宝珠旁边的平台上（落点用 vmap 查过，平台地面约 21 码高），攻击最近的玩家；脱战时恢复免疫飞回原位。战斗技能 Blast of Air（击退）按 TDB 4.4.2 的间隔保留。

第一次实测仍然没反应。gdb 跟踪显示宝珠的 `SmartGameObjectAI::EventInform` 触发了，但 Aetherion 的 `SetData` 没被调用：`SMART_TARGET_CREATURE_GUID` 按 GUID 找生物时，搜索半径取的是发起者的格子激活范围，普通游戏物件这个值是 0，所以从宝珠出发永远找不到。改成 `SMART_TARGET_CLOSEST_CREATURE`（entry 33041，100 码内）。另外，宝珠带"仅任务需要时可交互"标志，"使用宝珠"一旦计数客户端就不让再点，所以重启时趁角色离线把这一项进度清零。

第二次实测：宝珠事件、`SetData`、`SetFly` 都走到了，Aetherion 解除免疫可以打，打完掉落 Aetherion's Essence，任务能完成。但他没有飞到平台上，还停在原来的高处，玩家 20 级可以飞上去打。用户决定能跑通就不再动这一处。

### 1.3 Elune's Fire：Horoo 是绿名

13582 要从 Horoo the Flamekeeper（34385）身上拿 Elune's Torch。火炬是他的任务掉落（[《全局修复》2.4](/Build-a-MoP-Server-2-Global-Fixes/#24-任务物品打不出来378-条缺失的任务掉落) 批量补回的那批里就有），也就是要把他打死。实测 Horoo 是绿名，打不了。

Horoo 的阵营模板是 1924（阵营 1065 "Monster, Zone Force Reaction 1"），对玩家本来是敌对的。但同一位 NPC 给的 The Wildkin's Oath（13583）奖励一个永久光环 Force Reaction 1（61899），把阵营 1065 对玩家强制改成友好，好让枭兽变成盟友。先交了 13583 的玩家，Horoo 就跟着变成友好，任务卡死。TDB 4.4.2 也是这样配置的。

修复（`sql-custom/2026_11_16_01_horoo_hostile_faction.sql`）：Horoo 单独改用普通敌对怪物阵营 14，等级、技能、掉落不变；黑海岸其他用 1924 的只有 Wildkin Spirit，本来就该在立誓后变友好，不动。经同意重启后生效。

### 1.4 Soothing the Elements：图腾放不出来

13580 要在 Jagged Reef 顶上放 Energized Soothing Totem。放图腾的技能 65361 需要施法焦点 1610。TDB 4.4.2 有这个焦点的模板（195059），但没有刷新点，所以 11 月 13 日我补了一个自定义焦点 910101。当时的位置是估的，离任务地图标记（5558, 492）大约 32 码；范围填的是 20，而核心代码会除以 2，实际只有 10 码。站在标记点放不出来。

修复（`sql-custom/2026_11_16_02_jagged_reef_focus_position.sql`）：焦点移到标记点和坡顶之间（5552, 478, 24），范围改成实际 30 码，模型改用其他焦点物件的 1407。经同意重启后生效，等游戏里验证。这是第二个因为估位置出错的任务（另一个是 [1.1](#11-黑海岸找不到的幸存者)）。

实测图腾放出来了，两波元素之后仪式完成，任务计数。

### 1.5 Leave No Tracks：接任务窗口里只有"完成任务"

13892 的 NPC 打开后是任务窗口，但按钮是"完成任务"，点了没反应。gdb 跟踪显示，一点 NPC，服务器就直接发了交任务的 `SendQuestGiverRequestItems`，玩家点按钮后发来的是 `CMSG_QUESTGIVER_CHOOSE_REWARD`，而这个任务根本没接。

原因在 `Player::SendPreparedQuest`：NPC 身上只有一个可接任务时服务器会直接打开它，条件里有 `|| quest->HasFlag(QUEST_FLAGS_AUTOCOMPLETE)`，任务带 0x10000 标志就打开交任务窗口而不是接任务窗口。这个写法来自 TrinityCore 早年的代码，当时 `IsAutoComplete()` 也看这个标志；SkyFire 后来把 `IsAutoComplete()` 改成只看 Method 0（接了就算完成），注释也写明 0x10000 只管完成后的远程交任务提示，但这几处没跟着改。库里带这个标志的普通任务有 380 个。同样的写法还在 `HandleQuestgiverQueryQuestOpcode`（从任务列表里点任务）和组队共享任务里。

修复（`patches/2026_11_16_02_quest_autocomplete_flag_details.patch`）：三处都只在 `IsAutoComplete()` 时直接发交任务窗口，其余发接任务窗口。任务数据没动，完成后的远程交任务提示不受影响。编译后经同意重启上线，等游戏里验证。

实测可以正常接任务了。

### 1.6 Consumed：湖底的东西点不了

13881 要调查熊喝水的湖。湖底能看到 Devouring Artifact（195057），但它是类型 5 的纯装饰物件，本来就不能点。这一项目标在这边是 DUMMY 类型（`quest_objective` type 10，对象 0）；TDB 4.4.2 的 `quest_objectives` 里它是"进入区域触发器 5449"，5449 就在湖底那件物品旁边，半径 12 码。这边进入区域触发器后靠 `areatrigger_involvedrelation` 找关联任务、给 DUMMY 目标记完成，可这张表里没有 13881。

顺着查了全库：TDB 4.4.2 里靠区域触发器完成、这边也有 DUMMY 目标的现存任务 87 个，缺关联的 52 个。补了 49 条（`sql-custom/2026_11_16_03_restore_areatrigger_quest_links.sql`）；另外 3 条的触发器已经关联了别的任务（171、4200、4201），这张表一个触发器只能对应一个任务，保留原样。14482 和 28732 在参考库里各有两个触发器，这边只有一个 DUMMY 目标，两个都关联上，进任意一个算完成，和客户端显示的目标一致。用 `reload areatrigger_involvedrelation` 热加载，没有重启。

### 1.7 The Seeds of Life：三颗种子只有一颗能拿

13882 要收集大地、海洋、天空三颗种子。查下来只有海洋种子有来源（19 个 Glittering Shell 宝箱，位置和任务标记一致）。另外两颗：

- **大地种子（46354）：** 任务标记就是站在交任务处旁边的 Onu（33072）。他有一个对话选项"Ancient Onu, where may I find a Seed of the Earth?"，回答是从头上摘一颗橡果给你，但这个选项的 `OptionNpcflag` 是 0，被服务器隐藏了，也没有给物品的脚本。
- **天空种子（46355）：** 任务标记覆盖的是 Darkshore Wisp（34306，对玩家友好）活动的区域；创建种子的法术 65125 叫 "Capturing"，但没有任何东西会施放它。

两颗种子在 TDB 4.4.2 里同样没有实现。修复（`sql-custom/2026_11_16_04_seeds_of_life_earth_sky.sql`）：Onu 的选项改为可见，选了给大地种子；小精灵加点击，点了由玩家自己施放 65125 得到天空种子，小精灵随后消失、2 分钟重刷，刷出时放参考库里的闪光效果。都只在接了任务、包里还没有这颗种子时生效。经同意重启后生效，等游戏里验证。

同一次还确认了 The Bear's Blessing（13544）的 Ancient Bear Statue 有刷出来，位置和参考库一致，只是离任务标记约 26 码、施法范围 5 码。

### 1.8 Cleansing the Afflicted：灵魂是友方

13545 要先对 Blackwood Hold 的熊怪用 Blessed Herb Bundle（44889），再杀掉出现的 Spirit of Corruption（33000）7 只。灵魂能刷出来，但任务不计数。法术 62092 的召唤没问题；问题在灵魂的模板：阵营 35（友方）、1 级，玩家打不了它，也就拿不到击杀。TDB 4.4.2 里它是阵营 14（敌对）。

修复（`sql-custom/2026_11_16_07_spirit_of_corruption_hostile.sql`）：阵营改成 14，等级改成和 Blackwood Furbolg（33084）一样的 17–18。热加载 `creature_template`，没有重启。已经刷出来的友方灵魂不会变，之后新召唤的才是敌对的。已在游戏里确认能计数。

### 1.9 In Defense of Darkshore：Orseus 的选项看不见

13885 原本要找 Orseus（34392）借一只角鹰兽，从空中保护鹿、熊和夜刃豹各 8 只。空中场景从来没实现过，11 月 13 日的处理是跳过场景：选他的对话选项"Orseus, Kathrena sent me to borrow one of your Hippogryphs."直接给全部 24 个计数（见 [《全局修复》1.12](/Build-a-MoP-Server-2-Global-Fixes/#112-批次八侏儒黑海岸狼人新手区)）。但在游戏里和他说话只有一段文字，没有这个选项。

原因和 [1.7](#17-the-seeds-of-life三颗种子只有一颗能拿) 的 Onu 一样：选项的 `OptionType` 和 `OptionNpcflag` 都是 0，服务器只显示 `OptionNpcflag` 和 NPC 标志有交集的选项，所以它永远不出现，SmartAI 也就等不到玩家选择。修复（`sql-custom/2026_11_16_08_orseus_gossip_visible.sql`）：改成 1 / 1，热加载 `gossip_menu_option`，没有重启。已在游戏里确认，任务完成。

顺便查了全库"有 SmartAI 等玩家选、选项却被隐藏"的情况：除了旅店老板的重复选项，只剩 Grek（纳格兰）、暗月马戏团传送法师和一个游戏物体的对话，都不在现在的路线上，暂不处理。

### 1.10 The Devourer of Darkshore：树苗用不了

13891 要在 Grove of the Ancients 南边浅湖的岸边用 Lifebringer Sapling（46370），召出湖底 Devouring Artifact 的守护者 Yoth'al the Devourer（34331）并打死它。树苗的法术 65207 要求附近有施法焦点 1608，然后发送事件 21674。三块都缺：焦点物体 Consumed Watering Hole（195028）没有模板也没有刷新点（TDB 4.4.2 只有模板），事件 21674 没有脚本，Yoth'al 没有刷新点，模板还是友方阵营 35、1 级、没有 AI。

修复（`sql-custom/2026_11_16_09_devourer_of_darkshore.sql`）：

- 焦点模板照参考库补上（`data1` 改成 60，这个核心的施法范围是 `data1 / 2`，即 30 码），刷在湖心水面 (4809, 106, 48.9)，正好在 Devouring Artifact 上方，位置检查通过。
- 事件 21674 在湖心召唤 Yoth'al，5 分钟后消失。
- Yoth'al 改成敌对（16）、19 级，加上参考库里的三个技能（暗影箭、暗影新星、精神鞭笞），出现后直接攻击召唤者。
- 树苗只在任务未完成、80 码内没有 Yoth'al 时能用，避免连用叠出好几个。

新加了物体模板，经同意重启后生效。已在游戏里确认，任务完成。

### 1.11 The Titans' Terminal：哪里都 "Requires %"

13918 要在 Remtravel 挖掘点附近的海滩上用 Buried Artifact Detector（46388）找 5 个 Ancient Device Fragment（46702），右键合成 Ancient Slotted Device。探测器在哪里用都提示 "Requires %"：法术 65300 Ping for Artifact 要求施法焦点 1612，焦点物体 Remtravel Excavation Beach（195085）没有模板也没有刷新点，客户端连它的名字都查不到，于是只剩一个 `%`。

后面的环节也是空的：海滩上有 90 个看不见的 Buried Treasure Bunny（34356），没有任何脚本；掉碎片的 Buried Debris（195055，掉落表 27251）一个刷新点都没有。DBC 里能看出原版的连法（65300 → 65305 Artifact Pings Back → 65306 Summon Buried Treasure Pile），但参考库里同样没有实现。

修复（`sql-custom/2026_11_16_10_titans_terminal.sql`）：

- 焦点模板照参考库补上（`data1` 140，即 70 码），在海滩上刷 10 个，位置用贪心算法选出，盖住全部 90 个 Bunny。
- 65300 的作用范围（20 码）限定到 Bunny；被扫到的 Bunny 在原地冒出一堆 Buried Debris，60 秒后消失，同一个 Bunny 2 分钟内只冒一次。土堆本身只有接了任务的人看得见。
- 经同意重启后生效。

测试时土堆能冒，但开出来只有灰色垃圾。原因是碎片设成了"只有任务需要时才掉"（`-100`），而服务器判断"任务需要"只看任务目标和任务的来源物品，碎片两样都不是（目标是合成后的装置）。第二个修复（`sql-custom/2026_11_16_11_titans_terminal_fragment_source.sql`）：碎片改成 100% 掉落（参考库也是 100%），热加载；同时把碎片登记为任务来源物品，需要 5 个，这一项要改任务表，热加载 `quest_template` 会删掉所有任务对象，有人在线时不安全，等下次重启生效。已在游戏里确认：碎片进背包，合成后任务完成。

## 第二章　灰谷

### 2.1 Of Their Own Design：桌上的野火瓶拿不到

13595 在 Bathran's Haunt，由 Bathran 的灵魂发布：去对面被遗忘者草药师的桌子上拿一瓶 Bottle of Wildfire（44967），扔到东北边 Bathran 的遗体上把它烧掉。玩家反馈 NPC 让去烧东西，但没给道具。

这个瓶子本来就不是 NPC 给的，而是要从草药师桌上的 Potion of Wildfire（194202，刷新点 76676，旁边还有一团装饰火焰 194203）里拾取。物体在，任务也把 44967 登记成了来源物品，问题出在拾取：这个箱子的拾取表编号（`data1`）是 0，`gameobject_loot_template` 里也没有对应的行，点开什么都没有，这个物品在整个库里没有任何来源。核心在拾取表编号为 0 时不做任何兜底。扔瓶子那一段（法术 62506 只能对 Bathran's Corpse 33183 施放，遗体被打中给施法者计数）是好的。

修复（`sql-custom/2026_11_22_01_of_their_own_design_wildfire_loot.sql`）：照 TDB 4.4.2 把 `data1` 设成 26865，并加一行拾取：26865 → 44967，任务需要时 100% 掉落（`-100`）。物体模板不能热加载，0 人在线时直接重启生效。还没在游戏里验证。


### 2.2 Bathed in Light：药剂在哪里用都 "Requires %s"

13642 由 Orendil Broadleaf 发布：把 Unbathed Concoction（45065）带到西边的 Lake Falathim，在 Elune 的月光下"沐浴"，变成 Bathed Concoction（45066）。药剂一用就提示 "Requires %s"，和黑海岸的 [1.11](#111-the-titans-terminal哪里都-requires-) 是同一类问题：法术 62981 要求附近有施法焦点 1600，可库里没有任何物体模板带这个焦点，客户端连焦点的名字都查不到，只剩一个占位符。

湖边那道看得见的月光（Light of Elune，194651）是好的，但它只是装饰物体，不是施法焦点。TDB 4.4.2 有焦点模板（194343 Light of Elune Spell Focus，服务器端隐形物体），但同样没有刷新点。

修复（`sql-custom/2026_11_22_02_bathed_in_light_spell_focus.sql`）：照参考库补上模板，刷在那道月光的正中（3073.65, 616.10, 6.46），位置检查通过。这个核心的施法焦点范围是 `data1 / 2`，即 4 码，所以要站进月光里用药剂。新加了物体模板，经同意重启后生效。还没在游戏里验证。

### 2.3 Respect for the Fallen：塔下的锤子拿不到

13626 要从两具遗体上取回遗物：塔顶 Delgren the Purifier（33347）身上的祈祷书（45043），塔下 Feero Ironhand（33348）身上的圣锤（45042）。这个任务在[《全局修复》1.13](/Build-a-MoP-Server-2-Global-Fixes/#113-批次九119-级任务物品的人工清单)里修过：两具遗体都加了右键点击，点击者对遗体施放 62839 / 62837。书由 SAI 直接放进背包；锤子则是遗体被 62837 打中后，再对玩家施放 DBC 里现成的 62838 Create Feero's Holy Hammer。

实测书能拿到，锤子拿不到：鼠标指针会变成拾取，点了没有任何反应。两具遗体的模板、点击法术、条件、光效光环都一样，唯一的差别是最后一步：书是脚本直接加物品，锤子是让遗体施放 62838。我先按这个差别改了（`sql-custom/2026_11_22_03_respect_for_the_fallen_hammer.sql`：锤子改成由 SAI 直接把 45042 放进背包，热加载），但实测还是拿不到，说明点击那一步就没成功。

真正的差别在环境：点击时由玩家自己施放 62837 / 62839，走普通施法检查，而这两个法术都带 `SPELL_ATTR0_CANT_USED_IN_COMBAT`（战斗中不能使用，DBC 原样）。Delgren 在塔顶，周围没有怪；Feero 倒在塔下，身边有 20 个敌对的 Horde Invader（33334），走过去就会进入战斗，这时点遗体会被服务器拒绝。这是原版设计，不算坏，所以没有去掉这个限制：清掉附近的敌人、脱离战斗再点。上面那个 SAI 改动和原来的做法效果相同，保留。还没在游戏里验证。

### 2.4 Astranaar's Burning!：看不到起火

13849 由阿斯特兰纳的 Sentinel Thenysil（4079）发布：给一个水桶（46094），把镇上 15 处火扑灭。接了任务以后镇上一处火都没有，水桶也没有目标。

一开始怀疑是相位问题，但这些火其实不靠相位：45 个火焰点（Astranaar's Burning! Fire Bunny，34123）都在 0 相位，全在 Astranaar（区域 415）里，跟参考库一样。它们身上挂着两道光环：52855 是火焰光效，64573 "Astranaar's Burning!: Invisibility" 是 7 号隐身。原版的做法是接任务的玩家在镇上带着 64572 "Astranaar's Burning!: See Invisibility 01"（7 号隐身侦测），这样只有做任务的人能看到火。DBC 里这个法术是现成的，但 SFDB 和 TDB 4.4.2 都没有让玩家获得它的地方（`spell_area`、SAI、脚本都没有），所以火对所有人都是隐身的，水桶自然也选不到目标。

修复（`sql-custom/2026_11_22_04_astranaars_burning_see_fires.sql`）：

- `spell_area` 加一行：在区域 415、任务 13849 进行中（状态掩码 8，只在未完成时）自动加上 64572；火扑够 15 处后光环自动消失。
- 火焰点原来的 SAI（[《全局修复》1.7](/Build-a-MoP-Server-2-Global-Fixes/#17-批次三任务物品的标记法术没人接) 加的：被 64558 水桶打中给施法者计数）后面接一步：0.5 秒后消失，120 秒后重刷。原来扑过的火还亮着，还能反复计数；现在扑灭的火会熄掉，跟原版一样每处火只算一次。备份 `backup/fire_bunny_34123_sai_20261122.tsv`。

`spell_area` 不能热加载（会留下悬空指针，见[《新手村》Trolling for Information](/Build-a-MoP-Server-3-Starter-Zones/#24489-trolling-for-information偷听不到巨魔说话)），经同意重启后生效（当时 Vanhelsing 在线）。还没在游戏里验证。
