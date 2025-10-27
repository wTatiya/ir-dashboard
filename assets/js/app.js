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

const state = {
  incidents: [],
  filtered: [],
  charts: {},
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
  profileDepartment: document.getElementById('profileDepartment'),
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
  filterType: document.getElementById('filterType'),
  filterDepartment: document.getElementById('filterDepartment'),
  filterSeverity: document.getElementById('filterSeverity'),
  filterStart: document.getElementById('filterStart'),
  filterEnd: document.getElementById('filterEnd'),
  resetFilters: document.getElementById('resetFilters'),
  downloadCsv: document.getElementById('downloadCsv')
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

    return {
      ...item,
      Incident_Date_Obj: incidentDate,
      Report_Date_Obj: reportDate,
      Resolution_Date_Obj: resolutionDate,
      Confirmation_Date_Obj: confirmationDate,
      Severity_Code_Num: Number(item.Severity_Code) || null,
      isClinical: item.Incident_Type.includes('คลินิก'),
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
    opt.value = option;
    opt.textContent = option;
    selectEl.appendChild(opt);
  });
}

function calculateKpis(data) {
  const total = data.length;
  const open = data.filter((item) => !item.isResolved);
  const resolved = data.filter((item) => item.isResolved);
  const highSeverity = data.filter((item) => (item.Severity_Code_Num || 0) >= 4);
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

function applyFilters() {
  const { filters, incidents } = state;
  state.filtered = incidents.filter((item) => {
    const matchesType = filters.type === 'all' || item.Incident_Type === filters.type;
    const matchesDepartment = filters.department === 'all' || item.Department === filters.department;
    const matchesSeverity = filters.severity === 'all' || String(item.Severity_Code_Num) === filters.severity;

    const incidentDate = item.Incident_Date_Obj;
    const afterStart = !filters.startDate || (incidentDate && incidentDate >= filters.startDate);
    const beforeEnd = !filters.endDate || (incidentDate && incidentDate <= filters.endDate);

    return matchesType && matchesDepartment && matchesSeverity && afterStart && beforeEnd;
  });

  renderTable();
  updateCharts();
  updateTableSummary();
  calculateKpis(state.filtered);
}

function updateTableSummary() {
  const total = state.filtered.length;
  const open = state.filtered.filter((item) => !item.isResolved).length;
  elements.tableSummary.textContent = `แสดง ${formatNumber(total)} รายการ (กำลังติดตาม ${formatNumber(open)} ราย)`;
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
      <td>${item.Severity_Code}</td>
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

function getLast12MonthsLabels() {
  const labels = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    labels.push(`${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`);
  }
  return labels;
}

function updateCharts() {
  const data = state.filtered;

  const trendLabels = getLast12MonthsLabels();
  const monthlyCounts = new Array(12).fill(0);
  const now = new Date();

  data.forEach((item) => {
    const date = item.Incident_Date_Obj;
    if (!date) return;
    const diffMonths = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
    if (diffMonths >= 0 && diffMonths < 12) {
      monthlyCounts[11 - diffMonths] += 1;
    }
  });

  createChart('trendChart', {
    type: 'line',
    data: {
      labels: trendLabels,
      datasets: [{
        label: 'จำนวนเหตุการณ์',
        data: monthlyCounts,
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
    const key = item.Severity_Code || 'ไม่ระบุ';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const severityLabels = Object.keys(severityGroups);
  const severityValues = Object.values(severityGroups);
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

  const categoryCounts = data.reduce((acc, item) => {
    acc[item.Incident_Type] = (acc[item.Incident_Type] || 0) + 1;
    return acc;
  }, {});
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (sortedCategories.length === 0) {
    sortedCategories.push(['ไม่มีข้อมูล', 0]);
  }

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
    state.filters.startDate = event.target.value ? new Date(event.target.value) : null;
    applyFilters();
  });

  elements.filterEnd.addEventListener('change', (event) => {
    if (event.target.value) {
      const endDate = new Date(event.target.value);
      endDate.setHours(23, 59, 59, 999);
      state.filters.endDate = endDate;
    } else {
      state.filters.endDate = null;
    }
    applyFilters();
  });

  elements.resetFilters.addEventListener('click', () => {
    state.filters = { type: 'all', department: 'all', severity: 'all', startDate: null, endDate: null };
    elements.filterType.value = 'all';
    elements.filterDepartment.value = 'all';
    elements.filterSeverity.value = 'all';
    elements.filterStart.value = '';
    elements.filterEnd.value = '';
    applyFilters();
  });
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
      item.Severity_Code,
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
}

function handleLogin() {
  const storedId = localStorage.getItem('irUserId');
  if (storedId) {
    elements.userName.textContent = `รหัส ${storedId}`;
    elements.profileDepartment.textContent = 'ข้อมูลรวมทั้งหมด';
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
    elements.profileDepartment.textContent = 'ข้อมูลรวมทั้งหมด';
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
    calculateKpis(incidents);
    renderTable();
    updateCharts();
    updateTableSummary();
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
  setupDownload();
  initNavigation();
  loadData();
}

document.addEventListener('DOMContentLoaded', init);
