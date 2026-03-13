/**
 * Clan utility functions (TH composition, etc.)
 */

/**
 * Calculate town hall composition for a clan
 * @param {Array} memberList - Array of clan members
 * @returns {Object} TH composition object with counts per TH level
 */
export const calculateTHComposition = (memberList) => {
  if (!memberList || !Array.isArray(memberList)) return {}

  const composition = {}
  const totalMembers = memberList.length

  memberList.forEach(member => {
    const th = member.townHallLevel
    composition[th] = (composition[th] || 0) + 1
  })

  // Calculate percentages for each TH level
  Object.keys(composition).forEach(th => {
    const count = composition[th]
    composition[th] = {
      count,
      percentage: totalMembers > 0 ? (count / totalMembers) * 100 : 0
    }
  })

  return composition
}
