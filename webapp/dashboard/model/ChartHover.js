sap.ui.define([], function () {
    "use strict";
    // One-measure chart point IDs use category order. A stacked_bar with a color
    // dimension uses series-major IDs, in reverse color-series order.
    function rowForPoint(rows, id, stacked) {
        if (!Number.isInteger(id) || id < 0 || id >= rows.length) { return undefined; }
        if (!stacked) { return rows[id]; }
        const seriesCount = new Set(rows.map(row => row.proposalKey)).size;
        const ownerCount = rows.length / seriesCount;
        return rows[(id % ownerCount) * seriesCount + seriesCount - 1 - Math.floor(id / ownerCount)];
    }
    function ChartHover(fields) {
        this.fields = fields;
        this.observers = [];
        this.element = document.createElement("div");
        this.element.className = "dashboardHoverCard";
        this.element.setAttribute("role", "tooltip");
        this.element.hidden = true;
        document.body.appendChild(this.element);
        this.hide = this.hide.bind(this);
        window.addEventListener("resize", this.hide);
        document.addEventListener("scroll", this.hide, true);
    }
    ChartHover.rowForPoint = rowForPoint;
    ChartHover.prototype.connect = function (chart, getRows, stacked) {
        const pointAt = target => target?.closest?.(".v-datapoint[data-id]");
        const show = event => {
            const point = pointAt(event.target);
            const row = point && rowForPoint(getRows(), Number(point.getAttribute("data-id")), stacked);
            if (!row) { this.hide(); return; }
            if (this.point === point && !this.element.hidden) { return; }
            this.point = point;
            this.element.replaceChildren();
            const title = document.createElement("strong");
            title.textContent = row.hoverTitle || row.label;
            this.element.appendChild(title);
            for (const [key, label] of this.fields) {
                const line = document.createElement("div");
                const name = document.createElement("span"), value = document.createElement("b");
                name.textContent = label; value.textContent = row[key];
                line.append(name, value); this.element.appendChild(line);
            }
            for (const [label, value] of row.hoverExtra || []) {
                const line = document.createElement("div"), name = document.createElement("span"), amount = document.createElement("b");
                name.textContent = label; amount.textContent = value;
                line.append(name, amount); this.element.appendChild(line);
            }
            this.element.hidden = false;
            const bounds = point.getBoundingClientRect();
            const x = event.clientX || bounds.left + bounds.width / 2;
            const y = event.clientY || bounds.top + bounds.height / 2;
            const width = this.element.offsetWidth, height = this.element.offsetHeight;
            const left = x + 16 + width < window.innerWidth ? x + 16 : x - width - 16;
            this.element.style.left = Math.max(8, Math.min(left, window.innerWidth - width - 8)) + "px";
            this.element.style.top = Math.max(8, Math.min(y + 16, window.innerHeight - height - 8)) + "px";
        };
        chart.attachBrowserEvent("mousemove", show);
        chart.attachBrowserEvent("mouseleave", this.hide);
        chart.attachBrowserEvent("focusin", show);
        chart.attachBrowserEvent("focusout", this.hide);
        chart.attachBrowserEvent("keydown", event => { if (event.key === "Escape") { this.hide(); } });
        const annotate = () => {
            chart.getDomRef()?.querySelectorAll(".v-datapoint[data-id]").forEach(point => {
                const row = rowForPoint(getRows(), Number(point.getAttribute("data-id")), stacked);
                if (row && (!stacked || row.value !== 0)) {
                    point.setAttribute("tabindex", "0");
                    point.setAttribute("aria-label", (row.hoverTitle || row.label) + ": " + row.hoverCount);
                } else {
                    point.removeAttribute("tabindex");
                    point.removeAttribute("aria-label");
                }
            });
        };
        // Viz virtualizes categories while scrolling without firing renderComplete.
        const observer = new MutationObserver(annotate);
        this.observers.push(observer);
        chart.addEventDelegate({
            onBeforeRendering: () => observer.disconnect(),
            onAfterRendering: () => {
                observer.observe(chart.getDomRef(), { childList: true, subtree: true });
                annotate();
            }
        });
        chart.attachRenderComplete(annotate);
    };
    ChartHover.prototype.hide = function () { this.element.hidden = true; this.point = null; };
    ChartHover.prototype.destroy = function () {
        this.observers.forEach(observer => observer.disconnect());
        window.removeEventListener("resize", this.hide);
        document.removeEventListener("scroll", this.hide, true);
        this.element.remove();
    };
    return ChartHover;
});
