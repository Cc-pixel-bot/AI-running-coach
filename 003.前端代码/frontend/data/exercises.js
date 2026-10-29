/**
 * 动作库 —— 当前版本 PRD 的练前动态热身、练后静态拉伸与力量动作库。
 *
 * 每个动作包含：名称、剂量、要点、所属分类、示范视频资源 ID。
 * 视频资源 ID 对应产品媒体库中的教学视频（Demo 阶段使用占位图 + 视频位说明）。
 */

export const WARMUP_LIBRARY = [
  {
    id: 'wu_walk',
    name: '快走 / 轻松慢跑',
    dose: '3–5 分钟',
    points: '呼吸放松，逐步升温，不进入训练强度',
    applies: ['all'],
    video: 'video_warmup_runner_01',
    source: 'Mayo Clinic 跑者热身',
  },
  {
    id: 'wu_ankle',
    name: '踝绕环 + 提踵',
    dose: '每侧 10 次 + 提踵 15 次',
    points: '动作慢而可控，脚掌三点支撑；不塌踝',
    applies: ['all'],
    video: 'video_warmup_runner_02',
    source: 'World Athletics 热身动作',
  },
  {
    id: 'wu_swing',
    name: '摆腿（前后 / 左右）',
    dose: '每侧 10 次',
    points: '扶稳支撑物，骨盆保持正对前方，不甩动',
    applies: ['tempo', 'interval', 'race', 'long'],
    video: 'video_warmup_runner_01',
    source: 'Mayo Clinic 跑者热身',
  },
  {
    id: 'wu_lunge',
    name: '动态弓步 + 转体',
    dose: '每侧 6–8 次',
    points: '前膝对准脚尖，幅度以无痛为准，躯干自然转动',
    applies: ['tempo', 'interval', 'race'],
    video: 'video_warmup_runner_01',
    source: 'Mayo Clinic 跑者热身',
  },
  {
    id: 'wu_highknee',
    name: '高抬腿 / 后踢腿',
    dose: '各 20 秒 × 2 组',
    points: '小步幅、轻落地、身体直立；不追求抬腿高度',
    applies: ['tempo', 'interval', 'race'],
    video: 'video_warmup_runner_02',
    source: 'World Athletics 热身动作',
  },
  {
    id: 'wu_strides',
    name: '渐进加速跑 strides',
    dose: '4–6 次 × 15–20 秒，间隔慢走',
    points: '从轻松到约 70–85% 主观速度，不冲刺；出现疼痛立即停止',
    applies: ['interval', 'tempo', 'race'],
    video: 'video_warmup_runner_02',
    source: 'World Athletics 热身动作',
  },
]

export const COOLDOWN_LIBRARY = [
  {
    id: 'cd_calf',
    name: '小腿腓肠肌拉伸',
    dose: '每侧 15–20 秒 × 2',
    points: '后脚跟着地，脚尖朝前，身体前倾至轻微牵拉',
    focus: '全部，尤其间歇 / 坡跑',
    video: 'video_stretch_runner_01',
    source: 'NHS 跑后拉伸',
  },
  {
    id: 'cd_quad',
    name: '股四头肌拉伸',
    dose: '每侧 15–20 秒 × 2',
    points: '膝盖并拢，骨盆保持中立，不要塌腰',
    focus: '全部',
    video: 'video_stretch_runner_01',
    source: 'NHS 跑后拉伸',
  },
  {
    id: 'cd_hamstring',
    name: '腘绳肌拉伸',
    dose: '每侧 15–20 秒 × 2',
    points: '背部自然，髋部折叠；不弓背硬压',
    focus: '长距离 / 节奏跑',
    video: 'video_stretch_runner_01',
    source: 'NHS 跑后拉伸',
  },
  {
    id: 'cd_glute',
    name: '臀肌 / 梨状肌拉伸',
    dose: '每侧 15–20 秒 × 2',
    points: '仰卧抱腿或交叉抱腿，保持呼吸，不拉扯膝关节',
    focus: '长距离 / 久坐用户',
    video: 'video_stretch_runner_01',
    source: 'NHS 跑后拉伸',
  },
  {
    id: 'cd_hipflexor',
    name: '髋屈肌拉伸',
    dose: '每侧 15–20 秒 × 2',
    points: '半跪，收紧腹部并轻收骨盆，避免腰部过伸',
    focus: '全部，尤其久坐用户',
    video: 'video_stretch_runner_02',
    source: 'NHS 全身放松',
  },
  {
    id: 'cd_innerthigh',
    name: '大腿内侧拉伸',
    dose: '15–20 秒 × 2',
    points: '坐姿脚掌相对，背部自然；不向下压膝盖',
    focus: '长距离 / 侧向动作较多',
    video: 'video_stretch_runner_01',
    source: 'NHS 跑后拉伸',
  },
]

