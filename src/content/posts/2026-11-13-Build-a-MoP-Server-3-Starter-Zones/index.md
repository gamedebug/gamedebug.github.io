---
title: "建造自己的魔兽世界（熊猫人之谜）（三）：新手村"
date: 2026-11-13
slug: "Build-a-MoP-Server-3-Starter-Zones"
category: "ACG"
tags:
  - "私服"
  - "魔兽世界"
  - "Docker"
description: "熊猫人服务器的新手村任务修复：熊猫人新手岛、矮人、狼人、德莱尼、侏儒和死亡骑士的新手村。"
---

这是《建造自己的魔兽世界（熊猫人之谜）》系列的第三篇。

这个系列一共五篇，按大地图分篇，篇内按地图区域分章：

1. [选型与部署](/Build-a-MoP-Server/)：服务器选型、部署、配置和客户端设置，以及修复进度和待办
2. [全局修复](/Build-a-MoP-Server-2-Global-Fixes/)：全库任务审计、批量修复，以及影响全服的问题
3. **新手村**（本篇）：熊猫人、矮人、狼人、德莱尼、侏儒、死亡骑士的新手村任务修复
4. [东部王国](/Build-a-MoP-Server-4-Eastern-Kingdoms/)：东部王国各地图的任务修复
5. [卡利姆多](/Build-a-MoP-Server-5-Kalimdor/)：卡利姆多各地图的任务修复

## 第一章　熊猫人新手岛

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

### 29423 补记：放弃任务后 Huo 还一直跟着

熊猫人岛 29423 The Passion of Shen-zin Su 接任务时，脚本 `npc_huo` 给玩家放 128700 Summon Spirit of Fire，召出跟随的 Huo（54958）。这个召唤（SummonProperties 3277）走的是普通临时召唤，和任务没有关联；放弃任务时服务器只删任务，不管 Huo，于是他会一直跟着，直到重新登录。

