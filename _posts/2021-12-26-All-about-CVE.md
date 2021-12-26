---
layout: post
title: 关于常见漏洞披露（CVE）的一切
category: 计算机
tags: [计算机, 软件, 安全]
---


----------
## 概述

CVE®计划的任务是识别、定义和编目公开披露的网络安全漏洞。目录中的每个漏洞都有一个CVE记录。这些漏洞被发现，然后由世界各地与CVE计划合作的组织进行分配和发布。合作伙伴发布CVE记录以传达一致的漏洞描述。信息技术和网络安全专业人员使用CVE记录来确保他们正在讨论相同的问题，并协调他们的努力以优先考虑和解决漏洞。

## 历史沿革

### 概述

CVE的共同创建者，MITRE公司的David E.Mann和Steven M.Christey在1999年1月21日至22日在位于美国印第安纳州的西拉斐特普渡大学举行的第二届安全漏洞数据库研究研讨会上提出了CVE列表的原始概念，作为题为["迈向漏洞的共同枚举"（PDF，0.3MB）][1]的白皮书。 

根据最初的构想，成立了一个工作组（后来成为最初的19名成员的CVE编辑委员会），并创建了最初的321个CVE记录。CVE列表于1999年9月正式向公众发布。

### 社区广泛采用CVE

从1999年CVE推出的那一刻起，网络安全社区就通过"CVE兼容"产品和服务认可了CVE的重要性。早在 2000年12月，就有29个组织参与，并声明了43种产品的兼容性。今天，随着来自世界各地的众多产品和服务整合CVE记录，这些数字显着增加。

采用的另一个促进因素是持续在安全公告中包含CVEID。来自世界各地的许多主要操作系统（OS）供应商和其他组织在其警报中包含CVEID，以确保国际社会在问题公布后立即获得CVEID，从而从中受益。此外，CVE记录用于唯一标识公共监视列表中的漏洞，例如[OWASP十大Web应用程序安全问题][2]等，并在[通用漏洞评分系统（CVSS）][3]中按严重性进行评级。CVEID也经常出现在有关软件漏洞的贸易出版物和一般新闻媒体报道中，例如["Heartbleed"][4]的[CVE-2014-0160][5]和["Bluekeep"][6]的[CVE-2019-0708][7]。

[美国国家标准与技术研究院（NIST）][8]在"NIST特别出版物（SP）800-51，CVE漏洞命名方案的使用"中建议美国机构使用CVE，该出版物最初于2002年发布，并于2011年更新。2004年6月，[美国国防信息系统局（DISA）][9]发布了信息保障应用程序的任务命令，要求使用使用CVEID的产品。

CVE也被用作全新服务的基础。NIST的[美国国家漏洞数据库（NVD）][10]是一个"全面的网络安全漏洞数据库，集成了所有公开可用的美国政府漏洞资源，并提供行业资源参考"，与CVE列表同步并基于CVE列表。NVD还包括CVEID的[安全内容自动化协议（SCAP）][11]映射。SCAP是一种使用特定标准实现自动化漏洞管理、度量和策略符合性评估（例如FISMA合规性）的方法，CVE是SCAP用于枚举、评估和度量软件问题的影响和报告结果的开放社区标准之一。此外，[美国联邦桌面核心配置（FDCC）][12]要求使用经过SCAP验证的扫描工具验证是否符合FDCC要求。[CVE更改日志][13]是由[CERIAS/普渡大学][14]创建的工具，用于监视CVE列表的添加和更改，并允许用户获取每日或每月报告。由[Internet安全中心][15]运营的[开放漏洞和评估语言（OVAL）][16]是使用社区开发的OVAL漏洞定义（主要基于CVE记录）确定计算机系统机器状态的标准。[常见弱点枚举（CWE™）][17]是常见软件弱点的正式字典，部分基于CVE列表中的150,000多个CVE记录。

2011年，[国际电信联盟（ITU-T）][18]网络安全报告员小组（基于条约的150年历史的政府间组织内的电信/信息系统标准机构）根据前CVE兼容性计划存档的要求和建议，通过发布[ITU-T X.1520通用漏洞和暴露（CVE）][19]建议书，将CVE作为其新的["全球网络安全信息交换技术（X.CYBEX）"][20]的一部分。CVE兼容性文档。

### CVE继续增长

2016年，CVE计划开始积极扩大作为[CVE编号机构（CNAs）][21]参与的组织数量。CNA合作伙伴是[CVE列表][22]的构建方式。每个[CVE记录][23]都由CNA添加。这种扩展一直持续到今天，来自世界各地的越来越多的组织决定与CVE计划合作[成为CNA][24]。

### 历届赞助商

