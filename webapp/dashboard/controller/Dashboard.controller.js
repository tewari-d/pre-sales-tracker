sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/util/File",
    "sap/m/MessageToast",
    "sap/ui/model/Sorter",
    "sap/ushell/Container",
    "sap/m/MessageBox",
    "sap/viz/ui5/controls/VizFrame",
    "sap/viz/ui5/data/FlattenedDataset",
    "sap/viz/ui5/controls/common/feeds/FeedItem",
    "com/ngr/presales/dashboard/model/ChartHover",
    "com/ngr/presales/dashboard/model/Analytics",
    "com/ngr/presales/dashboard/model/DataService",
    "com/ngr/presales/dashboard/model/Navigation",
    "com/ngr/presales/dashboard/model/ViewState",
    "sap/ui/core/theming/Parameters",
    "sap/ui/core/Theming",
  ],
  function (
    Controller,
    JSONModel,
    NumberFormat,
    File,
    MessageToast,
    Sorter,
    ShellContainer,
    MessageBox,
    VizFrame,
    FlattenedDataset,
    FeedItem,
    ChartHover,
    Analytics,
    DataService,
    Navigation,
    ViewState,
    ThemeParameters,
    Theming,
  ) {
    "use strict";
    const shortNumber = NumberFormat.getFloatInstance({
      style: "short",
      maxFractionDigits: 1,
    });
    const fullNumber = NumberFormat.getFloatInstance({
      groupingEnabled: true,
      minFractionDigits: 2,
      maxFractionDigits: 2,
    });

    return Controller.extend(
      "com.ngr.presales.dashboard.controller.Dashboard",
      {
        onInit: function () {
          this._rows = [];
          this._generation = 0;
          this._charts = {};
          this._onThemeApplied = () => this._applyOwnerPalette();
          Theming.attachApplied(this._onThemeApplied);
          const query = new URLSearchParams(window.location.search);
          const startup =
            this.getOwnerComponent().getComponentData()?.startupParameters;
          let user = "standalone";
          if (startup && ShellContainer) {
            user = ShellContainer.getUser().getId();
          }
          this._stateScope = [
            user,
            startup?.["sap-client"]?.[0] ||
              query.get("sap-client") ||
              "default",
            query.get("snapshot") || "live",
          ];
          const state = ViewState.take(this._stateScope);
          this._restoreTop = state.returning ? state.scrollTop : null;
          this._restoreFrame = null;
          this._viewModel = new JSONModel({
            busy: true,
            loaded: false,
            error: "",
            warning: "",
            progress: "",
            updated: "",
            rateNote: "",
            filters: state.filters,
            options: {},
            periods: ViewState.quarters([], new Date(), state.filters.periods).concat([
              { key: "custom", text: "Custom date range" },
              { key: "all", text: "All received dates" },
            ]),
            metric: state.metric,
            breakdown: state.breakdown,
            interval: state.interval,
            sort: state.sort,
            kpis: {},
            rows: [],
            charts: {},
            scope: "",
            filterCount: 0,
            overview: "",
            reportContext: "",
            sourceNote: "",
            headerExpanded: state.headerExpanded,
          });
          this.getView().setModel(this._viewModel, "dashboard");
          this._setRange(state.filters);
          this.byId("opportunitiesKpi").addEventDelegate({
            onclick: () => this.onJumpToTable(),
            onsapenter: (event) => {
              event.preventDefault();
              this.onJumpToTable();
            },
            onsapspace: (event) => {
              event.preventDefault();
              this.onJumpToTable();
            },
            onAfterRendering: () => {
              const element = this.byId("opportunitiesKpi").getDomRef();
              element.setAttribute("role", "button");
              element.setAttribute("tabindex", "0");
              if (this._bundle) {
                element.setAttribute(
                  "aria-label",
                  this._text("jumpToOpportunities"),
                );
              }
            },
          });
          Promise.resolve(
            this.getOwnerComponent().getModel("i18n").getResourceBundle(),
          ).then((bundle) => {
            if (!this._exited) {
              this._bundle = bundle;
              this._snapshot =
                new URLSearchParams(window.location.search).get("snapshot") ===
                "PS4-500";
              if (this._snapshot) {
                this._viewModel.setProperty(
                  "/sourceNote",
                  this._text("snapshot500"),
                );
              }
              this._makeChart("trend", "column");
              this._makeChart("status", "donut");
              this._makeChart("breakdown", "bar");
              this._makeChart("band", "column");
              this._makeChart("owner", "bar");
              this._makeChart("proposalCode", "bar");
              this.onRefresh();
            }
          });
        },
        _text: function (key, args) {
          return this._bundle.getText(key, args);
        },
        _makeChart: function (name, type) {
          const ownerSplit = name === "owner";
          const contexts = [
            ["hoverCount", "totalOpportunities"],
            ["hoverValue", "hoverTotalValue"],
            ["hoverPipeline", "activePipeline"],
            ["hoverWon", "wonValue"],
            ["hoverRate", "winRate"],
            ["hoverOverdue", "hoverOverdue"],
            ["hoverShare", "hoverShare"],
            ["hoverUnavailable", "hoverUnavailable"],
          ];
          if (!this._hover) {
            this._hover = new ChartHover(
              contexts.map(([key, label]) => [key, this._text(label)]),
            );
          }
          const chart = new VizFrame(this.getView().createId(name + "Chart"), {
            width: "100%",
            height: ["breakdown", "owner", "proposalCode"].includes(name)
              ? "24rem"
              : "19rem",
            vizType: ownerSplit ? "stacked_bar" : type,
            uiConfig: { applicationSet: "fiori" },
            dataset: new FlattenedDataset({
              dimensions: [
                { name: "Category", value: "{dashboard>label}" },
              ].concat(ownerSplit ? [{ name: "ProposalType", value: "{dashboard>proposalLabel}" }] : []).concat(
                contexts.map(([key, label]) => ({
                  identity: key,
                  name: this._text(label),
                  value: "{dashboard>" + key + "}",
                })),
              ),
              context: contexts.map(([key]) => ({
                id: key,
                showInTooltip: true,
              })),
              measures: [{ name: "Amount", value: "{dashboard>value}" }],
              data: { path: "dashboard>/charts/" + name },
            }),
            feeds: [
              new FeedItem({
                uid: type === "donut" ? "color" : "categoryAxis",
                type: "Dimension",
                values: ["Category"],
              }),
              new FeedItem({
                uid: type === "donut" ? "size" : "valueAxis",
                type: "Measure",
                values: ["Amount"],
              }),
            ].concat(ownerSplit ? [new FeedItem({uid: "color", type: "Dimension", values: ["ProposalType"]})] : []),
          });
          chart.setVizProperties({
            tooltip: { visible: false },
            title: { visible: false },
            legend: { visible: type === "donut" || ownerSplit },
            legendGroup: { layout: { position: ownerSplit ? "top" : "bottom" } },
            plotArea: {
              colorPalette: ownerSplit ? this._ownerPalette([]) : [
                "#0070f2",
                "#00a5a8",
                "#7858d5",
                "#e5a000",
                "#df6081",
                "#647987",
                "#a15b26",
              ],
              dataLabel: { visible: true, type: "value", showTotal: ownerSplit },
              drawingEffect: "normal",
            },
            valueAxis: { title: { visible: false } },
            categoryAxis: { title: { visible: false } },
            // EXCLUSIVE lets sap.viz select a whole owner stack from its axis
            // label and a whole series from the legend; SINGLE ignores both.
            interaction: { selectability: { mode: ownerSplit ? "EXCLUSIVE" : "SINGLE" } },
          });
          chart.attachRenderComplete(() => this._restoreScroll());
          if (ownerSplit) {
            chart.attachRenderComplete(() => this._trackOwnerClickOrigin(chart));
          }
          chart.attachSelectData((event) => this._onChartSelect(name, event));
          this.byId(name + "Host").addItem(chart);
          this._hover.connect(
            chart,
            () => this._viewModel.getProperty("/charts/" + name) || [],
            ownerSplit,
          );
          this._charts[name] = chart;
        },
        onRefresh: async function () {
          const generation = ++this._generation;
          const model = this._viewModel;
          model.setProperty("/busy", true);
          model.setProperty("/loaded", false);
          model.setProperty("/error", "");
          model.setProperty("/warning", "");
          try {
            const odata = this.getOwnerComponent().getModel();
            const [raw, fx] = await Promise.all([
              DataService.readAll(
                odata,
                (count) => {
                  if (generation === this._generation) {
                    model.setProperty(
                      "/progress",
                      this._text("loadingCount", [count]),
                    );
                  }
                },
                () => generation !== this._generation,
              ),
              DataService.loadRates(),
            ]);
            if (generation !== this._generation) {
              return;
            }
            this._rows = Analytics.normalize(raw, fx.rates);
            this._fx = fx;
            model.setSizeLimit(Math.max(1000, this._rows.length + 1));
            Object.keys(Analytics.DIMENSIONS).forEach((d) =>
              model.setProperty(
                "/options/" + d,
                Analytics.options(this._rows, d),
              ),
            );
            this._setPeriods();
            model.setProperty(
              "/updated",
              this._text(this._snapshot ? "snapshotLoadedAt" : "updatedAt", [
                new Date().toLocaleString(),
              ]),
            );
            model.setProperty(
              "/rateNote",
              fx.failed
                ? this._text("ratesUnavailable")
                : this._text("ratesDated", [fx.date]),
            );
            model.setProperty("/loaded", true);
            this._apply();
          } catch (error) {
            if (generation !== this._generation) {
              return;
            }
            this._rows = [];
            model.setProperty("/rows", []);
            model.setProperty(
              "/error",
              error.message || this._text("loadError"),
            );
          } finally {
            if (generation === this._generation) {
              model.setProperty("/busy", false);
              this._restoreScroll();
            }
          }
        },
        _setPeriods: function () {
          const periods = [
            { key: "custom", text: this._text("customRange") },
            { key: "all", text: this._text("allDates") },
          ];
          this._viewModel.setProperty(
            "/periods",
            ViewState.quarters(
                this._rows.map((r) => r.received),
                new Date(),
                this._viewModel.getProperty("/filters/periods"),
              ).concat(periods),
          );
        },
        onPeriodChange: function (event) {
          const filters = this._viewModel.getProperty("/filters");
          const range = ViewState.selectPeriods(
            event.getSource().getSelectedKeys(),
            event.getParameter("changedItem").getKey(),
            event.getParameter("selected"),
          );
          if (range.period === "custom") {
            const previous = filters.from && filters.to && !filters.disjoint
              ? filters : ViewState.defaults().filters;
            range.from = previous.from;
            range.to = previous.to;
          }
          this._viewModel.setProperty("/filters", Object.assign({}, filters, range));
          this._setRange(range);
          this._apply();
          if (range.period === "custom") {
            event.getSource().close();
            this.byId("receivedRange").focus();
          }
        },
        _setRange: function (range) {
          this._viewModel.setProperty("/filters/from", range.from);
          this._viewModel.setProperty("/filters/to", range.to);
          this.byId("receivedRange").setDateValue(
            range.from && !range.disjoint ? new Date(range.from + "T00:00:00") : null,
          );
          this.byId("receivedRange").setSecondDateValue(
            range.to && !range.disjoint ? new Date(range.to + "T00:00:00") : null,
          );
          this.byId("receivedRange").setValueState("None");
        },
        onDateChange: function (event) {
          const control = event.getSource();
          const from = control.getDateValue();
          const to = control.getSecondDateValue();
          if (
            !event.getParameter("valid") ||
            Boolean(from) !== Boolean(to) ||
            from > to
          ) {
            control.setValueState("Error");
            control.setValueStateText(this._text("invalidDate"));
            MessageToast.show(this._text("invalidDate"));
            return;
          }
          control.setValueState("None");
          this._viewModel.setProperty("/filters/periods", [from ? "custom" : "all"]);
          this._viewModel.setProperty("/filters/disjoint", false);
          this._viewModel.setProperty(
            "/filters/period",
            from ? "custom" : "all",
          );
          this._viewModel.setProperty(
            "/filters/from",
            Analytics.dateKey(from, true),
          );
          this._viewModel.setProperty(
            "/filters/to",
            Analytics.dateKey(to, true),
          );
          this._apply();
        },
        onFilterChange: function () {
          this._apply();
        },
        onSearch: function (event) {
          this._viewModel.setProperty(
            "/filters/search",
            event.getParameter("newValue") || "",
          );
          this._apply();
        },
        onReset: function () {
          const filters = ViewState.defaults().filters;
          this._viewModel.setProperty("/filters", filters);
          this._setRange(filters);
          this._apply();
        },
        _apply: function () {
          if (!this._viewModel.getProperty("/loaded")) {
            return;
          }
          const model = this._viewModel;
          this._hover.hide();
          const filters = model.getProperty("/filters");
          const rows = Analytics.filter(this._rows, filters);
          const metric = model.getProperty("/metric");
          const summary = Analytics.summarize(
            rows,
            Analytics.dateKey(new Date(), true),
          );
          const count =
            Object.keys(Analytics.DIMENSIONS).reduce(
              (total, key) => total + filters[key].length,
              0,
            ) +
            (filters.from ? 1 : 0) +
            (filters.search ? 1 : 0);
          const scope = filters.period === "quarters"
            ? filters.periods.slice().reverse().map(key => `Q${key.slice(-1)} ${key.slice(0, 4)}`).join(" + ")
            : filters.from
            ? `${filters.from} – ${filters.to}`
            : this._text("allDates");
          const context = [scope];
          Object.keys(Analytics.DIMENSIONS).forEach((d) => {
            if (filters[d].length) {
              const options = model.getProperty("/options/" + d);
              context.push(
                this._text(d) +
                  ": " +
                  filters[d]
                    .map(
                      (key) =>
                        (options.find((o) => o.key === key) || { text: key })
                          .text,
                    )
                    .join(", "),
              );
            }
          });
          if (filters.search) {
            context.push(this._text("searchLabel") + ": " + filters.search);
          }
          model.setProperty(
            "/scope",
            this._text("scope", [scope, rows.length, this._rows.length]),
          );
          model.setProperty("/filterCount", count);
          model.setProperty("/reportContext", context.join(" · "));
          model.setProperty("/kpis", summary);
          model.setProperty("/rows", rows);
          this._sortRows();
          this._setChartData(
            "status",
            rows,
            Analytics.group(rows, "status", metric),
            "status",
          );
          this._setChartData(
            "band",
            rows,
            Analytics.group(rows, "band", metric),
            "band",
          );
          const breakdown = Analytics.group(
            rows,
            model.getProperty("/breakdown"),
            metric,
          );
          this._setChartData(
            "breakdown",
            rows,
            breakdown,
            model.getProperty("/breakdown"),
          );
          this._setChartData(
            "trend",
            rows,
            Analytics.trend(
              rows,
              model.getProperty("/interval"),
              metric,
              filters,
            ),
            "trend",
          );
          const owners = Analytics.group(rows, "owner", metric);
          this._setChartData("owner", rows, owners, "owner");
          const proposals = Analytics.group(rows, "proposalCode", metric);
          this._setChartData("proposalCode", rows, proposals, "proposalCode");
          const warnings = [];
          if (this._fx.failed) {
            warnings.push(this._text("ratesUnavailable"));
          }
          if (this._fx.stale) {
            warnings.push(this._text("staleRates"));
          }
          if (summary.unconverted) {
            warnings.push(this._text("missingEur", [summary.unconverted]));
          }
          if (summary.undated) {
            warnings.push(this._text("missingDate", [summary.undated]));
          }
          model.setProperty("/warning", warnings.join(" "));
          model.setProperty(
            "/overview",
            this._text("overview", [
              summary.active,
              summary.won,
              summary.lost,
              summary.overdue,
            ]),
          );
          Object.entries(this._charts).forEach(([name, chart]) => {
            chart.setVizProperties({
              valueAxis: {
                title: {
                  visible: true,
                  text:
                    metric === "eur"
                      ? this._text("eurValue")
                      : this._text("opportunityCount"),
                },
              },
              plotArea: {
                dataLabel: {
                  formatString: metric === "eur" ? "#,##0.00" : "#,##0",
                },
              },
            });
            chart.vizSelection([], { clearSelection: true });
          });
        },
        _setChartData: function (name, rows, groups, dimension) {
          const data = name === "owner" ? Analytics.ownerProposalStacks(rows, this._viewModel.getProperty("/metric"), Analytics.dateKey(new Date(), true)) : Analytics.chartMetrics(
            rows,
            groups,
            dimension,
            this._viewModel.getProperty("/interval"),
            Analytics.dateKey(new Date(), true),
          );
          data.forEach((item) => {
            const metrics = item.metrics;
            const eur = (amount) => "€" + fullNumber.format(amount);
            item.hoverCount = String(metrics.total);
            item.hoverValue = eur(metrics.value);
            item.hoverPipeline = eur(metrics.pipeline);
            item.hoverWon = eur(metrics.wonValue);
            item.hoverRate = this.formatRate(metrics.winRate);
            item.hoverOverdue = String(metrics.overdue);
            item.hoverShare = item.share.toFixed(1) + "%";
            item.hoverUnavailable = String(metrics.unconverted);
            if (item.ownerMetrics) {
              item.hoverTitle = item.label + " · " + item.proposalLabel;
              item.hoverExtra = [[this._text("ownerTotal"), item.ownerMetrics.total + " · " + this.formatEur(item.ownerMetrics.value)]];
            }
          });
          this._viewModel.setProperty("/charts/" + name, data);
          if (name === "owner") {
            this._applyOwnerPalette();
          }
        },
        _ownerPalette: function (data) {
          const series = data.length ? [...new Set(data.map(item => item.proposalKey))] : ["FULL", "CAP", "__UNASSIGNED__"];
          // SAP Fiori chart palette guidance: real categories take the theme's
          // qualitative hues in order; "unassigned" is not a category and takes
          // the semantic neutral. Theme-independent parameter names, so the
          // colours follow whichever theme the launchpad applies.
          const tokens = {
            FULL: "sapUiChartPaletteQualitativeHue1",
            CAP: "sapUiChartPaletteQualitativeHue2",
            __UNASSIGNED__: "sapUiChartPaletteSemanticNeutral",
          };
          let next = 3;
          return series.map(key => ThemeParameters.get({ name: tokens[key] || "sapUiChartPaletteQualitativeHue" + next++ }));
        },
        _applyOwnerPalette: function () {
          if (this._exited || !this._charts?.owner) { return; }
          this._charts.owner.setVizProperties({plotArea: {
            colorPalette: this._ownerPalette(this._viewModel.getProperty("/charts/owner") || [])
          }});
        },
        _onChartSelect: function (name, event) {
          const points = (event.getParameter("data") || []).map(p => p && p.data).filter(p => p && p.Category);
          let label = points.length ? points[0].Category : "";
          if (!label) {
            return;
          }
          if (name === "owner") {
            const scope = this._ownerSelectionScope(points, this._ownerClickOrigin);
            this._ownerClickOrigin = "";
            if (!scope) { return; }
            this._viewModel.setProperty("/filters/owner", scope.owners);
            this._viewModel.setProperty("/filters/proposalCode", scope.proposals);
            label = scope.label;
          } else if (name === "trend") {
            const interval = this._viewModel.getProperty("/interval");
            const year = Number(label.slice(0, 4));
            let range;
            if (interval === "quarter") {
              range = Analytics.quarterRange(year, Number(label.slice(-1)));
            } else {
              const month = Number(label.slice(5, 7));
              range = {
                from: `${label}-01`,
                to: Analytics.dateKey(new Date(Date.UTC(year, month, 0))),
              };
            }
            this._viewModel.setProperty("/filters/period", "custom");
            this._viewModel.setProperty("/filters/periods", ["custom"]);
            this._viewModel.setProperty("/filters/disjoint", false);
            this._setRange(range);
          } else {
            const dimension =
              name === "breakdown"
                ? this._viewModel.getProperty("/breakdown")
                : name;
            const group = this._viewModel
              .getProperty("/charts/" + name)
              .find((g) => g.label === label);
            if (!group) {
              return;
            }
            this._viewModel.setProperty("/filters/" + dimension, [group.key]);
          }
          this._apply();
          MessageToast.show(this._text("chartFiltered", [label]));
        },
        // sap.viz reports the selected cells but not what was clicked, so the
        // origin is captured before its own handlers run: an owner name (axis
        // label) selects the whole stack, a legend entry selects one series.
        _trackOwnerClickOrigin: function (chart) {
          const dom = chart.getDomRef();
          if (!dom || dom.dataset.ownerOrigin) { return; }
          dom.dataset.ownerOrigin = "tracked";
          dom.addEventListener("pointerdown", (event) => {
            const within = (selector) => event.target instanceof Element && event.target.closest(selector);
            this._ownerClickOrigin = within(".v-m-categoryAxis") ? "axis" : within(".v-m-legend") ? "legend" : "";
          }, true);
        },
        _ownerSelectionScope: function (points, origin) {
          const data = this._viewModel.getProperty("/charts/owner") || [];
          const cells = points
            .map(p => data.find(g => g.label === p.Category && g.proposalLabel === p.ProposalType))
            .filter(Boolean);
          if (!cells.length) { return null; }
          const unique = (field) => [...new Set(cells.map(c => c[field]))];
          if (origin === "axis") {
            return { owners: unique("key"), proposals: [], label: unique("label").join(" · ") };
          }
          if (origin === "legend") {
            return { owners: [], proposals: unique("proposalKey"), label: unique("proposalLabel").join(" · ") };
          }
          return { owners: [cells[0].key], proposals: [cells[0].proposalKey], label: cells[0].label + " · " + cells[0].proposalLabel };
        },
        onSort: function (event) {
          this._viewModel.setProperty(
            "/sort",
            event.getSource().getSelectedKey(),
          );
          this._sortRows();
        },
        _sortRows: function () {
          const key = this._viewModel.getProperty("/sort");
          this.byId("opportunities")
            .getBinding("items")
            .sort(new Sorter(key, key !== "CustomerName"));
        },
        onAfterRendering: function () {
          this._restoreScroll();
        },
        onTableUpdated: function () {
          this._restoreScroll();
        },
        _restoreScroll: function () {
          if (
            this._exited ||
            this._restoreTop === null ||
            this._viewModel.getProperty("/busy")
          ) {
            return;
          }
          if (this._restoreFrame !== null) {
            cancelAnimationFrame(this._restoreFrame);
          }
          this._restoreFrame = requestAnimationFrame(() => {
            this._restoreFrame = requestAnimationFrame(() => {
              this._restoreFrame = null;
              if (this._exited || this._restoreTop === null) {
                return;
              }
              const section = this.byId("opportunityTableSection").getDomRef();
              if (!section || !section.getBoundingClientRect().height) {
                return;
              }
              const delegate = this.byId("dashboardPage").getScrollDelegate();
              delegate.scrollTo(0, this._restoreTop, 0);
              if (Math.abs(delegate.getScrollTop() - this._restoreTop) < 2) {
                this._restoreTop = null;
              }
            });
          });
        },
        onJumpToTable: function () {
          const section = this.byId("opportunityTableSection").getDomRef();
          const page = this.byId("dashboardPage");
          const wrapper = page
            .getDomRef()
            ?.querySelector(".sapFDynamicPageContentWrapper");
          if (!section || !wrapper) {
            return;
          }
          const delegate = page.getScrollDelegate();
          // The scroll wrapper extends behind the fixed DynamicPage title/header.
          // Align below that visible header, including when the filters are collapsed.
          const header = page
            .getDomRef()
            .querySelector(".sapFDynamicPageTitleWrapper");
          const visibleTop = Math.max(
            wrapper.getBoundingClientRect().top,
            header?.getBoundingClientRect().bottom || 0,
          );
          const top =
            wrapper.scrollTop +
            section.getBoundingClientRect().top -
            visibleTop;
          delegate.scrollTo(0, Math.max(0, top - 12), 300);
        },
        _rememberReturn: function () {
          const page = this.byId("dashboardPage");
          ViewState.remember(
            this._stateScope,
            Object.assign({}, this._viewModel.getData(), {
              scrollTop: page.getScrollDelegate().getScrollTop(),
              headerExpanded: page.getHeaderExpanded(),
            }),
          );
        },
        onExport: function () {
          const model = this._viewModel;
          const context = [
            model.getProperty("/sourceNote"),
            model.getProperty("/reportContext"),
            model.getProperty("/rateNote"),
            model.getProperty("/updated"),
            model.getProperty("/warning"),
          ]
            .filter(Boolean)
            .join(" | ");
          File.save(
            Analytics.csv(model.getProperty("/rows"), context),
            "presales-" + Analytics.dateKey(new Date(), true),
            "csv",
            "text/csv",
            "utf-8",
          );
        },
        onPrint: function () {
          window.print();
        },
        onOpportunityPress: async function (event) {
          this._rememberReturn();
          const row = event
            .getSource()
            .getBindingContext("dashboard")
            .getObject();
          if (
            this.getOwnerComponent().getComponentData()?.startupParameters &&
            ShellContainer
          ) {
            try {
              const navigation =
                await ShellContainer.getServiceAsync("Navigation");
              await navigation.navigate(
                Navigation.trackerTarget(row.Id),
                this.getOwnerComponent(),
              );
            } catch (error) {
              ViewState.forget(this._stateScope);
              MessageBox.error(this._text("trackerNavigationError"));
            }
            return;
          }
          const componentUrl = new URL(
            sap.ui.require.toUrl("com/ngr/presales/dashboard/index.html"),
            window.location.href,
          ).href;
          window.open(
            Navigation.trackerUrl(window.location.href, componentUrl, row.Id),
            "_blank",
            "noopener,noreferrer",
          );
        },
        onExit: function () {
          this._exited = true;
          Theming.detachApplied(this._onThemeApplied);
          this._hover?.destroy();
          if (this._restoreFrame !== null) {
            cancelAnimationFrame(this._restoreFrame);
          }
          ++this._generation;
          this._viewModel.destroy();
        },
        formatEur: function (value) {
          return value === null || value === undefined
            ? "—"
            : "€" + shortNumber.format(value);
        },
        formatAmount: function (value) {
          return value === null || value === undefined
            ? "—"
            : fullNumber.format(value);
        },
        formatRate: function (value) {
          return value === null || value === undefined
            ? "0%"
            : value.toFixed(1) + "%";
        },
        formatId: function (value) {
          return String(value ?? "").replace(/^0+(?=\d)/, "");
        },
        statusState: function (status) {
          return ["WIN", "COMPLETE"].includes(status)
            ? "Success"
            : ["LOSS", "NOGO"].includes(status)
              ? "Error"
              : status === "HOLD"
                ? "Warning"
                : "Information";
        },
      },
    );
  },
);
