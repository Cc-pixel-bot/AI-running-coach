/**
 * 中国田径协会《路跑赛事大众选手等级评定实施办法》（2025-03-22 版）成绩锚点。
 * 数据来源：当前版本 PRD 的跑者能力分级配置。
 *
 * 说明：PRD 只给出了 10km 的完整年龄组精英级成绩，半马/全马仅给出 29 岁以下档。
 * 因此 `elite` 只覆盖有权威数值的年龄组，缺档时 `eliteFor` 返回 null（不触发精英级拦截），
 * 避免用编造的数据做可达性判断。
 */
export const ATHLETICS_GRADES = {
  '5K': {
    label: '5公里',
    elite: [],
  },
  '10K': {
    label: '10公里',
    elite: [
      { gender: 'male', maxAge: 29, sec: 37 * 60 },
      { gender: 'male', maxAge: 34, sec: 38 * 60 },
      { gender: 'male', maxAge: 39, sec: 39 * 60 },
      { gender: 'male', maxAge: 120, sec: 40 * 60 },
      { gender: 'female', maxAge: 29, sec: 47 * 60 },
      { gender: 'female', maxAge: 34, sec: 48 * 60 },
      { gender: 'female', maxAge: 39, sec: 49 * 60 },
      { gender: 'female', maxAge: 120, sec: 50 * 60 },
    ],
  },
  'HM': {
    label: '半程马拉松',
    elite: [
      { gender: 'male', maxAge: 29, sec: 94 * 60 },
      { gender: 'female', maxAge: 29, sec: 109 * 60 },
    ],
  },
  MARATHON: {
    label: '全程马拉松',
    elite: [
      { gender: 'male', maxAge: 29, sec: 180 * 60 },
      { gender: 'female', maxAge: 29, sec: 200 * 60 },
    ],
  },
}

/**
 * 取某性别/年龄对应的精英级成绩（秒）。无权威数值时返回 null。
 */
export function eliteFor(distance, gender, age) {
  const table = ATHLETICS_GRADES[distance]?.elite || []
  const hit = table.find(
    (row) => row.gender === gender && age >= 20 && age <= row.maxAge,
  )
  return hit ? hit.sec : null
}
