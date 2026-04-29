import { db } from "../db/client.js";
import { round2 } from "../utils/money.js";
import { convert } from "../utils/currency.js";
import { enrichAccountsBatch, getPreferredCurrency } from "./account.js";
import { getPortfolioSummary } from "./portfolioSummary.js";

export interface WealthSummary {
  preferred_currency: string;
  book: {
    net_with_debt: number;
    net_without_debt: number;
    gross_with_debt: number;
    gross_without_debt: number;
  };
  market: {
    net_with_debt: number;
    net_without_debt: number;
    gross_with_debt: number;
    gross_without_debt: number;
  };
  breakdown: {
    checking: number;
    savings: number;
    loans: number;
    investments_book_value: number;
    investments_market_value: number;
    investments_unrealized_pl: number;
  };
}

export async function getWealthSummary(userId: number): Promise<WealthSummary> {
  const database = db();
  const accountRows = await database
    .selectFrom("accounts")
    .select(["id", "type", "currency"])
    .where("user_id", "=", userId)
    .execute();

  const [preferredCurrency, enrichedAccounts, portfolioSummary] = await Promise.all([
    getPreferredCurrency(userId),
    enrichAccountsBatch(accountRows as unknown as Record<string, unknown>[], userId),
    getPortfolioSummary(userId),
  ]);

  const byType = {
    checking: 0,
    savings: 0,
    loans: 0,
    investmentsBook: 0,
    investmentsMarketFromAccounts: 0,
  };

  for (const account of enrichedAccounts) {
    const balancePreferred = Number(account.balance_preferred ?? 0);
    if (account.type === "checking") byType.checking += balancePreferred;
    if (account.type === "savings") byType.savings += balancePreferred;
    if (account.type === "loan") byType.loans += balancePreferred;
    if (account.type === "investment") {
      byType.investmentsBook += balancePreferred;
      if (account.market_value != null) {
        const marketValuePreferred = await convert(
          Number(account.market_value),
          String(account.currency ?? preferredCurrency),
          preferredCurrency,
        );
        byType.investmentsMarketFromAccounts += marketValuePreferred;
      }
    }
  }

  const portfolioCurrency = String(portfolioSummary.currency ?? "EUR");
  const portfolioMarketValuePreferred = await convert(
    Number(portfolioSummary.total_value ?? 0),
    portfolioCurrency,
    preferredCurrency,
  );
  const portfolioCostBasisPreferred = await convert(
    Number(portfolioSummary.assets?.reduce((sum, asset) => sum + (asset.cost_basis ?? 0), 0) ?? 0),
    portfolioCurrency,
    preferredCurrency,
  );

  // Keep investment balances outside portfolio assets (cash/P2P/etc) on book value.
  const nonPortfolioInvestmentBalance = byType.investmentsBook - portfolioCostBasisPreferred;
  const blendedInvestmentMarketValue =
    portfolioMarketValuePreferred + nonPortfolioInvestmentBalance;

  const assetsBook = byType.checking + byType.savings + byType.investmentsBook;
  const assetsMarket = byType.checking + byType.savings + blendedInvestmentMarketValue;
  const debtAbs = Math.abs(byType.loans);

  return {
    preferred_currency: preferredCurrency,
    book: {
      net_with_debt: round2(assetsBook + byType.loans),
      net_without_debt: round2(assetsBook),
      gross_with_debt: round2(assetsBook + debtAbs),
      gross_without_debt: round2(assetsBook),
    },
    market: {
      net_with_debt: round2(assetsMarket + byType.loans),
      net_without_debt: round2(assetsMarket),
      gross_with_debt: round2(assetsMarket + debtAbs),
      gross_without_debt: round2(assetsMarket),
    },
    breakdown: {
      checking: round2(byType.checking),
      savings: round2(byType.savings),
      loans: round2(byType.loans),
      investments_book_value: round2(byType.investmentsBook),
      investments_market_value: round2(blendedInvestmentMarketValue),
      investments_unrealized_pl: round2(blendedInvestmentMarketValue - byType.investmentsBook),
    },
  };
}
