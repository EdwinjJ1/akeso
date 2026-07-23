import { expect, test, type Page, type TestInfo } from '@playwright/test'

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

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string
) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  })
}

test('Issue 53 fixture report journey is complete and responsive', async ({
  page,
}, testInfo) => {
  await page.goto('/reports')
  await expect(page.getByText('Health reports', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Deterministic demo fixtures', { exact: true })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page
    .getByRole('button', { name: 'Load High & low flags report fixture' })
    .click()
  await expect(page.getByLabel('Result for Ferritin')).toHaveValue('18')
  await expect(page.getByText('Below report range', { exact: true })).toBeVisible()
  await expect(page.getByText('Above report range', { exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await attachScreenshot(page, testInfo, 'report-review')

  await page.getByRole('checkbox', { name: 'Confirm Haemoglobin' }).click()
  await page.getByLabel('Result for Ferritin').fill('42')
  await page.getByRole('checkbox', { name: 'Confirm Ferritin' }).click()
  await page
    .getByRole('button', { name: 'Save reviewed metrics and continue' })
    .click()

  await expect(page.getByText('Report saved', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Flagged pathology fixture', { exact: true })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)

  await page
    .getByRole('button', {
      name: 'View details for Flagged pathology fixture',
    })
    .click()
  await expect(page.getByText('All metrics', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Ferritin: 42 µg/L', { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText('LDL cholesterol: 5.1 mmol/L', { exact: true })
  ).toHaveCount(0)
  await expectNoHorizontalOverflow(page)

  await page
    .getByRole('button', { name: 'Edit report details and metrics' })
    .click()
  await page.getByLabel('Result for Ferritin').fill('18')
  await expect(page.getByText('Advice needs updating', { exact: true })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Confirm Ferritin' }).click()
  await page
    .getByRole('button', {
      name: 'Save report changes and regenerate advice',
    })
    .click()

  await expect(
    page.getByText(
      'Changes confirmed. Advice was regenerated from current metrics.',
      { exact: true }
    )
  ).toBeVisible()
  await expect(
    page.getByText('Ferritin: 18 µg/L', { exact: true }).first()
  ).toBeVisible()
  await expect(
    page.getByText('Review these results with a professional', { exact: true })
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
  await attachScreenshot(page, testInfo, 'updated-advice')

  await page
    .getByRole('button', { name: 'Delete this health report' })
    .click()
  await expect(page.getByText('Delete this report?', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm delete report' }).click()
  await expect(page).toHaveURL(/\/reports$/)
  await expect(
    page.getByText('Flagged pathology fixture', { exact: true })
  ).toHaveCount(0)
})

test('retry and low-confidence fixtures expose their required states', async ({
  page,
}) => {
  await page.goto('/reports')

  await page
    .getByRole('button', { name: 'Load Failure & retry report fixture' })
    .click()
  await expect(
    page.getByText(
      'Fixture parsing failed safely. The file is retained locally; retry to continue.',
      { exact: true }
    )
  ).toBeVisible()
  await page.getByRole('button', { name: 'Retry report extraction' }).click()
  await expect(page.getByLabel('Result for Creatinine')).toHaveValue('78')

  await page
    .getByRole('button', { name: 'Load Low confidence report fixture' })
    .click()
  await expect(page.getByText('42% confidence', { exact: true })).toBeVisible()
  await expect(
    page.getByText(
      'Why this needs review: The unit and printed reference range were not legible.',
      { exact: true }
    )
  ).toBeVisible()
  await expectNoHorizontalOverflow(page)
})
