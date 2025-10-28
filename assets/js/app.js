const THAI_MONTHS = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม'
];

const THAI_MONTHS_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.'
];

const MS_IN_DAY = 24 * 60 * 60 * 1000;

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);
const DEFAULT_MONTH_SELECTION = { year: TODAY.getFullYear(), month: TODAY.getMonth() };
const DEFAULT_QUARTER_SELECTION = {
  year: TODAY.getFullYear(),
  quarter: Math.floor(TODAY.getMonth() / 3) + 1
};
const DEFAULT_YEAR_SELECTION = { year: TODAY.getFullYear() };

const CLINICAL_SEVERITY_RANK = {
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9
};

const HIGH_SEVERITY_CLINICAL_THRESHOLD = CLINICAL_SEVERITY_RANK.G;

const state = {
  incidents: [],
  filtered: [],
  charts: {},
  trendPeriod: 'month',
  timeframeType: 'month',
  timeframeValue: { ...DEFAULT_MONTH_SELECTION },
  timeframeSelections: {
    day: new Date(TODAY),
    month: { ...DEFAULT_MONTH_SELECTION },
    quarter: { ...DEFAULT_QUARTER_SELECTION },
    year: { ...DEFAULT_YEAR_SELECTION }
  },
  timeframeLabel: '',
  filters: {
    type: 'all',
    department: 'all',
    severity: 'all',
    startDate: null,
    endDate: null
  }
};

const elements = {
  loginOverlay: document.getElementById('loginOverlay'),
  loginForm: document.getElementById('loginForm'),
  employeeId: document.getElementById('employeeId'),
  logoutBtn: document.getElementById('logoutBtn'),
  userName: document.getElementById('userName'),
  dataRefresh: document.getElementById('dataRefresh'),
  totalIncidents: document.getElementById('totalIncidents'),
  weeklyAvg: document.getElementById('weeklyAvg'),
  openIncidents: document.getElementById('openIncidents'),
  avgOpenDays: document.getElementById('avgOpenDays'),
  highSeverity: document.getElementById('highSeverity'),
  highSeverityRate: document.getElementById('highSeverityRate'),
  avgResolution: document.getElementById('avgResolution'),
  fastClosureRate: document.getElementById('fastClosureRate'),
  tableBody: document.getElementById('tableBody'),
  tableSummary: document.getElementById('tableSummary'),
  sidebarResolved: document.getElementById('sidebarResolved'),
  sidebarOpen: document.getElementById('sidebarOpen'),
  sidebarClinical: document.getElementById('sidebarClinical'),
  trendRange: document.getElementById('trendRange'),
  trendSubtitle: document.getElementById('trendSubtitle'),
  timeframeDisplay: document.getElementById('timeframeDisplay'),
  timeframeOptions: document.querySelectorAll('.timeframe-option'),
  timeframeChoices: document.querySelectorAll('.timeframe-choice'),
  timeframeDayInput: document.getElementById('timeframeDay'),
  timeframeMonthSelect: document.getElementById('timeframeMonth'),
  timeframeQuarterSelect: document.getElementById('timeframeQuarter'),
  timeframeYearSelect: document.getElementById('timeframeYear'),
  filterType: document.getElementById('filterType'),
  filterDepartment: document.getElementById('filterDepartment'),
  filterSeverity: document.getElementById('filterSeverity'),
  filterStart: document.getElementById('filterStart'),
  filterEnd: document.getElementById('filterEnd'),
  resetFilters: document.getElementById('resetFilters'),
  downloadCsv: document.getElementById('downloadCsv'),
  categoryExplanations: document.getElementById('categoryExplanations'),
  sidebarFilters: {
    container: document.getElementById('sidebarFilters'),
    groups: {
      department: {
        toggle: document.querySelector('[data-filter-group="department"] .sidebar-filter-toggle'),
        list: document.getElementById('sidebarFilterDepartment')
      },
      severity: {
        toggle: document.querySelector('[data-filter-group="severity"] .sidebar-filter-toggle'),
        list: document.getElementById('sidebarFilterSeverity')
      },
      type: {
        toggle: document.querySelector('[data-filter-group="type"] .sidebar-filter-toggle'),
        list: document.getElementById('sidebarFilterType')
      }
    }
  }
};

function parseDate(value) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return new Date(value);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatThaiDate(value, withTime = false) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '-';

  const day = date.getDate().toString().padStart(2, '0');
  const month = THAI_MONTHS[date.getMonth()];
  const year = date.getFullYear() + 543;
  if (!withTime) {
    return `${day}/${month}/${year}`;
  }
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function formatNumber(value) {
  return value.toLocaleString('th-TH');
}

