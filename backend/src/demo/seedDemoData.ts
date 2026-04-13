import { db } from "../db/client.js";
import * as userService from "../services/user.js";

const DEMO_USER = {
  name: "Test User",
  email: "test@example.com",
  password: "test123",
};

type DemoAccountType = "checking" | "savings" | "investment" | "income" | "expense";
type TransactionType = "income" | "expense" | "transfer";

type DemoAccountSpec = {
  key: string;
  name: string;
  type: DemoAccountType;
};

type AccountMap = Record<string, number>;

const DEMO_ACCOUNTS: DemoAccountSpec[] = [
  { key: "checking", name: "Checking Account", type: "checking" },
  { key: "savings", name: "Savings Account", type: "savings" },
  { key: "investment", name: "Investment Account", type: "investment" },
  { key: "income", name: "Salary Account", type: "income" },
  { key: "expense", name: "Expenses Account", type: "expense" },
];

function amount(value: number): string {
  return value.toFixed(2);
}

function dateAt(year: number, month0: number, day: number): string {
  return new Date(Date.UTC(year, month0, day)).toISOString().slice(0, 10);
}

function monthDays(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function deterministicNoise(seed: number): number {
  const x = Math.sin(seed * 99991) * 10000;
  return x - Math.floor(x);
}

function around(base: number, varianceRatio: number, seed: number): number {
  const centered = deterministicNoise(seed) * 2 - 1;
  return Math.max(0, base * (1 + centered * varianceRatio));
}

function pickDay(maxDay: number, preferredDay: number): number {
  return Math.min(Math.max(1, preferredDay), maxDay);
}

function isWinter(month0: number): boolean {
  return month0 === 11 || month0 <= 1;
}

function isSummer(month0: number): boolean {
  return month0 >= 5 && month0 <= 7;
}

export async function ensureDemoData(options?: { monthsBack?: number }): Promise<void> {
  const database = db();
  const monthsBack = Math.max(1, options?.monthsBack ?? 12);
  let user = await userService.getUserByEmail(DEMO_USER.email);

  if (!user) {
    const passwordHash = await Bun.password.hash(DEMO_USER.password, { algorithm: "argon2id" });
    await userService.createUser(DEMO_USER.name, DEMO_USER.email, passwordHash);
    user = await userService.getUserByEmail(DEMO_USER.email);
  }
  if (!user) throw new Error("Failed to create or load demo user");

  const existingTx = await database
    .selectFrom("transactions")
    .select((eb) => eb.fn.countAll().as("count"))
    .where("user_id", "=", user.id)
    .executeTakeFirst();
  if (Number(existingTx?.count ?? 0) > 0) return;

  const bank = await database
    .insertInto("banks")
    .values({ user_id: user.id, name: "Demo Bank", website: "https://example.com" })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  const accountIds = await createAccounts(user.id, bank.id);
  const incomes: number[] = [];
  const expenses: number[] = [];

  await seedMonthlyTransactions(user.id, accountIds, incomes, expenses, monthsBack);
  await seedBudgets(user.id);
  await seedInvestments(user.id, accountIds);
  await seedRefunds(user.id, incomes, expenses);
}

async function createAccounts(userId: number, bankId: number): Promise<AccountMap> {
  const database = db();
  const accountIds: AccountMap = {};
  for (const account of DEMO_ACCOUNTS) {
    const created = await database
      .insertInto("accounts")
      .values({
        user_id: userId,
        name: account.name,
        type: account.type,
        bank_id: bankId,
        currency: "EUR",
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();
    accountIds[account.key] = created.id;
  }
  return accountIds;
}

async function createTransaction(
  userId: number,
  fromAccountId: number,
  toAccountId: number,
  txDate: string,
  txType: TransactionType,
  description: string,
  category: string,
  value: number,
  subcategory?: string,
): Promise<number> {
  const database = db();
  const row = await database
    .insertInto("transactions")
    .values({
      user_id: userId,
      date: txDate,
      date_accountability: txDate,
      description,
      amount: amount(value),
      from_account_id: fromAccountId,
      to_account_id: toAccountId,
      category,
      subcategory: subcategory ?? null,
      type: txType,
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  return row.id;
}

async function seedMonthlyTransactions(
  userId: number,
  accounts: AccountMap,
  incomes: number[],
  expenses: number[],
  monthsBack: number,
): Promise<void> {
  const now = new Date();
  const checkingId = accounts["checking"]!;
  const savingsId = accounts["savings"]!;
  const investmentId = accounts["investment"]!;
  const incomeId = accounts["income"]!;
  const expenseId = accounts["expense"]!;

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month0 = d.getUTCMonth();
    const maxDay = monthDays(year, month0);
    const monthSeed = year * 100 + month0 + 1;
    const winterMultiplier = isWinter(month0) ? 1.25 : 0.95;
    const summerTravelMultiplier = isSummer(month0) ? 1.45 : 1;

    const salaryAmount = around(3200, 0.08, monthSeed + 1);
    incomes.push(
      await createTransaction(
        userId,
        incomeId,
        checkingId,
        dateAt(year, month0, pickDay(maxDay, 25)),
        "income",
        "Salary - Main Employment",
        "Salaires",
        salaryAmount,
        "Monthly salary",
      ),
    );

    if (month0 === 11) {
      incomes.push(
        await createTransaction(
          userId,
          incomeId,
          checkingId,
          dateAt(year, month0, pickDay(maxDay, 18)),
          "income",
          "Year-end bonus",
          "Salaires",
          around(1400, 0.2, monthSeed + 2),
          "Bonus",
        ),
      );
    }
    if (month0 === 5) {
      incomes.push(
        await createTransaction(
          userId,
          incomeId,
          checkingId,
          dateAt(year, month0, pickDay(maxDay, 20)),
          "income",
          "Vacation allowance",
          "Salaires",
          around(850, 0.15, monthSeed + 3),
          "Allowance",
        ),
      );
    }

    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 2)),
        "expense",
        "Rent",
        "Logement",
        780,
        "Loyer",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 11)),
        "expense",
        "Electricity & Gas",
        "Logement",
        around(68 * winterMultiplier, 0.18, monthSeed + 5),
        "Electricité & Gaz",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 8)),
        "expense",
        "Internet & Mobile",
        "Abonnements",
        52,
        "Internet",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 6)),
        "expense",
        "Home insurance",
        "Logement",
        18,
        "Assurance habitation",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 3)),
        "expense",
        "Netflix",
        "Abonnements",
        13,
        "Streaming vidéo",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 21)),
        "expense",
        "Spotify",
        "Abonnements",
        11,
        "Streaming audio",
      ),
    );

    for (let week = 0; week < 4; week++) {
      const day = pickDay(maxDay, 4 + week * 7);
      expenses.push(
        await createTransaction(
          userId,
          checkingId,
          expenseId,
          dateAt(year, month0, day),
          "expense",
          `Grocery Shopping - Week ${week + 1}`,
          "Alimentation & Restauration",
          around(82, 0.25, monthSeed + week + 10),
          "Supermarché / Epicerie",
        ),
      );
    }

    for (let week = 0; week < 2; week++) {
      const day = pickDay(maxDay, 10 + week * 14);
      expenses.push(
        await createTransaction(
          userId,
          checkingId,
          expenseId,
          dateAt(year, month0, day),
          "expense",
          "Fuel",
          "Auto & Transports",
          around(45, 0.22, monthSeed + week + 30),
          "Carburant",
        ),
      );
    }

    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 17)),
        "expense",
        "Public Transport Pass",
        "Auto & Transports",
        49,
        "Transports en commun",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 21)),
        "expense",
        "Restaurant",
        "Alimentation & Restauration",
        around(56 * summerTravelMultiplier, 0.28, monthSeed + 19),
        "Restaurants",
      ),
    );
    expenses.push(
      await createTransaction(
        userId,
        checkingId,
        expenseId,
        dateAt(year, month0, pickDay(maxDay, 24)),
        "expense",
        "Gym membership",
        "Sport",
        29,
        "Abonnement",
      ),
    );

    if (month0 === 11) {
      expenses.push(
        await createTransaction(
          userId,
          checkingId,
          expenseId,
          dateAt(year, month0, pickDay(maxDay, 15)),
          "expense",
          "Holiday gifts",
          "Cadeaux",
          around(280, 0.3, monthSeed + 50),
          "Cadeaux de Noël",
        ),
      );
    }
    if (month0 === 6 || month0 === 7) {
      expenses.push(
        await createTransaction(
          userId,
          checkingId,
          expenseId,
          dateAt(year, month0, pickDay(maxDay, 19)),
          "expense",
          "Vacation expenses",
          "Voyages",
          around(360, 0.35, monthSeed + 55),
          "Vacances",
        ),
      );
    }

    await createTransaction(
      userId,
      checkingId,
      savingsId,
      dateAt(year, month0, pickDay(maxDay, 27)),
      "transfer",
      "Monthly savings transfer",
      "Virements",
      around(Math.max(250, salaryAmount * 0.16), 0.3, monthSeed + 4),
      "Épargne",
    );

    await createTransaction(
      userId,
      checkingId,
      investmentId,
      dateAt(year, month0, pickDay(maxDay, 28)),
      "transfer",
      "Investment funding transfer",
      "Investments",
      around(Math.max(180, salaryAmount * 0.11), 0.35, monthSeed + 8),
      "Investissement",
    );
  }
}

