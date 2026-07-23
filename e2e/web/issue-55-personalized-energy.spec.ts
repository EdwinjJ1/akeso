import { expect, test, type Page } from '@playwright/test'

async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    ),
  }))
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1)
}

test('Issue 55 check-in shows explainable personalized score and saves calibration', async ({
  page,
}) => {
  await page.goto('/checkin')
  await expect(page.getByText('Daily check-in', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Good' }).click()
  await page.getByRole('button', { name: '7–8h' }).click()
  await page.getByRole('button', { name: '1–3h ago' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: '1–1.5L' }).click()
  await page.getByRole('button', { name: 'Get my energy plan' }).click()

  await expect(page.getByText(/% signal confidence$/)).toBeVisible()
  await expect(page.getByText('PERSONAL BASELINE', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Model energy-v2-multisignal', { exact: true })
  ).toBeVisible()
  await expect(page.getByText('Why this score', { exact: true })).toBeVisible()
  await expect(page.getByText('Feeling good (4/5)', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page
    .getByRole('button', { name: 'Calibrate energy 4 out of 5' })
    .click()
  await expect(
    page.getByText('Saved for future scores.', { exact: true })
  ).toBeVisible()
  await expect(
    page.getByText(
      'This never changes today’s saved score. It only improves future personal baselines.',
      { exact: true }
    )
  ).toBeVisible()
})
