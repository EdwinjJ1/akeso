const CONNECTION_ERROR_PATTERN = /network error|timed out|failed to fetch/i

export function getOnboardingErrorMessage(error: unknown): string {
  if (error instanceof Error && CONNECTION_ERROR_PATTERN.test(error.message)) {
    return 'Could not connect to Akeso. Check that the API is running, then try again.'
  }

  return 'Could not save your profile. Please try again.'
}
