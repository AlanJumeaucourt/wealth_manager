import { sql, type Insertable, type Kysely } from "kysely";
import { db } from "../db/client.js";
import type { Database, InvestmentDetailsTable } from "../db/schema.js";
import { tCreateInvestmentSchema, tUpdateInvestmentSchema } from "../schemas/typebox.js";
import { NotFoundError, ValidationError } from "../utils/error.js";
import * as base from "./base.js";

const INVESTMENT_CATEGORY = "Investissements";
const FEE_SUBCATEGORY = "Frais bancaires";
const TAX_SUBCATEGORY = "Taxes";

type ActivityType = InvestmentDetailsTable["investment_type"];

type DB = Kysely<Database>;
type Trx = DB;

type CreateInvestmentInput = typeof tCreateInvestmentSchema.static;
type UpdateInvestmentInput = typeof tUpdateInvestmentSchema.static;

type InvestmentTransactionInsert = Insertable<Database["transactions"]>;

async function createInvestmentTransaction(
  trx: Trx,
  values: InvestmentTransactionInsert,
): Promise<number | null> {
  const row = await trx.insertInto("transactions").values(values).returningAll().executeTakeFirst();
  return row?.id ?? null;
}

function getOrCreateNamedAccount(
  trx: Trx,
  userId: number,
  params: { name: string; type: "income" | "expense" },
): Promise<number> {
  const { name, type } = params;
  return trx
    .selectFrom("accounts")
    .select("id")
    .where("user_id", "=", userId)
    .where("name", "=", name)
    .where("type", "=", type)
    .executeTakeFirst()
    .then((row: { id: number } | undefined) => {
      if (row?.id) return row.id;
      return trx
        .selectFrom("banks")
        .select("id")
        .where("user_id", "=", userId)
        .limit(1)
        .executeTakeFirst()
        .then((bank: { id: number } | undefined) => {
          if (!bank?.id) {
            throw new ValidationError("No bank found for user. Please create a bank first.");
          }
          return trx
            .insertInto("accounts")
            .values({
              user_id: userId,
              name,
              type,
              bank_id: bank.id,
              currency: "EUR",
            })
            .returningAll()
            .executeTakeFirst();
        })
        .then((inserted: { id: number } | undefined) => {
          if (!inserted?.id) {
            throw new ValidationError(`Failed to create ${name} account`);
          }
          return inserted.id;
        });
    });
}

function getOrCreatePlAccount(
  trx: Trx,
  userId: number,
  accountType: "income" | "expense",
): Promise<number> {
  return getOrCreateNamedAccount(trx, userId, { name: "Investment P/L", type: accountType });
}

function getOrCreateFeeAccount(trx: Trx, userId: number): Promise<number> {
  return getOrCreateNamedAccount(trx, userId, { name: "Investment Fees", type: "expense" });
}

async function getOrCreateAsset(
  trx: Trx,
  userId: number,
  symbol: string,
  name?: string,
): Promise<{ id: number; symbol: string }> {
  const normalized = symbol.trim().toUpperCase();
  const existing = await trx
    .selectFrom("assets")
    .select(["id", "symbol"])
    .where("user_id", "=", userId)
    .where(sql<boolean>`UPPER(TRIM(assets.symbol)) = ${normalized}`)
    .executeTakeFirst();
  if (existing) return { id: existing.id, symbol: existing.symbol };
  const inserted = await trx
    .insertInto("assets")
    .values({ user_id: userId, symbol: normalized, name: (name ?? symbol).trim() || normalized })
    .returningAll()
    .executeTakeFirst();
  if (!inserted?.id) {
    throw new ValidationError("Failed to create asset");
  }
  return { id: inserted.id, symbol: inserted.symbol };
}

export interface InvestmentResponse {
  id: number;
  transaction_id: number;
  activity_type: ActivityType;
  asset_id: number;
  date: string;
  fee: number;
  from_account_id: number;
  quantity: number;
  tax: number;
  to_account_id: number;
  total_paid: number;
  unit_price: number;
  user_id: number;
  pl_transaction_id: number | null;
  fee_transaction_id: number | null;
  tax_transaction_id: number | null;
  gain_loss_override: number | null;
  gain_loss_source: string | null;
  gain_loss_calculated: number | null;
}

async function computeCostBasisForAsset(
  trx: Trx,
  userId: number,
  assetId: number,
): Promise<{ totalCost: number; totalQuantity: number }> {
  const buyRows = await trx
    .selectFrom("investment_details")
    .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
    .select([
      "investment_details.quantity",
      "investment_details.unit_price",
      "investment_details.fee",
      "investment_details.tax",
    ])
    .where("investment_details.asset_id", "=", assetId)
    .where("transactions.user_id", "=", userId)
    .where("investment_details.investment_type", "=", "Buy")
    .execute();

  let totalCost = 0;
  let totalQuantity = 0;
  for (const r of buyRows ?? []) {
    const q = Number(r.quantity);
    const up = Number(r.unit_price);
    const f = Number(r.fee ?? 0);
    const t = Number(r.tax ?? 0);
    totalCost += q * up + f + t;
    totalQuantity += q;
  }
  return { totalCost, totalQuantity };
}

