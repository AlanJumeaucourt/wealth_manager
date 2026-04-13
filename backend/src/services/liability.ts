import { db } from "../db/client.js";
import { formatDateOnly, normalizeDateOnly, parseDateOnly } from "../utils/date.js";
import { NotFoundError, ValidationError } from "../utils/error.js";
import { round2, roundCeiling2 } from "../utils/money.js";
import { toNumber } from "../utils/number.js";
import { stringifyUnknown } from "../utils/stringifyUnknown.js";

type SortOrder = "asc" | "desc";

type LiabilityRecord = {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  liability_type: string;
  principal_amount: string | number;
  interest_rate: string | number;
  start_date: string;
  end_date: string | null;
  compounding_period: string;
  payment_frequency: string;
  payment_amount: string | number | null;
  deferral_period_months: number | null;
  deferral_type: string | null;
  direction: string;
  account_id: number | null;
  lender_name: string | null;
  currency: string;
  created_at: string | null;
  updated_at: string | null;
  capitalization_frequency: string | null;
  interest_calculation: string | null;
  first_period_days: number | null;
};

type LiabilityBalanceRecord = {
  principal_paid: string | number | null;
  interest_paid: string | number | null;
  remaining_balance: string | number | null;
  missed_payments_count: number | null;
  next_payment_date: string | null;
};

type LiabilityPaymentRecord = {
  transaction_id: number;
  user_id: number;
  liability_id: number;
  payment_date: string;
  amount: string | number;
  principal_amount: string | number;
  interest_amount: string | number;
  extra_payment: string | number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type LiabilityPaymentInput = {
  liability_id: number;
  payment_date: string;
  amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment?: number;
  transaction_id: number;
};

export type LiabilityPaymentPatch = Partial<LiabilityPaymentInput>;

export type LiabilityPaymentListParams = {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: SortOrder;
  filters?: Record<string, string | number>;
};

export type LiabilityScheduleStatus = "upcoming" | "missed";

export type LiabilityScheduleStatusListParams = {
  status: LiabilityScheduleStatus;
  page?: number;
  per_page?: number;
  sort_order?: SortOrder;
  search?: string;
  from_date?: string;
  to_date?: string;
  days_ahead?: number;
  filters?: {
    liability_id?: number;
    direction?: string;
    account_id?: number;
    liability_type?: string;
  };
};

export type LiabilityScheduleStatusItem = {
  liability_id: number;
  liability_name: string;
  liability_type: string;
  direction: string;
  account_id?: number;
  lender_name?: string;
  currency: string;
  payment_number: number;
  payment_date: string;
  scheduled_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  extra_payment: number;
  remaining_principal: number;
  transaction_id?: number | null;
  is_actual_payment: boolean;
  is_deferred: boolean;
  deferral_type: "none" | "partial" | "total";
  date_shifted: boolean;
  status: LiabilityScheduleStatus;
  days_from_today: number;
};

export type AmortizationScheduleItem = {
  payment_number: number;
  payment_date: string;
  scheduled_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  capitalized_interest: number;
  remaining_principal: number;
  transaction_id?: number | null;
  is_actual_payment: boolean;
  extra_payment: number;
  date_shifted: boolean;
  is_deferred: boolean;
  deferral_type: "none" | "partial" | "total";
  is_final_balloon_payment?: boolean;
  total_interest_paid?: number;
  total_principal_paid?: number;
  total_capitalized_interest?: number;
};

type ScheduleOverrideRowInput = {
  payment_number: number;
  payment_date: string;
  scheduled_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  capitalized_interest: number;
  remaining_principal: number;
  is_deferred: boolean;
  deferral_type: "none" | "partial" | "total";
};

function getFirstProportionnelPaymentDate(startDate: Date): Date {
  // Convention for proportionnel CA-style loans:
  // first payment on the 5th of the month following disbursement.
  return new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, 5));
}

function buildAnnualCapitalizationDeferralSchedule(params: {
  principal: number;
  annualRate: number;
  startDate: Date;
  deferralMonths: number;
  firstPeriodDate: Date;
  firstPeriodInterest: number;
}): Array<{
  paymentNumber: number;
  paymentDate: string;
  capitalizedInterest: number;
  remainingPrincipal: number;
}> {
  const { principal, annualRate, startDate, deferralMonths, firstPeriodDate } = params;
  const monthlyRateDecimal = annualRate / 100 / 12;
  const result: Array<{
    paymentNumber: number;
    paymentDate: string;
    capitalizedInterest: number;
    remainingPrincipal: number;
  }> = [];

  let firstPeriodInterest = params.firstPeriodInterest;
  if (firstPeriodInterest === 0) {
    const disbursementDay = startDate.getUTCDate();
    const paymentDay = firstPeriodDate.getUTCDate();
    const paymentMonthDays = getDaysInMonth(
      firstPeriodDate.getUTCFullYear(),
      firstPeriodDate.getUTCMonth() + 1,
    );
    const prevMonthDays = getDaysInMonth(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1);
    const remainingDaysInDisbursementMonth = prevMonthDays - disbursementDay;
    const daysInNextMonth = paymentDay;
    const totalDays = remainingDaysInDisbursementMonth + daysInNextMonth;
    const fractionOfMonth = totalDays / paymentMonthDays;
    firstPeriodInterest = roundCeiling2(principal * monthlyRateDecimal * fractionOfMonth);
  }

  let capital = round2(principal + firstPeriodInterest);
  result.push({
    paymentNumber: 1,
    paymentDate: formatDateOnly(firstPeriodDate),
    capitalizedInterest: firstPeriodInterest,
    remainingPrincipal: capital,
  });

  let paymentNum = 2;
  let yearStartCapital = principal;
  let currentDate = addMonths(firstPeriodDate, 1);
  const remainingMonths = deferralMonths - 1;
  let monthsThisYear = 0;

  for (let m = 0; m < remainingMonths; m += 1) {
    const monthlyInterest = roundCeiling2(yearStartCapital * monthlyRateDecimal);
    capital = round2(capital + monthlyInterest);
    monthsThisYear += 1;

    if (monthsThisYear === 12) {
      yearStartCapital = capital;
      monthsThisYear = 0;
    }

    result.push({
      paymentNumber: paymentNum,
      paymentDate: formatDateOnly(currentDate),
      capitalizedInterest: monthlyInterest,
      remainingPrincipal: capital,
    });
    paymentNum += 1;
    currentDate = addMonths(currentDate, 1);
  }

  return result;
}

function calcAnnuityPayment(
  capitalizedPrincipal: number,
  periodRate: number,
  numPeriods: number,
): number {
  if (periodRate === 0) return round2(capitalizedPrincipal / numPeriods);
  return round2(
    (capitalizedPrincipal * periodRate * (1 + periodRate) ** numPeriods) /
      ((1 + periodRate) ** numPeriods - 1),
  );
}

