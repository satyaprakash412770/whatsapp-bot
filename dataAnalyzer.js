"use strict";

const aq = require("arquero");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const { parse: csvParse } = require("csv-parse/sync");

// ─── Chart renderer ───────────────────────────────────────────────────────────
const chartRenderer = new ChartJSNodeCanvas({
  width: 800,
  height: 450,
  backgroundColour: "#1a1a2e",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse raw buffer into an arquero table.
 * @param {Buffer} buffer
 * @param {"text/csv"|"application/json"} mimetype
 * @returns {aq.ColumnTable}
 */
function parseData(buffer, mimetype) {
  const text = buffer.toString("utf8");
  if (mimetype === "text/csv" || mimetype === "application/octet-stream") {
    const rows = csvParse(text, { columns: true, skip_empty_lines: true, trim: true });
    return aq.from(rows);
  }
  // JSON — support both array-of-objects and {data: [...]}
  let json = JSON.parse(text);
  if (!Array.isArray(json)) {
    const key = Object.keys(json).find((k) => Array.isArray(json[k]));
    json = key ? json[key] : [json];
  }
  return aq.from(json);
}

/**
 * Detect the first numeric column in a table.
 */
function firstNumericCol(table) {
  const cols = table.columnNames();
  for (const col of cols) {
    const vals = table.array(col).filter((v) => v !== null && v !== undefined && v !== "");
    if (vals.length > 0 && !isNaN(Number(vals[0]))) return col;
  }
  return null;
}

/**
 * Build a descriptive statistics summary string.
 */
function buildSummary(table) {
  const cols = table.columnNames();
  const nRows = table.numRows();
  const lines = [`📊 *Data Summary* (${nRows} rows, ${cols.length} columns)\n`];

  for (const col of cols) {
    const rawVals = table.array(col);
    const nums = rawVals.map(Number).filter((n) => !isNaN(n));
    if (nums.length > 0) {
      const sum = nums.reduce((a, b) => a + b, 0);
      const avg = (sum / nums.length).toFixed(2);
      const min = Math.min(...nums).toFixed(2);
      const max = Math.max(...nums).toFixed(2);
      lines.push(`*${col}*: avg ${avg}, min ${min}, max ${max}, sum ${sum.toFixed(2)}`);
    } else {
      // Categorical
      const unique = [...new Set(rawVals.map(String))];
      lines.push(`*${col}*: ${unique.length} unique values`);
    }
  }
  return lines.join("\n");
}

/**
 * Detect chart type and columns from user text.
 */
function detectIntent(userText, cols) {
  const t = userText.toLowerCase();
  let chartType = "bar";
  if (t.includes("pie")) chartType = "pie";
  else if (t.includes("line")) chartType = "line";

  // Try to find mentioned column names
  const mentioned = cols.filter((c) => t.includes(c.toLowerCase()));
  return { chartType, mentionedCols: mentioned };
}

/**
 * Aggregate data for chart: group by first non-numeric col, sum numeric col.
 */
function aggregateForChart(table, labelCol, valueCol) {
  if (!labelCol || !valueCol) return null;

  const grouped = {};
  const labels = table.array(labelCol);
  const values = table.array(valueCol);
  labels.forEach((lbl, i) => {
    const numVal = Number(values[i]);
    if (!isNaN(numVal)) {
      grouped[lbl] = (grouped[lbl] || 0) + numVal;
    }
  });

  const sortedEntries = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12); // cap at 12 bars for readability

  return {
    labels: sortedEntries.map(([k]) => k),
    data: sortedEntries.map(([, v]) => parseFloat(v.toFixed(2))),
  };
}

/** Generate a chart image buffer */
async function renderChart(chartType, labels, data, xLabel, yLabel) {
  const palette = [
    "#6c63ff", "#ff6584", "#43e97b", "#fa709a", "#fee140",
    "#a18cd1", "#ffeaa7", "#81ecec", "#fd79a8", "#00cec9",
    "#e17055", "#74b9ff",
  ];

  const colors = chartType === "pie"
    ? palette.slice(0, labels.length)
    : palette[0];

  const config = {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          label: yLabel || "Value",
          data,
          backgroundColor: chartType === "pie" ? colors : `${palette[0]}99`,
          borderColor: chartType === "pie" ? colors : palette[0],
          borderWidth: 2,
          fill: chartType === "line",
          tension: 0.4,
          pointBackgroundColor: palette[0],
        },
      ],
    },
    options: {
      responsive: false,
      plugins: {
        legend: {
          display: chartType === "pie",
          labels: { color: "#e2e8f0", font: { size: 13 } },
        },
        title: {
          display: true,
          text: `${yLabel || "Value"} by ${xLabel || "Category"}`,
          color: "#e2e8f0",
          font: { size: 18, weight: "bold" },
        },
      },
      scales:
        chartType === "pie"
          ? {}
          : {
              x: {
                ticks: { color: "#94a3b8", maxRotation: 45 },
                grid: { color: "#ffffff15" },
                title: { display: !!xLabel, text: xLabel, color: "#94a3b8" },
              },
              y: {
                ticks: { color: "#94a3b8" },
                grid: { color: "#ffffff15" },
                title: { display: !!yLabel, text: yLabel, color: "#94a3b8" },
              },
            },
    },
  };

  return chartRenderer.renderToBuffer(config);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main entry point called from index.js when a CSV/JSON file is received.
 * @returns {{ text: string, imageBuffer: Buffer|null }}
 */
async function handleFile(buffer, mimetype, userText = "", userId = "") {
  let table;
  try {
    table = parseData(buffer, mimetype);
  } catch (e) {
    return { text: `❌ I couldn't read that file: ${e.message}`, imageBuffer: null };
  }

  const cols = table.columnNames();
  const t = (userText || "").toLowerCase();
  const wantsChart =
    t.includes("chart") ||
    t.includes("graph") ||
    t.includes("bar") ||
    t.includes("pie") ||
    t.includes("line") ||
    t.includes("plot") ||
    t.includes("visual");

  if (wantsChart) {
    const { chartType, mentionedCols } = detectIntent(userText, cols);

    // Determine label (categorical) and value (numeric) columns
    const numericCols = cols.filter((c) => {
      const vals = table.array(c).filter((v) => v !== "" && v != null);
      return vals.length > 0 && !isNaN(Number(vals[0]));
    });
    const categoryCols = cols.filter((c) => !numericCols.includes(c));

    const labelCol =
      mentionedCols.find((c) => categoryCols.includes(c)) || categoryCols[0] || cols[0];
    const valueCol =
      mentionedCols.find((c) => numericCols.includes(c)) || numericCols[0] || null;

    if (!valueCol) {
      return {
        text: `⚠️ I couldn't find a numeric column to chart. Available columns: ${cols.join(", ")}`,
        imageBuffer: null,
      };
    }

    const agg = aggregateForChart(table, labelCol, valueCol);
    if (!agg || agg.labels.length === 0) {
      return { text: "⚠️ Not enough data to build a chart.", imageBuffer: null };
    }

    try {
      const imageBuffer = await renderChart(chartType, agg.labels, agg.data, labelCol, valueCol);
      return {
        text: `📈 Here's your *${chartType} chart* — _${valueCol}_ by _${labelCol}_`,
        imageBuffer,
      };
    } catch (e) {
      return { text: `❌ Chart generation failed: ${e.message}`, imageBuffer: null };
    }
  }

  // Default: summary statistics
  const summary = buildSummary(table);
  return { text: summary, imageBuffer: null };
}

module.exports = { handleFile };
