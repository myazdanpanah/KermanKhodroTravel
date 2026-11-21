import { expect, test, type Page } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:3100';
const SECRETARY = { username: 'e2e_secretary', password: 'e2e-pass-1234' };
const OUTSIDER = { username: 'e2e_outsider', password: 'e2e-pass-1234' };
const SUBJECT = 'نامه آزمون مرورگر دبیرخانه';

async function login(page: Page, user: { username: string; password: string }) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('#username').fill(user.username);
  await page.locator('#password').fill(user.password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

test('secretary without manager rights completes the flow; a non-member is blocked', async ({ page, browser }) => {
  await login(page, SECRETARY);

  // Create a draft from the workbench as a regular (sales-role) user.
  await page.goto(`${BASE_URL}/erp/office`);
  await expect(page.getByRole('heading', { name: 'میزکار اداری' })).toBeVisible();
  await page.getByRole('button', { name: 'نامه جدید' }).click();
  await page.getByLabel(/موضوع/).fill(SUBJECT);
  await page.getByLabel('نوع نامه').selectOption('outgoing');
  await page.getByLabel('دبیرخانه').selectOption({ label: 'E2E Secretariat (E2E)' });
  await page.getByLabel('اولویت').selectOption('high');
  await page.getByLabel(/گیرنده/).selectOption({ label: 'E2E Outsider' });
  await page.getByLabel(/متن نامه/).fill('برای تست مرورگر دبیرخانه');
  await page.getByRole('button', { name: 'ذخیره پیش‌نویس' }).click();
  await page.waitForURL(/\/erp\/office\/correspondence\/\d+$/);

  const letterUrl = page.url();
  const letterId = Number(letterUrl.match(/correspondence\/(\d+)/)?.[1]);
  expect(letterId).toBeGreaterThan(0);

  // The secretary is a secretariat member, so the register action is shown.
  const registerButton = page.getByRole('button', { name: 'ثبت در دبیرخانه' });
  await expect(registerButton).toBeVisible();
  await registerButton.click();
  // Digits are rendered in Persian across the UI; the type letter stays Latin.
  await expect(page.getByText(/\/E2E\/O\/[۰-۹]+/)).toBeVisible();

  // Refer the registered letter to the outsider with an instruction.
  await page.getByRole('button', { name: 'ارجاع', exact: true }).first().click();
  await page
    .locator('select')
    .filter({ hasText: 'انتخاب کاربر…' })
    .selectOption({ label: 'E2E Outsider' });
  await page.getByPlaceholder('دستور / توضیح برای گیرنده').fill('لطفاً بررسی و پاسخ دهید');
  await page.getByRole('button', { name: 'ارجاع', exact: true }).last().click();
  await expect(page.getByText('در جریان')).toBeVisible();
  await expect(page.getByText('لطفاً بررسی و پاسخ دهید')).toBeVisible();

  // Reply from the same non-manager secretary.
  await page.getByPlaceholder('متن پاسخ…').fill('پاسخ دبیرخانه');
  await page.getByRole('button', { name: 'ثبت پاسخ' }).click();
  await expect(page.getByText('پاسخ داده‌شده')).toBeVisible();

  // The outsider is the recipient, so they can open the letter but cannot register it.
  const outsiderContext = await browser.newContext({ baseURL: BASE_URL });
  const outsiderPage = await outsiderContext.newPage();
  await login(outsiderPage, OUTSIDER);
  await outsiderPage.goto(letterUrl);
  await expect(outsiderPage.getByRole('heading', { name: SUBJECT })).toBeVisible();
  await expect(outsiderPage.getByRole('button', { name: 'ثبت در دبیرخانه' })).toHaveCount(0);

  const token = await outsiderPage.evaluate(() => {
    const raw = localStorage.getItem('nexivo-auth');
    return raw ? JSON.parse(raw)?.state?.token ?? null : null;
  });
  expect(token).toBeTruthy();

  const blocked = await outsiderPage.request.post(
    `${BASE_URL}/api/v1/office/correspondence/${letterId}/register/`,
    { headers: { Authorization: `Bearer ${token}` }, data: {} },
  );
  expect(blocked.status()).toBe(403);
  await outsiderContext.close();
});