function calcProportionnelFirstPeriod(params: {
  principal: number;
  annualRate: number;
  standardPayment: number;
  disbursementDate: Date;
  firstPaymentDate: Date;
}): {
  interest: number;
  capitalComponent: number;
  totalPayment: number;
  remainingAfter: number;
} {
  const { principal, annualRate, standardPayment, disbursementDate, firstPaymentDate } = params;
  const monthlyRate = annualRate / 100 / 12;

  const fullMonthInterest = round2(principal * monthlyRate);
  const capitalComponent = round2(standardPayment - fullMonthInterest);

  const disbursementDay = disbursementDate.getUTCDate();
  const paymentDay = firstPaymentDate.getUTCDate();
  const disbursementMonthDays = getDaysInMonth(
    disbursementDate.getUTCFullYear(),
    disbursementDate.getUTCMonth() + 1,
  );
  const remainingDaysInDisbursementMonth = disbursementMonthDays - disbursementDay;
  const fraction = (remainingDaysInDisbursementMonth + paymentDay) / disbursementMonthDays;

  const proportionalInterest = round2(principal * monthlyRate * fraction);
  const totalPayment = round2(capitalComponent + proportionalInterest);
  const remainingAfter = round2(principal - capitalComponent);

  return {
    interest: proportionalInterest,
    capitalComponent,
    totalPayment,
    remainingAfter,
  };
}

function todayUtc(): Date {
  return parseDateOnly(new Date().toISOString().slice(0, 10));
}