async function seedBudgets(userId: number): Promise<void> {
  const database = db();
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;

  await database
    .insertInto("budgets")
    .values([
      { user_id: userId, category: "Logement", year, month, amount: "900" },
      { user_id: userId, category: "Alimentation & Restauration", year, month, amount: "480" },
      { user_id: userId, category: "Auto & Transports", year, month, amount: "220" },
      { user_id: userId, category: "Abonnements", year, month, amount: "80" },
      { user_id: userId, category: "Loisirs & Sorties", year, month, amount: "160" },
    ])
    .execute();
}

async function seedInvestments(userId: number, accounts: AccountMap): Promise<void> {
  const database = db();
  const checkingId = accounts["checking"]!;
  const investmentId = accounts["investment"]!;
  const now = new Date();

  const assets = await database
    .insertInto("assets")
    .values([
      { user_id: userId, symbol: "IWDA.AS", name: "iShares Core MSCI World UCITS ETF" },
      { user_id: userId, symbol: "VWCE.DE", name: "Vanguard FTSE All-World UCITS ETF" },
      { user_id: userId, symbol: "PE500.PA", name: "Amundi PEA S&P 500 ESG UCITS ETF" },
    ])
    .returning(["id", "symbol"])
    .execute();

  for (let i = 14; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const year = d.getUTCFullYear();
    const month0 = d.getUTCMonth();
    const maxDay = monthDays(year, month0);
    const txDate = dateAt(year, month0, Math.min(26, maxDay));
    const monthSeed = year * 100 + month0 + 1;
    const asset = assets[i % assets.length]!;
    const quantity = 1.2 + deterministicNoise(monthSeed + 91) * 4.4;
    const unitPrice = 85 + deterministicNoise(monthSeed + 92) * 110;
    const fee = 1.2 + deterministicNoise(monthSeed + 93) * 1.4;
    const tax = 0;
    const totalPaid = quantity * unitPrice + fee + tax;

    const mainTx = await database
      .insertInto("transactions")
      .values({
        user_id: userId,
        date: txDate,
        date_accountability: txDate,
        description: `Buy ${quantity.toFixed(4)} ${asset.symbol} at ${unitPrice.toFixed(2)}€`,
        amount: amount(quantity * unitPrice),
        from_account_id: checkingId,
        to_account_id: investmentId,
        category: "Investments",
        subcategory: "ETF purchase",
        type: "transfer",
      })
      .returning(["id"])
      .executeTakeFirstOrThrow();

    await database
      .updateTable("transactions")
      .set({ investment_id: mainTx.id })
      .where("id", "=", mainTx.id)
      .execute();

    await database
      .insertInto("investment_details")
      .values({
        transaction_id: mainTx.id,
        asset_id: asset.id,
        quantity: quantity.toFixed(6),
        unit_price: unitPrice.toFixed(6),
        fee: amount(fee),
        tax: amount(tax),
        total_paid: amount(totalPaid),
        investment_type: "Buy",
        pl_transaction_id: null,
        fee_transaction_id: null,
        tax_transaction_id: null,
        gain_loss_override: null,
        gain_loss_source: null,
        gain_loss_calculated: null,
      })
      .execute();
  }
}

async function seedRefunds(userId: number, incomes: number[], expenses: number[]): Promise<void> {
  if (incomes.length === 0 || expenses.length < 8) return;
  const database = db();
  const refundGroup = await database
    .insertInto("refund_groups")
    .values({
      user_id: userId,
      name: "Demo refunds",
      description: "Reimbursements, cashback and shared expense paybacks",
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();

  await database
    .insertInto("refund_items")
    .values([
      {
        user_id: userId,
        income_transaction_id: incomes[incomes.length - 1]!,
        expense_transaction_id: expenses[2]!,
        amount: 34.5,
        refund_group_id: refundGroup.id,
        description: "Health insurance reimbursement",
      },
      {
        user_id: userId,
        income_transaction_id: incomes[incomes.length - 2]!,
        expense_transaction_id: expenses[5]!,
        amount: 22.0,
        refund_group_id: refundGroup.id,
        description: "Work meal reimbursement",
      },
      {
        user_id: userId,
        income_transaction_id: incomes[incomes.length - 3]!,
        expense_transaction_id: expenses[8]!,
        amount: 15.75,
        refund_group_id: refundGroup.id,
        description: "Cashback refund",
      },
    ])
    .execute();
}
