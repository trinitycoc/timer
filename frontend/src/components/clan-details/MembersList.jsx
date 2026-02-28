import React from 'react'

function MembersList({ memberList, totalMembers }) {
  const getRoleIcon = (role) => {
    switch (role) {
      case 'leader': return '👑'
      case 'coLeader': return '⭐'
      case 'admin': return '🛡️'
      case 'member': return '👤'
      default: return '👤'
    }
  }

  const getRoleName = (role) => {
    switch (role) {
      case 'leader': return 'Leader'
      case 'coLeader': return 'Co-Leader'
      case 'admin': return 'Elder'
      case 'member': return 'Member'
      default: return role
    }
  }

  return (
    <div className="detail-section">
      <h3>👥 Members ({totalMembers})</h3>
      <div className="members-list">
        <div className="members-table">
          <div className="members-header">
            <div className="member-rank">#</div>
            <div className="member-name">Name</div>
            <div className="member-tag">Tag</div>
            <div className="member-role">Role</div>
            <div className="member-th">TH</div>
            <div className="member-trophies">Trophies</div>
            <div className="member-donations">Donations</div>
          </div>
          {memberList?.map((member, index) => (
            <div key={member.tag} className="member-row">
              <div className="member-rank">{index + 1}</div>
              <div className="member-name">
                {getRoleIcon(member.role)} {member.name}
              </div>
              <div className="member-tag">{member.tag || 'N/A'}</div>
              <div className="member-role">{getRoleName(member.role)}</div>
              <div className="member-th">TH{member.townHallLevel}</div>
              <div className="member-trophies">🏆 {member.trophies.toLocaleString()}</div>
              <div className="member-donations">
                ⬆️ {member.donations} | ⬇️ {member.donationsReceived}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MembersList