function addDays(value: Date, days: number): Date {
  const out = new Date(value.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function sameDate(left: Date, right: Date): boolean {
  return formatDateOnly(left) === formatDateOnly(right);
}

function addMonths(value: Date, months: number): Date {
  const month = value.getUTCMonth() + months;
  const year = value.getUTCFullYear() + Math.floor(month / 12);
  const normalizedMonth = ((month % 12) + 12) % 12;
  const day = Math.min(value.getUTCDate(), getDaysInMonth(year, normalizedMonth + 1));
  return new Date(Date.UTC(year, normalizedMonth, day));
}

function getDaysInMonth(year: number, month1Based: number): number {
  return new Date(Date.UTC(year, month1Based, 0)).getUTCDate();
}

function getNextPaymentDate(currentDate: Date, paymentFrequency: string): Date {
  if (paymentFrequency === "weekly") return addDays(currentDate, 7);
  if (paymentFrequency === "bi-weekly") return addDays(currentDate, 14);
  if (paymentFrequency === "monthly") return addMonths(currentDate, 1);
  if (paymentFrequency === "quarterly") return addMonths(currentDate, 3);
  if (paymentFrequency === "annually") return addMonths(currentDate, 12);
  return addMonths(currentDate, 1);
}

function calculateNumberOfPayments(
  startDate: Date,
  endDate: Date | null,
  paymentFrequency: string,
): number {
  if (!endDate || startDate >= endDate) return 0;
  let count = 0;
  let cursor = new Date(startDate.getTime());
  while (cursor <= endDate && count < 1200) {
    count += 1;
    if (sameDate(cursor, endDate) && count > 0) break;
    cursor = getNextPaymentDate(cursor, paymentFrequency);
    if (cursor > endDate && count > 0) break;
  }
  return count < 1200 ? count : 0;
}

function getPeriodInterestRate(
  annualRate: number,
  compoundingPeriod: string,
  paymentFrequency: string,
): number {
  const compoundingPeriodsPerYear: Record<string, number> = {
    daily: 365,
    monthly: 12,
    quarterly: 4,
    annually: 1,
  };
  const paymentsPerYear: Record<string, number> = {
    weekly: 52,
    "bi-weekly": 26,
    monthly: 12,
    quarterly: 4,
    annually: 1,
  };
  const annualRateDecimal = annualRate / 100;
  const compoundingN = compoundingPeriodsPerYear[compoundingPeriod] ?? 12;
  const paymentN = paymentsPerYear[paymentFrequency] ?? 12;
  if (!compoundingN || !paymentN) return 0;
  const ear = (1 + annualRateDecimal / compoundingN) ** compoundingN - 1;
  return Math.round(((1 + ear) ** (1 / paymentN) - 1) * 1e8) / 1e8;
}

function normalizeDeferralType(value: string | null | undefined): "none" | "partial" | "total" {
  if (value === "partial" || value === "total") return value;
  return "none";
}

function validatePaymentTotals(
  amount: number,
  principalAmount: number,
  interestAmount: number,
  extraPayment: number,
): void {
  const total = round2(principalAmount + interestAmount + extraPayment);
  if (Math.abs(round2(amount) - total) > 0.01) {
    throw new ValidationError(
      "Payment amount must equal principal_amount + interest_amount + extra_payment",
    );
  }
}

function serializeLiability(row: LiabilityRecord, balance?: LiabilityBalanceRecord | null) {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description ?? undefined,
    liability_type: row.liability_type,
    principal_amount: toNumber(row.principal_amount),
    interest_rate: toNumber(row.interest_rate),
    start_date: String(row.start_date).slice(0, 10),
    end_date: row.end_date != null ? String(row.end_date).slice(0, 10) : undefined,
    compounding_period: row.compounding_period,
    payment_frequency: row.payment_frequency,
    payment_amount: row.payment_amount != null ? toNumber(row.payment_amount) : undefined,
    deferral_period_months: Number(row.deferral_period_months ?? 0),
    deferral_type: normalizeDeferralType(row.deferral_type),
    direction: row.direction,
    account_id: row.account_id ?? undefined,
    lender_name: row.lender_name ?? undefined,
    currency: row.currency,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
    capitalization_frequency: row.capitalization_frequency ?? undefined,
    interest_calculation: row.interest_calculation ?? undefined,
    first_period_days: row.first_period_days ?? undefined,
    principal_paid: balance ? toNumber(balance.principal_paid) : undefined,
    interest_paid: balance ? toNumber(balance.interest_paid) : undefined,
    remaining_balance: balance
      ? toNumber(balance.remaining_balance, toNumber(row.principal_amount))
      : undefined,
    missed_payments_count: balance?.missed_payments_count ?? undefined,
    next_payment_date: balance?.next_payment_date ?? undefined,
  };
}

async function getLiabilityRecord(
  userId: number,
  liabilityId: number,
): Promise<LiabilityRecord | null> {
  const database = db();
  const row = await database
    .selectFrom("liabilities")
    .selectAll()
    .where("id", "=", liabilityId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return (row as LiabilityRecord | undefined) ?? null;
}

async function getLiabilityBalanceRecord(
  userId: number,
  liabilityId: number,
): Promise<LiabilityBalanceRecord | null> {
  const database = db();
  const row = await database
    .selectFrom("liability_balances")
    .select([
      "principal_paid",
      "interest_paid",
      "remaining_balance",
      "missed_payments_count",
      "next_payment_date",
    ])
    .where("liability_id", "=", liabilityId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return (row as LiabilityBalanceRecord | undefined) ?? null;
}

export async function getLiabilityWithDetails(userId: number, liabilityId: number) {
  const row = await getLiabilityRecord(userId, liabilityId);
  if (!row) return null;
  const balance = await getLiabilityBalanceRecord(userId, liabilityId);
  return serializeLiability(row, balance);
}

async function getLiabilitySummaryForPayment(userId: number, liabilityId: number) {
  const liability = await getLiabilityWithDetails(userId, liabilityId);
  if (!liability) return undefined;
  return {
    id: liability.id,
    name: liability.name,
    liability_type: liability.liability_type,
    principal_amount: liability.principal_amount,
    interest_rate: liability.interest_rate,
    payment_frequency: liability.payment_frequency,
  };
}

async function getTransactionNamesForPayment(userId: number, transactionId: number) {
  const database = db();
  const row = await database
    .selectFrom("transactions as t")
    .leftJoin("accounts as from_acc", "from_acc.id", "t.from_account_id")
    .leftJoin("accounts as to_acc", "to_acc.id", "t.to_account_id")
    .select(["from_acc.name as from_account_name", "to_acc.name as to_account_name"])
    .where("t.id", "=", transactionId)
    .where("t.user_id", "=", userId)
    .executeTakeFirst();
  if (!row) return undefined;
  return {
    from_account_name: row.from_account_name ?? undefined,
    to_account_name: row.to_account_name ?? undefined,
  };
}

async function serializeLiabilityPayment(row: LiabilityPaymentRecord, includeDetails = false) {
  const serialized = {
    id: row.transaction_id,
    user_id: row.user_id,
    liability_id: row.liability_id,
    payment_date: String(row.payment_date).slice(0, 10),
    amount: toNumber(row.amount),
    principal_amount: toNumber(row.principal_amount),
    interest_amount: toNumber(row.interest_amount),
    extra_payment: toNumber(row.extra_payment),
    transaction_id: row.transaction_id,
    created_at: row.created_at ?? undefined,
    updated_at: row.updated_at ?? undefined,
  } as {
    id: number;
    user_id: number;
    liability_id: number;
    payment_date: string;
    amount: number;
    principal_amount: number;
    interest_amount: number;
    extra_payment: number;
    transaction_id: number;
    created_at?: string;
    updated_at?: string;
    transaction?: { from_account_name?: string; to_account_name?: string };
    liability?: {
      id: number;
      name: string;
      liability_type: string;
      principal_amount: number;
      interest_rate: number;
      payment_frequency: string;
    };
  };

  if (includeDetails) {
    serialized.transaction = await getTransactionNamesForPayment(row.user_id, row.transaction_id);
    serialized.liability = await getLiabilitySummaryForPayment(row.user_id, row.liability_id);
  }

  return serialized;
}

async function getLiabilityPaymentRecord(
  userId: number,
  paymentId: number,
): Promise<LiabilityPaymentRecord | null> {
  const database = db();
  const row = await database
    .selectFrom("liability_payment_details")
    .selectAll()
    .where("transaction_id", "=", paymentId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return (row as LiabilityPaymentRecord | undefined) ?? null;
}

export async function getLiabilityPaymentById(userId: number, paymentId: number) {
  const row = await getLiabilityPaymentRecord(userId, paymentId);
  if (!row) return null;
  return serializeLiabilityPayment(row, true);
}

export async function listLiabilityPayments(userId: number, params: LiabilityPaymentListParams) {
  const database = db();
  const page = params.page ?? 1;
  const perPage = params.per_page ?? 20;
  const sortByInput = params.sort_by ?? "payment_date";
  const sortOrder = params.sort_order ?? "desc";
  const filters = params.filters ?? {};
  const sortBy = sortByInput === "id" ? "transaction_id" : sortByInput;
  const validSortFields = new Set([
    "transaction_id",
    "liability_id",
    "payment_date",
    "amount",
    "principal_amount",
    "interest_amount",
    "extra_payment",
    "created_at",
    "updated_at",
  ]);
  if (!validSortFields.has(sortBy)) {
    throw new ValidationError("Invalid sort_by");
  }

  let countQ = database
    .selectFrom("liability_payment_details")
    .select((eb) => eb.fn.countAll().as("total"))
    .where("user_id", "=", userId);
  let dataQ = database
    .selectFrom("liability_payment_details")
    .selectAll()
    .where("user_id", "=", userId);

  for (const [rawKey, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    const key = rawKey === "id" ? "transaction_id" : rawKey;
    if (!validSortFields.has(key) && key !== "liability_id") continue;
    const normalized = typeof value === "string" ? value : stringifyUnknown(value);
    const column = key as keyof LiabilityPaymentRecord;
    if (normalized.includes(",")) {
      const values = normalized
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      countQ = countQ.where(column, "in", values);
      dataQ = dataQ.where(column, "in", values);
    } else {
      countQ = countQ.where(column, "=", normalized);
      dataQ = dataQ.where(column, "=", normalized);
    }
  }

  const countRows = await countQ.execute();
  const total = countRows[0]?.total;
  const rows = await dataQ
    .orderBy(sortBy as keyof LiabilityPaymentRecord, sortOrder)
    .limit(perPage)
    .offset((page - 1) * perPage)
    .execute();

  return {
    items: await Promise.all(
      (rows as LiabilityPaymentRecord[]).map((row) => serializeLiabilityPayment(row, false)),
    ),
    total: Number(total ?? 0),
    page,
    per_page: perPage,
  };
}

export async function getLiabilityPaymentsForLiability(userId: number, liabilityId: number) {
  const database = db();
  const rows = await database
    .selectFrom("liability_payment_details")
    .selectAll()
    .where("liability_id", "=", liabilityId)
    .where("user_id", "=", userId)
    .orderBy("payment_date", "asc")
    .orderBy("transaction_id", "asc")
    .execute();
  return {
    items: await Promise.all(
      (rows as LiabilityPaymentRecord[]).map((row) => serializeLiabilityPayment(row, true)),
    ),
  };
}

async function listLiabilityRecordsForStatus(
  userId: number,
  params: LiabilityScheduleStatusListParams,
): Promise<LiabilityRecord[]> {
  const database = db();
  const filters = params.filters ?? {};
  let query = database.selectFrom("liabilities").selectAll().where("user_id", "=", userId);

  if (filters.liability_id != null) {
    query = query.where("id", "=", filters.liability_id);
  }
  if (filters.direction) {
    query = query.where("direction", "=", filters.direction);
  }
  if (filters.account_id != null) {
    query = query.where("account_id", "=", filters.account_id);
  }
  if (filters.liability_type) {
    query = query.where("liability_type", "=", filters.liability_type);
  }
  if (params.search) {
    const like = `%${params.search}%`;
    query = query.where((eb) =>
      eb.or([
        eb("name", "like", like),
        eb("description", "like", like),
        eb("lender_name", "like", like),
      ]),
    );
  }

  const rows = await query.orderBy("start_date", "asc").orderBy("id", "asc").execute();
  return rows as LiabilityRecord[];
}

function buildStatusDateRange(params: LiabilityScheduleStatusListParams) {
  const today = todayUtc();
  const requestedFrom = params.from_date ? parseDateOnly(params.from_date) : null;
  const requestedTo = params.to_date ? parseDateOnly(params.to_date) : null;
  const daysAhead = Math.max(0, Number(params.days_ahead ?? 30));

  if (params.status === "upcoming") {
    const start = requestedFrom && requestedFrom > today ? requestedFrom : today;
    const defaultEnd = addDays(today, daysAhead);
    const end = requestedTo && requestedTo < defaultEnd ? requestedTo : defaultEnd;
    if (start > end) {
      throw new ValidationError("Invalid date range for upcoming status");
    }
    return { today, start, end };
  }

  const yesterday = addDays(today, -1);
  const start = requestedFrom;
  const end = requestedTo && requestedTo < yesterday ? requestedTo : yesterday;
  if (start && start > end) {
    throw new ValidationError("Invalid date range for missed status");
  }
  return { today, start, end };
}

function daysBetweenDates(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function createScheduleStatusItem(
  liability: LiabilityRecord,
  item: AmortizationScheduleItem,
  status: LiabilityScheduleStatus,
  today: Date,
): LiabilityScheduleStatusItem {
  const paymentDate = parseDateOnly(item.payment_date);
  return {
    liability_id: liability.id,
    liability_name: liability.name,
    liability_type: liability.liability_type,
    direction: liability.direction,
    account_id: liability.account_id ?? undefined,
    lender_name: liability.lender_name ?? undefined,
    currency: liability.currency,
    payment_number: item.payment_number,
    payment_date: item.payment_date,
    scheduled_date: item.scheduled_date,
    payment_amount: item.payment_amount,
    principal_amount: item.principal_amount,
    interest_amount: item.interest_amount,
    extra_payment: item.extra_payment,
    remaining_principal: item.remaining_principal,
    transaction_id: item.transaction_id,
    is_actual_payment: item.is_actual_payment,
    is_deferred: item.is_deferred,
    deferral_type: item.deferral_type,
    date_shifted: item.date_shifted,
    status,
    days_from_today: daysBetweenDates(today, paymentDate),
  };
}

export async function listLiabilityScheduleStatusItems(
  userId: number,
  params: LiabilityScheduleStatusListParams,
) {
  const page = params.page ?? 1;
  const perPage = params.per_page ?? 20;
  const sortOrder = params.sort_order ?? (params.status === "upcoming" ? "asc" : "desc");
  const { today, start, end } = buildStatusDateRange(params);
  const upcomingStart = start ?? today;
  const liabilities = await listLiabilityRecordsForStatus(userId, params);
  const items: LiabilityScheduleStatusItem[] = [];

  for (const liability of liabilities) {
    const schedule = await generateAmortizationSchedule(liability.id, userId);
    for (const entry of schedule) {
      if (entry.transaction_id || entry.is_deferred) continue;

      const paymentDate = parseDateOnly(entry.payment_date);
      const isMissed = paymentDate < today;
      const isUpcoming = paymentDate >= today;

      if (params.status === "missed") {
        if (!isMissed) continue;
        if (start && paymentDate < start) continue;
        if (paymentDate > end) continue;
      } else {
        if (!isUpcoming) continue;
        if (paymentDate < upcomingStart || paymentDate > end) continue;
      }

      items.push(createScheduleStatusItem(liability, entry, params.status, today));
    }
  }

  items.sort((left, right) => {
    const leftTime = parseDateOnly(left.payment_date).getTime();
    const rightTime = parseDateOnly(right.payment_date).getTime();
    if (leftTime !== rightTime) {
      return sortOrder === "asc" ? leftTime - rightTime : rightTime - leftTime;
    }
    return left.liability_id - right.liability_id;
  });

  return {
    items: items.slice((page - 1) * perPage, page * perPage),
    total: items.length,
    page,
    per_page: perPage,
  };
}

export async function createLiabilityPayment(userId: number, input: LiabilityPaymentInput) {
  const extraPayment = input.extra_payment ?? 0;
  validatePaymentTotals(input.amount, input.principal_amount, input.interest_amount, extraPayment);

  const database = db();
  await database
    .insertInto("liability_payment_details")
    .values({
      transaction_id: input.transaction_id,
      liability_id: input.liability_id,
      user_id: userId,
      payment_date: input.payment_date,
      amount: String(input.amount),
      principal_amount: String(input.principal_amount),
      interest_amount: String(input.interest_amount),
      extra_payment: String(extraPayment),
    })
    .execute();

  const created = await getLiabilityPaymentById(userId, input.transaction_id);
  if (!created) {
    throw new ValidationError("Create liability payment: insert returned no row");
  }
  return created;
}

export async function recordLiabilityPayment(userId: number, input: LiabilityPaymentInput) {
  return createLiabilityPayment(userId, input);
}

export async function updateLiabilityPayment(
  userId: number,
  paymentId: number,
  patch: LiabilityPaymentPatch,
) {
  const existing = await getLiabilityPaymentRecord(userId, paymentId);
  if (!existing) return null;

  const merged = {
    liability_id: patch.liability_id ?? existing.liability_id,
    payment_date:
      patch.payment_date != null
        ? normalizeDateOnly(patch.payment_date)
        : String(existing.payment_date).slice(0, 10),
    amount: patch.amount ?? toNumber(existing.amount),
    principal_amount: patch.principal_amount ?? toNumber(existing.principal_amount),
    interest_amount: patch.interest_amount ?? toNumber(existing.interest_amount),
    extra_payment: patch.extra_payment ?? toNumber(existing.extra_payment),
    transaction_id: patch.transaction_id ?? existing.transaction_id,
  };

  validatePaymentTotals(
    merged.amount,
    merged.principal_amount,
    merged.interest_amount,
    merged.extra_payment,
  );

  const database = db();
  const updated = await database
    .updateTable("liability_payment_details")
    .set({
      transaction_id: merged.transaction_id,
      liability_id: merged.liability_id,
      payment_date: merged.payment_date,
      amount: String(merged.amount),
      principal_amount: String(merged.principal_amount),
      interest_amount: String(merged.interest_amount),
      extra_payment: String(merged.extra_payment),
      updated_at: new Date().toISOString(),
    })
    .where("transaction_id", "=", paymentId)
    .where("user_id", "=", userId)
    .executeTakeFirst();

  const changed = Number((updated as { numUpdatedRows?: bigint } | undefined)?.numUpdatedRows ?? 0);
  if (changed === 0) return null;

  return getLiabilityPaymentById(userId, merged.transaction_id);
}

export async function deleteLiabilityPayment(userId: number, paymentId: number): Promise<boolean> {
  const database = db();
  const result = await database
    .deleteFrom("liability_payment_details")
    .where("transaction_id", "=", paymentId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return Number((result as { numDeletedRows?: bigint } | undefined)?.numDeletedRows ?? 0) > 0;
}

type ExistingPaymentMap = Map<string, Array<Awaited<ReturnType<typeof serializeLiabilityPayment>>>>;

export async function generateAmortizationSchedule(
  liabilityId: number,
  userId: number,
): Promise<AmortizationScheduleItem[]> {
  const liability = await getLiabilityWithDetails(userId, liabilityId);
  if (!liability) return [];

  if (liability.name === "Prêt Etudiant CA") {
    console.log("[DEBUG] Generating schedule for Prêt Etudiant CA", {
      id: liability.id,
      principal: liability.principal_amount,
      interest_rate: liability.interest_rate,
      start_date: liability.start_date,
      end_date: liability.end_date,
      compounding_period: liability.compounding_period,
      payment_frequency: liability.payment_frequency,
      deferral_months: liability.deferral_period_months,
      deferral_type: liability.deferral_type,
      capitalization_frequency: liability.capitalization_frequency,
      interest_calculation: liability.interest_calculation,
      first_period_days: liability.first_period_days,
    });
  }

  const startDate = parseDateOnly(liability.start_date);
  const endDate = liability.end_date ? parseDateOnly(liability.end_date) : null;
  const principalAmount = liability.principal_amount;
  const interestRate = liability.interest_rate;
  const compoundingPeriod = liability.compounding_period;
  const paymentFrequency = liability.payment_frequency;
  const explicitPaymentAmount = liability.payment_amount;
  const deferralMonths = liability.deferral_period_months ?? 0;
  const deferralType = normalizeDeferralType(liability.deferral_type);
  const capitalizationFrequency = (liability.capitalization_frequency ?? "monthly") as string;
  const interestCalculation = (liability.interest_calculation ?? "actuariel") as string;
  const isAnnualCap = deferralType === "total" && capitalizationFrequency === "annually";
  const isProportionnel = interestCalculation === "proportionnel";

  const paymentRows = await getLiabilityPaymentsForLiability(userId, liabilityId);
  const existingPaymentsByDate: ExistingPaymentMap = new Map();
  const paymentWindowMap = new Map<string, string[]>();

  for (const payment of paymentRows.items) {
    const paymentDate = String(payment.payment_date).slice(0, 10);
    const list = existingPaymentsByDate.get(paymentDate) ?? [];
    list.push(payment);
    existingPaymentsByDate.set(paymentDate, list);

    const baseDate = parseDateOnly(paymentDate);
    for (let offset = -5; offset <= 5; offset += 1) {
      const windowKey = formatDateOnly(addDays(baseDate, offset));
      const dates = paymentWindowMap.get(windowKey) ?? [];
      dates.push(paymentDate);
      paymentWindowMap.set(windowKey, dates);
    }
  }

  const schedule: AmortizationScheduleItem[] = [];

  // If the user provided a custom override schedule, return it (with actual-payment markers applied).
  const processedPaymentIds = new Set<number>();

  {
    const database = db();
    const overrideRows = await database
      .selectFrom("liability_schedule_overrides")
      .selectAll()
      .where("user_id", "=", userId)
      .where("liability_id", "=", liabilityId)
      .orderBy("payment_number", "asc")
      .execute();

    if (overrideRows && overrideRows.length > 0) {
      const out: AmortizationScheduleItem[] = overrideRows.map((row) => {
        const paymentDate = String(row.payment_date).slice(0, 10);
        const scheduledDate = String(row.scheduled_date ?? row.payment_date).slice(0, 10);
        return {
          payment_number: Number(row.payment_number),
          payment_date: paymentDate,
          scheduled_date: scheduledDate,
          payment_amount: toNumber(row.payment_amount),
          principal_amount: toNumber(row.principal_amount),
          interest_amount: toNumber(row.interest_amount),
          capitalized_interest: toNumber(row.capitalized_interest),
          remaining_principal: toNumber(row.remaining_principal),
          transaction_id: null,
          is_actual_payment: false,
          extra_payment: 0,
          date_shifted: paymentDate !== scheduledDate,
          is_deferred: Boolean(Number(row.is_deferred ?? 0)),
          deferral_type: normalizeDeferralType(row.deferral_type),
        };
      });

      // Attach actual recorded payments (so the UI can show paid vs scheduled).
      for (const item of out) {
        const key = item.payment_date;
        let matchedPayments = existingPaymentsByDate.get(key) ?? [];
        if (matchedPayments.length === 0 && paymentWindowMap.has(key)) {
          let closestDate: string | null = null;
          let minDiff = Number.POSITIVE_INFINITY;
          for (const candidateDate of paymentWindowMap.get(key) ?? []) {
            const diff = Math.abs(
              parseDateOnly(candidateDate).getTime() - parseDateOnly(key).getTime(),
            );
            if (diff < minDiff) {
              minDiff = diff;
              closestDate = candidateDate;
            }
          }
          if (closestDate) matchedPayments = existingPaymentsByDate.get(closestDate) ?? [];
        }
        const actualPayment = matchedPayments.find(
          (payment) =>
            payment.transaction_id != null && !processedPaymentIds.has(payment.transaction_id),
        );
        if (actualPayment?.transaction_id != null) {
          item.transaction_id = actualPayment.transaction_id;
          item.is_actual_payment = true;
          item.payment_amount = round2(actualPayment.amount);
          item.principal_amount = round2(actualPayment.principal_amount);
          item.interest_amount = round2(actualPayment.interest_amount);
          item.extra_payment = round2(actualPayment.extra_payment ?? 0);
          processedPaymentIds.add(actualPayment.transaction_id);
        }
      }

      return out;
    }
  }

  let currentDate = new Date(startDate.getTime());
  let balanceBeforePayment = round2(principalAmount);
  let paymentNumber = 0;

  let periodInterestRate = getPeriodInterestRate(interestRate, compoundingPeriod, paymentFrequency);
  if (isProportionnel && paymentFrequency === "monthly") {
    periodInterestRate = Math.round((interestRate / 100 / 12) * 1e8) / 1e8;
  }
  let theoreticalPayment = explicitPaymentAmount;

  const totalPeriods = endDate
    ? calculateNumberOfPayments(startDate, endDate, paymentFrequency)
    : 0;
  let deferralEndDate = deferralMonths > 0 ? addMonths(startDate, deferralMonths) : null;
  let nonDeferredPeriods = 0;
  if (deferralEndDate && endDate) {
    nonDeferredPeriods = calculateNumberOfPayments(deferralEndDate, endDate, paymentFrequency);
  } else if (totalPeriods > 0 && deferralMonths > 0) {
    nonDeferredPeriods = totalPeriods - deferralMonths;
  }

  if (!theoreticalPayment && endDate && !isProportionnel) {
    if (nonDeferredPeriods > 0) {
      let estimatedPrincipalAfterDeferral = principalAmount;
      if (deferralType === "total") {
        for (let i = 0; i < deferralMonths; i += 1) {
          const monthlyInterest = estimatedPrincipalAfterDeferral * (interestRate / 100 / 12);
          estimatedPrincipalAfterDeferral += monthlyInterest;
        }
      }
      if (periodInterestRate === 0) {
        theoreticalPayment =
          nonDeferredPeriods > 0
            ? round2(estimatedPrincipalAfterDeferral / nonDeferredPeriods)
            : estimatedPrincipalAfterDeferral;
      } else {
        theoreticalPayment = round2(
          (estimatedPrincipalAfterDeferral *
            periodInterestRate *
            (1 + periodInterestRate) ** nonDeferredPeriods) /
            ((1 + periodInterestRate) ** nonDeferredPeriods - 1),
        );
      }
    } else if (totalPeriods > 0) {
      if (periodInterestRate === 0) {
        theoreticalPayment =
          totalPeriods > 0 ? round2(principalAmount / totalPeriods) : principalAmount;
      } else {
        theoreticalPayment = round2(
          (principalAmount * periodInterestRate * (1 + periodInterestRate) ** totalPeriods) /
            ((1 + periodInterestRate) ** totalPeriods - 1),
        );
      }
    } else {
      theoreticalPayment =
        periodInterestRate > 0
          ? round2(principalAmount * (1 + periodInterestRate))
          : principalAmount;
    }
  } else if (!theoreticalPayment && !isProportionnel) {
    theoreticalPayment = round2(principalAmount * periodInterestRate);
  }

  if (!theoreticalPayment && endDate && isProportionnel) {
    const firstPaymentDate = getFirstProportionnelPaymentDate(startDate);
    const equalPaymentPeriods = calculateNumberOfPayments(
      firstPaymentDate,
      endDate,
      paymentFrequency,
    );
    if (equalPaymentPeriods > 0) {
      theoreticalPayment = calcAnnuityPayment(
        principalAmount,
        periodInterestRate,
        equalPaymentPeriods,
      );
    }
  }

  if (isAnnualCap && deferralMonths > 0) {
    const deferralItems = buildAnnualCapitalizationDeferralSchedule({
      principal: principalAmount,
      annualRate: interestRate,
      startDate,
      deferralMonths,
      firstPeriodDate: getNextPaymentDate(startDate, paymentFrequency),
      firstPeriodInterest: 0,
    });

    for (const item of deferralItems) {
      schedule.push({
        payment_number: item.paymentNumber,
        payment_date: item.paymentDate,
        scheduled_date: item.paymentDate,
        payment_amount: 0,
        principal_amount: 0,
        interest_amount: 0,
        capitalized_interest: item.capitalizedInterest,
        remaining_principal: item.remainingPrincipal,
        transaction_id: null,
        is_actual_payment: false,
        extra_payment: 0,
        date_shifted: false,
        is_deferred: true,
        deferral_type: "total",
      });
    }

    const lastDeferralItem = deferralItems.at(-1);
    balanceBeforePayment = lastDeferralItem
      ? lastDeferralItem.remainingPrincipal
      : balanceBeforePayment;
    currentDate = addMonths(startDate, deferralMonths);
    paymentNumber = deferralItems.length;

    if (endDate) {
      const repaymentPeriods = calculateNumberOfPayments(currentDate, endDate, paymentFrequency);
      periodInterestRate = getPeriodInterestRate(interestRate, compoundingPeriod, paymentFrequency);
      if (isProportionnel && paymentFrequency === "monthly") {
        periodInterestRate = Math.round((interestRate / 100 / 12) * 1e8) / 1e8;
      }
      theoreticalPayment = calcAnnuityPayment(
        balanceBeforePayment,
        periodInterestRate,
        repaymentPeriods,
      );
    }

    deferralEndDate = null;
  }

  while (true) {
    paymentNumber += 1;
    if (paymentNumber > 1200) break;

    const isDeferred = !!(deferralEndDate && currentDate < deferralEndDate);
    const interestForPeriod =
      isProportionnel && paymentFrequency === "monthly"
        ? round2(balanceBeforePayment * (interestRate / 100 / 12))
        : round2(balanceBeforePayment * periodInterestRate);
    let currentDateKey = formatDateOnly(currentDate);
    let matchedPayments = existingPaymentsByDate.get(currentDateKey) ?? [];

    if (matchedPayments.length === 0 && paymentWindowMap.has(currentDateKey)) {
      let closestDate: string | null = null;
      let minDiff = Number.POSITIVE_INFINITY;
      for (const candidateDate of paymentWindowMap.get(currentDateKey) ?? []) {
        const diff = Math.abs(parseDateOnly(candidateDate).getTime() - currentDate.getTime());
        if (diff < minDiff) {
          minDiff = diff;
          closestDate = candidateDate;
        }
      }
      if (closestDate) {
        matchedPayments = existingPaymentsByDate.get(closestDate) ?? [];
      }
    }

    const actualPayment = matchedPayments.find(
      (payment) =>
        payment.transaction_id != null && !processedPaymentIds.has(payment.transaction_id),
    );

    let capitalizedInterestThisPeriod = 0;
    let currentItem: AmortizationScheduleItem;
    let currentRemainingPrincipal = balanceBeforePayment;

    if (actualPayment) {
      let paidPrincipal = round2(actualPayment.principal_amount);
      let paidInterest = round2(actualPayment.interest_amount);
      const paymentAmount = round2(actualPayment.amount);
      const extraPayment = round2(actualPayment.extra_payment ?? 0);
      const actualDate = parseDateOnly(actualPayment.payment_date);

      if (isDeferred) {
        if (deferralType === "total") {
          if (paidPrincipal === 0 && paidInterest === 0) {
            paidPrincipal = paymentAmount;
            paidInterest = 0;
          }
          capitalizedInterestThisPeriod = interestForPeriod;
          currentRemainingPrincipal = round2(
            balanceBeforePayment + interestForPeriod - paidPrincipal,
          );
        } else if (deferralType === "partial") {
          if (paidPrincipal === 0 && paidInterest === 0) {
            paidInterest = Math.min(paymentAmount, interestForPeriod);
            paidPrincipal = paymentAmount - paidInterest;
          }
          currentRemainingPrincipal = round2(balanceBeforePayment - paidPrincipal);
        } else {
          currentRemainingPrincipal = round2(balanceBeforePayment - paidPrincipal);
        }
      } else {
        currentRemainingPrincipal = round2(balanceBeforePayment - paidPrincipal);
      }

      currentItem = {
        payment_number: paymentNumber,
        payment_date: formatDateOnly(actualDate),
        scheduled_date: currentDateKey,
        payment_amount: paymentAmount,
        principal_amount: paidPrincipal,
        interest_amount: paidInterest,
        capitalized_interest: 0,
        remaining_principal: currentRemainingPrincipal,
        transaction_id: actualPayment.transaction_id,
        is_actual_payment: true,
        extra_payment: extraPayment,
        date_shifted: !sameDate(actualDate, currentDate),
        is_deferred: isDeferred,
        deferral_type: isDeferred ? deferralType : "none",
      };
      if (actualPayment.transaction_id != null) {
        processedPaymentIds.add(actualPayment.transaction_id);
      }
    } else {
      let theoreticalPrincipalPaid = 0;
      let theoreticalInterestPaid = 0;
      let currentPaymentAmount = theoreticalPayment ?? 0;

      if (isDeferred) {
        if (deferralType === "total") {
          theoreticalInterestPaid = 0;
          theoreticalPrincipalPaid = 0;
          capitalizedInterestThisPeriod = interestForPeriod;
          currentRemainingPrincipal = round2(balanceBeforePayment + interestForPeriod);
          currentPaymentAmount = 0;
        } else if (deferralType === "partial") {
          theoreticalInterestPaid = interestForPeriod;
          theoreticalPrincipalPaid = 0;
          currentPaymentAmount = theoreticalInterestPaid;
          currentRemainingPrincipal = balanceBeforePayment;
        } else {
          theoreticalInterestPaid = interestForPeriod;
          theoreticalPrincipalPaid = round2(currentPaymentAmount - theoreticalInterestPaid);
          theoreticalPrincipalPaid = Math.max(theoreticalPrincipalPaid, 0);
          theoreticalPrincipalPaid = Math.min(theoreticalPrincipalPaid, balanceBeforePayment);
          currentPaymentAmount = round2(theoreticalPrincipalPaid + theoreticalInterestPaid);
          currentRemainingPrincipal = round2(balanceBeforePayment - theoreticalPrincipalPaid);
        }
      } else {
        const isFirstPayment = paymentNumber === 1;

        if (
          deferralEndDate &&
          sameDate(currentDate, deferralEndDate) &&
          !explicitPaymentAmount &&
          endDate
        ) {
          const remainingPeriods = calculateNumberOfPayments(
            currentDate,
            endDate,
            paymentFrequency,
          );
          if (periodInterestRate > 0 && remainingPeriods > 0) {
            theoreticalPayment = round2(
              (balanceBeforePayment *
                periodInterestRate *
                (1 + periodInterestRate) ** remainingPeriods) /
                ((1 + periodInterestRate) ** remainingPeriods - 1),
            );
            currentPaymentAmount = theoreticalPayment;
          }
        }

        if (isFirstPayment && isProportionnel && theoreticalPayment != null) {
          const firstPaymentDate = getFirstProportionnelPaymentDate(startDate);
          const firstPeriod = calcProportionnelFirstPeriod({
            principal: principalAmount,
            annualRate: interestRate,
            standardPayment: currentPaymentAmount,
            disbursementDate: startDate,
            firstPaymentDate,
          });
          theoreticalInterestPaid = firstPeriod.interest;
          theoreticalPrincipalPaid = firstPeriod.capitalComponent;
          currentPaymentAmount = firstPeriod.totalPayment;
          currentRemainingPrincipal = firstPeriod.remainingAfter;
          currentDate = firstPaymentDate;
          currentDateKey = formatDateOnly(firstPaymentDate);
        } else if (isProportionnel) {
          theoreticalInterestPaid = round2(balanceBeforePayment * (interestRate / 100 / 12));
          theoreticalPrincipalPaid = round2(currentPaymentAmount - theoreticalInterestPaid);
          theoreticalPrincipalPaid = Math.max(theoreticalPrincipalPaid, 0);
          theoreticalPrincipalPaid = Math.min(theoreticalPrincipalPaid, balanceBeforePayment);
          currentPaymentAmount = round2(theoreticalPrincipalPaid + theoreticalInterestPaid);
          currentRemainingPrincipal = round2(balanceBeforePayment - theoreticalPrincipalPaid);
        } else {
          theoreticalInterestPaid = interestForPeriod;
          theoreticalPrincipalPaid = round2(currentPaymentAmount - theoreticalInterestPaid);
          theoreticalPrincipalPaid = Math.max(theoreticalPrincipalPaid, 0);
          theoreticalPrincipalPaid = Math.min(theoreticalPrincipalPaid, balanceBeforePayment);
          currentPaymentAmount = round2(theoreticalPrincipalPaid + theoreticalInterestPaid);
          currentRemainingPrincipal = round2(balanceBeforePayment - theoreticalPrincipalPaid);
        }
      }

      currentItem = {
        payment_number: paymentNumber,
        payment_date: currentDateKey,
        scheduled_date: currentDateKey,
        payment_amount: currentPaymentAmount,
        principal_amount: theoreticalPrincipalPaid,
        interest_amount: theoreticalInterestPaid,
        capitalized_interest: capitalizedInterestThisPeriod,
        remaining_principal: currentRemainingPrincipal,
        transaction_id: null,
        is_actual_payment: false,
        extra_payment: 0,
        date_shifted: false,
        is_deferred: isDeferred,
        deferral_type: isDeferred ? deferralType : "none",
      };
    }

    schedule.push(currentItem);
    balanceBeforePayment = currentRemainingPrincipal;

    if (round2(balanceBeforePayment) <= 0 && !isDeferred) break;
    if (endDate && currentDate >= endDate) break;

    currentDate = getNextPaymentDate(currentDate, paymentFrequency);
    if (endDate && currentDate > endDate && round2(balanceBeforePayment) > 0) {
      const finalInterest = round2(balanceBeforePayment * periodInterestRate);
      schedule.push({
        payment_number: paymentNumber + 1,
        payment_date: formatDateOnly(endDate),
        scheduled_date: formatDateOnly(endDate),
        payment_amount: round2(balanceBeforePayment + finalInterest),
        principal_amount: round2(balanceBeforePayment),
        interest_amount: finalInterest,
        capitalized_interest: 0,
        remaining_principal: 0,
        transaction_id: null,
        is_actual_payment: false,
        extra_payment: 0,
        date_shifted: false,
        is_deferred: false,
        deferral_type: "none",
        is_final_balloon_payment: true,
      });
      break;
    }
  }

  const allActualDates = [...existingPaymentsByDate.keys()].sort();
  const lastScheduleRow = schedule.at(-1);
  const lastScheduledDate = lastScheduleRow
    ? parseDateOnly(lastScheduleRow.payment_date)
    : startDate;

  for (const paymentDate of allActualDates) {
    const paymentDateObj = parseDateOnly(paymentDate);
    if (paymentDateObj <= lastScheduledDate) continue;
    for (const payment of existingPaymentsByDate.get(paymentDate) ?? []) {
      if (payment.transaction_id == null || processedPaymentIds.has(payment.transaction_id))
        continue;
      paymentNumber += 1;
      const previousBalance = schedule.at(-1)?.remaining_principal ?? 0;
      schedule.push({
        payment_number: paymentNumber,
        payment_date: paymentDate,
        scheduled_date: paymentDate,
        payment_amount: round2(payment.amount),
        principal_amount: round2(payment.principal_amount),
        interest_amount: round2(payment.interest_amount),
        capitalized_interest: 0,
        remaining_principal: round2(previousBalance - round2(payment.principal_amount)),
        transaction_id: payment.transaction_id,
        is_actual_payment: true,
        extra_payment: round2(payment.extra_payment ?? 0),
        date_shifted: false,
        is_deferred: false,
        deferral_type: "none",
      });
      processedPaymentIds.add(payment.transaction_id);
    }
  }

  const totalInterestPaid = round2(schedule.reduce((sum, item) => sum + item.interest_amount, 0));
  const totalPrincipalPaid = round2(schedule.reduce((sum, item) => sum + item.principal_amount, 0));
  const totalCapitalizedInterest = round2(
    schedule.reduce((sum, item) => sum + item.capitalized_interest, 0),
  );
  const scheduleLast = schedule.at(-1);
  if (scheduleLast) {
    scheduleLast.total_interest_paid = totalInterestPaid;
    scheduleLast.total_principal_paid = totalPrincipalPaid;
    scheduleLast.total_capitalized_interest = totalCapitalizedInterest;
  }

  return schedule;
}

function parseOverrideCsv(text: string): ScheduleOverrideRowInput[] {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) return [];
  const [, ...rows] = lines;
  return rows.map((line, index) => {
    const parts = line.split(",").map((p) => p.trim());
    const [
      payment_number,
      payment_date,
      scheduled_date,
      payment_amount,
      principal_amount,
      interest_amount,
      capitalized_interest,
      remaining_principal,
      is_deferred,
      deferral_type,
    ] = parts;
    return {
      payment_number: Number(payment_number || index + 1),
      payment_date: String(payment_date || ""),
      scheduled_date: String(scheduled_date || payment_date || ""),
      payment_amount: toNumber(payment_amount),
      principal_amount: toNumber(principal_amount),
      interest_amount: toNumber(interest_amount),
      capitalized_interest: toNumber(capitalized_interest),
      remaining_principal: toNumber(remaining_principal),
      is_deferred: String(is_deferred).toLowerCase() === "true",
      deferral_type: normalizeDeferralType(deferral_type),
    };
  });
}

export async function saveLiabilityScheduleOverrideCsv(
  userId: number,
  liabilityId: number,
  csv: string,
): Promise<{ success: boolean; updated: number }> {
  const database = db();
  const liability = await getLiabilityWithDetails(userId, liabilityId);
  if (!liability) {
    throw new NotFoundError("Liability not found");
  }

  const rows = parseOverrideCsv(csv);
  if (rows.length === 0) {
    // Clearing overrides is allowed by sending only header/empty.
    await database
      .deleteFrom("liability_schedule_overrides")
      .where("user_id", "=", userId)
      .where("liability_id", "=", liabilityId)
      .execute();
    return { success: true, updated: 0 };
  }

  await database
    .deleteFrom("liability_schedule_overrides")
    .where("user_id", "=", userId)
    .where("liability_id", "=", liabilityId)
    .execute();

  const now = new Date().toISOString();
  const insertRows = rows.map((r) => ({
    user_id: userId,
    liability_id: liabilityId,
    payment_number: r.payment_number,
    payment_date: normalizeDateOnly(r.payment_date),
    scheduled_date: normalizeDateOnly(r.scheduled_date),
    payment_amount: String(round2(r.payment_amount)),
    principal_amount: String(round2(r.principal_amount)),
    interest_amount: String(round2(r.interest_amount)),
    capitalized_interest: String(round2(r.capitalized_interest)),
    remaining_principal: String(round2(r.remaining_principal)),
    is_deferred: r.is_deferred ? 1 : 0,
    deferral_type: r.deferral_type,
    created_at: now,
    updated_at: now,
  }));

  await database.insertInto("liability_schedule_overrides").values(insertRows).execute();
  return { success: true, updated: insertRows.length };
}

async function ensureInvestmentPlExpenseAccount(userId: number): Promise<number> {
  const database = db();
  const existing = await database
    .selectFrom("accounts")
    .select("id")
    .where("user_id", "=", userId)
    .where("name", "=", "Investment P/L")
    .where("type", "=", "expense")
    .executeTakeFirst();
  if (existing?.id) return existing.id;

  const bank = await database
    .selectFrom("banks")
    .select("id")
    .where("user_id", "=", userId)
    .orderBy("id", "asc")
    .limit(1)
    .executeTakeFirst();
  if (!bank?.id) {
    throw new ValidationError("No bank found for user. Please create a bank first.");
  }

  const inserted = await database
    .insertInto("accounts")
    .values({
      user_id: userId,
      name: "Investment P/L",
      type: "expense",
      bank_id: bank.id,
      currency: "EUR",
    })
    .returning("id")
    .executeTakeFirst();
  if (!inserted?.id) {
    throw new ValidationError("Failed to create Investment P/L account");
  }
  return inserted.id;
}

export async function generateInterestExpenseTransactions(
  liabilityId: number,
  userId: number,
): Promise<{ success: boolean; message: string; created: number }> {
  const liability = await getLiabilityWithDetails(userId, liabilityId);
  if (!liability) {
    return { success: false, message: "Liability not found", created: 0 };
  }
  if (!liability.account_id) {
    return { success: false, message: "Liability has no associated account", created: 0 };
  }

  const database = db();
  const expenseAccountId = await ensureInvestmentPlExpenseAccount(userId);
  const schedule = await generateAmortizationSchedule(liabilityId, userId);
  let created = 0;

  for (const entry of schedule) {
    // Create an expense transaction for any interest recognized this period.
    // - For total deferral, this comes from capitalized_interest.
    // - For normal periods, this comes from interest_amount.
    const interestRecognized = round2(entry.interest_amount + entry.capitalized_interest);
    if (interestRecognized === 0) continue;

    const description = `Interest accrual for ${liability.name} (#${entry.payment_number})`;
    const existing = await database
      .selectFrom("transactions")
      .select("id")
      .where("user_id", "=", userId)
      .where("date", "=", entry.payment_date)
      .where("from_account_id", "=", liability.account_id)
      .where("to_account_id", "=", expenseAccountId)
      .where("description", "=", description)
      .executeTakeFirst();
    if (existing?.id) continue;

    const inserted = await database
      .insertInto("transactions")
      .values({
        user_id: userId,
        date: entry.payment_date,
        date_accountability: entry.payment_date,
        amount: String(interestRecognized),
        description,
        type: "expense",
        category: "Interest Expense",
        subcategory: `Loan Interest - ${liability.liability_type}`,
        from_account_id: liability.account_id,
        to_account_id: expenseAccountId,
      })
      .returning("id")
      .executeTakeFirst();
    if (inserted?.id) {
      created += 1;
      await database
        .insertInto("liability_generated_transactions")
        .values({
          user_id: userId,
          liability_id: liabilityId,
          transaction_id: inserted.id,
          kind: "interest_accrual",
          schedule_payment_number: entry.payment_number,
          schedule_date: entry.payment_date,
        })
        .execute();
    }
  }

  return {
    success: true,
    message: "Interest expense transactions generated successfully",
    created,
  };
}

export async function regenerateInterestExpenseTransactions(
  liabilityId: number,
  userId: number,
): Promise<{ success: boolean; deleted: number; created: number }> {
  const database = db();
  const existing = await database
    .selectFrom("liability_generated_transactions")
    .select(["transaction_id"])
    .where("user_id", "=", userId)
    .where("liability_id", "=", liabilityId)
    .where("kind", "=", "interest_accrual")
    .execute();
  const ids = (existing ?? [])
    .map((r) => Number(r.transaction_id))
    .filter((n: number) => Number.isFinite(n));

  if (ids.length > 0) {
    await database
      .deleteFrom("transactions")
      .where("user_id", "=", userId)
      .where("id", "in", ids)
      .execute();
  }
  await database
    .deleteFrom("liability_generated_transactions")
    .where("user_id", "=", userId)
    .where("liability_id", "=", liabilityId)
    .where("kind", "=", "interest_accrual")
    .execute();

  const result = await generateInterestExpenseTransactions(liabilityId, userId);
  return { success: true, deleted: ids.length, created: result.created };
}