- [Defense Information Systems Agency (DISA):][25] Colonel Larry Huffman
- [Department of Energy (DOE):][26] John Przysucha
- [Department of the Treasury:][27] Jim Flyzik
- [General Services Administration:][28] Sallie McDonald
- [Intelligence Community:][29] Bill Dawson
- [Internal Revenue Service (IRS):][30] Len Baptiste
- [MITRE Corporation:][31] Pete Tasker
- [National Aeronautics and Space Administration (NASA):][32] Dave Nelson
- [National Information Assurance Partnership (NIAP):][33] Ron Ross
- National Infrastructure Protection Center (NIPC): Bob Gerber
- [National Institute of Standards and Technology (NIST):][34] Tim Grance
- [National Security Agency (NSA):][35] Tony Sager
- [U.S. Air Force:][36] Matt Mleziva

## 处理过程

### CVE记录的生命周期

![CVERecordLifeyclnfographic.c5741afa.jpg-110.3kB][37]

- 开始
- 发现（Discover）：个人或组织发现了新的漏洞；
- 报告（Report）：发现者向CVE计划参与者报告漏洞；
- 请求（Request）：CVE计划参与者请求CVEID；
- 储备（Reserve）：ID是保留的，这是CVE记录的初始状态。"保留"状态意味着CVE利益干系人正在使用CVEID进行早期漏洞协调和管理，但CNA尚未准备好公开披露该漏洞；

>CVEID说明：
>CVEID是由 CVE计划分配的唯一字母数字标识符。每个标识符都引用一个特定的漏洞。
>CVEID具有以下格式：
>CVE前缀+年份+任意数字
>"年份"部分是保留CVEID的年份或公开漏洞的年份。年份部分不用于指示发现漏洞的时间。
>"任意数字"或序列号部分可以在ID的序列号部分包含四位或更多位数字。例如，序列号中包含四位数字的 CVE-YYYY-NNNN、序列号中包含七位数字的CVE-YYYY-NNNNNNN等。任意位数没有限制。
>CVE计划的CNA规则包括有关CVEID的其他有用信息：
>[分配规则-如何分配CVEID][38]。

- 提交（Submit）：CVE计划参与者提交详细信息。详细信息包括但不限于受影响的产品；受影响或固定产品版本；漏洞类型、根本原因或影响；以及至少一个公共引用；
- 公布（Publish）：一旦CVE记录中包含所需的最少数据元素，它将由负责的CNA发布到CVE列表。CVE记录现在可供公众下载和查看；

>CVE记录是由 CVE 编号机构（CNA）提供的与CVEID关联的漏洞的描述性数据。这些数据以多种人类和机器可读的格式提供。
>每个CVE记录包括以下内容：
>&ensp;&ensp;在ID的序列号部分包含四位或更多数字的CVEID（即"CVE-1999-0067"、"CVE-2019-12345"、"CVE-2021-7654321"）。
>&ensp;&ensp;安全漏洞的简要说明。
>&ensp;&ensp;任何相关参考（即漏洞报告和公告）。
>CVE记录与以下状态之一相关联：
>&ensp;&ensp;保留：CVE记录的初始状态；当关联的CVEID由CNA保留时。
>&ensp;&ensp;已发布：当CNA将与CVEID关联的数据填充为CVE记录时，CVE记录的状态为"已发布"。关联的数据必须包含标识号（CVEID）、散文说明和至少一个公共引用。
>&ensp;&ensp;已拒绝：如果不应再使用CVEID和关联的CVE记录，则CVE记录将置于"已拒绝"状态。"已拒绝的CVE记录"保留在CVE列表中，以便用户可以知道该记录何时无效。
>CVE计划的CNA规则包括有关CVE记录的其他有用信息：
>&ensp;&ensp;CVE记录信息要求–CVE记录的完整要求。
>&ensp;&ensp;分配规则–CVE 记录中所需的数据元素。

- 结束

## 相关工作

### 国家漏洞数据库（NVD）

CVE和NVD是独立的程序。[美国国家漏洞数据库（NVD）][39]由[美国国家标准与技术研究院（NIST）][40]于 2005年推出，而CVE列表由[MITRE公司][41]于1999年作为社区努力推出。

NVD是一个基于CVE列表构建并与之完全同步的漏洞数据库，因此CVE的任何更新都会立即显示在NVD中。

CVE列表为NVD提供信息，然后NVD以CVE记录中包含的信息为基础，为每个CVE记录提供增强的信息，例如：

- 严重性评分和影响评级
- 通用平台枚举 （CPE） 信息
- 修复信息
- 按操作系统搜索;按供应商名称、产品名称和/或版本号;以及漏洞类型、严重性、相关漏洞利用范围和影响
- 增强的 CVE 内容数据馈送：
  - JSON 漏洞源
  - RSS 漏洞源
  - 漏洞翻译源
  - 漏洞供应商声明