function attachRelatedTransactions(
  trx: Trx,
  investmentId: number,
  relatedIds: Array<number | null>,
): Promise<void> {
  const ids = relatedIds.filter((x): x is number => x != null);
  if (ids.length === 0) return Promise.resolve();
  return trx
    .updateTable("transactions")
    .set({ investment_id: investmentId })
    .where("id", "in", ids)
    .execute()
    .then(() => undefined);
}

export async function createInvestment(
  userId: number,
  data: CreateInvestmentInput,
): Promise<InvestmentResponse> {
  const database = db();
  return database.transaction().execute(async (trx) => {
    let assetId: number;
    let asset: { symbol: string };
    if (data.asset_id != null) {
      const row = await trx
        .selectFrom("assets")
        .select(["id", "symbol"])
        .where("id", "=", data.asset_id)
        .where("user_id", "=", userId)
        .executeTakeFirst();
      if (!row?.symbol) {
        throw new NotFoundError(`Asset with ID ${data.asset_id} not found`);
      }
      assetId = row.id;
      asset = { symbol: row.symbol };
    } else if (data.symbol) {
      const resolved = await getOrCreateAsset(trx, userId, data.symbol, data.name);
      assetId = resolved.id;
      asset = { symbol: resolved.symbol };
    } else {
      throw new ValidationError("Either asset_id or symbol is required");
    }

    const activityType = data.activity_type as ActivityType;
    const investmentAccountId = activityType === "Buy" ? data.to_account_id : data.from_account_id;

    let plTransactionId: number | null = null;
    let feeTransactionId: number | null = null;
    let taxTransactionId: number | null = null;
    let gainLossSource: string | null = null;
    let gainLossCalculated: number | null = null;
    let gainLossOverride: number | null = data.gain_loss_override ?? null;

    const date = data.date;
    const descDate = date.slice(0, 10);

    if (activityType === "Buy") {
      const description = `Buy ${data.quantity} ${asset.symbol} at ${data.unit_price}€`;
      const amount = data.quantity * data.unit_price;

      if (data.fee > 0) {
        const feeAccountId = await getOrCreateFeeAccount(trx, userId);
        feeTransactionId = await createInvestmentTransaction(trx, {
          user_id: userId,
          date: descDate,
          date_accountability: descDate,
          description: `Investment fee for ${asset.symbol} buy`,
          amount: String(data.fee),
          from_account_id: investmentAccountId,
          to_account_id: feeAccountId,
          category: INVESTMENT_CATEGORY,
          subcategory: FEE_SUBCATEGORY,
          type: "expense",
        });
      }
      if (data.tax > 0) {
        const taxAccountId = await getOrCreateFeeAccount(trx, userId);
        taxTransactionId = await createInvestmentTransaction(trx, {
          user_id: userId,
          date: descDate,
          date_accountability: descDate,
          description: `Investment tax for ${asset.symbol} buy`,
          amount: String(data.tax),
          from_account_id: investmentAccountId,
          to_account_id: taxAccountId,
          category: INVESTMENT_CATEGORY,
          subcategory: TAX_SUBCATEGORY,
          type: "expense",
        });
      }

      const mainId = await createInvestmentTransaction(trx, {
        user_id: userId,
        date: descDate,
        date_accountability: descDate,
        description,
        amount: String(amount),
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        category: INVESTMENT_CATEGORY,
        type: "transfer",
      });
      if (!mainId) {
        throw new ValidationError("Insert main transaction failed");
      }

      await trx
        .updateTable("transactions")
        .set({ investment_id: mainId })
        .where("id", "=", mainId)
        .execute();

      await attachRelatedTransactions(trx, mainId, [feeTransactionId, taxTransactionId]);

      const totalPaid = data.quantity * data.unit_price + data.fee + data.tax;
      await trx
        .insertInto("investment_details")
        .values({
          transaction_id: mainId,
          asset_id: assetId,
          quantity: String(data.quantity),
          unit_price: String(data.unit_price),
          fee: String(data.fee),
          tax: String(data.tax),
          total_paid: String(totalPaid),
          investment_type: activityType,
          pl_transaction_id: null,
          fee_transaction_id: feeTransactionId,
          tax_transaction_id: taxTransactionId,
          gain_loss_override: gainLossOverride != null ? String(gainLossOverride) : null,
          gain_loss_source: gainLossSource,
          gain_loss_calculated: gainLossCalculated != null ? String(gainLossCalculated) : null,
        })
        .execute();

      return {
        id: mainId,
        transaction_id: mainId,
        activity_type: activityType,
        asset_id: assetId,
        date: descDate,
        fee: data.fee,
        from_account_id: data.from_account_id,
        quantity: data.quantity,
        tax: data.tax,
        to_account_id: data.to_account_id,
        total_paid: totalPaid,
        unit_price: data.unit_price,
        user_id: userId,
        pl_transaction_id: plTransactionId,
        fee_transaction_id: feeTransactionId,
        tax_transaction_id: taxTransactionId,
        gain_loss_override: gainLossOverride,
        gain_loss_source: gainLossSource,
        gain_loss_calculated: gainLossCalculated,
      };
    }

    if (activityType === "Sell") {
      const { totalCost, totalQuantity } = await computeCostBasisForAsset(trx, userId, assetId);
      const hasCostBasis = totalQuantity > 0;
      let costBasisForSale: number | null = null;
      if (hasCostBasis) {
        const saleRatio = data.quantity / totalQuantity;
        costBasisForSale = totalCost * saleRatio;
      }

      const grossSaleValue = data.quantity * data.unit_price;
      const saleProceeds = grossSaleValue - data.fee - data.tax;

      let profitLoss: number;
      if (gainLossOverride != null) {
        gainLossSource = "manual";
        profitLoss = gainLossOverride;
        if (hasCostBasis && costBasisForSale != null)
          gainLossCalculated = grossSaleValue - costBasisForSale;
      } else {
        gainLossSource = "calculated";
        if (!hasCostBasis || costBasisForSale == null) {
          throw new ValidationError("No cost basis found for this asset");
        }
        profitLoss = grossSaleValue - costBasisForSale;
        gainLossCalculated = profitLoss;
      }

      const [plExpenseId, plIncomeId] = await Promise.all([
        getOrCreatePlAccount(trx, userId, "expense"),
        getOrCreatePlAccount(trx, userId, "income"),
      ]);

      if (Math.abs(profitLoss) > 0.01) {
        const plDesc =
          profitLoss > 0
            ? `Investment P/L for ${asset.symbol} sale: gain (${gainLossSource})`
            : `Investment P/L for ${asset.symbol} sale: loss (${gainLossSource})`;
        const plType = profitLoss > 0 ? "income" : "expense";
        const plFrom = profitLoss > 0 ? plIncomeId : investmentAccountId;
        const plTo = profitLoss > 0 ? investmentAccountId : plExpenseId;
        plTransactionId = await createInvestmentTransaction(trx, {
          user_id: userId,
          date: descDate,
          date_accountability: descDate,
          description: plDesc,
          amount: String(Math.abs(profitLoss)),
          from_account_id: plFrom,
          to_account_id: plTo,
          category: INVESTMENT_CATEGORY,
          type: plType,
        });
      }

      if (data.fee > 0) {
        const feeAccountId = await getOrCreateFeeAccount(trx, userId);
        feeTransactionId = await createInvestmentTransaction(trx, {
          user_id: userId,
          date: descDate,
          date_accountability: descDate,
          description: `Investment fee for ${asset.symbol} sale`,
          amount: String(data.fee),
          from_account_id: investmentAccountId,
          to_account_id: feeAccountId,
          category: INVESTMENT_CATEGORY,
          subcategory: FEE_SUBCATEGORY,
          type: "expense",
        });
      }
      if (data.tax > 0) {
        const taxAccountId = await getOrCreateFeeAccount(trx, userId);
        taxTransactionId = await createInvestmentTransaction(trx, {
          user_id: userId,
          date: descDate,
          date_accountability: descDate,
          description: `Investment tax for ${asset.symbol} sale`,
          amount: String(data.tax),
          from_account_id: investmentAccountId,
          to_account_id: taxAccountId,
          category: INVESTMENT_CATEGORY,
          subcategory: TAX_SUBCATEGORY,
          type: "expense",
        });
      }

      const description = `Sell ${data.quantity} ${asset.symbol} at ${data.unit_price}€`;
      const mainId = await createInvestmentTransaction(trx, {
        user_id: userId,
        date: descDate,
        date_accountability: descDate,
        description,
        amount: String(saleProceeds),
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        category: INVESTMENT_CATEGORY,
        type: "transfer",
      });
      if (!mainId) {
        throw new ValidationError("Insert main transaction failed");
      }

      await trx
        .updateTable("transactions")
        .set({ investment_id: mainId })
        .where("id", "=", mainId)
        .execute();

      await attachRelatedTransactions(trx, mainId, [
        plTransactionId,
        feeTransactionId,
        taxTransactionId,
      ]);

      const totalPaid = data.quantity * data.unit_price + data.fee + data.tax;
      await trx
        .insertInto("investment_details")
        .values({
          transaction_id: mainId,
          asset_id: assetId,
          quantity: String(data.quantity),
          unit_price: String(data.unit_price),
          fee: String(data.fee),
          tax: String(data.tax),
          total_paid: String(totalPaid),
          investment_type: activityType,
          pl_transaction_id: plTransactionId,
          fee_transaction_id: feeTransactionId,
          tax_transaction_id: taxTransactionId,
          gain_loss_override: gainLossOverride != null ? String(gainLossOverride) : null,
          gain_loss_source: gainLossSource,
          gain_loss_calculated: gainLossCalculated != null ? String(gainLossCalculated) : null,
        })
        .execute();

      return {
        id: mainId,
        transaction_id: mainId,
        activity_type: activityType,
        asset_id: assetId,
        date: descDate,
        fee: data.fee,
        from_account_id: data.from_account_id,
        quantity: data.quantity,
        tax: data.tax,
        to_account_id: data.to_account_id,
        total_paid: totalPaid,
        unit_price: data.unit_price,
        user_id: userId,
        pl_transaction_id: plTransactionId,
        fee_transaction_id: feeTransactionId,
        tax_transaction_id: taxTransactionId,
        gain_loss_override: gainLossOverride,
        gain_loss_source: gainLossSource,
        gain_loss_calculated: gainLossCalculated,
      };
    }

    if (activityType === "Dividend") {
      const description = `Dividend ${asset.symbol} -> ${data.unit_price}€`;
      const amount = data.unit_price;
      const mainId = await createInvestmentTransaction(trx, {
        user_id: userId,
        date: descDate,
        date_accountability: descDate,
        description,
        amount: String(amount),
        from_account_id: data.from_account_id,
        to_account_id: data.to_account_id,
        category: INVESTMENT_CATEGORY,
        type: "transfer",
      });
      if (!mainId) {
        throw new ValidationError("Insert main transaction failed");
      }
      await trx
        .updateTable("transactions")
        .set({ investment_id: mainId })
        .where("id", "=", mainId)
        .execute();

      const totalPaid = data.unit_price;
      await trx
        .insertInto("investment_details")
        .values({
          transaction_id: mainId,
          asset_id: assetId,
          quantity: String(0),
          unit_price: String(data.unit_price),
          fee: String(0),
          tax: String(0),
          total_paid: String(totalPaid),
          investment_type: activityType,
          pl_transaction_id: null,
          fee_transaction_id: null,
          tax_transaction_id: null,
          gain_loss_override: null,
          gain_loss_source: null,
          gain_loss_calculated: null,
        })
        .execute();

      return {
        id: mainId,
        transaction_id: mainId,
        activity_type: activityType,
        asset_id: assetId,
        date: descDate,
        fee: 0,
        from_account_id: data.from_account_id,
        quantity: 0,
        tax: 0,
        to_account_id: data.to_account_id,
        total_paid: totalPaid,
        unit_price: data.unit_price,
        user_id: userId,
        pl_transaction_id: null,
        fee_transaction_id: null,
        tax_transaction_id: null,
        gain_loss_override: null,
        gain_loss_source: null,
        gain_loss_calculated: null,
      };
    }

    const description = `${activityType} ${data.quantity} ${asset.symbol} at ${data.unit_price}€`;
    const amount = data.quantity * data.unit_price;
    const mainId = await createInvestmentTransaction(trx, {
      user_id: userId,
      date: descDate,
      date_accountability: descDate,
      description,
      amount: String(amount),
      from_account_id: data.from_account_id,
      to_account_id: data.to_account_id,
      category: INVESTMENT_CATEGORY,
      type: "transfer",
    });
    if (!mainId) {
      throw new ValidationError("Insert main transaction failed");
    }
    await trx
      .updateTable("transactions")
      .set({ investment_id: mainId })
      .where("id", "=", mainId)
      .execute();

    const totalPaid = data.quantity * data.unit_price + data.fee + data.tax;
    await trx
      .insertInto("investment_details")
      .values({
        transaction_id: mainId,
        asset_id: assetId,
        quantity: String(data.quantity),
        unit_price: String(data.unit_price),
        fee: String(data.fee),
        tax: String(data.tax),
        total_paid: String(totalPaid),
        investment_type: activityType,
        pl_transaction_id: null,
        fee_transaction_id: null,
        tax_transaction_id: null,
        gain_loss_override: null,
        gain_loss_source: null,
        gain_loss_calculated: null,
      })
      .execute();

    return {
      id: mainId,
      transaction_id: mainId,
      activity_type: activityType,
      asset_id: assetId,
      date: descDate,
      fee: data.fee,
      from_account_id: data.from_account_id,
      quantity: data.quantity,
      tax: data.tax,
      to_account_id: data.to_account_id,
      total_paid: totalPaid,
      unit_price: data.unit_price,
      user_id: userId,
      pl_transaction_id: null,
      fee_transaction_id: null,
      tax_transaction_id: null,
      gain_loss_override: null,
      gain_loss_source: null,
      gain_loss_calculated: null,
    };
  });
}