修复（`patches/2026_11_17_02_questhandler_cumulative_incl_abandon_unsummon_huo.patch`，备份 `backup/QuestHandler.cpp.bak-20261117`）：`HandleQuestLogRemoveQuest` 放弃任务后，查一张"任务 → 跟随者 → 召唤光环"的小表：去掉召唤光环，并收回 200 码内由这个玩家召出的同 ID 生物。表里目前只有 29423 / Huo，以后碰到同类问题往里加一行就行。只改了 `QuestHandler.cpp`，和 [《全局修复》2.7](/Build-a-MoP-Server-2-Global-Fixes/#27-打完怪脱不了战斗) 一起在 11 月 17 日编译上线，等游戏里验证。

### 小结

| 类别 | 任务 |
|---|---|
| 上游误删脚本，已恢复或简化重写 | 29663、29792、29794、30767、29799 |
| 相位问题 | 29423（两处）、29786、29421 |
| 核心通用 bug | 区域相位不刷新、跳石法术默认效果、Evade 状态卡住 |
| 数据缺失 | 31450（对话标记、两个交任务 NPC 没有刷新点） |
| 不是 bug | 29770、29661 |

## 第二章　矮人新手村

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
- **验证：** 11 月 19 日用侏儒角色 Evan 重走这个任务，插旗后人物和镜头都不再卡，确认修好。

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

## 第三章　狼人新手村（吉尔尼斯）

### 3.1 吉尔尼斯城：两段骑马任务和一个相位 bug

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

我的猜测是：`Unit::_ExitVehicle` 先发"恢复重力"，紧接着给玩家启动一段"从载具上下来"的移动路径，客户端在这段路径结束时，又把开始时的无重力状态还原了回去。按这个猜测加了一个保险：玩家下载具 1.5 秒后，如果没有坐上别的载具，也没有悬浮或飞行光环，就再发一次"恢复重力"（`patches/2026_11_15_02_unit_cumulative_incl_exit_vehicle_gravity_resend.patch`）。

**11 月 20 日更正：这个保险从来没有真正生效过。** 死亡骑士新手村又遇到了一次（见 [6.2](#62-into-the-realm-of-shadows接了任务又不能跳而且看不到任务怪)），这才找到原因：卡住的客户端在之后每次报告移动时都带着"无重力"标志，而服务器会把客户端报上来的移动标志原样抄进自己的记录。保险的判断条件里有一条"服务器认为玩家没有处在无重力状态"，所以正好在需要它的时候被跳过。原地传送也没用，因为服务器把这份错误的标志又发回给了客户端。改法和验证情况见 [6.2](#62-into-the-realm-of-shadows接了任务又不能跳而且看不到任务怪)。

#### Exodus：马车没有，相位 186 也没有

Exodus（24438）原版是在庄园下方坐马车离开，中途翻车，落在沼泽边的 Prince Liam（37065）身边。数据库里马车（Stagecoach Harness 38755、Stagecoach Carriage 44928）在 SFDB 和 TDB 4.4.2 里都没有刷新点和脚本，乘车这段整个缺失；更糟的是 Liam 所在的 186 号相位（Exodus 之后整片乡下，579 个刷新）没有任何 `phase_area`，跑过去也看不到人。

按 186 号相位全部刷新所在的 12 个区域配上相位，条件是接了 / 完成 / 交了 Exodus（`sql-custom/2026_11_15_18_gilneas_phase_186.sql`，热加载）。测试角色跑到翻车地点交了任务。马车剧情暂时不做；187～191、194 号相位也还没配置，做到时再补。

#### Exodus 之后的三个任务

- **Stranded at the Marsh（24468）**：要"救 5 个幸存者"，实际目标是杀 5 只 Swamp Crocolisk（37078）。11 个 Crash Survivor（37067）没有任何可交互标志和脚本，37078 一只都没刷（TDB 也一样）。改成：接了任务和幸存者对话，就在玩家身边召唤一只鳄鱼扑过来，幸存者 3 秒后离开、60 秒重刷（`sql-custom/2026_11_15_19_stranded_at_the_marsh.sql`）。第一版鳄鱼能出来却不计数：击杀计数要求玩家打出至少一半血量的伤害（`Creature::IsDamageEnoughForLootingAndReward`），旁边的 NPC 经常抢掉。按用户的意思改成"参与就算"：召唤一只复制出来的替身鳄鱼 910003，它死时（不管谁杀的）给 30 码内的玩家记 37078，替身本身不是任务目标，所以不会重复计数（`sql-custom/2026_11_15_20_stranded_at_the_marsh_shared_credit.sql`）。
- **Preparations（24628）**：月叶（GO 201914）能采，读条结束却什么都没有。gdb 显示服务器生成了掉落、也走到了任务物品那一步，但月叶从没进过掉落列表：掉落表这一行的 `lootmode` 是 0，而 `LootTemplate::Process` 只放入 `lootmode & 1` 不为 0 的条目。全库查到 19 行同样问题（9 个游戏物件掉落，含奥特兰克 Frostwolf Maps、Dusty Journal、Borrowed Tabard；10 张感恩节食谱），全部改成 1 并热加载（`sql-custom/2026_11_15_21_lootmode0_rows.sql`）。
- **Losing Your Tail（24616）**：要打的 Dark Scout（37953）没有刷新，也没有东西施放"召唤 Dark Scout"（70795），阵营还是友好的 35。阵营改成 TDB 的 118，接任务时在玩家身边召唤一个攻击玩家，死时给 30 码内的玩家计数（`sql-custom/2026_11_15_22_losing_your_tail.sql`）。原版用护符挣脱定身的一段没有重做。

三个任务都已在游戏里完成。

#### Emberstone 一带：掉率、钥匙和客户端缓存

- **Last Meal（24675）**：Brown Stag 掉 Side of Stag Meat 原本 50%，按用户要求改成 100%（`sql-custom/2026_11_15_23_last_meal_drop_rate.sql`，热加载）。
- **矿洞里空无一人**：Emberstone Mine 内部是 WMO 区域 4732，不在 186 号相位里，一进矿洞监工和村民全看不见。和庄园内部（4817）是同一类问题，这次把 4714 下所有漏掉的 33 个子区域都补进 186 号相位（`sql-custom/2026_11_15_25_gilneas_phase_186_all_subareas.sql`，热加载）。
- **Liberation Day（24575）**：23 个 Ball and Chain（201775）的锁 1851 要 Slaver's Key（49881），但这把钥匙在 SFDB 和 TDB 里都没有任何掉落来源，Forsaken Slavedriver（37701）连掉落表编号都是 0。给监工加上必掉钥匙（`sql-custom/2026_11_15_24_liberation_day_slavers_key.sql`）。

  有了钥匙，铁球还是点不动：鼠标指针会变，点下去服务器什么请求都没收到（gdb 在 GO 使用、施法、物品使用的处理函数上都没断到），而服务器给这些铁球发的是"可交互 + 闪光"（`ActivateToQuest` → `HasQuestForGO` 返回 1）。换做法：去掉钥匙锁，改用任务编号控制（data1 = 24575），用后 60 秒复原；村民被 Rescue Enslaved Villager（70354）命中后 3 秒离开、2 分钟重刷（`sql-custom/2026_11_15_26_liberation_day_ball_and_chain.sql`）。改完重启，小退也还是点不动，最后是**删掉客户端的 `Cache` 文件夹**才好：客户端把物件模板缓存在本地，不会重新向服务器要，服务器改了锁它也不知道。以后改了 `gameobject_template` 的锁、类型这类字段，都要让玩家清一次缓存。任务已完成。

#### 吉尔尼斯城之战：关着的城门和之后的相位

**The Battle for Gilneas City（24904）** 原版是在城门口和 Krennan Aranas 对话，跟着 Liam 打进城。这场战斗在 SFDB 和 TDB 里都没有脚本。11 月 13 日批量审计时，我给 Lorna Crowley 加了"接任务直接计完成"（`sql-custom/2026_11_13_24_gilneas_quests.sql`），这等于跳过了整场战斗，当时应该先问用户，记在这里。

接了任务以后城门一直关着。我先判断错了：城门附近没有门物件，我用新写的水平视线工具（`tools/vmapcheck/losline.cpp`，读服务器自己的碰撞数据）测，以为门口是通的，就让 Krennan 的开战选项 "Let us take back our city!" 把玩家传送进门里。结果只往前送了一小段，真正的城门还要再往里 55 码，在 (-1422, 1344)，我测的那几条线根本没穿过它。重测这个位置：默认替换地形 638（地震前的城）在那里有一道实心的墙，而原始地图 654 那里是空的，城门是 187 号相位里单独的门物件 195578（`worgen_citygate01`，刷出来就是开着的）。所以 638 应该在战斗开始后停用：给它加条件，只有 24904 没接、没完成、没交时才生效（`sql-custom/2026_11_15_28_gilneas_city_gate_terrain_638.sql`）。Krennan 那个选项当时也不显示：`gossip_menu_option` 里它的 `OptionNpcflag` 是 0，`Player::PrepareGossipMenu` 会跳过和 NPC 的 npcflag 对不上的选项。改成普通对话选项。全库还有 1176 个选项的 npcflag 是 0，不一定都坏，以后排查。

相位（`sql-custom/2026_11_15_27_gilneas_city_phase_187.sql`、`_29_gilneas_city_phases_187_188_190.sql`），区域和 186 号一样是 4714 下全部 45 个子区域：

| 相位 | 内容 | 条件 |
|---|---|---|
| 187 | 战时的城，Lorna Crowley（38611，旅店里）、Liam 和约 500 个刷新 | 24904 接了 / 完成，或交了 24904 且没交 24903 |
| 190 | Greymane Court：国王 Genn（38539）、Liam 的遗体、Forsaken General | 交了 24902，且没交 Knee-Deep（24678） |
| 188 | 城东瘟疫：投石车、Forsaken Invader、蝙蝠、Krennan（38144） | 接了 / 完成 / 交了 24920（暂时不设结束） |

第一版 187 只配到 24904 交掉为止，结果一交任务 Lorna 就消失了，可她还要发 24902 和 24903，于是改成上表。**The Hunt For Sylvanas（24902）** 在数据库里没有任何目标，原版跟着 Tobias Mistmantle 看的那段剧情 NPC 根本没刷，所以接了就是完成，剧情没有补。

以上门和相位都在游戏里确认过：进了城，Lorna、国王都能看到，24902、24903 已交。

#### Slowing the Inevitable：缴获的蝙蝠

**24920** 要骑 Captured Riding Bat 炸掉 6 辆投石车和 40 个 Forsaken Invader。前前后后改了五轮（都在 `sql-custom/2026_11_15_30_captured_riding_bat.sql`，备份 `backup/captured_riding_bat_20261115.tsv`）：

1. **点不了**：国王旁边的蝙蝠（38615）有点击法术 72472，但 npcflag 是 0，客户端不给点。加上 SPELLCLICK 以后还是不行：38615 自己也挂了载具 641，而这个载具的座位没有"可上下"标志，`Vehicle::Vehicle()` 发现没有可用座位，又把 SPELLCLICK 去掉了。它只负责召唤，不需要载具，改成 VehicleId 0。
2. **点了骑不上**：72472 召唤 38540，召唤属性 161 属于载具类，可 38540 的 VehicleId 是 0，`EffectSummonType` 召唤完一看不是载具就返回了，不会让玩家上去。给它配载具 641（座位可操控、可施法），动作条是原有的 Iron Bomb（72246）和 Fly Back（72849）。原版是蝙蝠按固定路线飞，现在是玩家自己操控。座位不能主动下，所以 Fly Back 时先给骑手挂降落伞（45472）再让蝙蝠消失。
3. **炸弹连自己一起炸**：炸弹伤害 72247 的目标类型是"区域内指定生物"（TARGET_UNIT_DEST_AREA_ENTRY），要靠 `conditions` 来限定打谁，可这里一条都没有，于是 32 码内全都炸，第一颗就把蝙蝠自己、门口那只能点的蝙蝠和两个民兵炸死了。限定为 Forsaken 投石车、Invader、Plaguesmith，后来又加上国王附近的 Forsaken Invader（39015，同名不同编号，不算任务进度）和 Forsaken Infantry。门口那只蝙蝠原来 2 小时才重刷，改成 60 秒（`sql-custom/2026_11_15_31_captured_riding_bat_respawn.sql`）。
4. **炸了不掉血**：我先以为是等级：骑乘蝙蝠是 1 级，Forsaken 是 10～11 级，差 10 级法术大多会被抵抗，于是改成 11 级。改完还是不掉血，真正的原因是玩家炸的是国王附近那批 39015，不在第 3 步的名单里（见上）。等级的修改留着，它到底有没有影响没有单独验证。
5. **飞不起来**：这个比较绕。38540 原来的 InhabitType 4 让它一刷出来就带"可飞"标志，骑上时飞行光环（34873）调 `SetCanFly(true)`，发现标志已经有了就直接返回，什么都没发。改成刷出来不带、骑上 1 秒后再上光环，还是飞不起来。看 `Movement::PacketSender` 才明白：只有对象**本身是玩家**时，服务器才发客户端控制用的 `SMSG_MOVE_SET_CAN_FLY`；生物就算被玩家操控，发的也是给服务器自己控制的单位用的 spline 包，操控它的客户端会忽略。改成：生物的 `m_movedPlayer` 正在操控它时，把客户端控制包发给这个玩家，广播时跳过他（`patches/2026_11_15_05_packetsender_player_steered_creature.patch`）。编译后经同意换上新镜像。

实测：这只蝙蝠不能按空格往上飞，要一边移动一边抬视角爬升（载具 641 是靠俯仰飞的）；到城东炸投石车和 Invader，进度正常增加。另外一个教训：这台服务器的程序只有函数符号，gdb 能断在函数上，但读不了成员变量，断点条件里写 `this->m_spellInfo` 会直接报错。

#### Keel Harbor，以及最后的决定：跳过狼人和地精的新手村

- **Keel Harbor（24680）到了是空的**：Lord Darius Crowley、Lorna（Endgame）、Tobias、兽人这些都在 189 号相位，没配 `phase_area`。接了 24680 以后就进 189，不设结束（`sql-custom/2026_11_15_32_gilneas_phase_189_keel_harbor.sql`）。
- **They Have Allies, But So Do We（24681）的弩车开不了**：和蝙蝠一样，码头的 Glaive Thrower（38150）点了以后召唤 37927，而 37927 的 VehicleId 是 0。配上同类弩车用的载具 447，等级改成 12（`sql-custom/2026_11_15_33_keel_harbor_glaive_thrower.sql`）。三种目标怪原来 2 小时才刷新，改成 60 秒；Wolfmaw Outrider 全图只有 3 个（任务要 8 个），按用户要求加到 30 个刷新点、30 秒刷新（`sql-custom/2026_11_15_34_wolfmaw_outrider_spawns.sql`，新刷新点要重启才生效，还没重启）。弩车能开了，但攻击打不中，下车后人还会飘在空中，这两个问题没查完。

到这里用户说太累了：吉尔尼斯几乎每个任务都要修一遍。决定是**新建的狼人和地精（死亡骑士除外）直接跳过新手村**：

- 任务清单存在世界库 `custom_start_skip_quest`：新手村地图（狼人 654/638，地精 648/661）里任务发布者发的、限定这个种族的任务，加上这几条任务链里不限种族的环节（14375、14434、14467；28607）。像 CLUCK!（3861）这种别处也有的普通任务不算。狼人 105 个，地精 106 个。
- 角色库加三个触发器（`sql-custom/2026_11_15_35b_skip_start_zone_triggers.sql`）：新建角色只要是 1 级、在线时长 0、在新手村地图，就直接改成 12 级、标记开场动画已看，出生在新手村结束后的落脚点（狼人达纳苏斯，地精奥格瑞玛），炉石绑定也设在那里，同时把清单里的任务全部写成已完成。种族技能（Two Forms、Darkflight、Running Wild、火箭跳等）本来就是默认技能，不受影响；任务奖励法术里唯一会教技能的 93477，教的也是默认技能，所以首次登录不会重放动画或者传送。
- 在一个最后回滚的事务里插入四个假角色测试：狼人战士、地精盗贼正确改到 12 级和主城，各写入 105/106 个已完成任务；狼人死亡骑士和人类没有变化。还没有用客户端真正新建角色验证。已有的三个角色（Shen、Murphy、Grax）按用户意思不动。
- 注意：触发器在角色库里，重新导入角色库会丢，要重跑这个文件。

## 第四章　德莱尼新手村（秘蓝岛）

### 4.1 Rescue the Survivors!：治好了幸存者，任务不计数

Ammen Vale 的 9283 Rescue the Survivors! 要对坠毁现场附近躺着的德莱尼幸存者（Draenei Survivor，16483）用种族技能纳鲁的赐福（Gift of the Naaru）。Lizz（萨满，5 级）治好了人，幸存者也站起来道谢、跑开了，任务计数却一直是 0/1。

幸存者用的是 C++ 脚本 `npc_draenei_survivor`。先排除了法术的问题：脚本按法术的 SpellFamilyFlags 认赐福，各职业版本的赐福（28880、59542–59548、121093）在 5.4.8 客户端里都带着这个标志，所以每个职业都能触发。真正的问题在给计数那一步：道谢后脚本调用 `player->TalkedToCreature(16483)`，而这个函数只给"和 NPC 交互"类型（`QUEST_OBJECTIVE_TYPE_NPC_INTERACT`，3）的目标计数；9283 的目标在库里是普通的"NPC"类型（0），所以调用了也什么都不发生。

不能反过来把数据库里的目标类型改成 3：玩家每次打开 NPC 的对话，服务器都会调用 `TalkedToCreature`，改了以后点一下幸存者不用治疗就完成了。所以改脚本：把这一行换成 `KilledMonsterCredit`，它给类型 0 的目标计数。

同一个问题还出现在一个地方：血色岛 9756 What We Don't Know... 里，审问 Sunhawk 间谍的对话走完后，脚本也用 `TalkedToCreature` 给计数（17974），目标同样是类型 0，一起改了。其余十个调用 `TalkedToCreature` 的脚本不在德莱尼路线上，以后碰到再看。

补丁 `patches/2026_11_18_01_draenei_survivor_sunhawk_kill_credit.patch`（两个文件各改一行），源文件备份在 `backup/` 下。只重新编译了这两个脚本文件，11 月 18 日玩家下线后换上新镜像重启。等 Lizz 上线后在游戏里验证。

### 4.2 Tree's Company：变成树以后什么都没发生

9531 Tree's Company 是 Odesyus 上将让你去 Geezle 的营地附近，用 Tree Disguise Kit（23792）把自己伪装成一棵树，偷听谁在和地精 Geezle 接头。用了道具，人确实变成了树，然后就再也没有动静：没有人来，任务目标"The Traitor Uncovered"一直是 0/1。

道具的法术 30298 Tree Disguise 有三个效果：变形成树、定身，外加一个"发送事件"（10675）。事件脚本表里 10675 的内容是在营地旁召唤 Geezle（17318），存在 90 秒。所以召唤这一步是通的，问题在 Geezle 被召出来以后应该做什么。

源码里其实有完整的 `npc_geezle`：Geezle 一出现就召唤 Engineer "Spark" Overgrind（17243），两人走到海边碰头、挪走纳迦旗子、对话一大段（Spark 骂 Geezle 差点暴露了"我们在内部的间谍"），结束时给 50 码内**正处于树形态**的玩家任务计数（`KilledMonsterCredit(17243)`），然后两人离开、旗子恢复。但这个类的 `new npc_geezle()` 不在注册列表里，数据库里 Geezle 的 ScriptName 也是空的。查 git 历史，是 2012 年上游一次清理（a67c5fd0f2，"not exist Quest ... in Cata"）认为这个任务大灾变以后不存在，把注册和 ScriptName 一起删了；现在这个类的代码又出现在文件里，但注册和 ScriptName 都没有恢复。实际上 9531 在 5.4.8 里照样能接。

修法：

- C++：在 `AddSC_azuremyst_isle()` 里补回 `new npc_geezle();`。补丁 `patches/2026_11_18_02_azuremyst_cumulative_incl_geezle.patch`（这个文件相对上游的累计改动，含 [4.1](#41-rescue-the-survivors治好了幸存者任务不计数)），源文件备份 `backup/zone_azuremyst_isle.cpp.bak-20261118b`。
- SQL `sql-custom/2026_11_18_08_trees_company_geezle.sql`：Geezle 的 ScriptName 设为 `npc_geezle`；同时删掉库里一个常驻的 Geezle 刷新点（guid 85587，TDB 里没有）。脚本一挂上，这个常驻的 Geezle 每次刷新都会自己把整段剧情演一遍，等于每 5 分钟就在营地演一次；任务真正的来源是变树时召唤的那一个。原数据备份 `backup/geezle_tree_company_20261118.tsv`。

增量编译后，11 月 18 日在 0 人在线时重启，启动日志没有脚本报错。注意剧情从变树到给计数大约一分钟，期间要一直保持树的样子、待在 Geezle 附近 50 码内，提前取消变形就拿不到计数。已确认：Lizz 看完剧情拿到计数，交掉了 9531。

### 4.3 Show Gnomercy：叛徒 Spark 点不开

Tree's Company 揭穿了叛徒以后，接着是 9537 Show Gnomercy：回 Odesyus' Landing 找 Engineer "Spark" Overgrind（17243）当面揭穿他，打倒他拿到 Traitor's Communication（23899）。Lizz 走到他跟前，右键没有任何反应。

C++ 脚本 `npc_engineer_spark_overgrind` 是好的：任务进行中打开对话，会多出一个"Traitor! You will be brought to justice!"选项，点了以后 Spark 变成敌对、扔着炸药开打，掉落表里 23899 也是 100% 的任务掉落。问题在数据库：他的 `npcflag` 是 0，没有"可对话"标志，客户端根本不会向服务器发起对话，脚本也就没有机会出场；`gossip_menu_id` 同样是 0。TDB 里这两项分别是 1 和 7426，菜单 7426 和对应的文本在我们库里都在。

修法：`sql-custom/2026_11_18_09_show_gnomercy_spark_gossip.sql` 把 `npcflag` 加上对话位、`gossip_menu_id` 设为 7426，原值备份在 `backup/spark_overgrind_gossip_20261118.tsv`。NPC 模板是启动时读进内存的，场上的 Spark 要重启才拿到新数据，11 月 18 日经用户同意在 Lizz 在线时重启。已在游戏里确认：选项出现，Spark 变敌对，打倒后拿到 Traitor's Communication，任务完成。

### 4.4 Victims of Corruption：树人太少

9574 Victims of Corruption 要交 6 个 Crystallized Bark（23869），唯一来源是血雾岛上的 Corrupted Treant（17352），带任务时 100% 掉落。Lizz 反映树人"特别少"。

查下来数据并没有缺：库里一共 21 个刷新点，跟 TrinityCore 4.4.2 的世界库逐条对比，坐标完全一样，没有池子、事件或相位限制，刷新时间 5 分钟。问题在于这 21 只分散在整个岛上，最密的一群也只有 9 只左右，其余一两只一处，几个人或者一个人反复打的时候，很快就打空了。这不算"坏了"，但用户觉得太少，决定加怪并加快刷新。

修法：`sql-custom/2026_11_18_10_victims_of_corruption_treants.sql`（用 `scratch/treant_gen.py` 生成）在每个原有刷新点旁边 12–16 码加一只（guid 9100348–9100368），位置用地图高度文件挑选：地面高度和原刷新点相差不到 3 码，并且不在水下。现在一共 42 只，所有树人刷新时间都改成 60 秒。原数据备份 `backup/corrupted_treant_20261118.tsv`。11 月 18 日经用户同意，在 Lizz 在线时重启。等她在游戏里确认。

这一项不影响下面的统计：审计本来就不把这个任务算作有问题。

### 4.5 What We Don't Know：审问完探子还是不计数（4.1 的修法有误）

[4.1](#41-rescue-the-survivors治好了幸存者任务不计数) 里顺手改的 9756 What We Don't Know 实际上没修好：Lizz 变装后和牢笼里的 Captured Sunhawk Agent（17824）把对话走完，任务"Sunhawk Information Recovered"仍然是 0/1。

原因在我当时写的那行 `KilledMonsterCredit(C_SUNHAWK_TRIGGER, creature->GetGUID())`。`Player::KilledMonsterCredit` 收到 guid 时，会在地图上找到这个生物，然后**用它的真实编号代替传进来的编号**。传进去的是探子本人的 guid，于是计数按 17824 记，任务要的却是隐形计数 NPC 17974，对不上就什么都不发生。[4.1](#41-rescue-the-survivors治好了幸存者任务不计数) 里 Rescue the Survivors! 的同一种改法没问题，因为那边传的就是幸存者自己的编号和 guid。

修法：不传 guid，只写 `KilledMonsterCredit(C_SUNHAWK_TRIGGER)`。补丁 `patches/2026_11_18_03_bloodmyst_cumulative_sunhawk_credit_no_guid.patch`（这个文件相对上游的累计改动），源文件备份 `backup/zone_bloodmyst_isle.cpp.bak-20261118b`。只重新编译了这一个文件，11 月 18 日经用户同意在 Lizz 在线时重启。全库还有一处同样的写法在地精岛（`kezan.cpp` 的 DEFFIANT_KILL_CREDIT），地精线暂缓，先记下。

### 4.6 德莱尼两岛普查：Lizz 还没做的任务

Lizz（24 级德莱尼萨满）觉得两座岛的任务都做完了，于是把秘蓝岛、秘血岛、埃索达所有德莱尼萨满能接的任务（发任务的 NPC/物件刷在两岛上，或者任务归属这几个区域）列出来，和她交过的 121 个逐个对照。剩下的大致分三类。

**正常、可以不做的：** 9313 Travel to Azure Watch、9371 Botanist Taerix（都是引路任务，人已经到了）；9528 A Cry For Help（护送 Magwin，脚本和 31 个路径点都在）；9564 Gurf's Dignity（物品由 17475 掉落，有刷新）；9642 More Irradiated Crystal Shards（可重复）；14082 学骑术、Hero's Call 系列和捐布任务不属于新手岛。另有 9546、9633、9749、9751 在 TDB 里就标为废弃，9306/9307/9750/9754/9755 是没有发放者的旧条目。

**Wyrmscar 岛两条线，检查后正常：** 9687 Restoring Sanctity → 9688 Into the Dream → 9689 Razormaw（Razormaw 平时没有刷新点，用 Bundle of Dragon Bones 点燃 Ever-burning Pyre 后由事件 11087 召唤，飞完 11 个路径点后变得可攻击，数据都在）；9683 里的 Atoph 同样由 Statue of Queen Azshara 的事件 11027 召唤。

**真正坏掉、已修复的两处：**

- **9672 The Bloodcurse Legacy 接不到。** 它由物品 24132 A Letter from the Admiral 开始，但这封信在库里没有任何来源（TDB 4.4.2 也一样），后面整条 Captain Edward Hanes 线（9674 → 9682 → 9683）都因此锁住。改成由 Blood Watch 的信使 Messenger Hermesius（17703，前一个任务 9671 Urgent Delivery 的发放和交付人）直接发：`sql-custom/2026_11_18_12_bloodcurse_legacy_starter.sql`。
- **9711 Matis the Cruel 做不完。** 用 Flare Gun 打 Matis 会召唤 Tracker of the Hand（17853），但 Matis 和追踪者都没有 AI，追踪者还是中立的 35 号阵营打不了他，于是没人施放完成任务的 31336。照 TDB 4.4.2 移植了两者的 SAI 和喊话（Matis 血量降到 50% 以下：倒地、无敌、释放 31336 给附近玩家完成任务，追踪者押走他），追踪者阵营改回 1700；SkyFire 没有 SET_UNINTERACTIBLE 这个动作，改用"不可选中"单位标志。另外加了一条死亡兜底（和熊猫人岛 Li Fei 那次同一个思路）：玩家太强、一下把 Matis 从 50% 以上打死时，30 码内的玩家也算完成。`sql-custom/2026_11_18_11_matis_the_cruel.sql`。

原数据备份 `backup/matis_bloodcurse_20261118.tsv`。11 月 18 日经用户同意，在 Lizz 在线时重启，启动日志没有 SAI 报错。两处都等 Lizz 在游戏里确认。

## 第五章　侏儒新手村（New Tinkertown）

侏儒新手村之前在全局批次里修过三个任务（见 [《全局修复》1.12](/Build-a-MoP-Server-2-Global-Fixes/#112-批次八侏儒黑海岸狼人新手区)）。这一章跟着侏儒角色 Evan 的进度逐个修。

### 5.1 Missing in Action：打开笼子，任务不计数

26284 Missing in Action 要求在 Frostmane Hold 周围打开笼子，救出 6 个被俘的爆破手（Captured Demolitionist，42645）。Evan（侏儒，5 级）开了笼子，爆破手也说话跑掉了，任务就是不计数。

笼子 Makeshift Cage（204019）的 SmartAI 是：笼子被打开时跑动作列表 20401900。第 0 步让附近的爆破手说话、跑开、消失；第 1 步 2 秒后**由笼子对开笼子的玩家施放 79606**，这个法术的第 3 个效果是给施法者 42645 的击杀计数。问题在 SkyFire 的 `SMART_ACTION_CAST` 实现，第一行就是 `if (!me) break;`：只有生物脚本有 `me`，物体脚本没有，所以笼子永远放不出这个法术，计数也就永远不会发生。就算放得出来，计数效果作用在"施法者"身上，而笼子施法时真正的施法者是笼子临时召唤的触发器，也落不到玩家头上。TDB 4.4.2 是直接给计数，不走法术。

修复（`sql-custom/2026_11_19_05_missing_in_action_cage_credit.sql`，原动作列表备份 `backup/missing_in_action_cage_20261119.tsv`）：把第 1 步改成 `SMART_ACTION_CALL_KILLEDMONSTER` 42645，目标是开笼子的玩家（动作触发者），仍然延迟 2 秒，其余不动。这个动作在目标是指定玩家时不需要 `me`，物体脚本也能用。

`smart_scripts` 能热加载，11 月 19 日在控制台执行 `reload smart_scripts` 就生效了，没有重启。动作列表是每次开笼子时才从库里取，已经刷出来的笼子也直接用新的。已确认：Evan 救出了 6 个爆破手，交掉了 26284。

全库查了一遍，物体脚本里用 `SMART_ACTION_CAST` 的只剩一处：诺森德冰冠冰川 Arete's Gateway（191579）的动作列表召唤 Arete（18280），同样放不出来，等走到那里再修。

### 5.2 A Job for the Multi-Bot：机器人没了，要不到新的

26205 A Job for the Multi-Bot 在 [《全局修复》1.12](/Build-a-MoP-Server-2-Global-Fixes/#112-批次八侏儒黑海岸狼人新手区) 修过：接任务时 Engineer Grindspark 给玩家召一个 GS-9x Multi-Bot（42598），机器人跟着主人，走到有毒泉眼（Toxic Pool，42563）6 码内就给主人记一次，并清掉那口泉眼，一共要 5 次。Evan 反馈：没看到机器人，但走近泉眼确实记了 2 次，之后就不再涨；回去找 Grindspark 选"I need a new GS-9x Multibot."也没反应。

查下来是两件事：

- **机器人会到时消失。** 召唤法术 79412 的持续时间是 15 分钟（SpellDuration 347），到点机器人就没了，计数自然停在 2。这是原版设计，原版靠 Grindspark 那个对话选项补发。
- **补发的选项是空的。** 对话菜单 12634 里有这个选项，但没有任何脚本处理"选了这个选项"，所以点了什么都不发生；也没有显示条件，任务之外也能看到。

修复（`sql-custom/2026_11_19_06_multibot_replacement.sql`，原数据备份 `backup/multibot_grindspark_20261119.tsv`），照 TDB 4.4.2：Grindspark 的 SmartAI 加一条"选了 12634 第 0 项 → 对玩家施放 79419 召唤机器人，然后关闭对话"，和接任务时用的是同一个法术；再加一条条件，只有任务在日志里（未完成或已完成未交）时才显示这个选项。

`conditions` 和 `smart_scripts` 都热加载了，但这次热加载不够：SkyFire 的 `reload smart_scripts` 只刷新库里存的脚本，已经刷出来的 NPC 要等重生时才会重新读，Grindspark 一直站着没重生过，身上还是旧脚本。[5.1](#51-missing-in-action打开笼子任务不计数) 能热加载生效，是因为笼子的动作列表每次触发时都重新从库里读。11 月 19 日经用户同意，在 Evan 在线时重启，她的进度 2/5 保留。

**看不到机器人的原因是用户在游戏里找到的：** 重启后 Evan 再要了一个机器人，发现它刷进了 Grindspark 旁边的建筑里，卡住出不来。召唤法术 79412 的落点是"目标点右侧"（`TARGET_DEST_DEST` + `TARGET_DEST_DEST_RIGHT`），也就是玩家右手边几码；跟 Grindspark 说话时玩家的右手边很容易就是墙里，服务器选落点时不检查碰撞。之前那 2 次计数，多半是哪次落点碰巧在外面。

修复（`sql-custom/2026_11_19_07_multibot_spawn_spot.sql`，原数据备份 `backup/multibot_spawn_spot_20261119.tsv`）：接任务和要新机器人这两种情况都发生在 Grindspark 身边，所以让机器人一刷出来先瞬移到 Grindspark 正前方约 5 码的空地（-5075.5, 459.4, 410.6；地形高度 410.33，那里没有建筑模型），然后再跟随主人。注意 SkyFire 的 `SMART_ACTION_TELEPORT` 是先按目标类型挑出"要传送谁"，再用 target_x/y/z 当坐标，所以目标类型要填"自己"（1）；填"坐标"（8）的话一个单位都挑不出来，什么也不会发生。机器人每次都是新召出来的，会读最新的脚本，热加载就生效了，这一步没有重启。已确认：机器人刷在空地上，Evan 清完 5 口泉眼，交掉了 26205。

### 5.3 To the Surface：Torben 的对话选项没反应

27674 To the Surface 要找地下的 Torben Zapblast（46293），选"Send me to the surface, Torben."，他会给计数并把玩家传送到地面的 Nevin Twistwrench 旁边。Evan 选了这个选项，什么都没发生。

Torben 的 SmartAI 本身是对的：选中菜单 12104 的选项后给 46293 计数，并让玩家施放 86278 Teleport to Surface（落点在 `spell_target_position` 里，就在 Nevin 旁边，也查过了）。问题在编号：SAI 监听的是 12104 的 **0 号**选项，库里这个菜单却只有一个 **1 号**选项。TDB 4.4.2 里 0 号、1 号两个选项都有，我们的库只留了 1 号，于是选了也匹配不上任何脚本。

修复（`sql-custom/2026_11_19_08_to_the_surface_torben_option.sql`，原数据备份 `backup/torben_gossip_20261119.tsv`）：把这个选项的编号从 1 改成 0。对话选项是每次打开对话时才读的，`reload gossip_menu_option` 就生效了，不用重启；Torben 身上的旧脚本本来监听的就是 0 号，也不用重新加载。已确认：Evan 被传送到地面，交掉了 27674。

全库扫了一遍"SAI 监听的选项在菜单里不存在"：编号对不上的只有 Torben 这一处。另外 4 个 NPC 的菜单里一个选项都没有，包括 [《全局修复》2.12](/Build-a-MoP-Server-2-Global-Fixes/#212-部落去潘达利亚传送门没有目的地) 里提到的 General Nazgrim（55054）和 Sky Admiral Rogers（66292），以及 Darrok（27425）和 Valis Windchaser（33974），走到那里再修。

## 第六章　死亡骑士新手村（阿彻鲁斯：黑锋要塞）

### 6.1 Death Comes From On High：眼睛一收回，人就从要塞上摔下去

12641 Death Comes From On High 要在阿彻鲁斯里点控制装置，放出"阿彻鲁斯之眼"（28511），飞到下面的血色领地侦察四个地点。Kiv 侦察完，任务已经显示完成，在眼睛的技能栏上点了返回（Recall Eye of Acherus，52694），结果视角一回到角色身上，角色就从要塞边上掉下去，摔死在下面的地面上（z≈154；要塞地板在 z≈426）。

角色的身体其实一直没离开要塞，问题出在收尾。上游 SkyFire 8 月给这个任务重写过脚本：返回时眼睛先自己飞回巫妖王旁边，控制光环（51852）移除时，再把玩家传送到"眼睛当前所在的位置"。可眼睛还在半路上，控制就已经结束了，玩家被传到了要塞平台外面的半空。用碰撞模型逐格查了巫妖王周围的地板：x 小于 2340 左右的那一侧没有地板，Kiv 的死亡位置（2329, -5671）正好就在边缘外面。

修复（`patches/2026_11_20_06_eye_of_acherus_return_to_start.patch`，改的是 `chapter1.cpp` 里的光环脚本）：放出眼睛的那一刻，记下角色站的位置；控制结束时，把角色传回这个位置。万一没有记到，就传到巫妖王旁边一个有地板的点（2351.6, -5670.2, 426.0，这也是放弃任务时用的那个点）。这样不管眼睛飞到哪里、用哪种方式结束控制，角色都回到原地。任务本身的流程和难度都没动。回退用镜像 `skyfire548:pre-eyefix-20261120`，源码备份 `backup/chapter1.cpp.bak-20261120`。

增量编译，11 月 20 日经用户同意，在 0 人在线时重启。Kiv 放弃任务后重做了一遍：点返回后回到了原地，没有再摔下去，任务也交掉了。

### 6.2 Into the Realm of Shadows：接了任务又不能跳，而且看不到任务怪

这一节其实是两个问题，先后撞上的。

**下载具后不能跳。** 前一个任务 12680 Grand Theft Palomino 要偷一匹马骑回 Salanar the Horseman 那里，到了以后黑骑士会把马收走，玩家是被强制拉下马的。Kiv 接下一个任务 12687 Into the Realm of Shadows 时，就发现自己浮在离地 4.8 码的地方，不能跳，走到下坡还会水平地飘出去。这和 [3.1](#31-吉尔尼斯城两段骑马任务和一个相位-bug) 吉尔尼斯下马后的表现一样。接任务时加上的 Realm of Shadows 光环（52693）只有相位和屏幕特效，跟这件事无关。

先试了一下用控制台把她原地传送到正下方的地面，没有用。这说明不是只有客户端卡住：服务器记录的状态本身也是错的。往下查，找到了 [3.1](#31-吉尔尼斯城两段骑马任务和一个相位-bug) 那个保险失效的原因：卡住的客户端每次报告移动时都带着"无重力"标志，服务器在 `MovementHandler.cpp` 里把这些标志原样抄进自己的记录；而保险的条件是"服务器认为玩家没有无重力才补发"，所以每次都被跳过。传送时服务器又把这份错误的标志发回给客户端，所以传送也救不回来。只有重新登录，状态从头建一遍，才能恢复。

修复（`patches/2026_11_20_07_unit_cumulative_incl_exit_vehicle_gravity_v2.patch`，改的是 `Unit.cpp`）：玩家下载具 1.5 秒后，只要不在载具上、不在飞行路线上、身上也没有悬浮、飞行或飞行坐骑光环，就直接清掉服务器这边的"无重力"标志，再发一次"恢复重力"，3 秒后再检查一遍。真的清掉标志时会在日志里记一行 `ExitVehicleGravity`。回退用镜像 `skyfire548:pre-gravityv2-20261120`，源码备份 `backup/Unit.cpp.bak-20261120-gravity`。经用户同意后重启。Kiv 之后又被强制下马一次（见下面 12687 的结尾），这次没有卡住，日志里也没有出现 `ExitVehicleGravity`，所以新代码还没有在客户端真正卡住的时候派上用场，要等下一次碰上来验证。

**看不到任务怪。** 12687 要进入暗影界（Realm of Shadows），打下一个黑骑士（Dark Rider of Acherus，28768），抢他的死亡战马（Acherus Deathcharger，28782），骑回暗影界里的 Salanar（28788）。Kiv 接任务之前在外面看见过这些黑骑士，接了以后反而一个都看不到了。

Realm of Shadows 光环会把玩家切到 174 号相位，而这个核心里，进了特殊相位就看不到普通相位的 NPC（熊猫人岛 632 号相位那次也是这样，见第一章）。数据库里 11 个黑骑士和 11 匹战马都放在普通相位 0：在外面看得见，进了暗影界看不见，正好反了。TrinityCore 4.4.2 里这些战马都在 174 号相位，黑骑士是战马自带的骑手。另外，给任务计数的是暗影界里的 Salanar（28788）：脚本写的是"战马走到 28788 号 NPC 5 码以内就给计数"，可这个 NPC 一个刷新点都没有。就算抢到马，也没有地方交。

修复（`sql-custom/2026_11_20_02_realm_of_shadows_phase.sql`，修改前的数据备份在 `backup/realm_of_shadows_phase_20261120.tsv`）：22 个刷新点改到 174 号相位；在外面那个 Salanar 的位置补一个 174 号相位的 Salanar（28788）。刷新点只在启动时加载，经用户同意后重启。已确认：Kiv 打下黑骑士，骑上他的马回到 Salanar 身边，任务完成并交掉了。

### 6.3 The Gift That Keeps On Giving：食尸鬼在和空气打架

12698 The Gift That Keeps On Giving 要在矿洞里对 Scarlet 矿工使用 Gift of the Harvester。矿工有一半几率变成食尸鬼（Scarlet Ghoul，28845）跟着你，另一半几率变成敌对的鬼魂（Scarlet Ghost，28846）。食尸鬼带回 Gothik the Harvester 身边就计数。Kiv 召唤出鬼魂以后，自己什么都看不见，食尸鬼却一直对着空气打，脱不了战，也就没法带回去交任务。

先排除了几种常见原因：鬼魂的阵营（2089）对玩家是敌对的，和矿工一样；召唤它的法术（52505）是"野生"召唤，不会把它变成玩家的随从；模型（25731，鬼魂模型）和 TrinityCore 4.4.2 一致。剩下的可疑之处是模板里的 `dynamicflags = 9`。这个值像是从 WotLK 抓包数据里抄过来的：那时 0x1 是"可拾取"、0x8 是"已被玩家占有"。但在 5.4.8 里，"可拾取"已经挪到 0x2，0x1 在源码里只标着"未知"。按 6.x 的定义往回推，它在这个版本应该是"隐藏模型"。也就是说，服务器上鬼魂是真实存在的，食尸鬼打得到它，可客户端把它的模型藏起来了。TrinityCore 4.4.2 已经整个去掉了这个字段。

修复（`sql-custom/2026_11_20_03_scarlet_ghost_visible.sql`，原值 9）：鬼魂的 `dynamicflags` 改成 0，用 `reload creature_template 28846` 热加载，没有重启。已确认：Kiv 放弃任务重接，再召唤出来的鬼魂看得见，也打得动了。

全库还有 3 个模板带着同样的 0x1 位：Prince Thunderaan（14435）、Shannox（53691）、Riplimb（53694），都是团本 boss，先不动。

另外顺带发现：放弃任务时，已经召出来的食尸鬼不会被清掉，仍然算在玩家名下。道具规定身上最多同时有 5 只食尸鬼，所以放弃重做以后，眼前只有 4 只也会被拒绝使用。先交掉几只就能恢复，不卡进度。11 月 21 日和其他几项一起编译上线：放弃 12698 时，把这个玩家召出的食尸鬼和鬼魂一起收回（加在第一章"29423 补记"里那张"任务 → 跟随者"小表里），等游戏里验证。

### 6.4 Massacre At Light's Point：炮弹出膛就炸（基本修复）

12701 Massacre At Light's Point 要登上光明点外的两艘船，用船上的 Scarlet Cannon（28833，载具）炮轰岸上，杀 100 个 Scarlet 守军。Kiv 把 6 门炮都试了一遍，炮弹几乎都是一出膛就炸。她还注意到，每门炮后面都有一门炮的"残骸"。

开炮法术（52435）的落点是抛物线弹道（`TARGET_DEST_TRAJ`）：客户端把仰角和初速发给服务器，服务器沿弹道找第一个挡路的东西，把落点挪到那里。我先怀疑服务器用的是炮台的朝向而不是瞄准方向，改了一版，顺便加了临时日志，记下每一炮的朝向、瞄准点和撞上了什么。日志马上否定了这个猜测：朝向是对的，可每一炮都在距离 0 的地方"撞"上了另一个生物，28887。

28887 也叫 Scarlet Cannon，模型一样，坐标和每门能坐的炮完全相同。Kiv 看到的"残骸"就是它。TrinityCore 4.4.2 里能坐的炮在默认相位 169，这门摆设炮在 171 号相位，两者从不同时出现；我们库里都放在相位 0，叠在了一起，于是炮弹出膛先撞上了它。

修复（`sql-custom/2026_11_20_04_scarlet_cannon_decoys_phase.sql`，原值 0）：6 门 28887 改到 171 号相位。这张地图上没有 171 号相位的配置，所以谁都看不到它们。之前那段弹道代码改动是多余的，源码恢复原样，换回改动前的镜像后重启（经用户同意，0 人在线）。已确认：炮后面的"残骸"没了，大多数炮弹都能飞出去，Kiv 完成了任务。

所以这一节只算**基本修复**，不算完美修复。还剩一个小问题：有些角度开炮还是会出膛就炸，多半是撞上了同一条船上相邻的炮（大约相隔 6 码）。SkyFire 的弹道判断里任何生物都能挡住炮弹；TrinityCore 后来改成只有带"会挡导弹"类型标志（0x4000，SkyFire 里标作 `UNK14`）的生物才能挡住。11 月 21 日照这个改了 `Spell::SelectImplicitTrajTargets`，和其他几项一起编译上线（`patches/2026_11_21_01_batch_ghouls_traj_courier_cumulative.patch`），等游戏里验证；验证之前这一节仍算基本修复。

### 6.5 The Will Of The Lich King：第二章里一个 NPC 都没有

交掉 12706 Victory At Death's Breach! 以后，Kiv 去接 12714 The Will Of The Lich King，发现自己像被传进了另一个相位，周围一个 NPC 都没有。

交 12706 时，服务器会自动给玩家加上 Chapter II 光环（52597），把玩家切到 171 号相位，也就是第二章；同时还有一个换天空盒的光环（52598）。这个核心判断"玩家能不能看到某个东西"（`WorldObject::IsPhased`）的规则是：没有相位的普通刷新（相位 0），只有在玩家也带着默认相位 169 时才看得见。这张地图上没有任何东西给玩家 169，所以一进第二章，相位 0 的 NPC 全看不见了。能看到的，只有 [6.4](#64-massacre-at-lights-point炮弹出膛就炸基本修复) 刚挪到 171 号相位的那 6 门炮残骸，而这恰好和原版对得上：光明点被屠之后，那里只剩残骸。TrinityCore 的玩家永远自带 169，所以原版没有这个问题。TrinityCore 4.4.2 在这张地图上的分布是：默认相位 169 有 586 个刷新，第一章 170 有 171 个，第二章 171 有 662 个，另外还有 174～176。

修复（`sql-custom/2026_11_20_05_ebon_hold_default_phase.sql`，修复前这 28 个区域都没有 `phase_area`）：给整片血色领地（4298 和它的 27 个子区域）配上默认相位 169，不加条件。没进入任何章节时，看到的东西和原来一样；进了第二章，普通 NPC 也看得见。之所以不按光环加条件，是因为区域相位只在登录和换区域时计算，而光环是在交任务的那一刻加上的，加条件的话要跑到别的区域才会生效。副作用是在暗影界（174）里也能看到外面的世界，Salanar 会是两个叠在一起，不影响任务。`reload conditions` 会顺带重新加载 `phase_area`，所以没有重启。

已确认：Kiv 小退重新登录后，NPC 都回来了。她要小退，只是因为修复是在她已经身处这片地图时热加载的；新角色一登录就带着 169，以后进第二章不需要小退。

还有两个已知的遗留：我们库里不同章节的 NPC 多半混放在相位 0，所以第二章里可能会看到原版只在第一章出现的东西；另外库里有 232 个刷新放在第一章的 170 号相位，现在没有任何东西会把玩家放进 170，这些 NPC 谁都看不见。目前都不挡任务，遇到具体问题再分开处理。

### 6.6 四个章节的 NPC 全堆在一起：怪伤害高，结局任务提前出现

Kiv 一直觉得死亡骑士新手村的怪伤害特别高，后来又发现 12779 An End To All Things（骑冰霜巨龙清剿血色十字军的结局任务）的任务怪，全都刷在之前那些任务的区域里。

这条任务线原版分四章，每章靠一个光环切相位，这几行 `spell_area` 我们库里本来就有：交 12706 后进入第二章（52597，171 号相位），交 12757 Scarlet Armies Approach 后进入第三章（53107，175 号相位），交 12779 后进入第四章（53405，176 号相位）。问题在刷新点：各章节的 NPC 在我们库里全放在相位 0。第三章的决战怪 Hearthglen Crusader（29102）、Tirisfal Crusader（29103）、Scarlet Ballista（29104）是精英，伤害倍率 2.4，三种加起来三百多个，从第一天起就满地图都是。连 Gothik、Darion 这些剧情 NPC 也是每章各一个版本，全叠在一起。另外，12778 The Scarlet Apocalypse 没有前置任务，做完 12657 就能从 Darion 那里接到，结局任务也就跟着提前了（见 [6.1](#61-death-comes-from-on-high眼睛一收回人就从要塞上摔下去) 后 Kiv 的进度）。

修复（`sql-custom/2026_11_20_06_dk_chapter_phases.sql`，修改前的相位备份在 `backup/map609_creature_phase_20261120.tsv`）：对照 TrinityCore 4.4.2，如果一种 NPC 在这张地图上的所有刷新都在同一个章节相位（171、175 或 176），而我们库里它在相位 0，就挪回那个章节。一共 86 种、1079 个刷新：第二章 64 种 638 个，第三章 8 种 390 个，第四章 14 种 51 个。TrinityCore 里分布在多个相位的 6 种 NPC 没动，地上的物件也没动。12778 加上前置：要先交 12757。这一步依赖 [6.5](#65-the-will-of-the-lich-king第二章里一个-npc-都没有) 给整片区域配的默认相位 169，否则进了任何一章都会看不见相位 0 的 NPC。经用户同意后重启。

Kiv 在重启前已经骑着龙把 12779 做完交掉了，所以她现在同时处在第二章和第四章，以后也不会再进入第三章（第三章光环规定 12779 还没交才生效）。新角色会按原版顺序走：精英十字军和结局任务都要到第三章才出现。重启后 Kiv 接着做第二章的任务，没有发现缺 NPC。

### 6.7 How To Win Friends And Influence Enemies：武器从来不触发"逼问"

12720 How To Win Friends And Influence Enemies 要装备 Keleseth 的两把 Persuader（39371），用它们去"说服"血色十字军开口：武器命中时有几率触发 Persuasive Strike（52781），被打中的 Scarlet Marksman、Preacher 或 Crusader 会停手，分六段说完话后死去，任务完成。Kiv 装备着两把武器砍了一圈，一次都没触发。

几率本来就不高：按每分钟 1 次（PPM）算，双持时每一下大约 4%，和 TrinityCore 一样。用户要求改成必中（`sql-custom/2026_11_20_07_kelesets_persuader_always_proc.sql`，把 PPM 从 1 改成 0，服务器就改用法术自带的 100% 几率；**这一条是按用户要求故意偏离原版**）。重启后还是不触发，说明不是运气问题。

服务器镜像里的函数符号已经被去掉，gdb 没法按函数名下断点，只好在三个地方加临时日志：武器触发判定、52781 的施法结果、怪的脚本有没有收到法术。日志显示：触发判定做了，几率 100%，目标是 Scarlet Crusader，但每次施法都以错误码 27 失败，怪的脚本根本没收到。27 来自 `conditions` 表：这个法术配了三条条件，"目标必须是 Marksman / Preacher / Crusader 之一"，可 `ConditionTarget` 填的是 0。在法术条件里，0 指的是**施法者**，也就是玩家本人，于是服务器每次都在检查"玩家是不是 Scarlet Crusader"。TrinityCore 里这三条填的是 1，也就是被打的目标。

修复（`sql-custom/2026_11_20_08_persuasive_strike_condition_target.sql`，原值 0）：三条条件的 `ConditionTarget` 改成 1，`reload conditions` 热加载。全库同类写法（法术条件里检查生物种类、目标填 0）还有两条，和 TrinityCore 一致，是生物施放的法术，没有问题。临时日志已经从源码里删掉，正在运行的版本下次重启时换掉。已确认：Kiv 一下逼问成功了三个。

### 6.8 Orbaz 的"再开一次传送门"点不动

New Avalon 酒馆里的 Orbaz Bloodbane（28914）有一个对话选项："I missed the gate to Acherus, Orbaz. Could you please open another?"。Kiv 点了没有任何反应。

这个选项在 TrinityCore 里有两条规则：只有已经完成 12757 Scarlet Armies Approach、而且附近 30 码内没有回阿彻鲁斯的传送门（191155）时才显示；选中后关掉对话框，运行 Orbaz 现成的开门脚本（施放 Portal: Acherus，53097）。也就是说，它是给"接完 12757、错过了 Orbaz 开的门"的人准备的补救选项。我们库里这两样都缺：选项对所有人一直显示，选了也没有任何脚本响应。

修复（`sql-custom/2026_11_21_01_orbaz_portal_gossip.sql`，修复前这几行都不存在）：按 TrinityCore 补上"选择对话选项 → 关闭对话框 → 运行开门脚本"的 SmartAI，以及显示选项的两个条件。`reload smart_scripts` 和 `reload conditions` 热加载。不过 `reload smart_scripts` 只对之后新刷出来的 NPC 生效，已经站在酒馆里的 Orbaz 还在用旧脚本，所以又经用户同意重启了一次。已确认：Kiv 完成 12757 后点这个选项，Orbaz 开了门，传回了阿彻鲁斯。

### 6.9 The Light of Dawn 之前的预检：第五章整章是空的

Kiv 做到 12801 The Light of Dawn（圣光之愿礼拜堂大战）时，用户让我在开打前先检查一遍。大战本身的脚本（`chapter5.cpp` 里的 Darion Mograine 29173）、行军路线、"I am ready." 对话和最后的任务计数（53606 → 29245）都齐全，Darion 也在 Kiv 看得见的第四章相位里。

问题在大战之后。原版里大战结束，阿彻鲁斯搬到东瘟疫之地上空，也就是地图 0；第五章的 13165 Taking Back Acherus 要用死亡之门回去，交给那里的 Darion（31084），接着 13166 The Battle For The Ebon Hold 要在阿彻鲁斯里杀 10 个入侵的天灾、协助击杀 Patchwerk，最后 13188 Where Kings Walk 去暴风城见国王。第五章的相位光环（58354，177 号相位）、死亡之门的落点（53822，地图 0 的阿彻鲁斯）和天灾的击杀计数（31100）我们库里都有，可第五章的 NPC 一个刷新点都没有：Darion、Patchwerk、29 只可怕憎恶、17 个黑锋骑士、死灵法师、瓦格里、Koltira、Thassarian 全缺。这样大战打完就交不了任务，整条线到此为止。

修复（`sql-custom/2026_11_21_02_dk_chapter5_acherus_spawns.sql`，修复前这些刷新点都不存在）：按 TrinityCore 4.4.2 导入地图 0 上 177 号相位的 60 个刷新点；再像 [6.5](#65-the-will-of-the-lich-king第二章里一个-npc-都没有) 一样给地图 0 的阿彻鲁斯（区域 4281）配上默认相位 169，否则进了第五章，阿彻鲁斯里原有的普通 NPC 会看不见。经用户同意，开打前重启。

已确认：Kiv 打完了大战，用死亡之门回到阿彻鲁斯，做完 Battle For The Ebon Hold，交掉了 Where Kings Walk。死亡骑士新手线从头到尾走通，Kiv 60 级，任务日志是空的。没做的只有可重复的 12718 More Skulls For Brew 和已被废弃的 12625 Dominion Over Acherus。

### 6.10 Ambush At The Overlook：信使开启了"恋爱循环"

12754 Ambush At The Overlook 要在路边用道具 Makeshift Cover 伪装成一棵树，等 Scarlet 信使（29076）骑马经过，伏击他，拿到他的随身物品和信件。Kiv 用了道具，信使走到树跟前说一句"Hrm, what a strange tree. I must investigate."，然后又上马、又走过来、又说同一句话，一直循环。

道具法术 Cover（53061）做三件事：放下一棵树（191144）、召唤信使（53063），再给玩家一个潜行值 1000 的潜行光环。信使的脚本（`chapter2.cpp` 的 `npc_scarlet_courier`）走到树前以后会攻击树的主人，可玩家正在潜行，他看不见，攻击失败；脱战重置后又从头来一遍。原版里这一步他会识破伪装，喊"What's this!? This isn't a tree at all! Guards!"，然后开打。当时先告诉用户可以自己动手打他一下，打破潜行后就能正常战斗。

修复（`patches/2026_11_21_01_batch_ghouls_traj_courier_cumulative.patch`，备份 `backup/chapter2.cpp.bak-20261121-batch`）：信使走到树前时，先去掉玩家的 Cover 光环、收掉那棵树，再攻击玩家（TrinityCore 也是在这里收掉树）。11 月 21 日用户睡前让我把攒着的 C++ 改动一起编译，这一项、[6.3](#63-the-gift-that-keeps-on-giving食尸鬼在和空气打架) 的食尸鬼清理和 [6.4](#64-massacre-at-lights-point炮弹出膛就炸基本修复) 的弹道判断同一批上线，0 人在线时重启，回退用镜像 `skyfire548:pre-batch-20261121`。三项都还没在游戏里验证。
