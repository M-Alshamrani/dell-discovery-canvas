// ui/views/GapsEditView.js -- fully wired gaps & initiatives board

import { LAYERS, ENV_CATALOG, BUSINESS_DRIVERS, getEnvLabel } from "../../core/config.js";
import { LayerIds, EnvironmentIds } from "../../core/models.js";
// rc.7 / 7e-4 - v3-pure write surface per SPEC S40.
import {
  commitGapAdd,
  commitGapUpdate,
  commitGapRemove,
  commitGapLinkCurrentInstance,
  commitGapLinkDesiredInstance,
  commitGapUnlinkCurrentInstance,
  commitGapUnlinkDesiredInstance,
  commitGapSetDriverByBusinessDriverId
} from "../../state/adapter.js";
import {
  commitSyncDesiredFromGap,
  confirmPhaseOnLink
} from "../../state/dispositionLogic.js";
import { getActiveEngagement } from "../../state/engagementStore.js";
import { suggestDriverId, effectiveDriverId, effectiveDriverReason, driverLabel as driverLabelFor,
         effectiveDellSolutions } from "../../services/programsService.js";
import { helpButton } from "./HelpModal.js";
import { validateActionLinks, actionById } from "../../core/taxonomy.js";
import { SERVICE_TYPES, SUGGESTED_SERVICES_BY_GAP_TYPE, suggestedFor, serviceLabel, serviceDomain } from "../../core/services.js";
import { renderDemoBanner } from "../components/DemoBanner.js";
// rc.7 / 7e-9 · Z2 closure · SPEC §S43.3 · centralized label resolver.
// Aliased import to keep call sites reading intentionally + avoid name
// collision with the local envName wrapper below.
import { envLabel as _resolveEnvLabel } from "../../core/labelResolvers.js";
import { getActiveValue as getFilter, getActiveValues as getFilterValues,
         toggleValue as toggleFilter, subscribe as subscribeFilter,
         getToggles, setToggle } from "../../state/filterState.js";
import { renderFilterBar, applyMatchClasses as applyFilterMatchClasses } from "../components/FilterBar.js";
import { getSnapshot as getFilterSnapshot } from "../../state/filterState.js";
import { confirmAction, notifyError } from "../components/Notify.js";
// rc.7 / 7e-8c'-impl · shared empty-environments UX per SPEC §S41 + RULES §16 CH35.
import { renderEmptyEnvsCenterCard, visibleEnvCount } from "../components/NoEnvsCard.js";

// v2.4.14 F1 . apply the active services filter to a gap card. Sets
// .filter-match-services when the card's services include the active
// filter value; otherwise the CSS dim rule (body[data-filter-services]
// .gap-card:not(.filter-match-services)) drops opacity.
function applyServicesMatch(card, gap) {
  // Read the active filter from getFilter (the imported state alias).
  // Fallback to body attribute so direct test renders that mutate
  // body[data-filter-services] without going through filterState
  // (e.g. VT17) still trigger the dim. Both sources stay in sync via
  // filterState.applyToBody() at module init.
  var active = getFilter("services");
  if (!active && typeof document !== "undefined" && document.body) {
    active = document.body.getAttribute("data-filter-services") || null;
  }
  if (!active) {
    card.classList.remove("filter-match-services");
    return;
  }
  var services = (gap && Array.isArray(gap.services)) ? gap.services : [];
  if (services.indexOf(active) >= 0) {
    card.classList.add("filter-match-services");
  } else {
    card.classList.remove("filter-match-services");
  }
}

// v2.4.14 CD3 . pick the dominant domain across a gap's services (cyber /
// ops / data / null). When multiple services map to multiple domains we
// take the most-frequent; ties resolve by the SERVICE_TYPES catalog order.
// Returns null when the gap has no services or none have a domain.
function pickGapDomain(gap) {
  if (!gap || !Array.isArray(gap.services) || gap.services.length === 0) return null;
  var counts = {};
  for (var i = 0; i < gap.services.length; i++) {
    var d = serviceDomain(gap.services[i]);
    if (d) counts[d] = (counts[d] || 0) + 1;
  }
  var best = null, bestCount = 0;
  Object.keys(counts).forEach(function(k) {
    if (counts[k] > bestCount) { best = k; bestCount = counts[k]; }
  });
  return best;
}

// Phase 18: count how many gaps reference an instance id (in either link
// list). Used for the "linked to N gaps" multi-link chip and for the
// link-picker warning row.
function countGapsLinking(session, instanceId) {
  return ((session && _v3GapsArray()) || []).filter(function(g) {
    return (g.relatedCurrentInstanceIds || []).indexOf(instanceId) >= 0
        || (g.relatedDesiredInstanceIds || []).indexOf(instanceId) >= 0;
  }).length;
}

// Phase 18: return the FIRST other gap (excluding `excludeGapId`) that
// already links the given instanceId. null if none. Used by the picker.
function findOtherGapLinking(session, instanceId, excludeGapId) {
  var hits = ((session && _v3GapsArray()) || []).filter(function(g) {
    if (g.id === excludeGapId) return false;
    return (g.relatedCurrentInstanceIds || []).indexOf(instanceId) >= 0
        || (g.relatedDesiredInstanceIds || []).indexOf(instanceId) >= 0;
  });
  return hits.length ? hits[0] : null;
}


// rc.7 / 7e-4 - v3-pure helper module-scope. Walk getActiveEngagement
// + project to v2 shape so existing iteration patterns in
// renderGapsEditView keep working without rewriting every loop.
// These helpers are read-only; writes go via adapter commit* helpers
// imported above.
function _v3GapsArray() {
  var eng = getActiveEngagement();
  if (!eng || !eng.gaps || !Array.isArray(eng.gaps.allIds)) return [];
  return eng.gaps.allIds.map(function(id) { return eng.gaps.byId[id]; }).filter(Boolean);
}
function _v3InstancesArray() {
  var eng = getActiveEngagement();
  if (!eng || !eng.instances || !Array.isArray(eng.instances.allIds)) return [];
  return eng.instances.allIds.map(function(id) { return eng.instances.byId[id]; }).filter(Boolean);
}
function _v3EnvsAll() {
  var eng = getActiveEngagement();
  if (!eng || !eng.environments || !Array.isArray(eng.environments.allIds)) return [];
  return eng.environments.allIds.map(function(id) {
    var e = eng.environments.byId[id];
    if (!e) return null;
    var cat = ENV_CATALOG.find(function(c) { return c.id === e.envCatalogId; });
    // env.id stays as the catalog ref so existing iteration code that
    // calls getEnvLabel(env.id, ...) and similar legacy helpers keeps
    // working. env.uuid is the v3 UUID -- used for gap.affectedEnvironments
    // membership + commit-time references (since v3 stores UUIDs).
    return {
      id:           e.envCatalogId,
      uuid:         e.id,
      envCatalogId: e.envCatalogId,
      label:        (e.alias && e.alias.length > 0) ? e.alias : (cat ? cat.label : e.envCatalogId),
      hint:         cat ? cat.hint : "",
      hidden:       !!e.hidden,
      alias:        e.alias || null,
      location:     e.location || null,
      sizeKw:       (typeof e.sizeKw === "number") ? e.sizeKw : null,
      sqm:          (typeof e.sqm === "number") ? e.sqm : null,
      tier:         e.tier || null,
      notes:        e.notes || ""
    };
  }).filter(Boolean);
}
function _v3VisibleEnvs() {
  return _v3EnvsAll().filter(function(e) { return !e.hidden; });
}
function _v3DriversV2Shape() {
  var eng = getActiveEngagement();
  if (!eng || !eng.drivers || !Array.isArray(eng.drivers.allIds)) return [];
  return eng.drivers.allIds.map(function(id) {
    var d = eng.drivers.byId[id];
    if (!d) return null;
    return {
      id:       d.businessDriverId,
      priority: d.priority || "Medium",
      outcomes: typeof d.outcomes === "string" ? d.outcomes : ""
    };
  }).filter(Boolean);
}
function _v3Customer() {
  var eng = getActiveEngagement();
  if (!eng || !eng.customer) return { name: "", vertical: "", region: "", drivers: [] };
  return Object.assign({}, eng.customer, { drivers: _v3DriversV2Shape() });
}

// BUG-051 (closes BUG-032 root cause) · selectedGapId lifted to module scope
// so it survives the engagement subscriber chain re-render that fires after
// commitGapLinkCurrentInstance / commitGapLinkDesiredInstance / commitGapEdit /
// commitGapRemove. Pre-fix: closure-local var -> fresh closure -> null ->
// detail panel disappeared -> user perceived "the link button is deactivated"
// (the panel was gone; the buttons inside it weren't disabled, they were
// just absent because the panel reverted to the "select a gap" hint).
//
// Same pattern as BUG-048's MatrixView fix (commit d6d74b8). After re-render,
// if the persisted selectedGapId still matches a live gap, the right pane
// re-mounts the gap detail panel automatically.
var _selectedGapIdInGapsView = null;