export interface InvestmentDetail {
  transaction_id: number;
  investment_type: ActivityType;
  asset_id: number;
  fee: number;
  quantity: number;
  tax: number;
  total_paid?: number;
  unit_price: number;
  user_id: number;
  pl_transaction_id: number | null;
  fee_transaction_id: number | null;
  tax_transaction_id: number | null;
  gain_loss_override: number | null;
  gain_loss_source: string | null;
  gain_loss_calculated: number | null;
  asset_name: string | null;
  asset_symbol: string;
}

export async function getInvestmentById(
  investmentId: number,
  userId: number,
): Promise<{ investment: InvestmentDetail; transactions: Record<string, unknown>[] } | null> {
  const database = db();

  const mainTx = await database
    .selectFrom("transactions")
    .selectAll()
    .where("id", "=", investmentId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!mainTx) return null;

  const invRow = await database
    .selectFrom("investment_details")
    .innerJoin("assets", "assets.id", "investment_details.asset_id")
    .selectAll("investment_details")
    .select(["assets.symbol", "assets.name as asset_name"])
    .where("investment_details.transaction_id", "=", investmentId)
    .executeTakeFirst();

  if (!invRow) return null;

  const groupTxs = await database
    .selectFrom("transactions")
    .selectAll()
    .where("user_id", "=", userId)
    .where((eb) => eb.or([eb("id", "=", investmentId), eb("investment_id", "=", investmentId)]))
    .orderBy("date")
    .orderBy("id")
    .execute();

  // Shape must match frontend investmentDetailSchema.investment:
  // - strict investmentSchema fields
  // - plus optional asset_name and asset_symbol
  const investment: InvestmentDetail = {
    transaction_id: investmentId,
    investment_type: invRow.investment_type,
    asset_id: invRow.asset_id,
    fee: Number(invRow.fee ?? 0),
    quantity: Number(invRow.quantity),
    tax: Number(invRow.tax ?? 0),
    total_paid: invRow.total_paid != null ? Number(invRow.total_paid) : undefined,
    unit_price: Number(invRow.unit_price),
    user_id: mainTx.user_id,
    pl_transaction_id: invRow.pl_transaction_id ?? null,
    fee_transaction_id: invRow.fee_transaction_id ?? null,
    tax_transaction_id: invRow.tax_transaction_id ?? null,
    gain_loss_override:
      invRow.gain_loss_override != null ? Number(invRow.gain_loss_override) : null,
    gain_loss_source: invRow.gain_loss_source ?? null,
    gain_loss_calculated:
      invRow.gain_loss_calculated != null ? Number(invRow.gain_loss_calculated) : null,
    asset_name: invRow.asset_name,
    asset_symbol: invRow.symbol,
  };

  return {
    investment,
    transactions: groupTxs as Record<string, unknown>[],
  };
}