function formatDateInputValue(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  const year = value.getFullYear();
  const month = (value.getMonth() + 1).toString().padStart(2, '0');
  const day = value.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if ([year, month, day].some((item) => Number.isNaN(item))) return null;
  return new Date(year, month - 1, day);
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function formatMonthValue(year, month) {
  const normalizedMonth = Math.min(11, Math.max(0, Number(month) || 0));
  return `${year}-${(normalizedMonth + 1).toString().padStart(2, '0')}`;
}

function parseMonthValue(value) {
  if (!value || typeof value !== 'string') return null;
  const [yearStr, monthStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  if ([year, month].some((num) => Number.isNaN(num)) || month < 0 || month > 11) return null;
  return { year, month };
}

function formatQuarterValue(year, quarter) {
  const normalizedQuarter = Math.min(4, Math.max(1, Number(quarter) || 1));
  return `${year}-Q${normalizedQuarter}`;
}

function parseQuarterValue(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return null;
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

function computeTimeframeRange(type, selection) {
  if (type === 'day') {
    const base = selection instanceof Date ? new Date(selection) : new Date(TODAY);
    base.setHours(0, 0, 0, 0);
    const start = new Date(base);
    const end = endOfDay(base);
    return { start, end, label: formatThaiDate(start) };
  }

  if (type === 'month') {
    const ref = selection && typeof selection.year === 'number' && typeof selection.month === 'number'
      ? selection
      : DEFAULT_MONTH_SELECTION;
    const start = new Date(ref.year, ref.month, 1);
    const end = endOfDay(new Date(ref.year, ref.month + 1, 0));
    return { start, end, label: `${THAI_MONTHS[start.getMonth()]} ${start.getFullYear() + 543}` };
  }

  if (type === 'quarter') {
    const ref = selection && typeof selection.year === 'number' && typeof selection.quarter === 'number'
      ? selection
      : DEFAULT_QUARTER_SELECTION;
    const quarter = Math.min(4, Math.max(1, ref.quarter));
    const startMonth = (quarter - 1) * 3;
    const start = new Date(ref.year, startMonth, 1);
    const end = endOfDay(new Date(ref.year, startMonth + 3, 0));
    return { start, end, label: `ไตรมาส ${quarter}/${ref.year + 543}` };
  }

  if (type === 'year') {
    const year = selection && typeof selection.year === 'number'
      ? selection.year
      : DEFAULT_YEAR_SELECTION.year;
    const start = new Date(year, 0, 1);
    const end = endOfDay(new Date(year, 12, 0));
    return { start, end, label: `ปี ${year + 543}` };
  }

  if (type === 'all') {
    return { start: null, end: null, label: 'ทั้งหมด' };
  }

  return { start: null, end: null, label: '' };
}

function updateTimeframeControls() {
  if (!elements.timeframeOptions || elements.timeframeOptions.length === 0) return;
  const isCustom = state.timeframeType === 'custom';
  elements.timeframeOptions.forEach((option) => {
    const button = option.querySelector('.timeframe-choice');
    const panel = option.querySelector('.timeframe-panel');
    const { type } = option.dataset;
    const isActive = !isCustom && state.timeframeType === type;
    option.classList.toggle('active', isActive);
    if (button) {
      button.classList.toggle('active', isActive);
      if (type === 'all') {
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      } else {
        button.setAttribute('aria-expanded', isActive ? 'true' : 'false');
      }
    }
    if (panel) {
      const shouldShow = isActive && type !== 'all';
      panel.hidden = !shouldShow;
    }
  });
}

function updateTimeframeDisplay() {
  if (!elements.timeframeDisplay) return;
  if (state.timeframeType === 'custom') {
    const startText = state.filters.startDate ? formatThaiDate(state.filters.startDate) : 'ไม่กำหนด';
    const endText = state.filters.endDate ? formatThaiDate(state.filters.endDate) : 'ไม่กำหนด';
    elements.timeframeDisplay.textContent = `กำหนดเอง (${startText} - ${endText})`;
    return;
  }
  const { label } = computeTimeframeRange(state.timeframeType, state.timeframeValue);
  elements.timeframeDisplay.textContent = label || '-';
}

function markCustomTimeframe() {
  state.timeframeType = 'custom';
  state.timeframeValue = null;
  state.timeframeLabel = '';
  updateTimeframeControls();
  updateTimeframeDisplay();
}

function ensureTimeframeInputsReflectState() {
  if (elements.timeframeDayInput) {
    const daySelection = state.timeframeSelections.day instanceof Date
      ? state.timeframeSelections.day
      : new Date(TODAY);
    elements.timeframeDayInput.value = formatDateInputValue(daySelection);
  }

  if (elements.timeframeMonthSelect) {
    const ref = state.timeframeSelections.month || DEFAULT_MONTH_SELECTION;
    const value = formatMonthValue(ref.year, ref.month);
    const option = elements.timeframeMonthSelect.querySelector(`option[value="${value}"]`);
    if (option) {
      elements.timeframeMonthSelect.value = value;
    } else if (elements.timeframeMonthSelect.options.length > 0) {
      elements.timeframeMonthSelect.selectedIndex = 0;
    }
  }

  if (elements.timeframeQuarterSelect) {
    const ref = state.timeframeSelections.quarter || DEFAULT_QUARTER_SELECTION;
    const value = formatQuarterValue(ref.year, ref.quarter);
    const option = elements.timeframeQuarterSelect.querySelector(`option[value="${value}"]`);
    if (option) {
      elements.timeframeQuarterSelect.value = value;
    } else if (elements.timeframeQuarterSelect.options.length > 0) {
      elements.timeframeQuarterSelect.selectedIndex = 0;
    }
  }

  if (elements.timeframeYearSelect) {
    const ref = state.timeframeSelections.year || DEFAULT_YEAR_SELECTION;
    const value = String(ref.year);
    const option = elements.timeframeYearSelect.querySelector(`option[value="${value}"]`);
    if (option) {
      elements.timeframeYearSelect.value = value;
    } else if (elements.timeframeYearSelect.options.length > 0) {
      elements.timeframeYearSelect.selectedIndex = 0;
    }
  }
}

function setTimeframe(type, rawValue) {
  let selection = null;

  if (type === 'day') {
    const date = rawValue instanceof Date ? new Date(rawValue) : parseDateInput(rawValue);
    selection = date ? new Date(date) : new Date(TODAY);
    selection.setHours(0, 0, 0, 0);
    state.timeframeSelections.day = new Date(selection);
  } else if (type === 'month') {
    const parsed = rawValue && typeof rawValue === 'object' ? rawValue : parseMonthValue(rawValue);
    selection = parsed ? { year: parsed.year, month: parsed.month } : { ...DEFAULT_MONTH_SELECTION };
    state.timeframeSelections.month = { ...selection };
  } else if (type === 'quarter') {
    const parsed = rawValue && typeof rawValue === 'object' ? rawValue : parseQuarterValue(rawValue);
    const safe = parsed ? { year: parsed.year, quarter: Math.min(4, Math.max(1, parsed.quarter)) } : { ...DEFAULT_QUARTER_SELECTION };
    selection = safe;
    state.timeframeSelections.quarter = { ...selection };
  } else if (type === 'year') {
    const year = rawValue && typeof rawValue.year === 'number' ? rawValue.year : Number(rawValue);
    const safeYear = Number.isNaN(year) ? DEFAULT_YEAR_SELECTION.year : year;
    selection = { year: safeYear };
    state.timeframeSelections.year = { ...selection };
  } else if (type === 'all') {
    state.timeframeType = 'all';
    state.timeframeValue = null;
    state.timeframeLabel = 'ทั้งหมด';
    state.filters.startDate = null;
    state.filters.endDate = null;
    if (elements.filterStart) {
      elements.filterStart.value = '';
    }
    if (elements.filterEnd) {
      elements.filterEnd.value = '';
    }
    ensureTimeframeInputsReflectState();
    updateTimeframeControls();
    updateTimeframeDisplay();
    applyFilters();
    return;
  } else {
    return;
  }

  const { start, end, label } = computeTimeframeRange(type, selection);
  state.timeframeType = type;
  state.timeframeValue = selection;
  state.timeframeLabel = label;
  state.filters.startDate = start;
  state.filters.endDate = end;

  if (elements.filterStart) {
    elements.filterStart.value = start ? formatDateInputValue(start) : '';
  }

  if (elements.filterEnd) {
    const endForInput = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
    elements.filterEnd.value = endForInput ? formatDateInputValue(endForInput) : '';
  }

  ensureTimeframeInputsReflectState();
  updateTimeframeControls();
  updateTimeframeDisplay();
  applyFilters();
}

function populateTimeframeSelect(selectEl, options) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach((option) => {
    const opt = document.createElement('option');
    opt.value = option.value;
    opt.textContent = option.label;
    selectEl.appendChild(opt);
  });
}

function buildMonthOptions(limit = 18) {
  const options = [];
  for (let i = 0; i < limit; i += 1) {
    const ref = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    options.push({
      value: formatMonthValue(ref.getFullYear(), ref.getMonth()),
      label: `${THAI_MONTHS[ref.getMonth()]} ${ref.getFullYear() + 543}`
    });
  }
  return options;
}

function buildQuarterOptions(limit = 8) {
  const options = [];
  let { year, quarter } = { ...DEFAULT_QUARTER_SELECTION };
  for (let i = 0; i < limit; i += 1) {
    options.push({
      value: formatQuarterValue(year, quarter),
      label: `ไตรมาส ${quarter}/${year + 543}`
    });
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
  }
  return options;
}

function buildYearOptions(limit = 6) {
  const options = [];
  let year = DEFAULT_YEAR_SELECTION.year;
  for (let i = 0; i < limit; i += 1) {
    options.push({ value: String(year), label: `พ.ศ. ${year + 543}` });
    year -= 1;
  }
  return options;
}

function initTimeframeControls() {
  if (!elements.timeframeChoices || elements.timeframeChoices.length === 0) return;

  populateTimeframeSelect(elements.timeframeMonthSelect, buildMonthOptions());
  populateTimeframeSelect(elements.timeframeQuarterSelect, buildQuarterOptions());
  populateTimeframeSelect(elements.timeframeYearSelect, buildYearOptions());
  ensureTimeframeInputsReflectState();

  if (elements.timeframeDayInput) {
    elements.timeframeDayInput.addEventListener('change', (event) => {
      const picked = event.target.value ? parseDateInput(event.target.value) : null;
      const date = picked ? new Date(picked) : new Date(TODAY);
      date.setHours(0, 0, 0, 0);
      state.timeframeSelections.day = new Date(date);
      setTimeframe('day', date);
    });
  }

  if (elements.timeframeMonthSelect) {
    elements.timeframeMonthSelect.addEventListener('change', (event) => {
      const parsed = parseMonthValue(event.target.value) || { ...DEFAULT_MONTH_SELECTION };
      state.timeframeSelections.month = { ...parsed };
      setTimeframe('month', parsed);
    });
  }

  if (elements.timeframeQuarterSelect) {
    elements.timeframeQuarterSelect.addEventListener('change', (event) => {
      const parsed = parseQuarterValue(event.target.value) || { ...DEFAULT_QUARTER_SELECTION };
      state.timeframeSelections.quarter = { ...parsed };
      setTimeframe('quarter', parsed);
    });
  }

  if (elements.timeframeYearSelect) {
    elements.timeframeYearSelect.addEventListener('change', (event) => {
      const year = Number(event.target.value);
      const safeYear = Number.isNaN(year) ? DEFAULT_YEAR_SELECTION.year : year;
      state.timeframeSelections.year = { year: safeYear };
      setTimeframe('year', { year: safeYear });
    });
  }

  elements.timeframeChoices.forEach((button) => {
    button.addEventListener('click', () => {
      const option = button.closest('.timeframe-option');
      if (!option) return;
      const { type } = option.dataset;
      if (!type) return;

      if (type === 'all') {
        if (state.timeframeType !== 'all') {
          setTimeframe('all');
        }
        return;
      }

      if (type === 'day') {
        const dayInput = elements.timeframeDayInput;
        const value = dayInput ? dayInput.value : '';
        const parsed = value ? parseDateInput(value) : null;
        const date = parsed ? new Date(parsed) : new Date(state.timeframeSelections.day);
        setTimeframe('day', date);
        if (dayInput) {
          dayInput.focus();
        }
        return;
      }

      if (type === 'month') {
        const monthSelect = elements.timeframeMonthSelect;
        const value = monthSelect ? monthSelect.value : '';
        const parsed = value ? parseMonthValue(value) : state.timeframeSelections.month;
        setTimeframe('month', parsed);
        if (monthSelect) {
          monthSelect.focus();
        }
        return;
      }

      if (type === 'quarter') {
        const quarterSelect = elements.timeframeQuarterSelect;
        const value = quarterSelect ? quarterSelect.value : '';
        const parsed = value ? parseQuarterValue(value) : state.timeframeSelections.quarter;
        setTimeframe('quarter', parsed);
        if (quarterSelect) {
          quarterSelect.focus();
        }
        return;
      }

      if (type === 'year') {
        const yearSelect = elements.timeframeYearSelect;
        const value = yearSelect ? yearSelect.value : '';
        const year = value ? Number(value) : state.timeframeSelections.year.year;
        setTimeframe('year', { year });
        if (yearSelect) {
          yearSelect.focus();
        }
      }
    });
  });

  setTimeframe('month', state.timeframeSelections.month);
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.filter((line) => line.trim().length > 0).map((line) => {
    const cells = [];
    let current = '';
    let insideQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (insideQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        cells.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current);

    const record = {};
    headers.forEach((header, index) => {
      record[header.trim()] = (cells[index] ?? '').trim();
    });
    return record;
  });
}

function enrichIncidents(records) {
  return records.map((item) => {
    const incidentDate = parseDate(item.Incident_Date);
    const reportDate = parseDate(item.Report_Date);
    const resolutionDate = parseDate(item.Resolution_Date);
    const confirmationDate = parseDate(item.Confirmation_Date);
    const isClinical = item.Incident_Type.includes('คลินิก');
    const severityRaw = (item.Severity_Code || '').trim();
    const normalizedSeverity = isClinical ? severityRaw.toUpperCase() : severityRaw;
    const severityDisplay = normalizedSeverity || 'ไม่ระบุ';
    const severityRank = isClinical
      ? CLINICAL_SEVERITY_RANK[normalizedSeverity] ?? null
      : (Number(normalizedSeverity) || null);

    return {
      ...item,
      Incident_Date_Obj: incidentDate,
      Report_Date_Obj: reportDate,
      Resolution_Date_Obj: resolutionDate,
      Confirmation_Date_Obj: confirmationDate,
      Severity_Code_Display: severityDisplay,
      Severity_Code_Rank: severityRank,
      Severity_Code_Num: !isClinical ? severityRank : null,
      isClinical,
      isResolved: Boolean(resolutionDate),
      leadTimeDays: incidentDate && resolutionDate
        ? Math.max(0, Math.round((resolutionDate - incidentDate) / (1000 * 60 * 60 * 24)))
        : null,
      openDays: incidentDate && !resolutionDate
        ? Math.max(0, Math.round((new Date() - incidentDate) / (1000 * 60 * 60 * 24)))
        : null
    };
  });
}

function updateOptions(options, selectEl) {
  selectEl.innerHTML = '<option value="all">ทั้งหมด</option>';
  options.forEach((option) => {
    const opt = document.createElement('option');
    if (typeof option === 'string') {
      opt.value = option;
      opt.textContent = option;
    } else if (option && typeof option === 'object') {
      opt.value = option.value;
      opt.textContent = option.label || option.value;
    }
    selectEl.appendChild(opt);
  });
}

function getSeverityOrderInfo(value) {
  const numericValue = Number(value);
  if (!Number.isNaN(numericValue) && numericValue > 0) {
    return { type: 'general', rank: numericValue };
  }

  const code = String(value || '').toUpperCase();
  const rank = CLINICAL_SEVERITY_RANK[code] ?? Number.POSITIVE_INFINITY;
  return { type: 'clinical', rank };
}

function compareSeverityValues(a, b) {
  const infoA = getSeverityOrderInfo(a);
  const infoB = getSeverityOrderInfo(b);
  if (infoA.type !== infoB.type) {
    return infoA.type === 'general' ? -1 : 1;
  }
  return infoA.rank - infoB.rank;
}

function isHighSeverityIncident(item) {
  if (item.isClinical) {
    return (item.Severity_Code_Rank || 0) >= HIGH_SEVERITY_CLINICAL_THRESHOLD;
  }
  return (item.Severity_Code_Rank || 0) >= 4;
}

function getSeverityDisplayValue(item) {
  return item.Severity_Code_Display || 'ไม่ระบุ';
}

const SIDEBAR_FILTER_CONFIG = {
  department: {
    stateKey: 'department',
    selectKey: 'filterDepartment',
    getOptionMeta: (item) => {
      const raw = (item.Department || '').trim();
      return {
        value: raw,
        label: raw || 'ไม่ระบุหน่วยงาน'
      };
    },
    sort: (a, b) => {
      const labelA = a.label || '';
      const labelB = b.label || '';
      const isUnknownA = labelA === 'ไม่ระบุหน่วยงาน';
      const isUnknownB = labelB === 'ไม่ระบุหน่วยงาน';
      if (isUnknownA && !isUnknownB) return 1;
      if (!isUnknownA && isUnknownB) return -1;
      return labelA.localeCompare(labelB, 'th');
    }
  },
  severity: {
    stateKey: 'severity',
    selectKey: 'filterSeverity',
    getOptionMeta: (item) => {
      const value = getSeverityDisplayValue(item);
      const label = item.isClinical ? `ระดับ ${value} (คลินิก)` : `ระดับ ${value}`;
      return { value, label };
    },
    sort: (a, b) => {
      if (a.value === b.value) return 0;
      if (a.value === 'ไม่ระบุ') return 1;
      if (b.value === 'ไม่ระบุ') return -1;
      return compareSeverityValues(a.value, b.value);
    }
  },
  type: {
    stateKey: 'type',
    selectKey: 'filterType',
    getOptionMeta: (item) => {
      const value = (item.Incident_Type || '').trim();
      const detailRaw = (item.Incident_Type_Details || '').trim();
      const cleanedDetail = detailRaw.replace(/[:：]\s*$/, '').trim();
      let label = value;
      if (value && cleanedDetail) {
        label = `${value}: ${cleanedDetail}`;
      } else if (!value && cleanedDetail) {
        label = cleanedDetail;
      } else if (!value) {
        label = 'ไม่ระบุรหัส';
      }
      return {
        value,
        label: label || 'ไม่ระบุรหัส'
      };
    },
    sort: (a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      return (a.label || '').localeCompare(b.label || '', 'th');
    }
  }
};

function calculateKpis(data) {
  const total = data.length;
  const open = data.filter((item) => !item.isResolved);
  const resolved = data.filter((item) => item.isResolved);
  const highSeverity = data.filter((item) => isHighSeverityIncident(item));
  const clinical = data.filter((item) => item.isClinical);
  const incidentsPerWeek = total / Math.max(1, Math.round(daysBetween(data, 'Incident_Date_Obj') / 7));

  const avgOpenDays = open.reduce((sum, item) => sum + (item.openDays ?? 0), 0) / Math.max(open.length, 1);
  const resolutionDurations = resolved
    .map((item) => item.leadTimeDays)
    .filter((value) => typeof value === 'number');
  const avgResolution = resolutionDurations.reduce((sum, val) => sum + val, 0) / Math.max(resolutionDurations.length, 1);
  const fastClosure = resolved.filter((item) => (item.leadTimeDays ?? Infinity) <= 14).length;

  elements.totalIncidents.textContent = formatNumber(total);
  elements.weeklyAvg.textContent = incidentsPerWeek > 0 ? incidentsPerWeek.toFixed(1) : '0';
  elements.openIncidents.textContent = formatNumber(open.length);
  elements.avgOpenDays.textContent = avgOpenDays > 0 ? avgOpenDays.toFixed(1) : '0';
  elements.highSeverity.textContent = formatNumber(highSeverity.length);
  elements.highSeverityRate.textContent = total > 0
    ? `${((highSeverity.length / total) * 100).toFixed(1)}%`
    : '0%';
  elements.avgResolution.textContent = avgResolution > 0 ? `${avgResolution.toFixed(1)} วัน` : '-';
  elements.fastClosureRate.textContent = resolved.length > 0
    ? `${((fastClosure / resolved.length) * 100).toFixed(0)}%`
    : '0%';
  elements.sidebarResolved.textContent = formatNumber(resolved.length);
  elements.sidebarOpen.textContent = formatNumber(open.length);
  elements.sidebarClinical.textContent = formatNumber(clinical.length);
}

function daysBetween(data, dateKey) {
  const dates = data
    .map((item) => item[dateKey])
    .filter((value) => value instanceof Date && !Number.isNaN(value));
  if (dates.length === 0) return 7;
  const min = Math.min(...dates.map((date) => date.getTime()));
  const max = Math.max(...dates.map((date) => date.getTime()));
  return Math.max(7, Math.round((max - min) / (1000 * 60 * 60 * 24)));
}

function filterIncidentsWith(customFilters = state.filters) {
  const filters = customFilters;
  return state.incidents.filter((item) => {
    const matchesType = filters.type === 'all' || item.Incident_Type === filters.type;
    const matchesDepartment = filters.department === 'all' || item.Department === filters.department;
    const matchesSeverity = filters.severity === 'all'
      || (item.Severity_Code_Display && String(item.Severity_Code_Display) === filters.severity);

    const incidentDate = item.Incident_Date_Obj;
    const afterStart = !filters.startDate || (incidentDate && incidentDate >= filters.startDate);
    const beforeEnd = !filters.endDate || (incidentDate && incidentDate <= filters.endDate);

    return matchesType && matchesDepartment && matchesSeverity && afterStart && beforeEnd;
  });
}

function applyFilters() {
  state.filtered = filterIncidentsWith(state.filters);
  renderTable();
  updateCharts();
  updateTableSummary();
  calculateKpis(state.filtered);
  updateSidebarFilters();
}

function updateTableSummary() {
  const total = state.filtered.length;
  const open = state.filtered.filter((item) => !item.isResolved).length;
  elements.tableSummary.textContent = `แสดง ${formatNumber(total)} รายการ (กำลังติดตาม ${formatNumber(open)} ราย)`;
}

function updateSidebarFilters() {
  const sidebarFilters = elements.sidebarFilters;
  if (!sidebarFilters || !sidebarFilters.container) return;

  const groups = sidebarFilters.groups || {};
  Object.entries(SIDEBAR_FILTER_CONFIG).forEach(([groupKey, config]) => {
    const groupElements = groups[groupKey];
    if (!groupElements || !groupElements.list) return;

    const baseFilters = { ...state.filters, [config.stateKey]: 'all' };
    const baseData = filterIncidentsWith(baseFilters);
    const counts = new Map();

    baseData.forEach((item) => {
      const meta = config.getOptionMeta(item);
      if (!meta) return;
      const value = meta.value ?? '';
      const label = meta.label ?? (value || 'ไม่ระบุ');
      const key = String(value);
      if (!counts.has(key)) {
        counts.set(key, { value, label, count: 0 });
      }
      counts.get(key).count += 1;
    });

    const options = Array.from(counts.values());
    if (typeof config.sort === 'function') {
      options.sort(config.sort);
    }

    const list = groupElements.list;
    list.innerHTML = '';

    const activeValue = String(state.filters[config.stateKey] ?? 'all');
    list.appendChild(createSidebarFilterButton({
      groupKey,
      label: 'ทั้งหมด',
      value: 'all',
      count: baseData.length,
      isActive: activeValue === 'all'
    }));

    if (options.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'sidebar-filter-empty';
      empty.textContent = 'ไม่มีข้อมูล';
      list.appendChild(empty);
      return;
    }

    options.forEach((option) => {
      const value = option.value ?? '';
      list.appendChild(createSidebarFilterButton({
        groupKey,
        label: option.label,
        value,
        count: option.count,
        isActive: activeValue === String(value)
      }));
    });
  });
}

function createSidebarFilterButton({ groupKey, label, value, count, isActive }) {
  const li = document.createElement('li');
  li.className = 'sidebar-filter-item';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sidebar-filter-option';
  button.dataset.group = groupKey;
  button.dataset.value = value === 'all' ? 'all' : String(value ?? '');
  button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  if (isActive) {
    button.classList.add('active');
  }

  const labelSpan = document.createElement('span');
  labelSpan.className = 'sidebar-filter-label';
  labelSpan.textContent = label;

  const countSpan = document.createElement('span');
  countSpan.className = 'sidebar-filter-count';
  countSpan.textContent = formatNumber(count || 0);

  button.append(labelSpan, countSpan);
  button.addEventListener('click', () => {
    handleSidebarFilterSelection(groupKey, value);
  });

  li.appendChild(button);
  return li;
}

function handleSidebarFilterSelection(groupKey, rawValue) {
  const config = SIDEBAR_FILTER_CONFIG[groupKey];
  if (!config) return;

  const normalized = rawValue === 'all' ? 'all' : String(rawValue ?? '');
  if (state.filters[config.stateKey] === normalized) {
    return;
  }

  state.filters[config.stateKey] = normalized;

  const selectKey = config.selectKey;
  const selectEl = selectKey ? elements[selectKey] : null;
  if (selectEl) {
    const hasOption = Array.from(selectEl.options).some((option) => option.value === normalized);
    selectEl.value = hasOption ? normalized : 'all';
  }

  applyFilters();
}

function renderTable() {
  elements.tableBody.innerHTML = '';
  const fragment = document.createDocumentFragment();

  state.filtered.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.Incident_ID}</td>
      <td>${item.Incident_Type}</td>
      <td>${item.Incident_Type_Details}</td>
      <td>${item.Department}</td>
      <td>${item.Severity_Code_Display || '-'}</td>
      <td>${item.Harm_Level_Clinical || '-'}</td>
      <td>${item.Harm_Level_General || '-'}</td>
      <td>${formatThaiDate(item.Incident_Date_Obj)}</td>
      <td>${formatThaiDate(item.Report_Date_Obj)}</td>
      <td>${formatThaiDate(item.Confirmation_Date_Obj)}</td>
      <td>${formatThaiDate(item.Resolution_Date_Obj)}</td>
    `;
    fragment.appendChild(tr);
  });

  elements.tableBody.appendChild(fragment);
}

function createChart(key, config) {
  const ctx = document.getElementById(key);
  if (!ctx) return;
  if (state.charts[key]) {
    state.charts[key].destroy();
  }
  state.charts[key] = new Chart(ctx, config);
}

function updateCategoryDescriptions(categories, descriptions) {
  if (!elements.categoryExplanations) return;

  const container = elements.categoryExplanations;
  container.innerHTML = '';

  const visibleCategories = categories.filter(([name, count]) => {
    if (name === 'ไม่มีข้อมูล') {
      return Boolean(count);
    }
    return true;
  });

  if (visibleCategories.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'chart-explainer__empty';
    emptyMessage.textContent = 'ไม่มีหมวดหมู่ที่จะแสดง';
    container.appendChild(emptyMessage);
    return;
  }

  const title = document.createElement('h4');
  title.className = 'chart-explainer__title';
  title.textContent = 'คำอธิบายรหัสที่แสดง';
  container.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'chart-explainer__list';

  visibleCategories.forEach(([code]) => {
    const item = document.createElement('li');
    item.className = 'chart-explainer__item';

    const codeSpan = document.createElement('span');
    codeSpan.className = 'chart-explainer__code';
    codeSpan.textContent = code;

    const descriptionSpan = document.createElement('span');
    descriptionSpan.className = 'chart-explainer__description';
    descriptionSpan.textContent = descriptions[code] || 'ไม่มีคำอธิบาย';

    item.append(codeSpan, descriptionSpan);
    list.appendChild(item);
  });

  container.appendChild(list);
}

function initTrendControls() {
  if (!elements.trendRange) return;
  state.trendPeriod = elements.trendRange.value || state.trendPeriod;
  elements.trendRange.addEventListener('change', (event) => {
    state.trendPeriod = event.target.value;
    updateCharts();
  });
}

function getTrendSeries(data) {
  const now = new Date();
  const period = state.trendPeriod;

  if (period === 'day') {
    const days = 30;
    const values = new Array(days).fill(0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (days - 1));

    data.forEach((item) => {
      const date = item.Incident_Date_Obj;
      if (!date) return;
      const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      if (normalized < start || normalized > end) return;
      const diffDays = Math.round((normalized - start) / MS_IN_DAY);
      if (diffDays >= 0 && diffDays < values.length) {
        values[diffDays] += 1;
      }
    });

    const labels = values.map((_, index) => {
      const labelDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const day = labelDate.getDate().toString().padStart(2, '0');
      return `${day} ${THAI_MONTHS_SHORT[labelDate.getMonth()]}`;
    });

    return {
      labels,
      values,
      subtitle: `${formatThaiDate(start)} - ${formatThaiDate(end)}`
    };
  }

  if (period === 'quarter') {
    const timeline = [];
    let currentYear = now.getFullYear();
    let currentQuarter = Math.floor(now.getMonth() / 3);

    for (let i = 0; i < 4; i += 1) {
      timeline.push({ year: currentYear, quarter: currentQuarter });
      currentQuarter -= 1;
      if (currentQuarter < 0) {
        currentQuarter = 3;
        currentYear -= 1;
      }
    }

    timeline.reverse();

    const values = new Array(timeline.length).fill(0);
    const indexMap = new Map();
    timeline.forEach((periodInfo, index) => {
      indexMap.set(`${periodInfo.year}-${periodInfo.quarter}`, index);
    });

    data.forEach((item) => {
      const date = item.Incident_Date_Obj;
      if (!date) return;
      const key = `${date.getFullYear()}-${Math.floor(date.getMonth() / 3)}`;
      const index = indexMap.get(key);
      if (index !== undefined) {
        values[index] += 1;
      }
    });

    const labels = timeline.map((periodInfo) => `ไตรมาส ${periodInfo.quarter + 1} / ${periodInfo.year + 543}`);
    const first = timeline[0];
    const last = timeline[timeline.length - 1];
    const subtitle = `ไตรมาส ${first.quarter + 1} ${first.year + 543} - ไตรมาส ${last.quarter + 1} ${last.year + 543}`;

    return { labels, values, subtitle };
  }

  if (period === 'year') {
    const currentYear = now.getFullYear();
    const startYear = currentYear - 4;
    const labels = [];
    const values = [];

    for (let year = startYear; year <= currentYear; year += 1) {
      labels.push(`พ.ศ. ${year + 543}`);
      values.push(0);
    }

    data.forEach((item) => {
      const date = item.Incident_Date_Obj;
      if (!date) return;
      const year = date.getFullYear();
      if (year >= startYear && year <= currentYear) {
        values[year - startYear] += 1;
      }
    });

    return {
      labels,
      values,
      subtitle: `พ.ศ. ${startYear + 543} - ${currentYear + 543}`
    };
  }

  const labels = [...THAI_MONTHS];
  const values = new Array(12).fill(0);
  const year = now.getFullYear();

  data.forEach((item) => {
    const date = item.Incident_Date_Obj;
    if (!date) return;
    if (date.getFullYear() === year) {
      values[date.getMonth()] += 1;
    }
  });

  return {
    labels,
    values,
    subtitle: `ปี ${year + 543}`
  };
}

function updateCharts() {
  const data = state.filtered;

  const { labels: trendLabels, values: trendValues, subtitle: trendSubtitle } = getTrendSeries(data);
  if (elements.trendSubtitle) {
    elements.trendSubtitle.textContent = trendSubtitle;
  }

  createChart('trendChart', {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'จำนวนเหตุการณ์',
        data: trendValues,
        fill: true,
        borderColor: '#5c6cff',
        backgroundColor: 'rgba(92, 108, 255, 0.25)',
        tension: 0.4,
        pointBackgroundColor: '#ff7eb3',
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `จำนวน ${ctx.parsed.y} ราย`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            color: '#2b3a67'
          }
        },
        x: {
          ticks: {
            color: '#4a4a68'
          }
        }
      }
    }
  });

  const severityGroups = data.reduce((acc, item) => {
    const key = getSeverityDisplayValue(item);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const severityEntries = Object.entries(severityGroups).sort((a, b) => compareSeverityValues(a[0], b[0]));
  const severityLabels = severityEntries.map(([key]) => key);
  const severityValues = severityEntries.map(([, value]) => value);
  if (severityLabels.length === 0) {
    severityLabels.push('ไม่มีข้อมูล');
    severityValues.push(0);
  }

  const severityPalette = ['#5c6cff', '#ff9f43', '#845ef7', '#2ec4b6', '#ff7eb3', '#ffd166', '#06d6a0'];

  createChart('severityChart', {
    type: 'doughnut',
    data: {
      labels: severityLabels,
      datasets: [{
        data: severityValues,
        backgroundColor: severityLabels.map((_, index) => severityPalette[index % severityPalette.length]),
        borderWidth: 0
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#2b3a67'
          }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `ระดับ ${ctx.label}: ${ctx.parsed} ราย`
          }
        }
      }
    }
  });

  const categoryDescriptions = data.reduce((acc, item) => {
    const rawCode = (item.Incident_Type || '').trim();
    const code = rawCode || 'ไม่ระบุรหัส';
    if (acc[code]) return acc;
    const detail = (item.Incident_Type_Details || '').trim();
    if (!detail) return acc;
    acc[code] = detail.replace(/[:：]\s*$/, '').trim() || detail;
    return acc;
  }, {});

  const categoryCounts = data.reduce((acc, item) => {
    const code = (item.Incident_Type || '').trim() || 'ไม่ระบุรหัส';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (sortedCategories.length === 0) {
    sortedCategories.push(['ไม่มีข้อมูล', 0]);
  }

  updateCategoryDescriptions(sortedCategories, categoryDescriptions);

  createChart('categoryChart', {
    type: 'bar',
    data: {
      labels: sortedCategories.map(([name]) => name),
      datasets: [{
        label: 'จำนวนเหตุการณ์',
        data: sortedCategories.map(([, count]) => count),
        backgroundColor: ['#ff7eb3', '#ff9f43', '#845ef7', '#2ec4b6', '#5c6cff'],
        borderRadius: 12,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.parsed.x} ราย`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: '#2b3a67', precision: 0 }
        },
        y: {
          ticks: { color: '#4a4a68' }
        }
      }
    }
  });
}

