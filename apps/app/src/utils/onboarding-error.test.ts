import { describe, expect, it } from 'vitest'

import { getOnboardingErrorMessage } from './onboarding-error'

describe('getOnboardingErrorMessage', () => {
  it('explains when the API cannot be reached', () => {
    expect(
      getOnboardingErrorMessage(
        new Error('Network error calling PUT /v1/profile')
      )
    ).toBe('Could not connect to Akeso. Check that the API is running, then try again.')
  })

  it('uses a safe retry message for other failures', () => {
    expect(getOnboardingErrorMessage(new Error('Unexpected failure'))).toBe(
      'Could not save your profile. Please try again.'
    )
  })
})
