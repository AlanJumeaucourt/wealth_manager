import { describe, expect, test } from "bun:test";
import {
  balanceAtCursor,
  countDaysInclusive,
  createHistoryCursor,
  generateSampleDates,
  resolveChartGranularity,
} from "./chartSampling.js";

describe("chartSampling", () => {
  test("resolveChartGranularity picks day/week/month by range length", () => {
    expect(resolveChartGranularity("2026-01-01", "2026-06-01")).toBe("day");
    expect(resolveChartGranularity("2019-01-01", "2026-01-01")).toBe("week");
    expect(resolveChartGranularity("1985-01-01", "2026-01-01")).toBe("month");
    expect(resolveChartGranularity("1985-01-01", "2026-01-01", "day")).toBe("day");
  });

  test("generateSampleDates always includes endpoints", () => {
    const weekly = generateSampleDates("2020-01-01", "2020-03-31", "week");
    expect(weekly[0]).toBe("2020-01-01");
    expect(weekly[weekly.length - 1]).toBe("2020-03-31");
    expect(weekly.length).toBeLessThan(countDaysInclusive("2020-01-01", "2020-03-31"));

    const monthly = generateSampleDates("2018-01-02", "2026-10-20", "month");
    expect(monthly[0]).toBe("2018-01-02");
    expect(monthly[monthly.length - 1]).toBe("2026-10-20");
    expect(monthly.length).toBeLessThan(200);
  });

  test("history cursor forward-fills balances", () => {
    const cursor = createHistoryCursor({ "2020-01-01": 100, "2020-01-10": 150 });
    expect(balanceAtCursor(cursor, "2019-12-31")).toBe(0);
    expect(balanceAtCursor(cursor, "2020-01-05")).toBe(100);
    expect(balanceAtCursor(cursor, "2020-01-10")).toBe(150);
    expect(balanceAtCursor(cursor, "2020-02-01")).toBe(150);
  });
});