function handleFilters() {
  elements.filterType.addEventListener('change', (event) => {
    state.filters.type = event.target.value;
    applyFilters();
  });

  elements.filterDepartment.addEventListener('change', (event) => {
    state.filters.department = event.target.value;
    applyFilters();
  });

  elements.filterSeverity.addEventListener('change', (event) => {
    state.filters.severity = event.target.value;
    applyFilters();
  });

  elements.filterStart.addEventListener('change', (event) => {
    const startDate = event.target.value ? parseDateInput(event.target.value) : null;
    if (startDate) {
      startDate.setHours(0, 0, 0, 0);
    }
    state.filters.startDate = startDate;
    markCustomTimeframe();
    applyFilters();
  });

  elements.filterEnd.addEventListener('change', (event) => {
    const endDate = event.target.value ? parseDateInput(event.target.value) : null;
    if (endDate) {
      endDate.setHours(23, 59, 59, 999);
    }
    state.filters.endDate = endDate;
    markCustomTimeframe();
    applyFilters();
  });

  elements.resetFilters.addEventListener('click', () => {
    state.filters.type = 'all';
    state.filters.department = 'all';
    state.filters.severity = 'all';
    elements.filterType.value = 'all';
    elements.filterDepartment.value = 'all';
    elements.filterSeverity.value = 'all';
    state.timeframeSelections.day = new Date(TODAY);
    state.timeframeSelections.month = { ...DEFAULT_MONTH_SELECTION };
    state.timeframeSelections.quarter = { ...DEFAULT_QUARTER_SELECTION };
    state.timeframeSelections.year = { ...DEFAULT_YEAR_SELECTION };
    ensureTimeframeInputsReflectState();
    setTimeframe('month', state.timeframeSelections.month);
  });
}

