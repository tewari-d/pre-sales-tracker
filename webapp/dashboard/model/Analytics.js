sap.ui.define([], function () {
  "use strict";

  const EMPTY = "__UNASSIGNED__";
  const PROPOSAL_ORDER = ["FUNNEL", "CAP", "RFI", "FULL", "STAFF"];
  const ACTIVE = ["WIP", "SUBMITTED", "HOLD"];
  const WON = ["WIN", "COMPLETE"];
  const STATUS_PRIORITY = ["COMPLETE", "WIN", "SUBMITTED", "WIP", "HOLD", "LOSS"];
  const GEOGRAPHY_LABELS = { MENA: "MENA", APAC: "APAC", EUROPE: "Europe", UK: "UK", NA: "North America", AUS: "Australia & NZ", AFRICA: "Africa" };
  const GEOGRAPHY_ORDER = ["MENA", "APAC", "EUROPE", "UK", "NA", "AUS", "AFRICA"];
  const OPPORTUNITY_TYPES = {
    AMS: "AMS", PUB_IMPL: "Public Cloud Implementation", PVT_IMPL: "Private Cloud Implementation",
    ROLLOUT: "Rollout", UPGRADE: "Upgrade", OTHER: "Others",
  };
  const SAP_SYSTEM_CATEGORIES = {
    ECC: "ECC", S4_ONPREM: "S/4HANA On Premise", S4_PRIVATE: "S/4HANA Private Cloud",
    S4_PUBLIC: "S/4HANA Public Cloud", OTHER: "Others",
  };
  // Lower bound included, upper bound excluded. "below" also holds unavailable EUR values.
  const BANDS = [
    { key: "below", text: "Below €1", min: -Infinity, max: 1 },
    { key: "small", text: "€1–50K", min: 1, max: 50000 },
    { key: "medium", text: "€50–100K", min: 50000, max: 100000 },
    { key: "large", text: "€100–500K", min: 100000, max: 500000 },
    { key: "major", text: "€500K–1M", min: 500000, max: 1000000 },
    { key: "strategic", text: "€1M+", min: 1000000, max: Infinity },
  ];
  const DIMENSIONS = {
    bu: { field: "BUDetails", text: "BUDetailsText" },
    country: { field: "Country", text: "Country_Text" },
    geography: { field: "Geography", text: "GeographyText" },
    status: { field: "Status", text: "StatusText" },
    owner: { field: "Owner", text: "Owner" },
    proposalCode: { field: "ProposalTypeOp", text: "ProposalTypeOpText" },
    opportunityType: { field: "OpportunityType", text: "OpportunityTypeText" },
    sapSystemCategory: { field: "SapSystemCategory", text: "SapSystemCategoryText" },
    band: { field: "band", text: "bandText" },
  };

  // OData date-only values are UTC dates; picker values use local calendar dates.
  function dateKey(value, local) {
    if (!value) {
      return "";
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.slice(0, 10);
    }
    const match = typeof value === "string" && /\/Date\((-?\d+)/.exec(value);
    const date =
      value instanceof Date
        ? value
        : new Date(match ? Number(match[1]) : value);
    if (!Number.isFinite(date.getTime())) {
      return "";
    }
    const year = local ? date.getFullYear() : date.getUTCFullYear();
    const month = (local ? date.getMonth() : date.getUTCMonth()) + 1;
    const day = local ? date.getDate() : date.getUTCDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  function number(value) {
    return value === null || value === undefined || String(value).trim() === ""
      ? null
      : Number.isFinite(Number(value))
        ? Number(value)
        : null;
  }
  function normalize(rows, rates) {
    const ids = new Set();
    return rows
      .filter(function (row) {
        if (!row.Id || ids.has(row.Id)) {
          throw new Error(
            "The service returned missing or duplicate opportunity IDs. Totals cannot be verified.",
          );
        }
        ids.add(row.Id);
        return (
          row.DeletionIndicator !== true &&
          row.DeletionIndicator !== "true" &&
          row.DeletionIndicator !== "X" &&
          row.Status !== "DELE"
        );
      })
      .map(function (row) {
        const amount = number(row.OppTcv);
        const currency = (row.Currency || "").trim().toUpperCase();
        const rate = currency === "EUR" ? 1 : number(rates[currency]);
        const eur =
          amount !== null && rate !== null && rate > 0 ? amount / rate : null;
        const band =
          eur === null
            ? BANDS.find((b) => b.key === "below")
            : BANDS.find((b) => eur >= b.min && eur < b.max);
        const won = WON.includes(row.Status);
        const received = dateKey(row.ReceivedDate);
        const closed = dateKey(row.CloseDate);
        return Object.assign({}, row, {
          GeographyText: GEOGRAPHY_LABELS[row.Geography] || row.GeographyText,
          OpportunityTypeText: OPPORTUNITY_TYPES[row.OpportunityType] || row.OpportunityTypeText,
          SapSystemCategoryText: SAP_SYSTEM_CATEGORIES[row.SapSystemCategory] || row.SapSystemCategoryText,
          eur: eur,
          statusRank: STATUS_PRIORITY.indexOf(row.Status) < 0 ? STATUS_PRIORITY.length : STATUS_PRIORITY.indexOf(row.Status),
          band: band.key,
          bandText: band.text,
          received,
          closed,
          periodDate: won ? closed : received,
          due: dateKey(row.DueSubmissionDate),
          submitted: dateKey(row.SubmissionDate),
          active: ACTIVE.includes(row.Status),
          won,
        });
      });
  }
  function filter(rows, filters) {
    return rows.filter(function (row) {
      if (!inSelectedQuarters(row.periodDate, filters)) {
        return false;
      }
      if ((filters.from || filters.to) && !row.periodDate) {
        return false;
      }
      if (
        (filters.from && row.periodDate < filters.from) ||
        (filters.to && row.periodDate > filters.to)
      ) {
        return false;
      }
      if (
        filters.search &&
        ![row.Id, row.CustomerName, row.OppDesc, row.Owner]
          .join(" ")
          .toLowerCase()
          .includes(filters.search.toLowerCase().trim())
      ) {
        return false;
      }
      return Object.keys(DIMENSIONS).every(function (dimension) {
        const keys = filters[dimension] || [];
        return (
          !keys.length ||
          keys.includes(row[DIMENSIONS[dimension].field] || EMPTY)
        );
      });
    });
  }
  function options(rows, dimension) {
    if (dimension === "band") {
      return BANDS.map((b) => ({ key: b.key, text: b.text }));
    }
    const definition = DIMENSIONS[dimension];
    const map = new Map();
    const fixed = dimension === "opportunityType" ? OPPORTUNITY_TYPES
      : dimension === "sapSystemCategory" ? SAP_SYSTEM_CATEGORIES : null;
    if (fixed) Object.entries(fixed).forEach(([key, text]) => map.set(key, { key, text }));
    rows.forEach(function (row) {
      const key = row[definition.field] || EMPTY;
      map.set(key, {
        key: key,
        text: row[definition.text] || row[definition.field] || "Unassigned",
      });
    });
    return Array.from(map.values()).sort((a, b) =>
      fixed ? (Object.keys(fixed).indexOf(a.key) < 0 ? Object.keys(fixed).length : Object.keys(fixed).indexOf(a.key)) -
        (Object.keys(fixed).indexOf(b.key) < 0 ? Object.keys(fixed).length : Object.keys(fixed).indexOf(b.key)) || a.text.localeCompare(b.text) :
      dimension === "geography"
        ? (GEOGRAPHY_ORDER.indexOf(a.key) < 0 ? GEOGRAPHY_ORDER.length : GEOGRAPHY_ORDER.indexOf(a.key)) -
          (GEOGRAPHY_ORDER.indexOf(b.key) < 0 ? GEOGRAPHY_ORDER.length : GEOGRAPHY_ORDER.indexOf(b.key)) || a.text.localeCompare(b.text)
        : a.text.localeCompare(b.text),
    );
  }
  function contextualOptions(rows, filters, dimension) {
    return options(filter(rows, Object.assign({}, filters, { [dimension]: [] })), dimension);
  }
  function group(rows, dimension, metric) {
    const definition = DIMENSIONS[dimension];
    const map = new Map();
    // Size bands are a fixed scale: always show every band, even with no rows.
    if (dimension === "band") {
      BANDS.forEach((band) =>
        map.set(band.key, { key: band.key, label: band.text, count: 0, eur: 0 }),
      );
    }
    rows.forEach(function (row) {
      const key = row[definition.field] || EMPTY;
      if (!map.has(key)) {
        map.set(key, {
          key: key,
          label: row[definition.text] || row[definition.field] || "Unassigned",
          count: 0,
          eur: 0,
        });
      }
      const item = map.get(key);
      item.count++;
      item.eur += row.eur === null ? 0 : row.eur;
    });
    const groups = Array.from(map.values()).map((item) =>
      Object.assign(item, { value: metric === "eur" ? item.eur : item.count }),
    );
    // Distinguish duplicate descriptions so chart selection always identifies one key.
    const labels = new Map();
    groups.forEach((item) =>
      labels.set(item.label, (labels.get(item.label) || 0) + 1),
    );
    groups.forEach((item) => {
      if (labels.get(item.label) > 1) {
        item.label += " (" + item.key + ")";
      }
    });
    return groups.sort((a, b) =>
      dimension === "band"
        ? BANDS.findIndex((item) => item.key === a.key) -
          BANDS.findIndex((item) => item.key === b.key)
        : b.value - a.value || a.label.localeCompare(b.label),
    );
  }
  function periodKey(date, interval) {
    return interval === "quarter"
      ? `${date.slice(0, 4)} Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`
      : date.slice(0, 7);
  }
  function inSelectedQuarters(date, filters) {
    return (
      filters.period !== "quarters" ||
      (!!date &&
        (filters.periods || []).includes(
          periodKey(date, "quarter").replace(" ", "-"),
        ))
    );
  }
  function trend(rows, interval, metric, filters) {
    const map = new Map();
    const dates = rows
      .map((r) => r.periodDate)
      .filter(Boolean)
      .sort();
    const start = filters.from || dates[0];
    const end = filters.to || dates[dates.length - 1];
    if (start && end) {
      const cursor = new Date(`${start.slice(0, 7)}-01T00:00:00Z`);
      const stop = new Date(`${end.slice(0, 7)}-01T00:00:00Z`);
      // Avoid rendering unbounded periods for malformed historical dates.
      for (let i = 0; cursor <= stop && i < 1200; i++) {
        const key = periodKey(dateKey(cursor), interval);
        if (inSelectedQuarters(dateKey(cursor), filters)) {
          map.set(key, { label: key, value: 0 });
        }
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      }
    }
    rows.forEach(function (row) {
      if (!row.periodDate || !inSelectedQuarters(row.periodDate, filters)) {
        return;
      }
      const key = periodKey(row.periodDate, interval);
      if (!map.has(key)) {
        map.set(key, { label: key, value: 0 });
      }
      map.get(key).value += metric === "eur" ? row.eur || 0 : 1;
    });
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }
  function summarize(rows, today, denominator = rows.length) {
    const sum = (a) => a.reduce((total, row) => total + (row.eur || 0), 0);
    const active = rows.filter((r) => r.active);
    const won = rows.filter((r) => r.won);
    const lost = rows.filter((r) => r.Status === "LOSS");
    const converted = rows.filter((r) => r.eur !== null);
    return {
      total: rows.length,
      value: sum(rows),
      pipeline: sum(active),
      active: active.length,
      wonValue: sum(won),
      won: won.length,
      lost: lost.length,
      // Win rate: WIN + COMPLETE over every non-deleted opportunity in scope, whatever its status.
      winRate: denominator ? (won.length * 100) / denominator : 0,
      average: converted.length ? sum(converted) / converted.length : null,
      overdue: rows.filter(
        (r) => r.Status === "WIP" && !r.submitted && r.due && r.due < today,
      ).length,
      unconverted: rows.length - converted.length,
      undated: rows.filter((r) => !r.periodDate).length,
      undatedWins: rows.filter((r) => r.won && !r.closed).length,
    };
  }
  function quarterRange(year, quarter) {
    return {
      from: dateKey(new Date(Date.UTC(year, (quarter - 1) * 3, 1))),
      to: dateKey(new Date(Date.UTC(year, quarter * 3, 0))),
    };
  }
  function chartMetrics(rows, groups, dimension, interval, today, rateBase = rows) {
    return groups.map(function (item) {
      const members = rows.filter(function (row) {
        return dimension === "trend"
          ? row.periodDate && periodKey(row.periodDate, interval) === item.label
          : (row[DIMENSIONS[dimension].field] || EMPTY) === item.key;
      });
      const denominator = dimension === "status" ? rateBase.length : rateBase.filter(function (row) {
        return dimension === "trend"
          ? row.periodDate && periodKey(row.periodDate, interval) === item.label
          : (row[DIMENSIONS[dimension].field] || EMPTY) === item.key;
      }).length;
      return Object.assign({}, item, {
        metrics: summarize(members, today, denominator),
        share: rows.length ? (members.length * 100) / rows.length : 0,
      });
    });
  }
  function ownerProposalStacks(rows, metric, today, rateBase = rows) {
    const owners = group(rows, "owner", metric);
    // Series order follows the fixed values of domain /NGR/DO_PS_PROPOSAL_TYPE_OP;
    // codes not listed there sort after them and unassigned is always last.
    const proposals = group(rows, "proposalCode", "count").sort((a, b) => {
      const rank = (key) =>
        key === EMPTY ? PROPOSAL_ORDER.length + 1
          : PROPOSAL_ORDER.includes(key) ? PROPOSAL_ORDER.indexOf(key) : PROPOSAL_ORDER.length;
      return rank(a.key) - rank(b.key) || a.label.localeCompare(b.label);
    });
    // Include zero cells so every owner's stack uses the same series order.
    return owners.flatMap((owner) => {
      const members = rows.filter((row) => (row.Owner || EMPTY) === owner.key);
      const ownerBase = rateBase.filter((row) => (row.Owner || EMPTY) === owner.key);
      const ownerMetrics = summarize(members, today, ownerBase.length);
      return proposals.map((proposal) => {
        const segment = members.filter(
          (row) => (row.ProposalTypeOp || EMPTY) === proposal.key,
        );
        const metrics = summarize(segment, today, ownerBase.filter((row) => (row.ProposalTypeOp || EMPTY) === proposal.key).length);
        return {
          key: owner.key,
          label: owner.label,
          proposalKey: proposal.key,
          proposalLabel: proposal.label,
          value: metric === "eur" ? metrics.value : metrics.total,
          metrics,
          ownerMetrics,
          share: rows.length ? (segment.length * 100) / rows.length : 0,
        };
      });
    });
  }
  function csv(rows, context) {
    const escape = function (value) {
      let text = value === null || value === undefined ? "" : String(value);
      // Prevent spreadsheet formula execution in user-maintained names/descriptions.
      if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) {
        text = "'" + text;
      }
      return '"' + text.replace(/"/g, '""') + '"';
    };
    const headers = [
      "ID",
      "Customer",
      "Opportunity",
      "Received date",
      "Win/Loss date",
      "Business unit",
      "Country / Region",
      "Geography",
      "Status",
      "Owner",
      "Original size",
      "Currency",
      "Size EUR",
      "EUR band",
      "Proposal type",
      "Opportunity type",
      "SAP system category",
      "Report context",
    ];
    return (
      "\ufeff" +
      [headers]
        .concat(
          rows.map((r) => [
            r.Id,
            r.CustomerName,
            r.OppDesc,
            r.received,
            r.closed,
            r.BUDetailsText || r.BUDetails,
            r.Country_Text || r.Country,
            r.GeographyText || r.Geography,
            r.StatusText || r.Status,
            r.Owner,
            r.OppTcv,
            r.Currency,
            r.eur === null ? "" : r.eur.toFixed(2),
            r.bandText,
            r.ProposalTypeOpText || r.ProposalTypeOp,
            r.OpportunityTypeText || r.OpportunityType,
            r.SapSystemCategoryText || r.SapSystemCategory,
            context,
          ]),
        )
        .map((row) => row.map(escape).join(","))
        .join("\r\n")
    );
  }
  return {
    dateKey,
    normalize,
    filter,
    options,
    contextualOptions,
    group,
    trend,
    summarize,
    quarterRange,
    chartMetrics,
    ownerProposalStacks,
    csv,
    BANDS,
    DIMENSIONS,
    EMPTY,
    PROPOSAL_ORDER,
  };
});
