import type { Register } from 'claude-code'

import { register as band } from './band'
import { register as guards } from './guards'

// A plugin has one hooks module and may not hook the same event twice without a matcher,
// so the parts that share this plugin are called from here and each owns its own events.
export const register: Register = (on, options) => {
  band(on, options)
  guards(on, options)
}