export function renderGapsEditView(left, right, session) {
  var activeLayerIds        = new Set(LAYERS.map(function(l) { return l.id; }));
  // v2.4.15-polish iter-4 . multi-select active sets. Empty set = no
  // filter applied for that dim (matches everything). filteredGaps
  // checks size > 0 before applying the include test.
  var activeEnvIds          = new Set();
  var activeGapTypes        = new Set();
  var activeUrgencies       = new Set();
  // BUG-051 · accessor over module-scope state. Reads return the persisted
  // selection; writes mutate the map so subsequent re-renders see the same
  // selection. The local var stays for read-friendliness inside this closure.
  function getSelectedGapId() { return _selectedGapIdInGapsView || null; }
  function setSelectedGapId(id) { _selectedGapIdInGapsView = id || null; }
  var selectedGapId         = getSelectedGapId();
  var dragGapId             = null;
  var showNeedsReviewOnly   = false;
  // v2.4.11 · A2 · "Show closed gaps" filter. Default off , closed gaps
  // (auto-closed when their tile's disposition flips to Keep) stay
  // hidden from the main board so they don't clutter active work.
  // User can flip on to see + recover them.
  var showClosedGaps        = false;

  // v2.4.13 S5 . demo banner mirrors Tab 1 styling so the colorful demo
  // signal follows the user across the workshop.
  //
  // BUG-042 fix · the original predicate read isDemo from the v2-shape
  // session arg (3rd param), but app.js's renderStage now passes null
  // for that arg in the live demo-loader path (post-Step-H+J+K -- v3-pure;
  // session is dead). VT26 still passed a v2-shape projection so that
  // path's banner works. The two paths diverged. Reading isDemo from the
  // v3 engagement directly via getActiveEngagement().meta.isDemo
  // unifies them: any path that reaches renderGapsEditView with a
  // demo-flagged engagement gets the banner.
  var _engForDemo = getActiveEngagement();
  var _isDemoEng = !!(_engForDemo && _engForDemo.meta && _engForDemo.meta.isDemo);
  var _isDemoLegacy = !!(session && session.isDemo);
  if (_isDemoEng || _isDemoLegacy) renderDemoBanner(left);

  // rc.7 / 7e-8c'-impl · empty-environments empty-state via shared
  // NoEnvsCard component (SPEC §S41 + RULES §16 CH35). Per §S41.2 Tab 4
  // should be stepper-disabled when visibleEnvCount===0, so this body
  // code path is reached only on direct deep-link / programmatic mount.
  // Defensive empty-state retained.
  if (_v3VisibleEnvs().length === 0) {
    renderEmptyEnvsCenterCard(left, "gaps", {});
    return;
  }

  // ---- Header ----
  var header = mk("div", "card");
  var titleRow = mk("div", "card-title-row");
  titleRow.appendChild(mkt("div", "card-title", "Gaps and initiatives"));
  titleRow.appendChild(helpButton("gaps"));
  header.appendChild(titleRow);
  header.appendChild(mkt("div", "card-hint",
    "Each gap bridges current to desired state. Auto-drafted gaps appear when you set a disposition in Desired State. Drag cards between phases to re-prioritise."));

  // v2.4.15-polish iter-4 . FilterBar dim list = Service / Layer /
  // Environment / Gap type / Urgency. Domain is dropped (per user
  // direction). Each dim is multi-select (via filterState arrays).
  var filterBarHost = mk("div", "gaps-filter-bar-host");
  header.appendChild(filterBarHost);

  // v2.4.15-polish iter-3 . define the "+ Add gap" CTA BEFORE the
  // FilterBar so we can pass it as opts.trailing (var hoisting would
  // give us `undefined` if the declaration came later in the function).
  var addBtn = mkt("button", "btn-primary btn-with-feedback", "+ Add gap");
  addBtn.addEventListener("click", function() { openAddDialog(); });

  // v2.4.15-polish iter-3 . FilterBar owns Layer + Service + Domain +
  // Urgency + Environment dimensions plus the binary toggles row
  // ("Needs review only" / "Show closed gaps"). + Add gap rides as
  // the trailing CTA on the same line as the filter pill.
  if (left._unsubFilter) try { left._unsubFilter(); } catch (e) {}
  var visibleEnvsForFilter = _v3VisibleEnvs();
  var closedCountForBadge = (_v3GapsArray() || []).filter(function(g) {
    return g && g.status === "closed";
  }).length;
  renderFilterBar(filterBarHost, {
    dimensions: [
      { id: "services", label: "Service",
        options: SERVICE_TYPES.map(function(s) { return { id: s.id, label: s.label.split(" / ")[0] }; }) },
      { id: "layer",    label: "Layer",
        options: LAYERS.map(function(l) { return { id: l.id, label: l.label }; }) },
      { id: "environment", label: "Environment",
        options: visibleEnvsForFilter.map(function(e) {
          // Filter id == v3 UUID so it matches gap.affectedEnvironments
          // (v3-pure: UUIDs throughout). Display uses the env's
          // catalog/alias label.
          return { id: e.uuid, label: e.label };
        }) },
      { id: "gapType",  label: "Gap type",
        options: [
          { id: "replace",  label: "Replace" },
          { id: "enhance",  label: "Enhance" },
          { id: "ops",      label: "Operational / services" },
          { id: "newCap",   label: "New capability" },
          { id: "consolidate", label: "Consolidate" }
        ] },
      { id: "urgency",  label: "Urgency",
        options: [{ id: "High", label: "High" }, { id: "Medium", label: "Medium" }, { id: "Low", label: "Low" }] }
    ],
    toggles: [
      { key: "needsReviewOnly", label: "Needs review only",
        hint: "Show only gaps that still need approval or review." },
      { key: "showClosedGaps",
        label: "Show closed gaps" + (closedCountForBadge > 0 ? " (" + closedCountForBadge + ")" : ""),
        hint: "Closed gaps are hidden by default. Tick to see + recover them." }
    ],
    session: session,
    scope: left,
    trailing: addBtn
  });

  // Bridge filterState into GapsEditView's local renderAll. The legacy
  // local state vars (activeLayerIds, activeEnvId, showNeedsReviewOnly,
  // showClosedGaps) survive intact -- we just sync them on every
  // filterState change so renderAll's existing logic keeps working.
  function syncFromFilterState() {
    // v2.4.15-polish iter-4 . multi-select aware. Layer + Environment
    // can each have multiple active values now. activeLayerIds is a
    // Set so legacy filteredGaps logic keeps working; activeEnvIds is
    // a Set too (replaces the single activeEnvId).
    var layVals = getFilterValues("layer");
    var envVals = getFilterValues("environment");
    if (layVals.length > 0) {
      activeLayerIds = new Set(layVals);
    } else {
      activeLayerIds = new Set(LAYERS.map(function(l) { return l.id; }));
    }
    activeEnvIds = new Set(envVals);
    activeGapTypes = new Set(getFilterValues("gapType"));
    activeUrgencies = new Set(getFilterValues("urgency"));
    var togs = (typeof getToggles === "function") ? getToggles() : null;
    if (togs) {
      showNeedsReviewOnly = !!togs.needsReviewOnly;
      showClosedGaps      = !!togs.showClosedGaps;
    }
  }
  syncFromFilterState();
  var unsubFilter = subscribeFilter(function() {
    syncFromFilterState();
    renderAll();
  });
  left._unsubFilter = unsubFilter;

  // Auto-gap notice + v2.4.11 · C2 · "Review all" guided walkthrough button.
  var autoGaps = getAutoGaps();
  if (autoGaps.length > 0) {
    var notice = mk("div", "auto-gap-notice");
    var msg = "<strong>" + autoGaps.length + " auto-drafted gap" + (autoGaps.length > 1 ? "s" : "") +
      "</strong> from Desired State dispositions , review them in the board below.";
    notice.innerHTML = msg + " ";
    var reviewAllBtn = mkt("button", "btn-primary auto-gap-review-all", "Review all →");
    reviewAllBtn.title = "Walk through each unreviewed gap in sequence so you can approve, edit, or delete it.";
    reviewAllBtn.addEventListener("click", function() {
      // Walkthrough: select unreviewed gaps one at a time. Clicking the
      // button each time advances to the next; when none remain, it
      // auto-disables. Lightweight first cut , doesn't need a full
      // wizard chrome to be useful.
      var nextUnreviewed = (_v3GapsArray() || []).find(function(g) {
        return g.reviewed === false && g.status !== "closed";
      });
      if (nextUnreviewed) {
        selectedGapId = nextUnreviewed.id;
        setSelectedGapId(selectedGapId);
        renderAll();
      }
    });
    notice.appendChild(reviewAllBtn);
    header.appendChild(notice);
  }

  // v2.4.15-polish iter-3 . legacy filter-row removed. Layer / Env /
  // Needs-review / Show-closed all live inside the elegant FilterBar
  // pill below. The "+ Add gap" CTA travels with it as the trailing
  // slot. State bridging happens in subscribeFilter() further down --
  // we keep activeLayerIds / activeEnvId / showNeedsReviewOnly /
  // showClosedGaps locally so the existing renderAll logic doesn't
  // need rewriting.
  // (addBtn is defined ABOVE the renderFilterBar call so it can ride
  // as the FilterBar's trailing CTA. Hoisting would give us `undefined`
  // if it came later in the function.)

  // v2.4.12 · U1 · the v2.4.11 D2 "+ Add operational / services gap"
  // button is removed. Services attach to any gap as a multi-chip facet
  // (see "Services needed" section in the gap detail panel) , a dedicated
  // ops-typed gap CTA reinforced a wrong mental model.

  // (legacy filter-row removed; FilterBar pill below carries the same
  // controls plus the binary toggles and the "+ Add gap" trailing CTA)
  left.appendChild(header);

  var board = mk("div", "kanban");
  left.appendChild(board);

  showPlaceholder(right);

  // ---- Helpers ----
  // v2.4.11 · A1 · soft-chip helper. Probes the gap as if reviewed:true
  // and catches the friendly error from validateActionLinks. Returns the
  // friendly message string (or null if the gap is shape-valid).
  function computeDraftIssue(gap) {
    if (!gap || gap.status === "closed") return null;
    try {
      validateActionLinks(Object.assign({}, gap, { reviewed: true }));
      return null;
    } catch (e) {
      return e.message || String(e);
    }
  }

  function getAutoGaps() {
    return (_v3GapsArray() || []).filter(function(g) {
      return g.relatedDesiredInstanceIds && g.relatedDesiredInstanceIds.length > 0
          && g.status === "open" && !g.notes;
    });
  }

  function filteredGaps() {
    // v2.4.15-polish iter-4 . multi-select intersection. For each dim
    // with at least one active value, gap matches iff its value(s)
    // intersect with the active set. No active values for a dim ->
    // dim doesn't filter (matches everything).
    var layerIds   = Array.from(activeLayerIds);
    var envIds     = Array.from(activeEnvIds);
    var gapTypes   = Array.from(activeGapTypes);
    var urgencies  = Array.from(activeUrgencies);
    var allLayers  = activeLayerIds.size === LAYERS.length;
    return (_v3GapsArray() || []).filter(function(g) {
      var layers = (g.affectedLayers && g.affectedLayers.length) ? g.affectedLayers : [g.layerId];
      var envs   = g.affectedEnvironments || [];
      // Layer dim: when every layer is active (empty user filter), all
      // gaps match. Otherwise, intersection.
      var lOk = allLayers || layers.some(function(l) { return layerIds.indexOf(l) >= 0; });
      // Environment dim: empty active set = no filter; otherwise gap
      // must reference at least one active env (gaps with empty
      // affectedEnvironments are kept).
      var eOk = envIds.length === 0 ||
                envs.length === 0 ||
                envs.some(function(e) { return envIds.indexOf(e) >= 0; });
      var gtOk = gapTypes.length === 0 ||
                 (g.gapType && gapTypes.indexOf(g.gapType) >= 0);
      var uOk  = urgencies.length === 0 ||
                 (g.urgency && urgencies.indexOf(g.urgency) >= 0);
      var nrOk = !showNeedsReviewOnly || g.reviewed === false;
      var statusOk = (g.status !== "closed") || showClosedGaps;
      return lOk && eOk && gtOk && uOk && nrOk && statusOk;
    });
  }

  function renderAll() {
    renderBoard();
    renderDetail();
    // v2.4.15-polish iter-3 . re-apply FilterBar match classes after the
    // kanban rebuild. renderBoard wipes + recreates gap-cards from
    // scratch, so any .filter-match-<dim> class applied earlier is lost.
    try {
      applyFilterMatchClasses(left, getFilterSnapshot());
    } catch (e) { /* defensive: filterState may be unavailable in some test contexts */ }
  }

  // ---- Kanban board with drag-and-drop ----
  function renderBoard() {
    board.innerHTML = "";
    var gaps = filteredGaps();
    var phases = [
      ["now",   "Now (0-12 months)"],
      ["next",  "Next (12-24 months)"],
      ["later", "Later (>24 months)"]
    ];

    phases.forEach(function(phaseInfo) {
      var phId    = phaseInfo[0];
      var phLabel = phaseInfo[1];
      var phGaps  = gaps.filter(function(g) { return (g.phase || "now") === phId; });

      var col  = mk("div", "kanban-col");
      col.setAttribute("data-phase", phId);

      var head = mk("div", "kanban-col-head");
      var titleSpan = mkt("span", "kanban-col-title", phLabel);
      var countSpan = mkt("span", "kanban-col-count", String(phGaps.length));
      head.appendChild(titleSpan);
      head.appendChild(countSpan);
      col.appendChild(head);

      var body = mk("div", "kanban-col-body");
      body.setAttribute("data-drop-zone", phId);

      // Drag-over styling
      body.addEventListener("dragover", function(e) {
        e.preventDefault();
        body.classList.add("drop-hover");
      });
      body.addEventListener("dragleave", function() {
        body.classList.remove("drop-hover");
      });
      body.addEventListener("drop", function(e) {
        e.preventDefault();
        body.classList.remove("drop-hover");
        if (dragGapId) {
          try {
            commitGapUpdate(dragGapId, { phase: phId });
            // Bidirectional phase sync: propagate gap.phase → linked desired instance(s) (T4.5).
            commitSyncDesiredFromGap(dragGapId);
            renderAll();
          } catch(err) { notifyError({ title: "Couldn't move the gap", body: err.message || String(err) }); }
        }
      });

      phGaps.forEach(function(gap) { body.appendChild(buildCard(gap)); });
      col.appendChild(body);
      board.appendChild(col);
    });
  }

  function buildCard(gap) {
    var isSelected = gap.id === selectedGapId;
    var isAuto     = !gap.notes && gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length > 0;
    var needsReview = gap.reviewed === false;
    var cls = "gap-card" + (isSelected ? " selected" : "") + (isAuto ? " gap-card-auto" : "");
    if (needsReview) cls += " gap-needs-review";
    // Criticality accent , derived from gap.urgency (T4.4).
    if (gap.urgency) cls += " crit-" + gap.urgency.toLowerCase();
    var card = mk("div", cls);
    card.draggable = true;
    // v2.4.14 CD3 . carry the gap's domain (derived from its services'
    // dominant domain) on a data attribute so .gap-card::before paints
    // the muted-hue left bar via CSS.
    var domain = pickGapDomain(gap);
    if (domain) card.setAttribute("data-domain", domain);
    // v2.4.15 FB7a/c . cards carry layer + urgency on data attributes so
    // FilterBar's match-class pass can target them.
    if (gap.layerId) card.setAttribute("data-layer", gap.layerId);
    if (gap.urgency) card.setAttribute("data-urgency", gap.urgency);
    if (gap.gapType) card.setAttribute("data-gapType", gap.gapType);
    // v2.4.15-polish iter-3 . carry affectedEnvironments[] as a space-
    // separated attribute so the FilterBar's environment dim can dim
    // non-matching cards.
    if (Array.isArray(gap.affectedEnvironments) && gap.affectedEnvironments.length > 0) {
      card.setAttribute("data-environment", gap.affectedEnvironments.join(" "));
    }
    // affectedLayers[] gets reflected as data-layer (multi-value) so a
    // gap that affects both Compute and Storage matches both filter
    // chips. The primary layerId is always first in the array per the
    // v2.4.9 invariant, so single-value match-by-primary is preserved.
    if (Array.isArray(gap.affectedLayers) && gap.affectedLayers.length > 1) {
      card.setAttribute("data-layer", gap.affectedLayers.join(" "));
    }
    // v2.4.14 F1 . cards declare their services as a space-separated
    // attribute so the filter system + CSS dim rule can match.
    if (Array.isArray(gap.services) && gap.services.length > 0) {
      card.setAttribute("data-services", gap.services.join(" "));
    }
    // Apply the current services filter match class so initial render
    // is consistent with body[data-filter-services] state.
    applyServicesMatch(card, gap);

    // v2.1 · pulsing review dot for unreviewed auto-drafts.
    if (needsReview) {
      var dot = mk("span", "gap-review-dot");
      dot.title = "Auto-drafted , review and approve in the detail panel.";
      card.appendChild(dot);
    }

    var layerLabel = layerName(gap.layerId);
    var envTags = (gap.affectedEnvironments || []).map(function(id) {
      return envName(id);
    }).join(", ");

    var titleEl = mkt("div", "gap-card-title", gap.description || "(no description)");
    card.appendChild(titleEl);

    var metaEl = mkt("div", "gap-card-meta",
      layerLabel + (gap.gapType ? " - " + gap.gapType : "") + (envTags ? " | " + envTags : ""));
    card.appendChild(metaEl);

    var badgesEl = mk("div", "gap-card-badges");
    var urgBadge = mkt("span", "urgency-badge " + urgClass(gap.urgency), gap.urgency);
    // Tooltip explains urgency is derived and points at source (T4.2 / T3.16).
    var srcLabel = gapOriginCriticalityHint(gap, session);
    urgBadge.title = "Urgency is derived from the linked current instance's criticality , not editable. " + srcLabel;
    badgesEl.appendChild(urgBadge);
    var shape = mk("span", "crit-shape-" + (gap.urgency || "medium").toLowerCase());
    shape.title = urgBadge.title;
    badgesEl.appendChild(shape);

    // Strategic-driver chip (effective , explicit override OR auto-suggest).
    // "★" prefix = confirmed manually; "☆" prefix = suggested (one-click confirm).
    var effDid = effectiveDriverId(gap, session);
    if (effDid) {
      var glyph = gap.driverId ? "★ " : "☆ ";
      // BUG-A / SPEC §S43.3 closure · NEVER fall back to raw effDid (UUID).
      // driverLabelFor (services/programsService.js driverLabel) returns
      // "(unknown driver)" structured placeholder when neither catalog
      // nor engagement.drivers.byId resolution succeeds. Pre-fix the
      // `|| effDid` fallback leaked v3 driver UUIDs into the gap-card
      // program-badge whenever a gap had a driverId pointing at a removed
      // driver (orphan ref the scrubber would repair on next reload, but
      // visible in the meantime).
      var progBadge = mkt("span", "program-badge", glyph + driverLabelFor(effDid));
      progBadge.title = gap.driverId
        ? "Strategic driver (confirmed). Click a card to change in the right panel."
        : "Strategic driver (auto-suggested). Confirm or override it in the right panel.";
      if (!gap.driverId) progBadge.classList.add("program-suggested");
      badgesEl.appendChild(progBadge);
    }

    if (isAuto) {
      badgesEl.appendChild(mkt("span", "auto-badge", "Auto-drafted"));
    }
    // v2.1 · Dell solutions derive from linked Dell desired tiles, not free text.
    var derivedSolutions = effectiveDellSolutions(gap, session);
    if (derivedSolutions.length > 0) {
      badgesEl.appendChild(mkt("span", "solutions-badge", derivedSolutions[0]));
    }
    if (gap.status === "closed") {
      badgesEl.appendChild(mkt("span", "status-badge", "Closed"));
    }
    if (gap.relatedCurrentInstanceIds && gap.relatedCurrentInstanceIds.length) {
      badgesEl.appendChild(mkt("span", "link-badge",
        gap.relatedCurrentInstanceIds.length + " current"));
    }
    if (gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length) {
      badgesEl.appendChild(mkt("span", "link-badge link-badge-desired",
        gap.relatedDesiredInstanceIds.length + " desired"));
    }
    card.appendChild(badgesEl);

    card.addEventListener("click", function() {
      selectedGapId = gap.id;
      setSelectedGapId(gap.id);
      renderAll();
    });
    card.addEventListener("dragstart", function(e) {
      dragGapId = gap.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", function() {
      card.classList.remove("dragging");
      dragGapId = null;
    });

    return card;
  }

  // ---- Detail / edit panel ----
  function renderDetail() {
    right.innerHTML = "";
    var gap = (_v3GapsArray() || []).find(function(g) { return g.id === selectedGapId; });
    if (!gap) { showPlaceholder(right); return; }

    var panel = mk("div", "detail-panel");

    // Status bar at top
    var statusRow = mk("div", "gap-status-row");
    statusRow.appendChild(mkt("span", "urgency-badge " + urgClass(gap.urgency), gap.urgency));
    if (gap.gapType) statusRow.appendChild(mkt("span", "type-badge", gap.gapType));
    statusRow.appendChild(mkt("span", "status-badge", gap.status || "open"));
    panel.appendChild(statusRow);

    var titleEl = mkt("div", "detail-title", gap.description || "(no description)");
    panel.appendChild(titleEl);

    var subEl = mkt("div", "detail-sub",
      layerName(gap.layerId) + " | " + phaseLabel(gap.phase) +
      ((gap.affectedEnvironments && gap.affectedEnvironments.length)
        ? " | " + gap.affectedEnvironments.map(envName).join(", ") : ""));
    panel.appendChild(subEl);

    // v2.4.11 · A1 · soft chip when this gap's shape doesn't satisfy its
    // Action's link rules. Doesn't block editing , just surfaces what's
    // missing so the user knows what to fix before approving.
    var draftIssue = computeDraftIssue(gap);
    if (draftIssue) {
      var draftChip = mk("div", "draft-issue-chip");
      draftChip.appendChild(mkt("span", "draft-issue-eyebrow", "REVIEW NEEDED"));
      draftChip.appendChild(mkt("span", "draft-issue-msg", draftIssue));
      panel.appendChild(draftChip);
    }
    // v2.4.11 · A2 · closed-status banner when the gap is closed.
    if (gap.status === "closed") {
      var closedChip = mk("div", "closed-status-chip");
      closedChip.appendChild(mkt("span", "closed-status-eyebrow", "CLOSED"));
      closedChip.appendChild(mkt("span", "closed-status-msg",
        gap.closeReason || "manually closed"));
      var reopenBtn = mkt("button", "btn-ghost-sm", "Reopen");
      reopenBtn.title = "Reopen this gap. Status returns to 'open'.";
      reopenBtn.addEventListener("click", function() {
        try {
          commitGapUpdate(gap.id, { status: "open", closeReason: undefined, closedAt: undefined });
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      closedChip.appendChild(reopenBtn);
      panel.appendChild(closedChip);
    }

    // ---- Edit form ----
    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });

    form.appendChild(fg("Description",
      ta("description", gap.description || "", "One-line description of the gap or initiative")));
    // v2.4.11 · B2 · clarified label.
    form.appendChild(fg("Primary layer (drives the project bucket)",
      selEl("layerId", LayerIds, gap.layerId, layerMap)));
    // v2.4.11 · B2 · "Also affects" chips for additional layers. Excludes
    // the primary (which is always in affectedLayers[0] per the v2.4.9
    // invariant); user adds/removes layers here. Save handler stitches
    // primary back at index 0.
    var alsoGroup = mk("div", "form-group");
    alsoGroup.appendChild(mkt("label", "form-label", "Also affects (additional layers)"));
    var alsoRow = mk("div", "chips-row also-affects-chips");
    var existingAlso = (gap.affectedLayers || []).slice(1);  // skip primary at [0]
    LAYERS.forEach(function(layer) {
      if (layer.id === gap.layerId) return;  // primary not selectable here
      var chip = mkt("div", "chip-filter" + (existingAlso.indexOf(layer.id) >= 0 ? " active" : ""), layer.label);
      chip.dataset.alsoLayerId = layer.id;
      chip.addEventListener("click", function() {
        chip.classList.toggle("active");
      });
      alsoRow.appendChild(chip);
    });
    alsoGroup.appendChild(alsoRow);
    form.appendChild(alsoGroup);
    // Gap type: read-only display for auto-drafted gaps (T4.3);
    // editable ONLY when it's manual + hasn't been set yet (T4.14).
    if (isAutoDrafted(gap)) {
      form.appendChild(fg("Gap type", readOnlyField(gap.gapType || ",",
        "Gap type is derived from the source disposition. Change disposition in Desired State to change gap type.")));
    } else {
      form.appendChild(fg("Gap type",
        selEl("gapType", ["","enhance","replace","introduce","consolidate","ops"], gap.gapType || "")));
    }
    // v2.4.11 · A6 · urgency selector with override semantics.
    //   urgencyOverride: false → propagation owns urgency (P4/P7 sync from
    //                            linked current's criticality). UI shows the
    //                            value as derived + a "🔒 lock" button to pin.
    //   urgencyOverride: true  → user pinned. UI shows a real selector + an
    //                            "↺ auto" button to release back to derived.
    var urgencyGroup = mk("div", "form-group");
    urgencyGroup.appendChild(mkt("label", "form-label", "Urgency"));
    var urgencyRow = mk("div", "urgency-row");
    var isOverridden = gap.urgencyOverride === true;
    if (isOverridden) {
      // Editable selector + ↺ auto button.
      var urgSel = selEl("urgency", ["High","Medium","Low"], gap.urgency || "Medium");
      urgencyRow.appendChild(urgSel);
      var autoBtn = mkt("button", "btn-ghost-sm urg-auto-btn", "↺ auto");
      autoBtn.title = "Release urgency back to auto-derive (urgency follows the linked current's criticality).";
      autoBtn.addEventListener("click", function() {
        try {
          commitGapUpdate(gap.id, { urgencyOverride: false });
          // Re-derive urgency immediately from any linked current.
          var firstCur = (gap.relatedCurrentInstanceIds || []).map(function(id) {
            return (_v3InstancesArray() || []).find(function(i) { return i.id === id; });
          }).find(Boolean);
          if (firstCur && firstCur.criticality) {
            commitGapUpdate(gap.id, { urgency: firstCur.criticality });
          }
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      urgencyRow.appendChild(autoBtn);
      urgencyRow.appendChild(mkt("span", "urg-override-indicator", "🔒 manually set"));
    } else {
      // Read-only display + 🔒 lock button.
      urgencyRow.appendChild(mkt("span", "urg-derived-value urg-" + (gap.urgency||"Medium").toLowerCase(),
        gap.urgency || ","));
      var lockBtn = mkt("button", "btn-ghost-sm urg-lock-btn", "🔒 set manually");
      lockBtn.title = "Pin this urgency. Future propagation from criticality changes will not overwrite it.";
      lockBtn.addEventListener("click", function() {
        try {
          commitGapUpdate(gap.id, { urgencyOverride: true });
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      urgencyRow.appendChild(lockBtn);
      urgencyRow.appendChild(mkt("span", "urg-derived-indicator", "↺ auto from linked current"));
    }
    urgencyGroup.appendChild(urgencyRow);
    form.appendChild(urgencyGroup);
    form.appendChild(fg("Phase",
      selEl("phase", ["now","next","later"], gap.phase)));
    form.appendChild(fg("Status",
      selEl("status", ["open","in_progress","closed","deferred"], gap.status || "open")));

    // Program (driver) dropdown , session drivers + Unassigned. Auto-suggested
    // if no explicit driverId is set.
    var programOpts = [""].concat((_v3DriversV2Shape() || []).map(function(d) { return d.id; }));
    var programLabels = { "": "Unassigned" };
    (_v3DriversV2Shape() || []).forEach(function(d) {
      var meta = BUSINESS_DRIVERS.find(function(bd) { return bd.id === d.id; });
      programLabels[d.id] = (meta ? meta.label : d.id) + (gap.driverId === d.id ? "" : "");
    });
    var currentDriverVal = gap.driverId || "";
    var progSel = selEl("driverId", programOpts, currentDriverVal, programLabels);
    progSel.setAttribute("title",
      "Which strategic driver does this gap serve? Pick to override the auto-suggestion.");
    form.appendChild(fg("Strategic driver", progSel));
    // v2.4.11 · A5 · explicit "Auto-suggested driver: X because Y" chip
    // below the dropdown, replacing the silent ★-in-dropdown affordance.
    // Makes the suggestion logic visible and overridable.
    var driverReason = effectiveDriverReason(gap, session);
    if (driverReason && driverReason.source === "suggested" && driverReason.driverId) {
      var meta = BUSINESS_DRIVERS.find(function(d) { return d.id === driverReason.driverId; });
      var label = meta ? meta.label : driverReason.driverId;
      var hintRow = mk("div", "auto-driver-chip");
      hintRow.appendChild(mkt("span", "auto-driver-eyebrow", "AUTO-SUGGESTED"));
      hintRow.appendChild(mkt("span", "auto-driver-label", label));
      hintRow.appendChild(mkt("span", "auto-driver-reason", "because " + driverReason.reason));
      var acceptBtn = mkt("button", "btn-ghost-sm auto-driver-accept", "Pin this driver");
      acceptBtn.title = "Set this gap's driver explicitly to '" + label + "' so future heuristic changes don't reassign it.";
      acceptBtn.addEventListener("click", function() {
        try {
          commitGapSetDriverByBusinessDriverId(gap.id, driverReason.driverId);
          renderAll();
        } catch(e) { showErr(panel, e.message); }
      });
      hintRow.appendChild(acceptBtn);
      form.appendChild(hintRow);
    } else if (driverReason && driverReason.source === "none") {
      var noneRow = mk("div", "auto-driver-chip auto-driver-none");
      noneRow.appendChild(mkt("span", "auto-driver-eyebrow", "AUTO-SUGGESTED"));
      noneRow.appendChild(mkt("span", "auto-driver-reason", driverReason.reason));
      form.appendChild(noneRow);
    }

    // Affected environments -- multi-check
    var envGroup = mk("div", "form-group");
    envGroup.appendChild(mkt("label", "form-label", "Affected environments"));
    var envCheckRow = mk("div", "env-check-row");
    // rc.7 / 7e-4 - v3-pure: walk the active engagement's visible envs
    // (env.uuid is the v3 UUID stored in gap.affectedEnvironments).
    // Checkbox value is env.uuid so the on-save patch carries v3
    // UUIDs that pass GapSchema validation.
    _v3VisibleEnvs().forEach(function(env) {
      var lbl = mk("label", "env-check-label");
      var cb  = document.createElement("input");
      cb.type = "checkbox"; cb.value = env.uuid;
      cb.className = "env-checkbox";
      cb.checked = (gap.affectedEnvironments || []).indexOf(env.uuid) >= 0;
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(" " + env.label));
      envCheckRow.appendChild(lbl);
    });
    envGroup.appendChild(envCheckRow);
    form.appendChild(envGroup);

    // v2.1 · mappedDellSolutions input removed. Dell solutions derive render-time from
    // linked desired tiles tagged `vendorGroup: "dell"`. Here we surface the derived list
    // as a read-only field so the presales sees the result of their link choices.
    var solutions = effectiveDellSolutions(gap, session);
    var solutionsText = solutions.length === 0
      ? "None yet , link Dell-tagged desired tiles below to populate."
      : solutions.join(", ");
    form.appendChild(fg("Dell solutions (derived)",
      readOnlyField(solutionsText,
        "Derived from linked desired tiles with vendor = Dell. Manage the links below to change this list.")));

    // v2.4.12 · Services needed , multi-chip facet attached to any gap.
    // Picked chips are full-color (click to remove); suggested chips
    // appear under a SUGGESTED eyebrow (greyed, click to add). Suggested
    // is OPT-IN , never auto-applied. Suggestions re-derive on gapType
    // change but never auto-select.
    var servicesGroup = mk("div", "form-group services-group");
    servicesGroup.appendChild(mkt("label", "form-label", "Services needed"));
    var pickedServices = Array.isArray(gap.services) ? gap.services.slice() : [];
    var suggestedRow = mk("div", "services-suggested-row");
    var pickedRow    = mk("div", "services-picked-row");
    var addRow       = mk("div", "services-add-row");
    pickedRow.dataset.servicesPicked = "true";   // Save handler queries this.

    function paintServices() {
      pickedRow.innerHTML = "";
      suggestedRow.innerHTML = "";
      addRow.innerHTML = "";
      // Picked chips (full color, click to remove).
      pickedServices.forEach(function(id) {
        var lbl = serviceLabel(id) || id;
        var chip = mkt("button", "chip-filter services-chip-picked active", lbl + " ✕");
        chip.type = "button";
        chip.dataset.serviceId = id;
        chip.title = "Click to remove '" + lbl + "'";
        chip.addEventListener("click", function(ev) {
          ev.preventDefault();
          pickedServices = pickedServices.filter(function(x) { return x !== id; });
          paintServices();
        });
        pickedRow.appendChild(chip);
      });
      if (pickedServices.length === 0) {
        var hint = mkt("span", "services-empty-hint", "No services attached yet.");
        pickedRow.appendChild(hint);
      }
      // Suggested chips (greyed, click to add). Re-derive from current
      // gap.gapType minus already-picked.
      var suggestions = suggestedFor(gap.gapType, pickedServices);
      if (suggestions.length > 0) {
        suggestedRow.appendChild(mkt("span", "services-eyebrow", "SUGGESTED"));
        suggestions.forEach(function(id) {
          var lbl = serviceLabel(id) || id;
          var chip = mkt("button", "chip-filter services-chip-suggested", "+ " + lbl);
          chip.type = "button";
          chip.dataset.serviceId = id;
          chip.title = "Click to add '" + lbl + "' as a service for this gap";
          chip.addEventListener("click", function(ev) {
            ev.preventDefault();
            pickedServices.push(id);
            paintServices();
          });
          suggestedRow.appendChild(chip);
        });
      }
      // v2.4.12 · P1 · "+ Add service" picker exposes the FULL catalog so
      // service ids OUTSIDE the SUGGESTED-for-this-gapType list are reachable
      // (e.g. assessment, decommissioning, custom_dev on a Replace gap).
      // SUGGESTED ones for the current gapType get a ★ marker in the option
      // label so the user sees which are recommended without losing access
      // to the rest. Resets after each pick.
      var suggestedSet = (SUGGESTED_SERVICES_BY_GAP_TYPE[gap.gapType] || []);
      var availableForPicker = SERVICE_TYPES.filter(function(svc) {
        return pickedServices.indexOf(svc.id) < 0;
      });
      if (availableForPicker.length > 0) {
        var picker = document.createElement("select");
        picker.className = "services-add-picker";
        picker.title = "Pick any service from the catalog. ★ = suggested for this gap type.";
        var placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "+ Add service…";
        placeholder.selected = true;
        picker.appendChild(placeholder);
        availableForPicker.forEach(function(svc) {
          var opt = document.createElement("option");
          opt.value = svc.id;
          var star = (suggestedSet.indexOf(svc.id) >= 0) ? "★ " : "   ";
          opt.textContent = star + svc.label;
          picker.appendChild(opt);
        });
        picker.addEventListener("change", function() {
          var pickedId = picker.value;
          if (!pickedId) return;
          pickedServices.push(pickedId);
          paintServices();   // re-paints; new picker fresh-resets to placeholder
        });
        addRow.appendChild(picker);
      } else {
        addRow.appendChild(mkt("span", "services-empty-hint", "All services attached."));
      }
    }
    paintServices();
    servicesGroup.appendChild(suggestedRow);
    servicesGroup.appendChild(pickedRow);
    servicesGroup.appendChild(addRow);
    form.appendChild(servicesGroup);

    form.appendChild(fg("Notes / business context",
      ta("notes", gap.notes || "",
        "Business context, risk, regulatory drivers, assumptions, customer pain...")));
    panel.appendChild(form);

    // Save / Delete
    var actions = mk("div", "form-actions");

    // v2.1 · Approve-draft button only when this gap still needs review.
    if (gap.reviewed === false) {
      var approveBtn = mkt("button", "btn-secondary approve-draft-btn", "✓ Approve draft");
      approveBtn.title = "Accept this auto-drafted gap as-is without further changes.";
      approveBtn.addEventListener("click", function() {
        try { commitGapUpdate(gap.id, { reviewed: true }); renderAll(); }
        catch(e) { showErr(panel, e.message); }
      });
      actions.appendChild(approveBtn);
    }

    var saveBtn = mkt("button", "btn-primary save-btn", "Save changes");
    saveBtn.addEventListener("click", function() {
      // v2.4.11 · save button gets visible loading + success + error states.
      // Before: text swapped to "Saved" briefly on success only , no feedback
      // on click, no error state. User reported "save doesn't have any
      // dynamic clicking pattern". Fixing.
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving…";
      saveBtn.classList.remove("save-ok", "save-err");
      var patch = {};
      form.querySelectorAll("[data-prop]").forEach(function(el) {
        patch[el.getAttribute("data-prop")] = el.value || undefined;
      });
      // Collect environment checkboxes
      var checkedEnvs = [];
      form.querySelectorAll(".env-checkbox:checked").forEach(function(cb) {
        checkedEnvs.push(cb.value);
      });
      patch.affectedEnvironments = checkedEnvs;
      // v2.4.11 · B2 · collect Also-affects chips into affectedLayers
      // (with primary stitched at index 0 by setPrimaryLayer in updateGap).
      var alsoChips = form.querySelectorAll(".also-affects-chips .chip-filter.active");
      var alsoLayers = [];
      alsoChips.forEach(function(c) {
        if (c.dataset && c.dataset.alsoLayerId) alsoLayers.push(c.dataset.alsoLayerId);
      });
      var primaryForLayers = patch.layerId || gap.layerId;
      patch.affectedLayers = [primaryForLayers].concat(
        alsoLayers.filter(function(l) { return l !== primaryForLayers; })
      );
      // v2.4.12 · collect picked services from the chip selector.
      var pickedRowEl = form.querySelector("[data-services-picked='true']");
      if (pickedRowEl) {
        var pickedChips = pickedRowEl.querySelectorAll(".services-chip-picked");
        var pickedIds = [];
        pickedChips.forEach(function(c) {
          if (c.dataset && c.dataset.serviceId) pickedIds.push(c.dataset.serviceId);
        });
        patch.services = pickedIds;   // updateGap will normalize/dedupe
      }
      // v2.4.11 · A6 · urgency comes from the override-aware UI. If
      // gap.urgencyOverride is true, the form has a real selector; if
      // false, the form has a read-only display (no data-prop). In the
      // override=false case, preserve existing urgency. In the
      // override=true case, accept the user's choice.
      if (gap.urgencyOverride === true && patch.urgency) {
        // accept whatever the selector chose
      } else {
        patch.urgency = gap.urgency || "Medium";
      }
      patch.phase   = patch.phase   || "now";
      patch.status  = patch.status  || "open";
      // Lock gapType for auto-drafted gaps (T4.3 / T4.14 , derived from disposition).
      if (isAutoDrafted(gap)) patch.gapType = gap.gapType;
      else if (!patch.gapType) delete patch.gapType;
      // driverId is managed separately via setGapDriverId (allows delete when Unassigned)
      var driverIdChoice = patch.driverId;
      delete patch.driverId;
      try {
        commitGapUpdate(gap.id, patch);
        commitGapSetDriverByBusinessDriverId(gap.id, driverIdChoice || null);
        // Bidirectional phase sync after manual phase edit (T4.5).
        commitSyncDesiredFromGap(gap.id);
        saveBtn.textContent = "Saved ✓";
        saveBtn.classList.add("save-ok");
        setTimeout(function() {
          saveBtn.classList.remove("save-ok");
          saveBtn.textContent = "Save changes";
          saveBtn.disabled = false;
          renderAll();
        }, 900);
      } catch(e) {
        // Visible error state on the button + inline error in the panel.
        saveBtn.textContent = "Couldn't save";
        saveBtn.classList.add("save-err");
        saveBtn.disabled = false;
        showErr(panel, e.message);
        setTimeout(function() {
          saveBtn.classList.remove("save-err");
          saveBtn.textContent = "Save changes";
        }, 2000);
      }
    });
    actions.appendChild(saveBtn);

    var delBtn = mkt("button", "btn-danger btn-with-feedback", "Delete");
    delBtn.addEventListener("click", function() {
      confirmAction({
        title: "Delete this gap?",
        body: (gap.description || "(unnamed gap)") +
              " . This removes the gap from the kanban + all linked instance references. Cannot be undone.",
        confirmLabel: "Delete gap",
        danger: true
      }).then(function(yes) {
        if (!yes) return;
        delBtn.classList.add("is-loading");
        try {
          commitGapRemove(gap.id);
          selectedGapId = null;
          setSelectedGapId(null);
          renderAll();
        } catch (e) {
          delBtn.classList.remove("is-loading");
          notifyError({ title: "Couldn't delete gap", body: (e && e.message) || String(e) });
        }
      });
    });
    actions.appendChild(delBtn);
    panel.appendChild(actions);

    // ---- Linked instances section (Phase 18: always-visible, no collapse) ----
    var linksWrap = mk("div", "linked-inline-wrap");

    // Current instances
    var curSection = mk("div", "link-section");
    curSection.appendChild(mkt("div", "link-section-title", "Current state"));
    var curList = mk("div", "link-list");
    var currentLinked = (gap.relatedCurrentInstanceIds || []).map(function(id) {
      return (_v3InstancesArray() || []).find(function(i) { return i.id === id; });
    }).filter(Boolean);

    if (currentLinked.length === 0) {
      curList.appendChild(mkt("div", "link-empty", "None linked"));
    } else {
      currentLinked.forEach(function(inst) {
        curList.appendChild(buildLinkRow(inst, function() {
          try { commitGapUnlinkCurrentInstance(gap.id, inst.id); renderAll(); }
          catch(e) { notifyError({ title: "Couldn't apply change", body: (e && e.message) || String(e) }); }
        }));
      });
    }
    curSection.appendChild(curList);

    var addCurBtn = mkt("button", "btn-ghost-sm", "+ Link current instance");
    addCurBtn.addEventListener("click", function() {
      openLinkPicker("current", gap, function(instId) {
        try { commitGapLinkCurrentInstance(gap.id, instId); renderAll(); }
        catch(e) { notifyError({ title: "Couldn't apply change", body: (e && e.message) || String(e) }); }
      });
    });
    curSection.appendChild(addCurBtn);
    linksWrap.appendChild(curSection);

    // Desired instances
    var desSection = mk("div", "link-section");
    desSection.appendChild(mkt("div", "link-section-title", "Desired state"));
    var desList = mk("div", "link-list");
    var desiredLinked = (gap.relatedDesiredInstanceIds || []).map(function(id) {
      return (_v3InstancesArray() || []).find(function(i) { return i.id === id; });
    }).filter(Boolean);

    if (desiredLinked.length === 0) {
      desList.appendChild(mkt("div", "link-empty", "None linked"));
    } else {
      desiredLinked.forEach(function(inst) {
        desList.appendChild(buildLinkRow(inst, function() {
          try { commitGapUnlinkDesiredInstance(gap.id, inst.id); renderAll(); }
          catch(e) { notifyError({ title: "Couldn't apply change", body: (e && e.message) || String(e) }); }
        }));
      });
    }
    desSection.appendChild(desList);

    var addDesBtn = mkt("button", "btn-ghost-sm", "+ Link desired instance");
    addDesBtn.addEventListener("click", function() {
      openLinkPicker("desired", gap, function(instId) {
        // v2.1 · phase-conflict guard: if the tile's current phase differs from the gap's,
        // ask the presales before auto-reassigning. Gap wins per locked decision.
        // v2.4.11 · A4 · the function now refuses without { acknowledged: true }
        // when there's a conflict , make the confirm + acknowledged opt-in
        // explicit so no caller can accidentally bypass.
        var check = confirmPhaseOnLink(getActiveEngagement(), gap.id, instId);
        function doLink(acknowledged) {
          try {
            commitGapLinkDesiredInstance(gap.id, instId, { acknowledged: acknowledged });
            commitSyncDesiredFromGap(gap.id);     // gap wins → desired tile picks up gap.phase
            renderAll();
          } catch(e) {
            notifyError({ title: "Couldn't apply change", body: (e && e.message) || String(e) });
          }
        }
        if (check.status === "conflict") {
          confirmAction({
            title:        "Reassign phase?",
            body:         "Linking '" + check.desiredLabel + "' will move its phase from " +
                          check.currentPriority + " to " + check.targetPriority + ".",
            confirmLabel: "Reassign + link",
            cancelLabel:  "Cancel"
          }).then(function(yes) { if (yes) doLink(true); });
        } else {
          doLink(false);
        }
      });
    });
    desSection.appendChild(addDesBtn);
    linksWrap.appendChild(desSection);

    panel.appendChild(linksWrap);
    right.appendChild(panel);
  }

  // buildLinkRow renders one linked-instance row in the gap detail panel.
  // Phase 18: when the instance is also linked from another gap, append a
  // red `.multi-linked-chip` so the presales sees the cross-gap link
  // implication at a glance.
  function buildLinkRow(inst, onUnlink) {
    var row = mk("div", "link-row link-row-clickable");
    var dot = mk("span", "cmd-dot cmd-dot-" + (inst.vendorGroup || "custom"));
    row.appendChild(dot);
    row.appendChild(mkt("span", "link-row-label", inst.label));
    row.appendChild(mkt("span", "link-row-sub",
      layerName(inst.layerId) + " / " + envName(inst.environmentId)));
    // v2.4.11 · E1 · clickable navigation to the linked tile. Was a
    // visual-only row before; now the dot+label area dispatches a custom
    // event that app.js listens for, switches to the right tab (Tab 2 for
    // current, Tab 3 for desired), and scrolls the tile into view.
    row.title = "Click to open this " + inst.state + "-state tile in Tab " +
      (inst.state === "current" ? "2" : "3");
    row.addEventListener("click", function(e) {
      // Don't fire when the unlink × is clicked.
      if (e.target && e.target.classList && e.target.classList.contains("link-unlink-btn")) return;
      document.dispatchEvent(new CustomEvent("dell-canvas:navigate-to-tile", {
        detail: {
          instanceId:    inst.id,
          state:         inst.state,
          layerId:       inst.layerId,
          environmentId: inst.environmentId
        }
      }));
    });
    var totalGaps = countGapsLinking(session, inst.id);
    if (totalGaps >= 2) {
      var chip = mkt("span", "multi-linked-chip", "linked to " + totalGaps + " gaps");
      chip.title = "This instance is linked to " + totalGaps + " gaps. Removing it here unlinks only this gap.";
      row.appendChild(chip);
    }
    var unlink = mkt("button", "link-unlink-btn", "x");
    unlink.title = "Unlink";
    unlink.addEventListener("click", onUnlink);
    row.appendChild(unlink);
    return row;
  }

  // ---- Instance link picker dialog ----
  function openLinkPicker(stateFilter, gap, onSelect) {
    document.getElementById("link-picker")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "link-picker";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title",
      "Link " + (stateFilter === "current" ? "current" : "desired") + " instance"));

    var alreadyLinked = stateFilter === "current"
      ? (gap.relatedCurrentInstanceIds || [])
      : (gap.relatedDesiredInstanceIds  || []);

    var candidates = (_v3InstancesArray() || []).filter(function(i) {
      return i.state === stateFilter && alreadyLinked.indexOf(i.id) < 0;
    });

    if (candidates.length === 0) {
      box.appendChild(mkt("div", "detail-ph-hint",
        "No unlinked " + stateFilter + " instances available. Add technologies in the " +
        (stateFilter === "current" ? "Current" : "Desired") + " State step first."));
    } else {
      var list = mk("div", "link-picker-list");
      candidates.forEach(function(inst) {
        // Phase 18 · Item 9: warn-but-allow when linking would create a
        // double-link to another gap. Picker still proceeds on click.
        var otherGap = findOtherGapLinking(session, inst.id, gap.id);
        if (otherGap) {
          var warn = mk("div", "link-warning-row");
          var otherDesc = otherGap.description ? "'" + otherGap.description + "'" : "another gap";
          warn.textContent = "⚠ " + inst.label + " is already linked to Gap " + otherDesc +
                             ". Linking here too will count toward both initiatives.";
          list.appendChild(warn);
        }
        var item = mk("div", "link-picker-item");
        var dot  = mk("span", "cmd-dot cmd-dot-" + (inst.vendorGroup || "custom"));
        item.appendChild(dot);
        item.appendChild(mkt("span", "cmd-item-name", inst.label));
        item.appendChild(mkt("span", "cmd-item-vendor",
          layerName(inst.layerId) + " / " + envName(inst.environmentId)));
        item.addEventListener("click", function() {
          onSelect(inst.id);
          overlay.remove();
        });
        list.appendChild(item);
      });
      box.appendChild(list);
    }

    var cancelBtn = mkt("button", "btn-secondary", "Cancel");
    cancelBtn.addEventListener("click", function() { overlay.remove(); });
    var foot = mk("div", "form-actions");
    foot.appendChild(cancelBtn);
    box.appendChild(foot);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
  }

  // ---- Add gap dialog ----
  function openAddDialog(opts) {
    opts = opts || {};
    document.getElementById("gap-dialog")?.remove();
    var overlay = mk("div", "dialog-overlay"); overlay.id = "gap-dialog";
    var box     = mk("div", "dialog-box");
    box.appendChild(mkt("div", "dialog-title",
      opts.presetGapType === "ops" ? "Add operational / services gap" : "Add gap / initiative"));

    var form = mk("div", "edit-form");
    var layerMap = {};
    LAYERS.forEach(function(l) { layerMap[l.id] = l.label; });
    var descPlaceholder = opts.presetGapType === "ops"
      ? "e.g. Build DR runbook for tier-1 workloads · Train ops team on PowerProtect · Establish change-management for cloud spend"
      : "One-line description of what needs to change";
    form.appendChild(fg("Description *",      ta("description", "", descPlaceholder)));
    // v2.4.11 · B2 · primary layer label clarified.
    form.appendChild(fg("Primary layer (drives the project bucket) *",
      selEl("layerId", LayerIds, LayerIds[0], layerMap)));
    // v2.4.11 · B2 · "Also affects" multi-chip selector. User picks ANY
    // additional layers the gap touches; setPrimaryLayer keeps the
    // invariant (primary always at index 0) on save. The chip list is
    // serialized into a hidden data-prop so the existing form-collection
    // loop picks it up.
    var alsoGroup = mk("div", "form-group");
    alsoGroup.appendChild(mkt("label", "form-label", "Also affects (optional)"));
    var alsoChipRow = mk("div", "chips-row");
    var alsoSelected = new Set();
    var primarySelect = form.querySelector('[data-prop="layerId"]');
    LAYERS.forEach(function(layer) {
      var chip = mkt("div", "chip-filter", layer.label);
      chip.dataset.layerId = layer.id;
      chip.addEventListener("click", function() {
        if (chip.classList.contains("disabled")) return;
        chip.classList.toggle("active");
        if (chip.classList.contains("active")) alsoSelected.add(layer.id);
        else alsoSelected.delete(layer.id);
      });
      alsoChipRow.appendChild(chip);
    });
    function syncPrimaryDisable() {
      var pid = primarySelect ? primarySelect.value : null;
      [...alsoChipRow.querySelectorAll(".chip-filter")].forEach(function(c) {
        var disabled = c.dataset.layerId === pid;
        c.classList.toggle("disabled", disabled);
        if (disabled) {
          c.classList.remove("active");
          alsoSelected.delete(c.dataset.layerId);
          c.title = "Already the primary layer";
        } else {
          c.title = "Click to add as an affected layer";
        }
      });
    }
    if (primarySelect) {
      primarySelect.addEventListener("change", syncPrimaryDisable);
      syncPrimaryDisable();
    }
    alsoGroup.appendChild(alsoChipRow);
    alsoGroup.appendChild(mkt("div", "field-hint",
      "Only one project bucket per gap (set by Primary layer). Additional layers are listed for filtering + impact analysis."));
    form.appendChild(alsoGroup);
    form.appendChild(fg("Gap type",
      selEl("gapType", ["","enhance","replace","introduce","consolidate","ops"], opts.presetGapType || "")));
    // Manual-gap defaults (T4.13): urgency Medium (no linked current), phase Next, status open.
    form.appendChild(fg("Urgency",            selEl("urgency", ["High","Medium","Low"], "Medium")));
    form.appendChild(fg("Phase",              selEl("phase",   ["now","next","later"],  "next")));
    // v2.1 · mapped Dell solutions removed; derive from linking Dell desired tiles after creation.
    box.appendChild(form);

    var actions = mk("div", "form-actions");
    var cancelBtn = mkt("button", "btn-secondary", "Cancel");
    cancelBtn.addEventListener("click", function() { overlay.remove(); });
    var createBtn = mkt("button", "btn-primary", "Create gap");
    createBtn.addEventListener("click", function() {
      var vals = {};
      form.querySelectorAll("[data-prop]").forEach(function(el) {
        vals[el.getAttribute("data-prop")] = el.value;
      });
      if (!vals.description || !vals.description.trim()) {
        notifyError({ title: "Description required", body: "Every gap needs a one-line description so it reads on the kanban." });
        return;
      }
      try {
        // v2.4.11 · B2 · build affectedLayers from the Also-affects chips.
        // Primary is always at index 0; rc.7 R8 #5 setPrimaryLayer auto-
        // rebalance in updateGap reasserts that on subsequent edits.
        //
        // BUG-052 / R8 #6 closure (2026-05-09): the v2 contract
        // "reviewed defaults to true for manual creation per createGap"
        // is NOT preserved in v3-pure (schema/gap.js line 32:
        // reviewed.default(false)). v3 manual-add gaps appear with the
        // pulsing "needs review" dot until the user explicitly marks
        // reviewed via the detail-panel "Mark reviewed" button (which
        // routes through R8 #1's AL10 gate). This matches the v3 G2
        // invariant: a reviewed gap MUST satisfy its action-link rules,
        // which a fresh manual-add gap doesn't have yet (no links).
        // The v2 reviewed=true UX is deferred to v3.1 polish; would
        // need a dialog redesign to also collect links.
        var alsoLayers = Array.from(alsoSelected);
        var addRes = commitGapAdd({
          description:    vals.description,
          layerId:        vals.layerId,
          affectedLayers: [vals.layerId].concat(alsoLayers.filter(function(l) { return l !== vals.layerId; })),
          gapType:        vals.gapType || undefined,
          urgency:        vals.urgency || "Medium",
          phase:          vals.phase   || "next",
          status:         "open"
          // reviewed left default (false) per R8 #6 closure note above.
        });
        // BUG-052 fix: commitGapAdd returns { ok, engagement, errors }
        // (NOT the gap directly). If ok:false, surface the error and
        // bail. If ok:true, read the new gap's id from the engagement
        // (it's the last-added; addGap appends to allIds). Pre-fix this
        // dereferenced addRes.id (undefined) and lost selection on
        // every successful manual-add.
        if (addRes && addRes.ok === false) {
          var msg = (addRes.errors && addRes.errors[0] && addRes.errors[0].message) || "Validation failed";
          notifyError({ title: "Couldn't create gap", body: msg });
          return;
        }
        var newGapId = getActiveEngagement().gaps.allIds.at(-1);
        selectedGapId = newGapId;
        setSelectedGapId(newGapId);
        overlay.remove();
        renderAll();
      } catch(e) { notifyError({ title: "Validation error", body: e.message || String(e) }); }
    });
    actions.appendChild(cancelBtn); actions.appendChild(createBtn);
    box.appendChild(actions); overlay.appendChild(box);
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });
  }

  renderAll();
}

// ---- Helpers ----
function mk(tag, cls)         { var e = document.createElement(tag); if (cls) e.className = cls; return e; }
function mkt(tag, cls, text)  { var e = mk(tag, cls); e.textContent = text; return e; }
function fg(label, input)     { var g = mk("div","form-group"); g.appendChild(mkt("label","form-label",label)); g.appendChild(input); return g; }
function inputEl(prop, value, ph) {
  var i = mk("input","form-input"); i.setAttribute("data-prop",prop); i.value = value||""; i.placeholder = ph||""; return i;
}
function selEl(prop, options, value, labelMap) {
  var s = mk("select","form-select"); s.setAttribute("data-prop",prop);
  options.forEach(function(o) {
    var opt = document.createElement("option"); opt.value = o;
    opt.textContent = (labelMap && labelMap[o]) ? labelMap[o] : (o || "-- none --");
    if (o === value) opt.selected = true; s.appendChild(opt);
  });
  return s;
}
function ta(prop, value, ph) {
  var t = mk("textarea","form-textarea"); t.setAttribute("data-prop",prop);
  t.value = value||""; t.placeholder = ph||""; t.rows = 3; return t;
}
function urgClass(u) { return u==="High" ? "urg-high" : u==="Low" ? "urg-low" : "urg-med"; }
function showErr(parent, msg) {
  parent.querySelectorAll(".inline-err").forEach(function(e) { e.remove(); });
  parent.appendChild(mkt("div","inline-err",msg));
}
function showPlaceholder(right) {
  right.innerHTML = "";
  var ph = mk("div","detail-placeholder");
  ph.appendChild(mkt("div","detail-ph-icon","[gap]"));
  ph.appendChild(mkt("div","detail-ph-title","Select a gap"));
  ph.appendChild(mkt("div","detail-ph-hint",
    "Click any gap card to edit details and manage linked technologies. Drag cards between columns to reprioritise. Auto-drafted gaps from your Desired State dispositions appear highlighted."));
  right.appendChild(ph);
}
function layerName(id) { var l = (typeof LAYERS !== "undefined") ? LAYERS.find(function(x){return x.id===id;}) : null; return l ? l.label : id; }
// rc.7 / 7e-4 - v3-pure: envName takes a v3 env UUID (the v3-canonical
// identifier used in gap.affectedEnvironments + instance.environmentId).
// Falls back to catalog-ref lookup for any straggling v2-shape data.
// rc.7 / 7e-9 · Z2 closure (SPEC §S43.3) · envName delegates to the
// centralized labelResolvers module so all UUID-leak protection lives
// in one place. Pre-Z2 this was an inline implementation duplicating
// logic that also lived in services/roadmapService.envLabel and several
// view-local helpers. Per the user's "scalable and maintainable
// structured work" direction (2026-05-09 PM), the centralized module
// is the single source of truth; views import from there and never
// reimplement label resolution. Behavior unchanged: returns
// "(unknown environment)" placeholder for any orphan input.
function envName(uuidOrCatalogId) { return _resolveEnvLabel(uuidOrCatalogId); }
function phaseLabel(p) { return p==="now" ? "Now (0-12 months)" : p==="next" ? "Next (12-24 months)" : "Later (>24 months)"; }

// A gap is "auto-drafted" when it came from a Desired-State disposition, i.e.
// it has a linked desired instance. Manual gaps have no desired link at creation.
function isAutoDrafted(gap) {
  return !!(gap && gap.relatedDesiredInstanceIds && gap.relatedDesiredInstanceIds.length > 0);
}

function readOnlyField(text, titleText) {
  var el = document.createElement("div");
  el.className = "form-readonly";
  el.textContent = text;
  if (titleText) el.setAttribute("title", titleText);
  return el;
}

function gapOriginCriticalityHint(gap, session) {
  var ids = (gap && gap.relatedCurrentInstanceIds) || [];
  if (!ids.length || !session) return "No linked current instance , defaults to Medium for introduce gaps.";
  var first = (_v3InstancesArray() || []).find(function(i) { return i.id === ids[0]; });
  if (!first) return "";
  return "Source: '" + first.label + "' (criticality " + (first.criticality || "not set") + ").";
}

// rc.7 / 7e-8c'-impl · per-view _renderNoEnvsCardGaps helper RETIRED.
// Empty-environments UX surface lives in ui/components/NoEnvsCard.js
// (shared) per SPEC §S41 + RULES §16 CH35. F41.6.1 forbids per-view
// duplicates. See the renderEmptyEnvsCenterCard call inside
// renderGapsEditView above for the migration.