虽然是分开的，但CVE和NVD都由[美国国土安全部（DHS）][42][网络安全和基础设施安全局（CISA）][43]赞助，并且这两个程序的输出都免费供公众使用。
  
### 通用漏洞评分系统（CVSS）

由[事件响应和安全团队论坛（FIRST）][44]运营的[CVSS][45]标准是与CVE分开的程序，可用于对CVE记录识别的软件漏洞的严重性进行评分。通常，CVE记录的严重性分数由NVD提供，但如果发布记录的CNA决定包括CVE记录，则CVE列表中的某些CVE记录包括严重等级。

CVSS版本3.0提供了"一种捕获漏洞主要特征的方法，并生成反映其严重性的数字分数，以及该分数的文本表示形式。然后，可以将数字分数转换为定性表示（例如低，中，高和关键），以帮助组织正确评估其漏洞管理流程并确定其优先级。

CVSS规范和文档中引用了CVE记录，以识别用作示例的单个漏洞，但使用CVSS时不需要这些记录。

### CVE记录的CVSS计算器

CVE记录的严重等级评分和优先级可通过[美国国家漏洞数据库（NVD）][46]提供的[CVSS计算器][47]获得。

根据由[美国国家标准与技术研究院（NIST）][48]运营的NVD网站，NVD的CVE记录CVSS计算器支持CVSS2.0和CVSS3.0标准，并为每个版本的CVE记录提供定性严重性排名。此外，NVD的CVSS记录CVSS计算器还允许用户在其严重性评分中添加另外两种类型的分数数据：（1）时间，用于"由于漏洞外部事件而随时间变化的指标"，以及（2）环境，用于"自定义分数以反映漏洞对组织的影响"。有关详细信息和帮助，请访问NVD网站上的[CVE记录CVSS计算器][49]。

### 常见弱点枚举（CWE™）

[CWE™][50] 是社区开发的常见软件和硬件安全漏洞分类法，可用作通用语言、安全工具的衡量标准以及漏洞识别、缓解和预防工作的基准。如果不在软件或硬件部署之前消除软件和硬件中的弱点，则可能成为可利用的漏洞。弱点是CVE记录中必需的数据元素。

### 常见攻击模式枚举和分类（CAPEC™）

[CAPEC™][51]是针对软件和硬件弱点的常见攻击模式的综合字典和分类法。通过了解如何利用弱点，分析师、开发人员、测试人员和教育工作者可以更好地识别和消除弱点，以免它们成为可利用的漏洞。

### ATT&CK®

MITRE [ATT&CK®][52]是一个基于真实世界观察的对手战术和技术的全球可访问知识库。ATT&CK知识库被用作在私营部门，政府以及网络安全产品和服务社区中开发特定威胁模型和方法的基础。

## 指标

使用滚动条导航数据表。

### 已发布的CVE记录

从1999年至今所有年份按季度分列的公布的[CVE记录][53]比较。

CVE记录包含有关与[CVEID][54]关联的[漏洞][55]的描述性数据（即简要说明和至少一个引用）。CVE记录由[CVE编号机构（CNA）][56]发布。

```
Year	2021	2020	2019	2018	2017	2016	2015	2014	2013	2012	2011	2010	2009	2008	2007	2006	2005	2004	2003	2002	2001	2000	1999
Qtr4	N/A	4,387	4,822	3,614	3,570	1,590	1,652	2,528	1,416	1,244	1,133	1,071	1,100	1,500	1,884	1,737	1,725	376	154	104	81	393	0
Qtr3	5,421	4,170	5,150	4,350	4,037	1,713	1,747	2,220	1,297	1,926	988	1,020	1,547	1,343	1,564	1,643	1,477	741	265	304	573	218	321
Qtr2	5,000	5,011	4,091	4,613	3,612	1,775	1,443	1,660	1,147	1,058	901	1,408	1,381	1,279	1,887	1,887	2,013	229	630	593	337	198	0
Qtr1	4,418	4,807	3,245	3,935	3,426	1,379	1,652	1,540	1,282	1,060	1,128	1,140	1,704	1,551	1,987	1,618	1,493	266	174	690	332	629	0
```

### 保留的CVEIDs

从1999年至今按年份比较保留的[CVEIDs][57]。

"保留"CVEID是[CVE记录][58]的初始状态；当关联的CVEID由CNA保留时。

```
Year	2021*	2020	2019	2018	2017	2016	2015	2014	2013	2012	2011	2010	2009	2008	2007	2006	2005	2004	2003	2002	2001	2000	1999
Count	21,855	30,680	24,179	21,407	18,196	14,472	9,959	9,465	7,334	7,370	5,630	5,379	5,630	5,968	7,607	7,077	7,041	1,357	1,209	1,909	1,445	1,178	991
```

### 保留但公共（RBP）CVEIDs