function initSidebarFilters() {
  const sidebarFilters = elements.sidebarFilters;
  if (!sidebarFilters || !sidebarFilters.container) return;

  const groups = sidebarFilters.groups || {};
  Object.values(groups).forEach((group) => {
    if (!group || !group.toggle || !group.list) return;
    const initialExpanded = group.toggle.getAttribute('aria-expanded') === 'true';
    group.list.hidden = !initialExpanded;
    group.toggle.addEventListener('click', () => {
      const expanded = group.toggle.getAttribute('aria-expanded') === 'true';
      group.toggle.setAttribute('aria-expanded', String(!expanded));
      group.list.hidden = expanded;
    });
  });

  updateSidebarFilters();
}

function setupDownload() {
  elements.downloadCsv.addEventListener('click', () => {
    const headers = [
      'Incident_ID',
      'Incident_Type',
      'Incident_Type_Details',
      'Department',
      'Severity_Code',
      'Harm_Level_Clinical',
      'Harm_Level_General',
      'Incident_Date',
      'Discovery_Date',
      'Report_Date',
      'Confirmation_Date',
      'Notification_Date',
      'Status_Date',
      'Resolution_Date'
    ].join(',');
    const rows = state.filtered.map((item) => [
      item.Incident_ID,
      item.Incident_Type,
      item.Incident_Type_Details,
      item.Department,
      item.Severity_Code_Display,
      item.Harm_Level_Clinical,
      item.Harm_Level_General,
      item.Incident_Date,
      item.Discovery_Date,
      item.Report_Date,
      item.Confirmation_Date,
      item.Notification_Date,
      item.Status_Date,
      item.Resolution_Date
    ].map((value) => (value ? `"${String(value).replace(/"/g, '""')}"` : '')).join(','));

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const today = formatThaiDate(new Date()).replace(/[\s/]/g, '_');
    link.download = `รายงาน_IR_${today}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function displayDataRefreshDate() {
  if (state.incidents.length === 0) return;
  const latest = state.incidents.reduce((latestDate, item) => {
    const reportDate = item.Report_Date_Obj;
    if (!reportDate) return latestDate;
    return reportDate > latestDate ? reportDate : latestDate;
  }, state.incidents[0].Report_Date_Obj || new Date());
  const processedAt = new Date();
  elements.dataRefresh.textContent = `ข้อมูลล่าสุด - ${formatThaiDate(latest)} | ประมวลผล ${formatThaiDate(processedAt, true)}`;
}

function populateSelectors() {
  const types = Array.from(new Set(state.incidents.map((item) => item.Incident_Type))).sort();
  const departments = Array.from(new Set(state.incidents.map((item) => item.Department))).sort();
  updateOptions(types, elements.filterType);
  updateOptions(departments, elements.filterDepartment);

  const severityMap = new Map();
  state.incidents.forEach((item) => {
    const value = item.Severity_Code_Display;
    if (!value) return;
    if (!severityMap.has(value)) {
      severityMap.set(value, {
        label: item.isClinical ? `ระดับ ${value} (คลินิก)` : `ระดับ ${value}`,
        type: item.isClinical ? 'clinical' : 'general'
      });
    }
  });

  const severityOptions = Array.from(severityMap.entries())
    .sort((a, b) => compareSeverityValues(a[0], b[0]))
    .map(([value, meta]) => ({ value, label: meta.label }));
  updateOptions(severityOptions, elements.filterSeverity);
}

function handleLogin() {
  const storedId = localStorage.getItem('irUserId');
  if (storedId) {
    elements.userName.textContent = `รหัส ${storedId}`;
    elements.loginOverlay.classList.remove('active');
    elements.loginOverlay.setAttribute('aria-hidden', 'true');
    return;
  }
  elements.loginOverlay.classList.add('active');
  elements.loginOverlay.setAttribute('aria-hidden', 'false');
}

function bindLoginEvents() {
  elements.loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = elements.employeeId.value.trim();
    if (!/^\d{7}$/.test(value)) {
      alert('กรุณากรอกรหัสพนักงาน 7 หลักให้ถูกต้อง');
      return;
    }
    localStorage.setItem('irUserId', value);
    elements.userName.textContent = `รหัส ${value}`;
    elements.loginOverlay.classList.remove('active');
    elements.loginOverlay.setAttribute('aria-hidden', 'true');
    elements.employeeId.value = '';
  });

  elements.logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('irUserId');
    elements.loginOverlay.classList.add('active');
    elements.loginOverlay.setAttribute('aria-hidden', 'false');
  });
}

async function loadData() {
  try {
    const response = await fetch('data/incidents.csv');
    const text = await response.text();
    const records = parseCsv(text);
    const incidents = enrichIncidents(records);
    incidents.sort((a, b) => (b.Incident_Date_Obj || 0) - (a.Incident_Date_Obj || 0));
    state.incidents = incidents;
    state.filtered = incidents;
    populateSelectors();
    applyFilters();
    displayDataRefreshDate();
  } catch (error) {
    console.error('ไม่สามารถโหลดข้อมูลได้', error);
    elements.tableSummary.textContent = 'เกิดข้อผิดพลาดในการโหลดข้อมูล';
  }
}

function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-item');
  navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
    });
  });
}

function init() {
  bindLoginEvents();
  handleLogin();
  handleFilters();
  initSidebarFilters();
  initTimeframeControls();
  initTrendControls();
  setupDownload();
  initNavigation();
  loadData();
}

document.addEventListener('DOMContentLoaded', init);