export async function deleteInvestment(investmentId: number, userId: number): Promise<boolean> {
  const database = db();

  const groupRow = (await database
    .selectFrom("transactions")
    .select((eb) => eb.fn.coalesce("investment_id", "id").as("group_id"))
    .where("id", "=", investmentId)
    .where("user_id", "=", userId)
    .executeTakeFirst()) as { group_id: number } | undefined;

  const groupId = groupRow?.group_id ?? investmentId;

  const txRows = await database
    .selectFrom("transactions")
    .select("id")
    .where("user_id", "=", userId)
    .where((eb) => eb.or([eb("id", "=", groupId), eb("investment_id", "=", groupId)]))
    .execute();

  const ids = (txRows as { id: number }[]).map((r) => r.id).filter((id) => id !== groupId);
  for (const id of ids) {
    await base.deleteOne("transactions", id, userId);
  }
  const ok = await base.deleteOne("transactions", groupId, userId);
  return ok;
}

export async function updateInvestment(
  investmentId: number,
  userId: number,
  data: UpdateInvestmentInput,
): Promise<InvestmentResponse | null> {
  const database = db();

  const existing = await database
    .selectFrom("investment_details")
    .innerJoin("transactions", "transactions.id", "investment_details.transaction_id")
    .selectAll("investment_details")
    .select(["transactions.date", "transactions.from_account_id", "transactions.to_account_id"])
    .where("investment_details.transaction_id", "=", investmentId)
    .where("transactions.user_id", "=", userId)
    .executeTakeFirst();

  if (!existing) return null;

  const activityType = (data.activity_type ?? existing.investment_type) as ActivityType;
  const assetId = data.asset_id ?? existing.asset_id;
  const quantity = data.quantity ?? Number(existing.quantity);
  const unitPrice = data.unit_price ?? Number(existing.unit_price);
  const fee = data.fee !== undefined ? data.fee : Number(existing.fee);
  const tax = data.tax !== undefined ? data.tax : Number(existing.tax);
  const fromAccountId = data.from_account_id ?? existing.from_account_id;
  const toAccountId = data.to_account_id ?? existing.to_account_id;
  const date = (data.date ?? existing.date) as string;
  const descDate = date.slice(0, 10);
  const gainLossOverride =
    data.gain_loss_override !== undefined
      ? data.gain_loss_override
      : existing.gain_loss_override != null
        ? Number(existing.gain_loss_override)
        : null;

  const asset = await database
    .selectFrom("assets")
    .select("symbol")
    .where("id", "=", assetId)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!asset?.symbol) {
    throw new NotFoundError(`Asset with ID ${assetId} not found`);
  }

  const investmentAccountId = activityType === "Buy" ? toAccountId : fromAccountId;

  return database.transaction().execute(async (trx) => {
    let plTransactionId: number | null = existing.pl_transaction_id ?? null;
    let feeTransactionId: number | null = existing.fee_transaction_id ?? null;
    let taxTransactionId: number | null = existing.tax_transaction_id ?? null;
    let gainLossSource: string | null = existing.gain_loss_source ?? null;
    let gainLossCalculated: number | null =
      existing.gain_loss_calculated != null ? Number(existing.gain_loss_calculated) : null;

    if (activityType === "Buy") {
      const description = `Buy ${quantity} ${asset.symbol} at ${unitPrice}€`;
      const amount = quantity * unitPrice;

      if (fee > 0) {
        const feeAccountId = await getOrCreateFeeAccount(trx, userId);
        const feeDesc = `Investment fee for ${asset.symbol} buy`;
        if (feeTransactionId) {
          await trx
            .updateTable("transactions")
            .set({
              date: descDate,
              date_accountability: descDate,
              description: feeDesc,
              amount: String(fee),
              from_account_id: investmentAccountId,
              to_account_id: feeAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: FEE_SUBCATEGORY,
              type: "expense",
            })
            .where("id", "=", feeTransactionId)
            .where("user_id", "=", userId)
            .execute();
        } else {
          const feeRow = await trx
            .insertInto("transactions")
            .values({
              user_id: userId,
              date: descDate,
              date_accountability: descDate,
              description: feeDesc,
              amount: String(fee),
              from_account_id: investmentAccountId,
              to_account_id: feeAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: FEE_SUBCATEGORY,
              type: "expense",
            })
            .returningAll()
            .executeTakeFirst();
          feeTransactionId = feeRow?.id ?? null;
        }
      } else if (feeTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", feeTransactionId)
          .where("user_id", "=", userId)
          .execute();
        feeTransactionId = null;
      }

      if (tax > 0) {
        const taxAccountId = await getOrCreateFeeAccount(trx, userId);
        const taxDesc = `Investment tax for ${asset.symbol} buy`;
        if (taxTransactionId) {
          await trx
            .updateTable("transactions")
            .set({
              date: descDate,
              date_accountability: descDate,
              description: taxDesc,
              amount: String(tax),
              from_account_id: investmentAccountId,
              to_account_id: taxAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: TAX_SUBCATEGORY,
              type: "expense",
            })
            .where("id", "=", taxTransactionId)
            .where("user_id", "=", userId)
            .execute();
        } else {
          const taxRow = await trx
            .insertInto("transactions")
            .values({
              user_id: userId,
              date: descDate,
              date_accountability: descDate,
              description: taxDesc,
              amount: String(tax),
              from_account_id: investmentAccountId,
              to_account_id: taxAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: TAX_SUBCATEGORY,
              type: "expense",
            })
            .returningAll()
            .executeTakeFirst();
          taxTransactionId = taxRow?.id ?? null;
        }
      } else if (taxTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", taxTransactionId)
          .where("user_id", "=", userId)
          .execute();
        taxTransactionId = null;
      }

      if (plTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", plTransactionId)
          .where("user_id", "=", userId)
          .execute();
        plTransactionId = null;
        gainLossSource = null;
        gainLossCalculated = null;
      }

      await trx
        .updateTable("transactions")
        .set({
          date: descDate,
          date_accountability: descDate,
          description,
          amount: String(amount),
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
        })
        .where("id", "=", investmentId)
        .where("user_id", "=", userId)
        .execute();

      const totalPaid = quantity * unitPrice + fee + tax;
      await trx
        .updateTable("investment_details")
        .set({
          asset_id: assetId,
          quantity: String(quantity),
          unit_price: String(unitPrice),
          fee: String(fee),
          tax: String(tax),
          total_paid: String(totalPaid),
          investment_type: activityType,
          pl_transaction_id: null,
          fee_transaction_id: feeTransactionId,
          tax_transaction_id: taxTransactionId,
          gain_loss_override: null,
          gain_loss_source: null,
          gain_loss_calculated: null,
        })
        .where("transaction_id", "=", investmentId)
        .execute();

      return {
        id: investmentId,
        transaction_id: investmentId,
        activity_type: activityType,
        asset_id: assetId,
        date: descDate,
        fee,
        from_account_id: fromAccountId,
        quantity,
        tax,
        to_account_id: toAccountId,
        total_paid: totalPaid,
        unit_price: unitPrice,
        user_id: userId,
        pl_transaction_id: null,
        fee_transaction_id: feeTransactionId,
        tax_transaction_id: taxTransactionId,
        gain_loss_override: null,
        gain_loss_source: null,
        gain_loss_calculated: null,
      };
    }

    if (activityType === "Sell") {
      const { totalCost, totalQuantity } = await computeCostBasisForAsset(trx, userId, assetId);
      const hasCostBasis = totalQuantity > 0;
      let costBasisForSale: number | null = null;
      if (hasCostBasis) {
        const saleRatio = quantity / totalQuantity;
        costBasisForSale = totalCost * saleRatio;
      }

      const grossSaleValue = quantity * unitPrice;
      const saleProceeds = grossSaleValue - fee - tax;

      let profitLoss: number;
      if (gainLossOverride != null) {
        gainLossSource = "manual";
        profitLoss = gainLossOverride;
        if (hasCostBasis && costBasisForSale != null)
          gainLossCalculated = grossSaleValue - costBasisForSale;
      } else {
        gainLossSource = "calculated";
        if (!hasCostBasis || costBasisForSale == null) {
          throw new ValidationError("No cost basis found for this asset");
        }
        profitLoss = grossSaleValue - costBasisForSale;
        gainLossCalculated = profitLoss;
      }

      const [plExpenseId, plIncomeId] = await Promise.all([
        getOrCreatePlAccount(trx, userId, "expense"),
        getOrCreatePlAccount(trx, userId, "income"),
      ]);

      if (Math.abs(profitLoss) > 0.01) {
        const plDesc =
          profitLoss > 0
            ? `Investment P/L for ${asset.symbol} sale: gain (${gainLossSource})`
            : `Investment P/L for ${asset.symbol} sale: loss (${gainLossSource})`;
        const plType = profitLoss > 0 ? "income" : "expense";
        const plFrom = profitLoss > 0 ? plIncomeId : investmentAccountId;
        const plTo = profitLoss > 0 ? investmentAccountId : plExpenseId;
        if (plTransactionId) {
          await trx
            .updateTable("transactions")
            .set({
              date: descDate,
              date_accountability: descDate,
              description: plDesc,
              amount: String(Math.abs(profitLoss)),
              from_account_id: plFrom,
              to_account_id: plTo,
              category: INVESTMENT_CATEGORY,
              type: plType,
            })
            .where("id", "=", plTransactionId)
            .where("user_id", "=", userId)
            .execute();
        } else {
          const plRow = await trx
            .insertInto("transactions")
            .values({
              user_id: userId,
              date: descDate,
              date_accountability: descDate,
              description: plDesc,
              amount: String(Math.abs(profitLoss)),
              from_account_id: plFrom,
              to_account_id: plTo,
              category: INVESTMENT_CATEGORY,
              type: plType,
            })
            .returningAll()
            .executeTakeFirst();
          plTransactionId = plRow?.id ?? null;
        }
      } else if (plTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", plTransactionId)
          .where("user_id", "=", userId)
          .execute();
        plTransactionId = null;
      }

      if (fee > 0) {
        const feeAccountId = await getOrCreateFeeAccount(trx, userId);
        const feeDesc = `Investment fee for ${asset.symbol} sale`;
        if (feeTransactionId) {
          await trx
            .updateTable("transactions")
            .set({
              date: descDate,
              date_accountability: descDate,
              description: feeDesc,
              amount: String(fee),
              from_account_id: investmentAccountId,
              to_account_id: feeAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: FEE_SUBCATEGORY,
              type: "expense",
            })
            .where("id", "=", feeTransactionId)
            .where("user_id", "=", userId)
            .execute();
        } else {
          const feeRow = await trx
            .insertInto("transactions")
            .values({
              user_id: userId,
              date: descDate,
              date_accountability: descDate,
              description: feeDesc,
              amount: String(fee),
              from_account_id: investmentAccountId,
              to_account_id: feeAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: FEE_SUBCATEGORY,
              type: "expense",
            })
            .returningAll()
            .executeTakeFirst();
          feeTransactionId = feeRow?.id ?? null;
        }
      } else if (feeTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", feeTransactionId)
          .where("user_id", "=", userId)
          .execute();
        feeTransactionId = null;
      }

      if (tax > 0) {
        const taxAccountId = await getOrCreateFeeAccount(trx, userId);
        const taxDesc = `Investment tax for ${asset.symbol} sale`;
        if (taxTransactionId) {
          await trx
            .updateTable("transactions")
            .set({
              date: descDate,
              date_accountability: descDate,
              description: taxDesc,
              amount: String(tax),
              from_account_id: investmentAccountId,
              to_account_id: taxAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: TAX_SUBCATEGORY,
              type: "expense",
            })
            .where("id", "=", taxTransactionId)
            .where("user_id", "=", userId)
            .execute();
        } else {
          const taxRow = await trx
            .insertInto("transactions")
            .values({
              user_id: userId,
              date: descDate,
              date_accountability: descDate,
              description: taxDesc,
              amount: String(tax),
              from_account_id: investmentAccountId,
              to_account_id: taxAccountId,
              category: INVESTMENT_CATEGORY,
              subcategory: TAX_SUBCATEGORY,
              type: "expense",
            })
            .returningAll()
            .executeTakeFirst();
          taxTransactionId = taxRow?.id ?? null;
        }
      } else if (taxTransactionId) {
        await trx
          .deleteFrom("transactions")
          .where("id", "=", taxTransactionId)
          .where("user_id", "=", userId)
          .execute();
        taxTransactionId = null;
      }

      const description = `Sell ${quantity} ${asset.symbol} at ${unitPrice}€`;
      await trx
        .updateTable("transactions")
        .set({
          date: descDate,
          date_accountability: descDate,
          description,
          amount: String(saleProceeds),
          from_account_id: fromAccountId,
          to_account_id: toAccountId,
        })
        .where("id", "=", investmentId)
        .where("user_id", "=", userId)
        .execute();

      const totalPaid = quantity * unitPrice + fee + tax;
      await trx
        .updateTable("investment_details")
        .set({
          asset_id: assetId,
          quantity: String(quantity),
          unit_price: String(unitPrice),
          fee: String(fee),
          tax: String(tax),
          total_paid: String(totalPaid),
          investment_type: activityType,
          pl_transaction_id: plTransactionId,
          fee_transaction_id: feeTransactionId,
          tax_transaction_id: taxTransactionId,
          gain_loss_override: gainLossOverride != null ? String(gainLossOverride) : null,
          gain_loss_source: gainLossSource,
          gain_loss_calculated: gainLossCalculated != null ? String(gainLossCalculated) : null,
        })
        .where("transaction_id", "=", investmentId)
        .execute();

      const relatedIds = [plTransactionId, feeTransactionId, taxTransactionId].filter(
        (x): x is number => x != null,
      );
      if (relatedIds.length > 0) {
        await trx
          .updateTable("transactions")
          .set({ investment_id: investmentId })
          .where("id", "in", relatedIds)
          .execute();
      }

      return {
        id: investmentId,
        transaction_id: investmentId,
        activity_type: activityType,
        asset_id: assetId,
        date: descDate,
        fee,
        from_account_id: fromAccountId,
        quantity,
        tax,
        to_account_id: toAccountId,
        total_paid: totalPaid,
        unit_price: unitPrice,
        user_id: userId,
        pl_transaction_id: plTransactionId,
        fee_transaction_id: feeTransactionId,
        tax_transaction_id: taxTransactionId,
        gain_loss_override: gainLossOverride,
        gain_loss_source: gainLossSource,
        gain_loss_calculated: gainLossCalculated,
      };
    }

    const description =
      activityType === "Dividend"
        ? `Dividend ${asset.symbol} -> ${unitPrice}€`
        : `${activityType} ${quantity} ${asset.symbol} at ${unitPrice}€`;
    const amount = activityType === "Dividend" ? unitPrice : quantity * unitPrice;

    await trx
      .updateTable("transactions")
      .set({
        date: descDate,
        date_accountability: descDate,
        description,
        amount: String(amount),
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
      })
      .where("id", "=", investmentId)
      .where("user_id", "=", userId)
      .execute();

    const totalPaid = activityType === "Dividend" ? unitPrice : quantity * unitPrice + fee + tax;
    await trx
      .updateTable("investment_details")
      .set({
        asset_id: assetId,
        quantity: String(activityType === "Dividend" ? 0 : quantity),
        unit_price: String(unitPrice),
        fee: String(fee),
        tax: String(tax),
        total_paid: String(totalPaid),
        investment_type: activityType,
        pl_transaction_id: null,
        fee_transaction_id: null,
        tax_transaction_id: null,
        gain_loss_override: null,
        gain_loss_source: null,
        gain_loss_calculated: null,
      })
      .where("transaction_id", "=", investmentId)
      .execute();

    if (plTransactionId)
      await trx
        .deleteFrom("transactions")
        .where("id", "=", plTransactionId)
        .where("user_id", "=", userId)
        .execute();
    if (feeTransactionId)
      await trx
        .deleteFrom("transactions")
        .where("id", "=", feeTransactionId)
        .where("user_id", "=", userId)
        .execute();
    if (taxTransactionId)
      await trx
        .deleteFrom("transactions")
        .where("id", "=", taxTransactionId)
        .where("user_id", "=", userId)
        .execute();

    return {
      id: investmentId,
      transaction_id: investmentId,
      activity_type: activityType,
      asset_id: assetId,
      date: descDate,
      fee,
      from_account_id: fromAccountId,
      quantity: activityType === "Dividend" ? 0 : quantity,
      tax,
      to_account_id: toAccountId,
      total_paid: totalPaid,
      unit_price: unitPrice,
      user_id: userId,
      pl_transaction_id: null,
      fee_transaction_id: null,
      tax_transaction_id: null,
      gain_loss_override: null,
      gain_loss_source: null,
      gain_loss_calculated: null,
    };
  });
}
