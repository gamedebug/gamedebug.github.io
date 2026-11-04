export const SITE = {
  title: '北境程序猿',
  bio: '凛冬将至..',
  description: 'Linux、内核、网络与云计算的排障笔记，以及高达和游戏。',
  url: 'https://gamedebug.github.io',
  author: '陆翊司',
  locale: 'zh_CN',
};

// Category display order; hidden categories keep their posts reachable by URL,
// in /posts/ and in search, but get no category page or navigation entry.
export const CATEGORY_META: Record<string, { hidden?: boolean; blurb: string }> = {
  技术: { blurb: 'Linux、内核、网络、存储、安全与云' },
  ACG: { blurb: '高达机体资料、游戏私服与云游戏' },
  科普: { blurb: '天文、数学、信息论与历史地理' },
  健康: { hidden: true, blurb: '2020 年初新冠与 MERS 资料' },
};

// Every social link from the old _config.yml, in the old display order.
export const SOCIAL = [
  { id: 'email', label: 'Email', href: 'mailto:luyisi1982@gmail.com' },
  { id: 'x', label: 'X (Twitter)', href: 'https://x.com/luyisi_82' },
  { id: 'facebook', label: 'Facebook', href: 'https://facebook.com/gamedebug' },
  { id: 'googleplus', label: 'Google+', href: 'https://plus.google.com/+陆翊司' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com/in/翊司-陆-5a379ba8' },
  { id: 'instagram', label: 'Instagram', href: 'https://instagram.com/louis.hellscream' },
  { id: 'github', label: 'GitHub', href: 'https://github.com/gamedebug' },
  { id: 'stackoverflow', label: 'Stack Overflow', href: 'https://stackoverflow.com/users/9968818/louis' },
  { id: 'steam', label: 'Steam', href: 'https://steamcommunity.com/id/gamedebug' },
  { id: 'soundcloud', label: 'SoundCloud', href: 'https://soundcloud.com/m4fj2ztesrcj' },
  { id: 'weibo', label: '微博', href: 'https://www.weibo.com/louis82' },
  { id: 'hackernews', label: 'Hacker News', href: 'https://news.ycombinator.com/user?id=gamedebug' },
] as const;

// Comments: fill in after enabling GitHub Discussions and installing the giscus
// app (https://giscus.app). Left empty, no comment widget is rendered.
export const GISCUS = {
  repo: 'gamedebug/gamedebug.github.io',
  repoId: '',
  category: 'Announcements',
  categoryId: '',
};

// Analytics: the GoatCounter site code (https://<code>.goatcounter.com).
// Left empty, no analytics script is rendered.
export const GOATCOUNTER_CODE = '';
