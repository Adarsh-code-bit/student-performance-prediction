/**
 * ==============================================================================
 * STUDENT PULSE — Academic Performance Monitoring & Decision Support System
 * Client Application (Vanilla JavaScript)
 * Architectural Views:
 *   1. Dashboard (Academic Overview, Dynamic KPIs, Urgency Table)
 *   2. Students (Directory, Filters, Live Search, Column Sorting)
 *   3. Predictor (Live ML Classifier, Sliders & Direct Inputs, Independent Exam Rule)
 *   4. Model Info (Auditable SVG Decision Tree, Animated Marble Simulation, Specs)
 * ==============================================================================
 */

(function () {
  'use strict';

  // Application State
  const state = {
    treeData: null,
    cohortData: null,
    modelSpecs: null,
    currentStudent: {
      student_id: null,
      cgpa: 7.5,
      internal_marks: 28.0,
      attendance: 75.0,
      assignment_marks: 7.5
    },
    lastPrediction: null,

    // Registered Students State (MySQL Backend)
    registeredStudents: [],
    registeredStats: { total: 0, on_track: 0, needs_attention: 0, at_risk: 0, eligible: 0, not_eligible: 0 },
    recordsFilter: 'ALL',
    recordsSearch: '',
    recordsSemester: 'ALL',
    recordsSection: 'ALL',
    recordsEligibility: 'ALL',
    recordsSortColumn: 'usn',
    recordsSortDirection: 'asc',
    currentEditingId: null,
    currentViewingStudent: null,
    currentDeletingStudent: null,

    // Legacy/compatibility
    minCgpaFilter: 0,
    sortColumn: 'usn',
    sortDirection: 'asc',

    // Model View Simulation State
    isDroppingMarble: false,
    marbleRaf: null
  };

  // Cached DOM References
  const dom = {
    // Navigation Tabs & Views
    tabs: {
      dashboard: document.getElementById('tab-dashboard'),
      records: document.getElementById('tab-records'),
      predictor: document.getElementById('tab-predictor'),
      model: document.getElementById('tab-model')
    },
    views: {
      dashboard: document.getElementById('view-dashboard'),
      records: document.getElementById('view-records'),
      predictor: document.getElementById('view-predictor'),
      model: document.getElementById('view-model')
    },

    // Dashboard Elements
    kpiTotalVal: document.getElementById('kpi-total-val'),
    kpiOnTrackVal: document.getElementById('kpi-ontrack-val'),
    kpiOnTrackPct: document.getElementById('kpi-ontrack-pct'),
    kpiAttentionVal: document.getElementById('kpi-attention-val'),
    kpiAttentionPct: document.getElementById('kpi-attention-pct'),
    kpiAtRiskVal: document.getElementById('kpi-atrisk-val'),
    kpiAtRiskPct: document.getElementById('kpi-atrisk-pct'),
    segTeal: document.getElementById('seg-teal'),
    segGold: document.getElementById('seg-gold'),
    segCoral: document.getElementById('seg-coral'),
    legTextOnTrack: document.getElementById('leg-text-ontrack'),
    legTextAttention: document.getElementById('leg-text-attention'),
    legTextAtRisk: document.getElementById('leg-text-atrisk'),
    urgentStudentsTbody: document.getElementById('urgent-students-tbody'),
    urgentTableFootnote: document.getElementById('urgent-table-footnote'),

    // Students Directory Elements (Registered Students)
    filterPills: document.querySelectorAll('.category-filters-pills .filter-pill'),
    countAll: document.getElementById('count-all'),
    countOnTrack: document.getElementById('count-ontrack'),
    countAttention: document.getElementById('count-attention'),
    countAtRisk: document.getElementById('count-atrisk'),
    searchStudentQuery: document.getElementById('search-student-query'),
    filterSemester: document.getElementById('filter-semester'),
    filterSection: document.getElementById('filter-section'),
    filterEligibility: document.getElementById('filter-eligibility'),
    btnClearFilters: document.getElementById('btn-clear-filters'),
    btnAddStudent: document.getElementById('btn-add-student'),
    fullRecordsTable: document.getElementById('full-records-table'),
    fullRecordsTbody: document.getElementById('full-records-tbody'),
    recordsTallyText: document.getElementById('records-tally-text'),

    // Student Modals & Notifications
    modalStudentForm: document.getElementById('modal-student-form'),
    studentModalTitle: document.getElementById('student-modal-title'),
    studentModalSubtitle: document.getElementById('student-modal-subtitle'),
    formStudentError: document.getElementById('form-student-error'),
    studentForm: document.getElementById('student-form'),
    studentIdField: document.getElementById('student-id-field'),
    inputUsn: document.getElementById('input-usn'),
    inputName: document.getElementById('input-name'),
    inputEmail: document.getElementById('input-email'),
    inputPhone: document.getElementById('input-phone'),
    inputDept: document.getElementById('input-dept'),
    inputSemester: document.getElementById('input-semester'),
    inputSection: document.getElementById('input-section'),
    inputCgpa: document.getElementById('input-cgpa'),
    inputInternal: document.getElementById('input-internal'),
    inputAttendance: document.getElementById('input-attendance'),
    inputAssignment: document.getElementById('input-assignment'),
    btnCloseFormModal: document.getElementById('btn-close-form-modal'),
    btnCancelStudentForm: document.getElementById('btn-cancel-student-form'),
    btnSaveStudent: document.getElementById('btn-save-student'),

    modalStudentView: document.getElementById('modal-student-view'),
    viewStudentName: document.getElementById('view-student-name'),
    viewStudentUsnBadge: document.getElementById('view-student-usn-badge'),
    btnCloseViewModal: document.getElementById('btn-close-view-modal'),
    btnCloseViewFooter: document.getElementById('btn-close-view-footer'),
    btnViewToEdit: document.getElementById('btn-view-to-edit'),
    viewDeptVal: document.getElementById('view-dept-val'),
    viewSemSecVal: document.getElementById('view-sem-sec-val'),
    viewEmailVal: document.getElementById('view-email-val'),
    viewCgpaVal: document.getElementById('view-cgpa-val'),
    viewInternalVal: document.getElementById('view-internal-val'),
    viewAttendanceVal: document.getElementById('view-attendance-val'),
    viewAssignmentVal: document.getElementById('view-assignment-val'),
    viewStandingBox: document.getElementById('view-standing-box'),
    viewStandingIcon: document.getElementById('view-standing-icon'),
    viewCategoryVal: document.getElementById('view-category-val'),
    viewAdviceVal: document.getElementById('view-advice-val'),
    viewEligibilityPill: document.getElementById('view-eligibility-pill'),
    viewEligibilityExplain: document.getElementById('view-eligibility-explain'),

    modalStudentDelete: document.getElementById('modal-student-delete'),
    deleteStudentNameUsn: document.getElementById('delete-student-name-usn'),
    btnCloseDeleteModal: document.getElementById('btn-close-delete-modal'),
    btnCancelDelete: document.getElementById('btn-cancel-delete'),
    btnConfirmDelete: document.getElementById('btn-confirm-delete'),
    toastContainer: document.getElementById('toast-container'),

    // Predictor Inputs
    sliderCgpa: document.getElementById('slider-cgpa'),
    numCgpa: document.getElementById('num-cgpa'),
    sliderInternal: document.getElementById('slider-internal'),
    numInternal: document.getElementById('num-internal'),
    sliderAttendance: document.getElementById('slider-attendance'),
    numAttendance: document.getElementById('num-attendance'),
    sliderAssignment: document.getElementById('slider-assignment'),
    numAssignment: document.getElementById('num-assignment'),
    btnResetPredictor: document.getElementById('btn-reset-predictor'),
    btnRunPrediction: document.getElementById('btn-run-prediction'),
    presetOnTrack: document.getElementById('preset-ontrack'),
    presetAttention: document.getElementById('preset-attention'),
    presetAtRisk: document.getElementById('preset-atrisk'),

    // Predictor Results
    predictorResultsCard: document.getElementById('predictor-results-card'),
    resStudentTag: document.getElementById('res-student-tag'),
    resStandingBox: document.getElementById('res-standing-box'),
    resStandingIcon: document.getElementById('res-standing-icon'),
    resCategoryText: document.getElementById('res-category-text'),
    resAdviceText: document.getElementById('res-advice-text'),
    resEligibilityBox: document.getElementById('res-eligibility-box'),
    resEligibilityPill: document.getElementById('res-eligibility-pill'),
    resEligibilityText: document.getElementById('res-eligibility-text'),
    resDecisionSteps: document.getElementById('res-decision-steps'),
    linkDropInModel: document.getElementById('link-drop-in-model'),

    // Model View Elements
    treeStudentReadout: document.getElementById('tree-student-readout'),
    btnDropTreeMarble: document.getElementById('btn-drop-tree-marble'),
    btnCascadeAllCohort: document.getElementById('btn-cascade-all-cohort'),
    svgTreeViewport: document.getElementById('svg-tree-viewport'),
    treeResultStatusBanner: document.getElementById('tree-result-status-banner'),
    statTrainAcc: document.getElementById('stat-train-acc'),
    statTestAcc: document.getElementById('stat-test-acc'),
    featureImportanceBars: document.getElementById('feature-importance-bars'),

    // Accessibility
    srAnnouncer: document.getElementById('sr-announcer')
  };

  /**
   * Screen reader accessibility announcer
   */
  function announce(text) {
    if (dom.srAnnouncer) {
      dom.srAnnouncer.textContent = text;
    }
  }

  // ============================================================================
  // Initialization & Backend Data Fetching
  // ============================================================================
  async function init() {
    setupNavigation();
    setupPredictorControls();
    setupRecordsControls();
    setupModelControls();

    try {
      // 1. Fetch Decision Tree structure
      const treeRes = await fetch('/api/tree');
      state.treeData = await treeRes.json();

      // 2. Fetch full cohort dataset (200 students)
      const cohortRes = await fetch('/api/cohort');
      state.cohortData = await cohortRes.json();

      // 3. Fetch model specifications and evaluation metrics
      const modelRes = await fetch('/api/model');
      state.modelSpecs = await modelRes.json();

      // Render all views with real backend data
      renderDashboard();
      await loadRegisteredStudents();
      renderModelSpecs();
      renderDecisionTree();

      // Initial prediction evaluation for default inputs (CGPA 7.5, Internal 28, Attend 75, Assign 7.5)
      await runPrediction();

    } catch (err) {
      console.error('Failed to load application data:', err);
      announce('Error communicating with academic prediction backend.');
    }
  }

  // ============================================================================
  // 1. GLOBAL NAVIGATION & TAB ROUTING
  // ============================================================================
  function setupNavigation() {
    // Handle hash routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      switchView(hash);
    });

    // Initial route
    const currentHash = window.location.hash.replace('#', '') || 'dashboard';
    switchView(currentHash);

    // Tab click handlers
    Object.keys(dom.tabs).forEach(key => {
      const tabEl = dom.tabs[key];
      if (tabEl) {
        tabEl.addEventListener('click', (e) => {
          e.preventDefault();
          window.location.hash = '#' + key;
        });
      }
    });

    // Special view cross-links (e.g. "View all students", "Predict student performance")
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      if (!anchor.classList.contains('nav-item')) {
        anchor.addEventListener('click', (e) => {
          const target = anchor.getAttribute('href').replace('#', '');
          if (dom.views[target]) {
            e.preventDefault();
            window.location.hash = '#' + target;
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        });
      }
    });
  }

  function switchView(viewName) {
    const validViews = ['dashboard', 'records', 'predictor', 'model'];
    const activeView = validViews.includes(viewName) ? viewName : 'dashboard';

    // Update Navbar Tabs
    Object.keys(dom.tabs).forEach(key => {
      const tab = dom.tabs[key];
      if (tab) {
        const isActive = (key === activeView);
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      }
    });

    // Update View Panels
    Object.keys(dom.views).forEach(key => {
      const view = dom.views[key];
      if (view) {
        const isCurrent = (key === activeView);
        view.style.display = isCurrent ? 'block' : 'none';
        view.classList.toggle('active', isCurrent);
      }
    });

    // Refresh view specific visual components
    if (activeView === 'model') {
      updateModelReadout();
      renderDecisionTree();
    } else if (activeView === 'records') {
      loadRegisteredStudents();
    }

    announce(`Switched to ${activeView} view.`);
  }

  // ============================================================================
  // 2. DASHBOARD VIEW (ACADEMIC OVERVIEW)
  // ============================================================================
  function renderDashboard() {
    if (!state.cohortData) return;

    const { total, counts, students } = state.cohortData;
    const onTrackCount = counts['On Track'] || 0;
    const attentionCount = counts['Needs Attention'] || 0;
    const atRiskCount = counts['At Risk'] || 0;

    const onTrackPct = ((onTrackCount / total) * 100).toFixed(1);
    const attentionPct = ((attentionCount / total) * 100).toFixed(1);
    const atRiskPct = ((atRiskCount / total) * 100).toFixed(1);

    // 1. Populate Top KPI Cards
    if (dom.kpiTotalVal) dom.kpiTotalVal.textContent = total;
    if (dom.kpiOnTrackVal) dom.kpiOnTrackVal.textContent = onTrackCount;
    if (dom.kpiOnTrackPct) dom.kpiOnTrackPct.textContent = `${onTrackPct}%`;
    if (dom.kpiAttentionVal) dom.kpiAttentionVal.textContent = attentionCount;
    if (dom.kpiAttentionPct) dom.kpiAttentionPct.textContent = `${attentionPct}%`;
    if (dom.kpiAtRiskVal) dom.kpiAtRiskVal.textContent = atRiskCount;
    if (dom.kpiAtRiskPct) dom.kpiAtRiskPct.textContent = `${atRiskPct}%`;

    // 2. Performance Distribution Segmented Bar
    if (dom.segTeal) {
      dom.segTeal.style.width = `${onTrackPct}%`;
      dom.segTeal.textContent = `${onTrackPct}%`;
    }
    if (dom.segGold) {
      dom.segGold.style.width = `${attentionPct}%`;
      dom.segGold.textContent = `${attentionPct}%`;
    }
    if (dom.segCoral) {
      dom.segCoral.style.width = `${atRiskPct}%`;
      dom.segCoral.textContent = `${atRiskPct}%`;
    }

    // Legend texts
    if (dom.legTextOnTrack) {
      dom.legTextOnTrack.textContent = `On Track: ${onTrackCount} students (${onTrackPct}%)`;
    }
    if (dom.legTextAttention) {
      dom.legTextAttention.textContent = `Needs Attention: ${attentionCount} students (${attentionPct}%)`;
    }
    if (dom.legTextAtRisk) {
      dom.legTextAtRisk.textContent = `At Risk: ${atRiskCount} students (${atRiskPct}%)`;
    }

    // 3. Students Needing Attention (Urgent Sample Table)
    renderUrgentStudentsTable(students, attentionCount + atRiskCount);
  }

  function renderUrgentStudentsTable(allStudents, totalNeedingAttention) {
    if (!dom.urgentStudentsTbody) return;

    // Filter students needing attention
    const needy = allStudents.filter(
      s => s.category === 'Needs Attention' || s.category === 'At Risk'
    );

    // Find the 5 prominent sample students shown in reference design or sort by lowest attendance/cgpa
    const sampleIds = ['S-033', 'S-052', 'S-091', 'S-075', 'S-118'];
    let sample = sampleIds
      .map(id => needy.find(s => s.student_id === id))
      .filter(Boolean);

    // If any are missing, fill from needy list
    if (sample.length < 5) {
      const remaining = needy.filter(s => !sample.some(item => item.student_id === s.student_id));
      sample = sample.concat(remaining.slice(0, 5 - sample.length));
    }

    dom.urgentStudentsTbody.innerHTML = '';
    sample.forEach(s => {
      const tr = document.createElement('tr');
      const isRisk = (s.category === 'At Risk');
      const pillClass = isRisk ? 'pill-coral' : 'pill-gold';

      tr.innerHTML = `
        <td><strong>${escapeHtml(s.student_id)}</strong></td>
        <td>${s.cgpa.toFixed(1)}</td>
        <td>${Math.round(s.internal_marks)}</td>
        <td>${Math.round(s.attendance)}%</td>
        <td><span class="status-pill ${pillClass}">${escapeHtml(s.category)}</span></td>
        <td>
          <div class="table-action-links">
            <a href="#predictor" class="table-link link-predict" data-id="${escapeHtml(s.student_id)}">Predict</a>
            <span class="link-sep">|</span>
            <a href="#predictor" class="table-link link-view" data-id="${escapeHtml(s.student_id)}">View</a>
          </div>
        </td>
      `;

      // Bind Predict / View actions to load student into predictor
      const predictBtn = tr.querySelector('.link-predict');
      const viewBtn = tr.querySelector('.link-view');
      [predictBtn, viewBtn].forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          loadStudentIntoPredictor(s);
          window.location.hash = '#predictor';
        });
      });

      dom.urgentStudentsTbody.appendChild(tr);
    });

    if (dom.urgentTableFootnote) {
      dom.urgentTableFootnote.textContent = `Showing ${sample.length} of ${totalNeedingAttention} students needing attention.`;
    }
  }

  // ============================================================================
  // 3. STUDENT RECORDS DIRECTORY & CRUD OPERATIONS (MYSQL BACKEND)
  // ============================================================================

  // --- Modal Helpers ---
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove('open');
    document.body.style.overflow = '';
  }

  // --- Toast Notification Feedback ---
  function showToast(message, type = 'success') {
    const container = dom.toastContainer || document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast-pill ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    const icon = (type === 'error')
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF625C" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#119B91" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 320);
    }, 3800);
  }

  // --- Setup Records Controls & Modals ---
  let searchDebounceTimer = null;

  function setupRecordsControls() {
    // 1. Status Filter Pills (All Students, On Track, Needs Attention, At Risk)
    if (dom.filterPills) {
      dom.filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
          dom.filterPills.forEach(p => {
            p.classList.remove('active');
            p.setAttribute('aria-checked', 'false');
          });
          pill.classList.add('active');
          pill.setAttribute('aria-checked', 'true');
          state.recordsFilter = pill.getAttribute('data-filter') || 'ALL';
          loadRegisteredStudents();
        });
      });
    }

    // 2. Live Search by Name or USN
    if (dom.searchStudentQuery) {
      dom.searchStudentQuery.addEventListener('input', (e) => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
          state.recordsSearch = e.target.value.trim();
          loadRegisteredStudents();
        }, 250);
      });
    }

    // 3. Dropdown Filters (Semester, Section, Attendance Eligibility)
    if (dom.filterSemester) {
      dom.filterSemester.addEventListener('change', (e) => {
        state.recordsSemester = e.target.value;
        loadRegisteredStudents();
      });
    }
    if (dom.filterSection) {
      dom.filterSection.addEventListener('change', (e) => {
        state.recordsSection = e.target.value;
        loadRegisteredStudents();
      });
    }
    if (dom.filterEligibility) {
      dom.filterEligibility.addEventListener('change', (e) => {
        state.recordsEligibility = e.target.value;
        loadRegisteredStudents();
      });
    }

    // 4. Clear Filters Button
    if (dom.btnClearFilters) {
      dom.btnClearFilters.addEventListener('click', () => {
        resetAllFilters();
      });
    }

    // 5. Add Student Button
    if (dom.btnAddStudent) {
      dom.btnAddStudent.addEventListener('click', () => {
        openAddStudentModal();
      });
    }

    // 6. Sortable Headers
    if (dom.fullRecordsTable) {
      const headers = dom.fullRecordsTable.querySelectorAll('th.sortable');
      headers.forEach(th => {
        th.addEventListener('click', () => {
          const sortKey = th.getAttribute('data-sort');
          if (state.recordsSortColumn === sortKey) {
            state.recordsSortDirection = (state.recordsSortDirection === 'asc') ? 'desc' : 'asc';
          } else {
            state.recordsSortColumn = sortKey;
            state.recordsSortDirection = 'asc';
          }
          renderRegisteredTable();
        });
      });
    }

    // 7. Student Form Modal Actions
    if (dom.btnCloseFormModal) {
      dom.btnCloseFormModal.addEventListener('click', () => closeModal(dom.modalStudentForm));
    }
    if (dom.btnCancelStudentForm) {
      dom.btnCancelStudentForm.addEventListener('click', () => closeModal(dom.modalStudentForm));
    }
    if (dom.btnSaveStudent) {
      dom.btnSaveStudent.addEventListener('click', () => saveStudent());
    }
    if (dom.studentForm) {
      dom.studentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveStudent();
      });
    }

    // 8. View Profile Modal Actions
    if (dom.btnCloseViewModal) {
      dom.btnCloseViewModal.addEventListener('click', () => closeModal(dom.modalStudentView));
    }
    if (dom.btnCloseViewFooter) {
      dom.btnCloseViewFooter.addEventListener('click', () => closeModal(dom.modalStudentView));
    }
    if (dom.btnViewToEdit) {
      dom.btnViewToEdit.addEventListener('click', () => {
        closeModal(dom.modalStudentView);
        if (state.currentViewingStudent) {
          openEditStudentModal(state.currentViewingStudent);
        }
      });
    }

    // 9. Delete Confirmation Modal Actions
    if (dom.btnCloseDeleteModal) {
      dom.btnCloseDeleteModal.addEventListener('click', () => closeModal(dom.modalStudentDelete));
    }
    if (dom.btnCancelDelete) {
      dom.btnCancelDelete.addEventListener('click', () => closeModal(dom.modalStudentDelete));
    }
    if (dom.btnConfirmDelete) {
      dom.btnConfirmDelete.addEventListener('click', () => deleteStudent());
    }

    // 10. Close Modals on Backdrop Click & Escape Key
    [dom.modalStudentForm, dom.modalStudentView, dom.modalStudentDelete].forEach(modal => {
      if (!modal) return;
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal(modal);
        }
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal(dom.modalStudentForm);
        closeModal(dom.modalStudentView);
        closeModal(dom.modalStudentDelete);
      }
    });
  }

  // --- Reset All Filters ---
  function resetAllFilters() {
    state.recordsFilter = 'ALL';
    state.recordsSearch = '';
    state.recordsSemester = 'ALL';
    state.recordsSection = 'ALL';
    state.recordsEligibility = 'ALL';

    if (dom.filterPills) {
      dom.filterPills.forEach(pill => {
        const isAll = (pill.getAttribute('data-filter') === 'ALL');
        pill.classList.toggle('active', isAll);
        pill.setAttribute('aria-checked', isAll ? 'true' : 'false');
      });
    }
    if (dom.searchStudentQuery) dom.searchStudentQuery.value = '';
    if (dom.filterSemester) dom.filterSemester.value = 'ALL';
    if (dom.filterSection) dom.filterSection.value = 'ALL';
    if (dom.filterEligibility) dom.filterEligibility.value = 'ALL';

    loadRegisteredStudents();
  }

  // --- Fetch Registered Students from Flask Backend ---
  async function loadRegisteredStudents() {
    try {
      const params = new URLSearchParams();
      if (state.recordsFilter && state.recordsFilter !== 'ALL') {
        params.set('status', state.recordsFilter);
      }
      if (state.recordsSearch) {
        params.set('search', state.recordsSearch);
      }
      if (state.recordsSemester && state.recordsSemester !== 'ALL') {
        params.set('semester', state.recordsSemester);
      }
      if (state.recordsSection && state.recordsSection !== 'ALL') {
        params.set('section', state.recordsSection);
      }
      if (state.recordsEligibility && state.recordsEligibility !== 'ALL') {
        params.set('eligibility', state.recordsEligibility);
      }

      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/students${queryStr}`);
      const data = await res.json();

      if (data.success) {
        state.registeredStudents = data.students || [];
        state.registeredStats = data.stats || { total: 0, on_track: 0, needs_attention: 0, at_risk: 0, eligible: 0, not_eligible: 0 };
        updateFilterCounts(state.registeredStats);
        renderRegisteredTable();
      } else {
        console.error('Error in /api/students response:', data.error);
      }
    } catch (err) {
      console.error('Failed to load registered students:', err);
      showToast('Could not load student records from server.', 'error');
    }
  }

  function updateFilterCounts(stats) {
    if (dom.countAll) dom.countAll.textContent = stats.total || 0;
    if (dom.countOnTrack) dom.countOnTrack.textContent = stats.on_track || 0;
    if (dom.countAttention) dom.countAttention.textContent = stats.needs_attention || 0;
    if (dom.countAtRisk) dom.countAtRisk.textContent = stats.at_risk || 0;
  }

  // --- Render Table of Registered Students ---
  function renderRegisteredTable() {
    if (!dom.fullRecordsTbody) return;

    let list = [...state.registeredStudents];

    // Local column sorting
    const col = state.recordsSortColumn;
    const dir = (state.recordsSortDirection === 'asc') ? 1 : -1;
    list.sort((a, b) => {
      let va = a[col];
      let vb = b[col];
      if (va === null || va === undefined) va = '';
      if (vb === null || vb === undefined) vb = '';

      if (typeof va === 'string' && typeof vb === 'string') {
        return va.localeCompare(vb) * dir;
      }
      return ((parseFloat(va) || 0) - (parseFloat(vb) || 0)) * dir;
    });

    dom.fullRecordsTbody.innerHTML = '';

    if (list.length === 0) {
      const isFiltered = (state.recordsSearch || state.recordsFilter !== 'ALL' || state.recordsSemester !== 'ALL' || state.recordsSection !== 'ALL' || state.recordsEligibility !== 'ALL');
      const emptyTitle = isFiltered 
        ? 'No matching registered students' 
        : 'No registered students in database';
      const emptyMsg = isFiltered 
        ? 'No student records match the active search and filter criteria.' 
        : 'Get started by adding registered student records to monitor academic performance.';

      dom.fullRecordsTbody.innerHTML = `
        <tr>
          <td colspan="10" style="text-align: center; padding: 48px 24px;">
            <div style="max-width: 440px; margin: 0 auto; text-align: center;">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#766779" stroke-width="1.8" style="margin: 0 auto 12px; display: block;">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
              <h4 style="font-family: var(--font-serif); font-size: 18px; color: var(--color-plum-deep); margin-bottom: 6px;">${emptyTitle}</h4>
              <p style="font-size: 13.5px; color: var(--color-text-secondary); margin-bottom: 20px; line-height: 1.5;">${emptyMsg}</p>
              ${isFiltered 
                ? `<button type="button" class="btn btn-outline btn-sm" id="btn-empty-clear">Clear Filters</button>` 
                : `<button type="button" class="btn btn-teal btn-sm" id="btn-empty-add">+ Add First Student</button>`}
            </div>
          </td>
        </tr>
      `;

      const emptyAdd = dom.fullRecordsTbody.querySelector('#btn-empty-add');
      if (emptyAdd) emptyAdd.addEventListener('click', () => openAddStudentModal());

      const emptyClear = dom.fullRecordsTbody.querySelector('#btn-empty-clear');
      if (emptyClear) emptyClear.addEventListener('click', () => resetAllFilters());

      if (dom.recordsTallyText) {
        dom.recordsTallyText.textContent = `Showing 0 registered students.`;
      }
      return;
    }

    list.forEach(s => {
      const tr = document.createElement('tr');

      // Status pill styling
      let pillClass = 'pill-teal';
      if (s.academic_status === 'Needs Attention') pillClass = 'pill-gold';
      else if (s.academic_status === 'At Risk') pillClass = 'pill-coral';

      // Attendance LOW flag (< 75%)
      const lowBadge = (parseFloat(s.attendance) < 75.0)
        ? `<span style="font-size: 10px; font-weight: 800; color: #EF625C; margin-left: 5px; padding: 1px 4px; background: #FDE8E7; border-radius: 4px;">LOW</span>`
        : '';

      tr.innerHTML = `
        <td><strong style="font-family: var(--font-mono); color: var(--color-plum-primary);">${escapeHtml(s.usn)}</strong></td>
        <td><strong>${escapeHtml(s.name)}</strong></td>
        <td>${escapeHtml(s.semester || '-')}</td>
        <td><span style="font-weight: 600; color: var(--color-text-secondary);">${escapeHtml(s.section || '-')}</span></td>
        <td><strong>${Number(s.cgpa).toFixed(1)}</strong></td>
        <td>${Number(s.internal_marks).toFixed(1)}</td>
        <td>${Number(s.attendance).toFixed(1)}% ${lowBadge}</td>
        <td>${Number(s.assignment_marks).toFixed(1)}</td>
        <td><span class="status-pill ${pillClass}">${escapeHtml(s.academic_status)}</span></td>
        <td style="text-align: center;">
          <div class="table-action-links" style="justify-content: center;">
            <button type="button" class="table-link link-view" data-id="${s.id}">View</button>
            <span class="link-sep">|</span>
            <button type="button" class="table-link link-edit" data-id="${s.id}">Edit</button>
            <span class="link-sep">|</span>
            <button type="button" class="table-link link-delete" data-id="${s.id}" style="color: #EF625C;">Delete</button>
          </div>
        </td>
      `;

      // Wire row actions
      const viewBtn = tr.querySelector('.link-view');
      const editBtn = tr.querySelector('.link-edit');
      const deleteBtn = tr.querySelector('.link-delete');

      viewBtn.addEventListener('click', () => openViewStudentModal(s));
      editBtn.addEventListener('click', () => openEditStudentModal(s));
      deleteBtn.addEventListener('click', () => openDeleteStudentModal(s));

      dom.fullRecordsTbody.appendChild(tr);
    });

    if (dom.recordsTallyText) {
      dom.recordsTallyText.textContent = `Showing ${list.length} of ${state.registeredStats.total} registered students.`;
    }
  }

  // --- Modal: Add Student ---
  function openAddStudentModal() {
    state.currentEditingId = null;

    if (dom.studentIdField) dom.studentIdField.value = '';
    if (dom.inputUsn) {
      dom.inputUsn.value = '';
      dom.inputUsn.disabled = false;
    }
    if (dom.inputName) dom.inputName.value = '';
    if (dom.inputEmail) dom.inputEmail.value = '';
    if (dom.inputPhone) dom.inputPhone.value = '';
    if (dom.inputDept) dom.inputDept.value = 'Computer Science & Engineering';
    if (dom.inputSemester) dom.inputSemester.value = 'Semester 5';
    if (dom.inputSection) dom.inputSection.value = 'A';
    if (dom.inputCgpa) dom.inputCgpa.value = '';
    if (dom.inputInternal) dom.inputInternal.value = '';
    if (dom.inputAttendance) dom.inputAttendance.value = '';
    if (dom.inputAssignment) dom.inputAssignment.value = '';

    if (dom.studentModalTitle) dom.studentModalTitle.textContent = 'Register New Student';
    if (dom.studentModalSubtitle) dom.studentModalSubtitle.textContent = 'Enter student personal details and academic indicators to record into database.';
    if (dom.btnSaveStudent) dom.btnSaveStudent.textContent = 'Save Student';
    if (dom.formStudentError) dom.formStudentError.style.display = 'none';

    openModal(dom.modalStudentForm);
  }

  // --- Modal: Edit Student ---
  function openEditStudentModal(student) {
    state.currentEditingId = student.id;

    if (dom.studentIdField) dom.studentIdField.value = student.id;
    if (dom.inputUsn) {
      dom.inputUsn.value = student.usn;
      dom.inputUsn.disabled = true; // USN is immutable in edit mode
    }
    if (dom.inputName) dom.inputName.value = student.name;
    if (dom.inputEmail) dom.inputEmail.value = student.email || '';
    if (dom.inputPhone) dom.inputPhone.value = student.phone || '';
    if (dom.inputDept) dom.inputDept.value = student.department || 'Computer Science & Engineering';
    if (dom.inputSemester) dom.inputSemester.value = student.semester || 'Semester 5';
    if (dom.inputSection) dom.inputSection.value = student.section || 'A';
    if (dom.inputCgpa) dom.inputCgpa.value = student.cgpa;
    if (dom.inputInternal) dom.inputInternal.value = student.internal_marks;
    if (dom.inputAttendance) dom.inputAttendance.value = student.attendance;
    if (dom.inputAssignment) dom.inputAssignment.value = student.assignment_marks;

    if (dom.studentModalTitle) dom.studentModalTitle.textContent = 'Edit Student Profile';
    if (dom.studentModalSubtitle) dom.studentModalSubtitle.textContent = `Updating records for student ${student.usn}`;
    if (dom.btnSaveStudent) dom.btnSaveStudent.textContent = 'Update Student';
    if (dom.formStudentError) dom.formStudentError.style.display = 'none';

    openModal(dom.modalStudentForm);
  }

  // --- Form Action: Save (Create or Update) Student ---
  async function saveStudent() {
    const isEdit = Boolean(state.currentEditingId);
    const usn = dom.inputUsn ? dom.inputUsn.value.trim().toUpperCase() : '';
    const name = dom.inputName ? dom.inputName.value.trim() : '';
    const email = dom.inputEmail ? dom.inputEmail.value.trim() : '';
    const phone = dom.inputPhone ? dom.inputPhone.value.trim() : '';
    const dept = dom.inputDept ? dom.inputDept.value.trim() : '';
    const semester = dom.inputSemester ? dom.inputSemester.value.trim() : '';
    const section = dom.inputSection ? dom.inputSection.value.trim() : '';

    const cgpaVal = dom.inputCgpa ? dom.inputCgpa.value.trim() : '';
    const internalVal = dom.inputInternal ? dom.inputInternal.value.trim() : '';
    const attendanceVal = dom.inputAttendance ? dom.inputAttendance.value.trim() : '';
    const assignmentVal = dom.inputAssignment ? dom.inputAssignment.value.trim() : '';

    // Validation
    function showError(msg) {
      if (dom.formStudentError) {
        dom.formStudentError.textContent = msg;
        dom.formStudentError.style.display = 'block';
      }
    }

    if (!isEdit && !usn) {
      showError('USN is required.');
      return;
    }
    if (!name) {
      showError('Student Name is required.');
      return;
    }

    const cgpa = parseFloat(cgpaVal);
    const internal = parseFloat(internalVal);
    const attendance = parseFloat(attendanceVal);
    const assignment = parseFloat(assignmentVal);

    if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
      showError('CGPA must be a valid number between 0.0 and 10.0.');
      return;
    }
    if (isNaN(internal) || internal < 0 || internal > 40) {
      showError('Internal Marks must be a valid number between 0 and 40.');
      return;
    }
    if (isNaN(attendance) || attendance < 0 || attendance > 100) {
      showError('Attendance must be a valid percentage between 0% and 100%.');
      return;
    }
    if (isNaN(assignment) || assignment < 0 || assignment > 10) {
      showError('Assignment Marks must be a valid number between 0.0 and 10.0.');
      return;
    }

    if (dom.formStudentError) dom.formStudentError.style.display = 'none';

    const payload = {
      usn: usn,
      name: name,
      email: email,
      phone: phone,
      department: dept,
      semester: semester,
      section: section,
      cgpa: cgpa,
      internal_marks: internal,
      attendance: attendance,
      assignment_marks: assignment
    };

    try {
      const url = isEdit ? `/api/students/${state.currentEditingId}` : '/api/students';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showError(data.error || 'Failed to save student record.');
        return;
      }

      closeModal(dom.modalStudentForm);
      showToast(data.message || (isEdit ? 'Student updated successfully!' : 'Student registered successfully!'), 'success');
      await loadRegisteredStudents();

    } catch (err) {
      console.error('Error saving student:', err);
      showError('Communication error with server. Please try again.');
    }
  }

  // --- Modal: View Student Academic Profile ---
  function openViewStudentModal(student) {
    state.currentViewingStudent = student;

    if (dom.viewStudentName) dom.viewStudentName.textContent = student.name;
    if (dom.viewStudentUsnBadge) dom.viewStudentUsnBadge.textContent = student.usn;
    if (dom.viewDeptVal) dom.viewDeptVal.textContent = student.department || 'Computer Science & Engineering';
    if (dom.viewSemSecVal) dom.viewSemSecVal.textContent = `${student.semester || 'Semester 5'} — Sec ${student.section || 'A'}`;
    if (dom.viewEmailVal) dom.viewEmailVal.textContent = student.email || 'Not provided';

    if (dom.viewCgpaVal) dom.viewCgpaVal.textContent = Number(student.cgpa).toFixed(1);
    if (dom.viewInternalVal) dom.viewInternalVal.textContent = Number(student.internal_marks).toFixed(1);
    if (dom.viewAttendanceVal) dom.viewAttendanceVal.textContent = `${Number(student.attendance).toFixed(1)}%`;
    if (dom.viewAssignmentVal) dom.viewAssignmentVal.textContent = Number(student.assignment_marks).toFixed(1);

    // Academic Standing (Decision Tree)
    if (dom.viewCategoryVal) dom.viewCategoryVal.textContent = student.academic_status;

    let adviceText = 'Performing well. Keep the academic routine and semester milestones going.';
    let iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#119B91" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

    if (student.academic_status === 'Needs Attention') {
      adviceText = 'Showing some academic performance dips. A short mentoring check-in is advised.';
      iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDA52D" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else if (student.academic_status === 'At Risk') {
      adviceText = 'Higher risk of poor semester performance. Prioritise faculty intervention and academic support.';
      iconSvg = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF625C" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    }

    if (dom.viewAdviceVal) dom.viewAdviceVal.textContent = adviceText;
    if (dom.viewStandingIcon) dom.viewStandingIcon.innerHTML = iconSvg;

    // Exam Eligibility (Independent Attendance Rule)
    const isEligible = (student.exam_eligibility === 'Eligible' || parseFloat(student.attendance) >= 75.0);
    if (dom.viewEligibilityPill) {
      dom.viewEligibilityPill.textContent = isEligible ? 'Eligible' : 'Not Eligible (< 75%)';
      dom.viewEligibilityPill.className = `eligibility-pill ${isEligible ? 'pill-eligible' : 'pill-not-eligible'}`;
    }
    if (dom.viewEligibilityExplain) {
      dom.viewEligibilityExplain.textContent = isEligible
        ? 'Attendance satisfies institutional regulation (≥ 75%).'
        : 'Attendance is below institutional 75% requirement. Faculty condonation or makeup needed.';
    }

    openModal(dom.modalStudentView);
  }

  // --- Modal: Delete Confirmation ---
  function openDeleteStudentModal(student) {
    state.currentDeletingStudent = student;
    if (dom.deleteStudentNameUsn) {
      dom.deleteStudentNameUsn.textContent = `${student.name} (${student.usn})`;
    }
    openModal(dom.modalStudentDelete);
  }

  // --- Action: Delete Student ---
  async function deleteStudent() {
    if (!state.currentDeletingStudent) return;
    const s = state.currentDeletingStudent;

    try {
      const res = await fetch(`/api/students/${s.id}`, { method: 'DELETE' });
      const data = await res.json();

      closeModal(dom.modalStudentDelete);

      if (res.ok && data.success) {
        showToast(data.message || `Student ${s.usn} deleted successfully`, 'success');
        await loadRegisteredStudents();
      } else {
        showToast(data.error || 'Failed to delete student', 'error');
      }
    } catch (err) {
      console.error('Error deleting student:', err);
      showToast('Error communicating with server.', 'error');
    }
  }

  // ============================================================================
  // 4. STUDENT PERFORMANCE PREDICTOR
  // ============================================================================
  function setupPredictorControls() {
    // Synchronize CGPA Slider & Number
    bindInputPair(dom.sliderCgpa, dom.numCgpa, (val) => {
      state.currentStudent.cgpa = parseFloat(val);
      state.currentStudent.student_id = null; // reset to manual simulation
      debouncePrediction();
    });

    // Synchronize Internal Marks Slider & Number
    bindInputPair(dom.sliderInternal, dom.numInternal, (val) => {
      state.currentStudent.internal_marks = parseFloat(val);
      state.currentStudent.student_id = null;
      debouncePrediction();
    });

    // Synchronize Attendance Slider & Number
    bindInputPair(dom.sliderAttendance, dom.numAttendance, (val) => {
      state.currentStudent.attendance = parseFloat(val);
      state.currentStudent.student_id = null;
      debouncePrediction();
    });

    // Synchronize Assignment Marks Slider & Number
    bindInputPair(dom.sliderAssignment, dom.numAssignment, (val) => {
      state.currentStudent.assignment_marks = parseFloat(val);
      state.currentStudent.student_id = null;
      debouncePrediction();
    });

    // Primary Predict Button
    if (dom.btnRunPrediction) {
      dom.btnRunPrediction.addEventListener('click', () => {
        runPrediction();
      });
    }

    // Reset to Class Average Button
    if (dom.btnResetPredictor) {
      dom.btnResetPredictor.addEventListener('click', () => {
        const avgCgpa = state.cohortData ? state.cohortData.average_cgpa : 7.0;
        const avgAttend = state.cohortData ? state.cohortData.average_attendance : 75.0;
        setPredictorValues(avgCgpa, 25.0, avgAttend, 7.0, null);
      });
    }

    // Presets
    if (dom.presetOnTrack) {
      dom.presetOnTrack.addEventListener('click', () => {
        setPredictorValues(8.5, 34.0, 90.0, 8.5, 'HIGH PERFORMER PRESET');
      });
    }
    if (dom.presetAttention) {
      dom.presetAttention.addEventListener('click', () => {
        setPredictorValues(7.5, 28.0, 75.0, 7.5, 'ATTENTION CASE PRESET');
      });
    }
    if (dom.presetAtRisk) {
      dom.presetAtRisk.addEventListener('click', () => {
        setPredictorValues(5.2, 16.0, 60.0, 4.0, 'AT-RISK CASE PRESET');
      });
    }

    // Link to drop marble in Model View
    if (dom.linkDropInModel) {
      dom.linkDropInModel.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = '#model';
        setTimeout(() => {
          triggerSingleMarbleDrop();
        }, 250);
      });
    }
  }

  function bindInputPair(slider, num, callback) {
    if (!slider || !num) return;

    slider.addEventListener('input', (e) => {
      num.value = e.target.value;
      callback(e.target.value);
    });

    num.addEventListener('input', (e) => {
      let val = parseFloat(e.target.value);
      const min = parseFloat(num.min);
      const max = parseFloat(num.max);
      if (!isNaN(val)) {
        val = Math.max(min, Math.min(max, val));
        slider.value = val;
        callback(val);
      }
    });
  }

  let predictionTimer = null;
  function debouncePrediction() {
    updateModelReadout();
    if (predictionTimer) clearTimeout(predictionTimer);
    predictionTimer = setTimeout(() => {
      runPrediction();
    }, 180);
  }

  function setPredictorValues(cgpa, internal, attendance, assignment, studentTag) {
    state.currentStudent = {
      student_id: studentTag,
      cgpa: parseFloat(cgpa),
      internal_marks: parseFloat(internal),
      attendance: parseFloat(attendance),
      assignment_marks: parseFloat(assignment)
    };

    if (dom.sliderCgpa) dom.sliderCgpa.value = state.currentStudent.cgpa;
    if (dom.numCgpa) dom.numCgpa.value = state.currentStudent.cgpa;

    if (dom.sliderInternal) dom.sliderInternal.value = state.currentStudent.internal_marks;
    if (dom.numInternal) dom.numInternal.value = state.currentStudent.internal_marks;

    if (dom.sliderAttendance) dom.sliderAttendance.value = state.currentStudent.attendance;
    if (dom.numAttendance) dom.numAttendance.value = state.currentStudent.attendance;

    if (dom.sliderAssignment) dom.sliderAssignment.value = state.currentStudent.assignment_marks;
    if (dom.numAssignment) dom.numAssignment.value = state.currentStudent.assignment_marks;

    updateModelReadout();
    runPrediction();
  }

  function loadStudentIntoPredictor(student) {
    setPredictorValues(
      student.cgpa,
      student.internal_marks,
      student.attendance,
      student.assignment_marks,
      `STUDENT ${student.student_id}`
    );
  }

  async function runPrediction() {
    const payload = {
      cgpa: state.currentStudent.cgpa,
      internal_marks: state.currentStudent.internal_marks,
      attendance: state.currentStudent.attendance,
      assignment_marks: state.currentStudent.assignment_marks
    };

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Prediction API returned status ${response.status}`);
      }

      const result = await response.json();
      state.lastPrediction = result;
      renderPredictionResult(result);

    } catch (err) {
      console.error('Error running prediction:', err);
    }
  }

  function renderPredictionResult(result) {
    const { predicted_category, advice, is_eligible, path_steps } = result;

    // 1. Target Student Badge
    if (dom.resStudentTag) {
      dom.resStudentTag.textContent = state.currentStudent.student_id || 'MANUAL SIMULATION';
    }

    // 2. Academic Standing Primary Result Banner
    if (dom.resStandingBox) {
      dom.resStandingBox.className = 'standing-result-box';
      if (predicted_category === 'On Track') {
        dom.resStandingBox.classList.add('box-teal');
      } else if (predicted_category === 'Needs Attention') {
        dom.resStandingBox.classList.add('box-gold');
      } else {
        dom.resStandingBox.classList.add('box-coral');
      }
    }

    // Icon
    if (dom.resStandingIcon) {
      let iconSvg = '';
      if (predicted_category === 'On Track') {
        iconSvg = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#119B91" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
        `;
      } else if (predicted_category === 'Needs Attention') {
        iconSvg = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#DDA52D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        `;
      } else {
        iconSvg = `
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF625C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        `;
      }
      dom.resStandingIcon.innerHTML = iconSvg;
    }

    // Category Text & Advice
    if (dom.resCategoryText) dom.resCategoryText.textContent = predicted_category;
    if (dom.resAdviceText) {
      dom.resAdviceText.textContent = advice || {
        'On Track': 'Performing well. Keep the academic routine and semester milestones going.',
        'Needs Attention': 'A short mentoring chat now can change the outcome.',
        'At Risk': 'Immediate faculty intervention, remedial tutorials, and advisor support are advised.'
      }[predicted_category];
    }

    // 3. Exam Eligibility Independent Attendance Rule Box
    if (dom.resEligibilityPill) {
      if (is_eligible) {
        dom.resEligibilityPill.className = 'eligibility-pill pill-eligible';
        dom.resEligibilityPill.textContent = 'Eligible';
      } else {
        dom.resEligibilityPill.className = 'eligibility-pill pill-not-eligible';
        dom.resEligibilityPill.textContent = 'Not Eligible';
      }
    }

    if (dom.resEligibilityText) {
      const att = Math.round(state.currentStudent.attendance);
      if (is_eligible) {
        dom.resEligibilityText.textContent = 
          `Attendance of ${att}% satisfies the institutional regulation (≥ 75%). This regulatory norm does not alter the machine learning academic capability prediction.`;
      } else {
        dom.resEligibilityText.textContent = 
          `Attendance of ${att}% is below the statutory 75% threshold. Institutional regulations require attendance condonation approval prior to semester examination entry, independent of academic standing.`;
      }
    }

    // 4. Decision Tree Reasoning Path Steps
    if (dom.resDecisionSteps) {
      dom.resDecisionSteps.innerHTML = '';
      if (path_steps && path_steps.length > 0) {
        path_steps.forEach((step, idx) => {
          const li = document.createElement('li');
          const isYes = (step.branch === 'YES');
          const badgeClass = isYes ? 'branch-yes' : 'branch-no';

          li.innerHTML = `
            <strong>Step ${idx + 1}:</strong> 
            Is ${escapeHtml(step.feature_label)} &ge; ${step.threshold}? 
            Current: <code>${step.value}</code> &rarr; 
            Evaluated <code>${escapeHtml(step.condition)}</code> &rarr; 
            <span class="branch-badge ${badgeClass}">${escapeHtml(step.branch)}</span>
            <span style="color:var(--color-text-muted); font-size:12px; margin-left:4px;">(${escapeHtml(step.direction)})</span>
          `;
          dom.resDecisionSteps.appendChild(li);
        });
      }
    }

    updateModelReadout();
    announce(`Prediction evaluated: ${predicted_category}. Exam status: ${is_eligible ? 'Eligible' : 'Not Eligible'}.`);
  }

  function updateModelReadout() {
    if (dom.treeStudentReadout) {
      const s = state.currentStudent;
      dom.treeStudentReadout.textContent = 
        `Uses marks from Predictor: CGPA ${s.cgpa.toFixed(1)} · Internal ${Math.round(s.internal_marks)} · Attendance ${Math.round(s.attendance)}% · Assignment ${s.assignment_marks.toFixed(1)}`;
    }
  }

  // ============================================================================
  // 5. MODEL VIEW (AUDITABLE SVG DECISION TREE & MARBLE SIMULATION)
  // ============================================================================
  function setupModelControls() {
    if (dom.btnDropTreeMarble) {
      dom.btnDropTreeMarble.addEventListener('click', () => {
        triggerSingleMarbleDrop();
      });
    }

    if (dom.btnCascadeAllCohort) {
      dom.btnCascadeAllCohort.addEventListener('click', () => {
        triggerCohortCascade();
      });
    }
  }

  function renderModelSpecs() {
    if (!state.modelSpecs) return;

    // Accuracy Tiles
    if (dom.statTrainAcc && state.modelSpecs.train_accuracy) {
      dom.statTrainAcc.textContent = `${(state.modelSpecs.train_accuracy * 100).toFixed(1)}%`;
    }
    if (dom.statTestAcc && state.modelSpecs.test_accuracy) {
      dom.statTestAcc.textContent = `${(state.modelSpecs.test_accuracy * 100).toFixed(1)}%`;
    }

    // Feature Importance Progress Bars
    if (dom.featureImportanceBars && state.modelSpecs.feature_importances) {
      dom.featureImportanceBars.innerHTML = '';
      state.modelSpecs.feature_importances.forEach(fi => {
        const row = document.createElement('div');
        row.className = 'fi-row';
        row.innerHTML = `
          <div class="fi-label-wrap">
            <span>${escapeHtml(fi.name)}</span>
            <strong>${fi.percentage.toFixed(1)}%</strong>
          </div>
          <div class="fi-track">
            <div class="fi-fill" style="width: ${fi.percentage}%;"></div>
          </div>
        `;
        dom.featureImportanceBars.appendChild(row);
      });
    }
  }

  /**
   * Decision Tree Node Layout Definition (Matches Trained scikit-learn Depth-4 Tree)
   */
  const TREE_NODES = {
    r: [410, 42, 'CGPA ≥ 7.60?'],
    a: [190, 132, 'CGPA ≥ 5.58?'],
    b: [620, 132, 'Internal Marks ≥ 26.4?'],
    c: [330, 232, 'Internal Marks ≥ 15.3?'],
    d: [560, 232, 'Assignment Marks ≥ 8.7?'],
    e: [440, 332, 'Internal Marks ≥ 30.9?']
  };

  const TREE_LEAVES = [
    { id: 'L0', type: 'coral', label: 'At Risk', count: 31 },
    { id: 'L1', type: 'coral', label: 'At Risk', count: 5 },
    { id: 'L2', type: 'gold',  label: 'Needs Attention', count: 74 },
    { id: 'L3', type: 'teal',  label: 'On Track', count: 5 },
    { id: 'L4', type: 'gold',  label: 'Needs Attention', count: 2 },
    { id: 'L5', type: 'teal',  label: 'On Track', count: 3 },
    { id: 'L6', type: 'teal',  label: 'On Track', count: 80 }
  ];

  const TREE_EDGES = [
    ['r', 'a', 'No'],
    ['r', 'b', 'Yes'],
    ['a', 'L0', 'No'],
    ['a', 'c', 'Yes'],
    ['c', 'L1', 'No'],
    ['c', 'e', 'Yes'],
    ['e', 'L2', 'No'],
    ['e', 'L3', 'Yes'],
    ['b', 'd', 'No'],
    ['b', 'L6', 'Yes'],
    ['d', 'L4', 'No'],
    ['d', 'L5', 'Yes']
  ];

  const LEAF_POS = id => id[0] === 'L' ? [58.6 + 117.1 * (+id.slice(1)), 430] : [TREE_NODES[id][0], TREE_NODES[id][1]];

  function edgePathD(from, to) {
    const [x1, y1] = LEAF_POS(from);
    const [x2, y2] = LEAF_POS(to);
    const topY = y1 + 17;
    const botY = (to[0] === 'L') ? y2 : y2 - 17;
    const midY = (topY + botY) / 2;
    return `M${x1},${topY} C${x1},${midY} ${x2},${midY} ${x2},${botY}`;
  }

  function getStudentPath(cgpa, internal, assignment) {
    if (cgpa >= 7.6) {
      if (internal >= 26.4) return ['r', 'b', 'L6'];
      return (assignment >= 8.7) ? ['r', 'b', 'd', 'L5'] : ['r', 'b', 'd', 'L4'];
    }
    if (cgpa < 5.58) return ['r', 'a', 'L0'];
    if (internal < 15.3) return ['r', 'a', 'c', 'L1'];
    return (internal >= 30.9) ? ['r', 'a', 'c', 'e', 'L3'] : ['r', 'a', 'c', 'e', 'L2'];
  }

  function renderDecisionTree(highlightPath) {
    if (!dom.svgTreeViewport) return;

    const s = state.currentStudent;
    const activePath = highlightPath || getStudentPath(s.cgpa, s.internal_marks, s.assignment_marks);
    const activeSet = new Set();
    activePath.forEach((node, idx) => {
      if (idx > 0) activeSet.add(activePath[idx - 1] + '>' + node);
    });

    let svg = `<svg viewBox="0 0 820 500" style="width: 100%; height: auto; display: block;" role="img" aria-label="Interactive Decision Tree">`;

    // 1. Draw Connecting Edges
    TREE_EDGES.forEach(([f, t]) => {
      const isHigh = activeSet.has(f + '>' + t);
      const stroke = isHigh ? '#DDA52D' : '#DBCBDC';
      const width = isHigh ? 4 : 2;
      svg += `<path d="${edgePathD(f, t)}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
    });

    // 2. Draw Branch Badges (YES / NO)
    TREE_EDGES.forEach(([f, t, label]) => {
      const [x1, y1] = LEAF_POS(f);
      const [x2] = LEAF_POS(t);
      const isYes = (label === 'Yes');
      const badgeBg = isYes ? '#EBF8F6' : '#FDF0EF';
      const badgeColor = isYes ? '#119B91' : '#EF625C';
      const badgeBorder = isYes ? '#9FE0DA' : '#F8B6B2';
      const posX = x1 + (x2 > x1 ? 30 : -30);
      const posY = y1 + 42;

      svg += `
        <g transform="translate(${posX}, ${posY})">
          <rect x="-17" y="-10" width="34" height="20" rx="4" fill="${badgeBg}" stroke="${badgeBorder}" stroke-width="1"/>
          <text text-anchor="middle" y="4" font-family="'Plus Jakarta Sans', sans-serif" font-size="10.5" font-weight="800" fill="${badgeColor}">${label.toUpperCase()}</text>
        </g>
      `;
    });

    // 3. Draw Decision Nodes
    for (const key in TREE_NODES) {
      const [x, y, text] = TREE_NODES[key];
      const w = text.length * 8.6 + 28;
      const isHit = activePath.includes(key);
      const stroke = isHit ? '#542447' : '#D5C7D8';
      const strokeWidth = isHit ? 2.5 : 1.2;
      const fill = isHit ? '#FFFFFF' : '#FAF6FB';

      svg += `
        <rect x="${x - w / 2}" y="${y - 17}" width="${w}" height="34" rx="17" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
        <text x="${x}" y="${y + 5}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700" fill="#3E1937">${text}</text>
      `;
    }

    // 4. Draw Terminal Leaf Bins
    const colorMap = {
      teal: { bg: '#EBF8F6', border: '#119B91', text: '#119B91' },
      gold: { bg: '#FEF9EC', border: '#DDA52D', text: '#B57F0C' },
      coral: { bg: '#FDF0EF', border: '#EF625C', text: '#EF625C' }
    };

    TREE_LEAVES.forEach((leaf, idx) => {
      const x = LEAF_POS('L' + idx)[0];
      const isTarget = (activePath[activePath.length - 1] === 'L' + idx);
      const c = colorMap[leaf.type];
      const stroke = isTarget ? '#3E1937' : c.border;
      const strokeWidth = isTarget ? 3 : 1.5;

      svg += `
        <g id="leaf-group-${idx}">
          <rect x="${x - 54}" y="430" width="108" height="58" rx="8" fill="${c.bg}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
          <text x="${x}" y="452" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="800" fill="${c.text}">${leaf.label.toUpperCase()}</text>
          <text x="${x}" y="475" text-anchor="middle" font-family="'Space Mono', monospace" font-size="16" font-weight="700" fill="#3E1937" id="leaf-count-${idx}">${leaf.count}</text>
        </g>
      `;
    });

    // 5. Animated Marble Element
    svg += `<circle id="marble" r="9" cx="410" cy="10" fill="#DDA52D" stroke="#FFFFFF" stroke-width="2.5" opacity="0"/></svg>`;

    dom.svgTreeViewport.innerHTML = svg;
  }

  function triggerSingleMarbleDrop() {
    if (state.isDroppingMarble) return;
    state.isDroppingMarble = true;

    const s = state.currentStudent;
    const path = getStudentPath(s.cgpa, s.internal_marks, s.assignment_marks);
    renderDecisionTree(path);

    const marble = document.getElementById('marble');
    if (!marble) {
      state.isDroppingMarble = false;
      return;
    }

    // Build keyframe positions along the path
    const keyframes = [];
    keyframes.push([410, 10]); // Spawn above root

    path.forEach(id => {
      const [x, y] = LEAF_POS(id);
      if (id[0] === 'L') {
        keyframes.push([x, y + 25]); // inside leaf
      } else {
        keyframes.push([x, y]);
      }
    });

    marble.setAttribute('opacity', '1');
    announce('Student marble dropping through decision questions.');

    let currentSegment = 0;
    const segmentDuration = 450; // ms per path branch
    let segmentStartTime = null;

    function step(timestamp) {
      if (!segmentStartTime) segmentStartTime = timestamp;
      const elapsed = timestamp - segmentStartTime;
      const progress = Math.min(elapsed / segmentDuration, 1);

      // Smooth ease-in-out interpolation
      const ease = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;

      const [x1, y1] = keyframes[currentSegment];
      const [x2, y2] = keyframes[currentSegment + 1];

      const curX = x1 + (x2 - x1) * ease;
      const curY = y1 + (y2 - y1) * ease;

      marble.setAttribute('cx', curX);
      marble.setAttribute('cy', curY);

      if (progress < 1) {
        state.marbleRaf = requestAnimationFrame(step);
      } else {
        currentSegment++;
        segmentStartTime = null;
        if (currentSegment < keyframes.length - 1) {
          state.marbleRaf = requestAnimationFrame(step);
        } else {
          // Marble finished at destination leaf!
          onMarbleLanded(path[path.length - 1]);
        }
      }
    }

    state.marbleRaf = requestAnimationFrame(step);
  }

  function onMarbleLanded(leafId) {
    state.isDroppingMarble = false;
    const leafIndex = parseInt(leafId.slice(1), 10);
    const leafInfo = TREE_LEAVES[leafIndex];

    // Status banner update
    if (dom.treeResultStatusBanner && leafInfo) {
      dom.treeResultStatusBanner.innerHTML = `
        🎯 Student landed in <strong>${escapeHtml(leafInfo.label)}</strong> (Leaf #${leafIndex}) via decision tree questions.
      `;
    }

    announce(`Student landed in ${leafInfo ? leafInfo.label : 'destination leaf'}.`);
  }

  function triggerCohortCascade() {
    if (state.isDroppingMarble) return;
    state.isDroppingMarble = true;

    announce('Dropping all 200 cohort records through the decision tree.');
    if (dom.treeResultStatusBanner) {
      dom.treeResultStatusBanner.innerHTML = `
        🔄 Routing all 200 enrolled students through the Decision Tree simultaneously...
      `;
    }

    // Flash leaf counters to show cohort accumulation
    let count = 0;
    const interval = setInterval(() => {
      count++;
      TREE_LEAVES.forEach((leaf, idx) => {
        const countEl = document.getElementById(`leaf-count-${idx}`);
        if (countEl) {
          const partial = Math.round((leaf.count * count) / 10);
          countEl.textContent = partial;
        }
      });

      if (count >= 10) {
        clearInterval(interval);
        state.isDroppingMarble = false;
        if (dom.treeResultStatusBanner) {
          dom.treeResultStatusBanner.innerHTML = `
            🎉 All 200 students routed: <strong>93 On Track (46.5%)</strong>, <strong>69 Needs Attention (34.5%)</strong>, <strong>38 At Risk (19.0%)</strong>.
          `;
        }
        announce('Cohort cascade completed.');
      }
    }, 60);
  }

  // ============================================================================
  // Utility Functions
  // ============================================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Bootstrap when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
