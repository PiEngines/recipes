export const ROLE_LABELS = {
  kuechenchef: 'Küchenchef',
  chefkoch: 'Chefkoch',
  koch: 'Koch',
  kuechenhilfe: 'Küchenhilfe',
  // Legacy
  admin: 'Küchenchef',
  autor: 'Koch',
  leser: 'Küchenhilfe',
}

export function getRoleLabel(role) {
  return ROLE_LABELS[role] ?? role
}

export function isKuechenchef(user) {
  return user?.role === 'kuechenchef' || user?.role === 'admin'
}

export function isChefkochOrAbove(user) {
  return ['kuechenchef', 'chefkoch', 'admin'].includes(user?.role)
}

export function isKochOrAbove(user) {
  return ['kuechenchef', 'chefkoch', 'koch', 'admin', 'autor'].includes(user?.role)
}