export const STRENGTH_LIBRARY = {
  base: [
    { name: '徒手深蹲', dose: '3 × 15' },
    { name: '单腿臀桥', dose: '3 × 12 / 侧' },
    { name: '侧向弓步', dose: '3 × 10 / 侧' },
    { name: '髋外展（侧卧抬腿）', dose: '3 × 15 / 侧' },
    { name: '提踵', dose: '3 × 20' },
    { name: '平板支撑', dose: '3 × 40 秒' },
  ],
  knee: [
    { name: '靠墙静蹲', dose: '3 × 30 秒' },
    { name: '单腿臀桥', dose: '3 × 12 / 侧' },
    { name: '侧向弓步', dose: '3 × 10 / 侧' },
    { name: '髋外展强化', dose: '3 × 15 / 侧' },
  ],
  ankle: [
    { name: '蚌式开合', dose: '3 × 15 / 侧' },
    { name: '单腿站立平衡', dose: '3 × 30 秒 / 侧' },
    { name: '提踵', dose: '3 × 20' },
  ],
  calf: [
    { name: '单腿提踵慢速下放', dose: '3 × 12 / 侧' },
    { name: '台阶下落', dose: '3 × 10' },
  ],
  foot: [
    { name: '足底泡沫轴放松', dose: '2 分钟' },
    { name: '短趾抓毛巾', dose: '2 × 20' },
  ],
  itb: [
    { name: '侧向弓步', dose: '3 × 10 / 侧' },
    { name: '臀中肌 / 髋外展激活', dose: '3 × 15 / 侧' },
  ],
}

/** 伤病部位 → 力量课替代动作 key */
export const INJURY_STRENGTH_KEY = {
  膝盖: 'knee',
  脚踝: 'ankle',
  小腿: 'calf',
  足部: 'foot',
  髂胫束: 'itb',
}

/** 教练跑前心法（按强度档） */
export const COACH_QUOTES = {
  easy: '全程保持呼吸从容、步频轻盈。不争一时之快，把注意力放在动作稳定与节奏连续上。',
  aerobic: '把配速守在呼吸稳定的有氧区间，放松肩颈，别跟着别人的速度跑。',
  long: '长距离的重点是稳定完成。全程保持放松，让呼吸、步频和体感维持在可控范围。',
  tempo: '关键在最后 10 分钟还能不能维持呼吸节奏。宁可慢 5 秒，也要把这一段跑扎实。',
  interval: '每一组都是独立的：前 200 米丢掉紧张，跑完再想下一组。组间一定要走回来。',
  race: '按目标配速跑，前半程比你想的再保守一点。分段配速，不要前快后慢。',
  strength: '力量不是可选项。髋与核心稳住了，跑量才敢往上加。动作做慢、做标准。',
}

/** 今日训练页的智程提示：同一课型随机取用，避免每次进入看到固定话术。 */
export const COACH_DIALOGUES = {
  easy: [
    '今天不追速度，把呼吸放稳、脚步放轻。跑完计划距离，就是一次扎实积累。',
    '先用几分钟找到舒服节奏，再把步频和呼吸保持均匀。稳定完成比冲快更重要。',
    '把注意力放在放松的肩颈和轻盈落地上。今天的任务，是让身体舒服地完成训练。',
  ],
  aerobic: [
    '今天以稳定有氧为主，保持动作自然，让耐力在连续奔跑中慢慢累积。',
    '把速度留一点余量，呼吸平稳、步频轻快，完成比逞强更有价值。',
    '不需要和别人比较。守住自己的节奏，就是今天最好的训练质量。',
  ],
  long: [
    '长距离从容开跑，前半程刻意保守一点，把体力留给后半段。',
    '今天的重点是连续与稳定。把整段路拆成一个个轻松的小目标。',
    '让配速自然展开，不急于提速。耐力是在平稳完成中建立起来的。',
  ],
  tempo: [
    '节奏跑从稳定开始，先找到能持续的速度，再逐渐进入目标区间。',
    '今天关注的是节奏感：动作不变形、呼吸不慌乱，速度自然就会稳定。',
    '质量课不靠硬顶。把每一段跑得均匀，才是最有效的完成方式。',
  ],
  interval: [
    '间歇跑每一组都重新开始。专注当前这一段，组间充分恢复再进入下一组。',
    '速度训练更要保持放松。抬头、摆臂自然，让发力干净而有节奏。',
    '今天不必一开始就冲满。把强度逐组跑稳，最后一组依然能控制动作。',
  ],
  strength: [
    '今天的力量训练，为之后更稳定的跑姿打底。动作做慢，质量优先。',
    '专注髋部与核心的控制感。基础稳了，跑量和速度才有可靠支撑。',
    '每一次动作都保持可控，不追求数量，追求准确和稳定。',
  ],
}
