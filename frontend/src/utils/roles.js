export const ROLE_LABELS = {
  chefkoch: 'Chefkoch',
  koch: 'Koch',
  kuechenhilfe: 'Küchenhilfe',
  // Legacy
  admin: 'Chefkoch',
  autor: 'Koch',
  leser: 'Küchenhilfe',
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

export function isChefkoch(user) {
  return user?.role === 'chefkoch' || user?.role === 'admin'
}

export function isKochOrAbove(user) {
  return ['chefkoch', 'koch', 'admin', 'autor'].includes(user?.role)
}