从2017年至今的所有年份按季度划分的[保留但公共（RBP）][59]CVEID的比较。

"RBP"是处于"保留"状态的[CVEID][60]，在一个或多个公共资源中引用，但其详细信息尚未在[CVE记录][61]中发布。

```
Year	2021	2020	2019	2018	2017
Qtr4	N/A	    553	    1,465	2,934	3,653
Qtr3	350	    690	    2,432	2,716	4,011
Qtr2	550	    565	    2,422	2,991	4,114
Qtr1	498	    603	    2,962	3,585	4,326
```

### 所有CNA与CNA-LR组合的CVE记录出版物

从2017年至今，所有[CNAs][62]发布的CVE记录与MITRE [CNA of Last Resort（CNA-LR）][63]发布的[CVE记录][64]的比较（按季度划分）。

```
Year	2021	2020	2019	2018	2017
Quarter	Qtr3	Qtr2	Qtr1	Qtr4	Qtr3	Qtr2	Qtr1	Qtr4	Qtr3	Qtr2	Qtr1	Qtr4	Qtr3	Qtr2	Qtr1	Qtr4	Qtr3	Qtr2	Qtr1
Other CNAs	64%	69%	68%	65%	70%	56%	53%	58%	46%	62%	59%	53%	52%	64%	53%	56%	49%	63%	53%
MITRE CNA-LR	36%	31%	32%	35%	30%	44%	47%	42%	54%	38%	41%	47%	48%	36%	47%	44%	51%	37%	47%
```






  [1]: https://www.cve.org/Resources/General/Towards-a-Common-Enumeration-of-Vulnerabilities.pdf
  [2]: https://www.owasp.org/index.php/OWASP_Top_Ten_Project
  [3]: https://www.first.org/cvss/
  [4]: https://tinyurl.com/ukm1e8vt
  [5]: https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-0160
  [6]: https://en.wikipedia.org/wiki/BlueKeep
  [7]: https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2019-0708
  [8]: https://www.nist.gov/index.html
  [9]: https://www.disa.mil/
  [10]: https://nvd.nist.gov/
  [11]: https://scap.nist.gov/
  [12]: https://nvd.nist.gov/fdcc/index.cfm
  [13]: https://cassandra.cerias.purdue.edu/CVE_changes/
  [14]: http://www.cerias.purdue.edu/
  [15]: https://www.cisecurity.org/
  [16]: https://oval.cisecurity.org/
  [17]: https://cwe.mitre.org/
  [18]: https://www.itu.int/en/pages/default.aspx
  [19]: https://www.itu.int/ITU-T/recommendations/rec.aspx?rec=11061
  [20]: https://www.itu.int/en/ITU-T/studygroups/com17/Pages/cybex.aspx
  [21]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCNA
  [22]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCVEList
  [23]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRecord
  [24]: https://www.cve.org/PartnerInformation/Partner#HowToBecomeAPartner
  [25]: https://www.disa.mil/
  [26]: https://www.energy.gov/
  [27]: https://www.treasury.gov/Pages/default.aspx
  [28]: https://www.gsa.gov/
  [29]: https://www.intelligence.gov/
  [30]: https://www.irs.gov/
  [31]: https://www.mitre.org/
  [32]: https://www.nasa.gov/
  [33]: https://www.niap-ccevs.org/
  [34]: https://www.nist.gov/index.html
  [35]: https://www.nsa.gov/
  [36]: https://www.af.mil/
  [37]: http://static.zybuluo.com/gamedebug/xfl69mwzf4e50zgpr7mdmkl8/CVERecordLifeyclnfographic.c5741afa.jpg
  [38]: https://www.cve.org/ResourcesSupport/AllResources/CNARules#section_7_assignment_rules
  [39]: https://nvd.nist.gov/
  [40]: https://www.nist.gov/
  [41]: https://www.cve.org/ResourcesSupport/FAQs#pc_introMITRE_role_in_cve
  [42]: https://www.dhs.gov/
  [43]: https://www.dhs.gov/cisa/cybersecurity-division/
  [44]: https://www.first.org/
  [45]: https://www.first.org/cvss/
  [46]: https://nvd.nist.gov/
  [47]: https://nvd.nist.gov/vuln-metrics/cvss
  [48]: https://www.nist.gov/
  [49]: https://nvd.nist.gov/vuln-metrics/cvss
  [50]: https://cwe.mitre.org/
  [51]: https://capec.mitre.org/
  [52]: https://attack.mitre.org/
  [53]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRecord
  [54]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCVEID
  [55]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryVulnerability
  [56]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCNA
  [57]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCVEID
  [58]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRecord
  [59]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRBP
  [60]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCVEID
  [61]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRecord
  [62]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCNA
  [63]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryCNALR
  [64]: https://www.cve.org/ResourcesSupport/Glossary?activeTerm=glossaryRecord