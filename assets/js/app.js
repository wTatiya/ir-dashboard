// IR Dashboard front-end logic
// Fetches CSV if present. Falls back to demo data.
// Renders 1) KPIs 2) trend line 3) donut 4) table

function csvToJSON(csv) {
  const [header, ...rows] = csv.trim().split(/\r?\n/);
  const keys = header.split(',');
  return rows.map(r => {
    const cells = r.split(',');
    const obj = {};
    keys.forEach((k,i)=>obj[k]=cells[i]);
    return obj;
  });
}

async function loadData() {
  try {
    const res = await fetch('data/incidents.csv', {cache:'no-store'});
    if (!res.ok) throw new Error('no csv');
    const txt = await res.text();
    return csvToJSON(txt);
  } catch {
    // fallback demo data
    return [
      {Incident_ID:'2511000089', Incident_Type:'GOP201', Incident_Type_Details:'Process gap', Location:'Burn Unit', Related_Location:'', Severity_Code:'1', Harm_Level:'Low', Incident_Status:'Open', Incident_Date:'2025-11-05', Report_Date:'2025-11-05', Confirmation_Date:'', Resolution_Date:''},
      {Incident_ID:'2002000396', Incident_Type:'CPE101', Incident_Type_Details:'CPR unplanned', Location:'Med', Related_Location:'', Severity_Code:'E', Harm_Level:'Moderate', Incident_Status:'Closed', Incident_Date:'2020-02-17', Report_Date:'2020-02-28', Confirmation_Date:'2020-03-03', Resolution_Date:'2020-03-20'},
      {Incident_ID:'2001000087', Incident_Type:'CPE401', Incident_Type_Details:'ER wait > 30m', Location:'Med', Related_Location:'Dialysis', Severity_Code:'E', Harm_Level:'Moderate', Incident_Status:'Open', Incident_Date:'2019-12-26', Report_Date:'2020-01-08', Confirmation_Date:'2020-01-08', Resolution_Date:''},
    ];
  }
}

function setKPIs(items){
  const total = items.length;
  const clinical = items.filter(x => /[A-I]/.test(x.Severity_Code)).length;
  const general = items.filter(x => /^[1-5]$/.test(x.Severity_Code)).length;
  const resolved = items.filter(x => x.Resolution_Date && x.Resolution_Date !== '-').length;
  document.getElementById('kpiTotal').textContent = total.toLocaleString('th-TH');
  document.getElementById('kpiClinical').textContent = clinical.toLocaleString('th-TH');
  document.getElementById('kpiGeneral').textContent = general.toLocaleString('th-TH');
  document.getElementById('kpiResolved').textContent = resolved.toLocaleString('th-TH');
  document.getElementById('kpiResolvedRate').textContent = total ? Math.round(resolved*100/total)+'% ปิดเรื่องแล้ว' : '—';
}

function buildTrend(items){
  // Count by month for last 12 months
  const now = new Date();
  const labels = [];
  const counts = [];
  for (let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = d.toISOString().slice(0,7); // yyyy-mm
    labels.push(d.toLocaleString('th-TH',{month:'short'}));
    counts.push(items.filter(x => (x.Incident_Date||'').slice(0,7)===key).length);
  }
  const ctx = document.getElementById('trendLine');
  new Chart(ctx, {
    type:'line',
    data:{labels, datasets:[{label:'จำนวนเหตุการณ์', data:counts, tension:.35}]},
    options:{responsive:true, plugins:{legend:{display:false}}}
  });
}

function buildDonut(items){
  // share by severity bucket
  const buckets = {
    'ความรุนแรงต่ำ': 0,
    'ปานกลาง': 0,
    'รุนแรง': 0,
    'เสียชีวิต': 0,
    'ไม่ระบุ': 0
  };
  items.forEach(x=>{
    const h=(x.Harm_Level||'').toLowerCase();
    if (h.includes('death')) buckets['เสียชีวิต']++;
    else if (h.includes('severe')) buckets['รุนแรง']++;
    else if (h.includes('moderate')) buckets['ปานกลาง']++;
    else if (h.includes('low') || h.includes('น้อย')) buckets['ความรุนแรงต่ำ']++;
    else buckets['ไม่ระบุ']++;
  });
  const labels = Object.keys(buckets);
  const values = Object.values(buckets);
  const total = values.reduce((a,b)=>a+b,0) || 1;
  const pct = Math.round((values[0]/total)*100);
  document.getElementById('donutPct').textContent = pct + '%';
  const ctx = document.getElementById('donut');
  new Chart(ctx, {
    type:'doughnut',
    data:{labels, datasets:[{data:values}]},
    options:{plugins:{legend:{display:false}}, cutout:'65%'}
  });
  // simple legend
  document.getElementById('lgLow').textContent = Math.round(values[0]*100/total)+'%';
  document.getElementById('lgModerate').textContent = Math.round(values[1]*100/total)+'%';
  document.getElementById('lgSevere').textContent = Math.round(values[2]*100/total)+'%';
  document.getElementById('lgDeath').textContent = Math.round(values[3]*100/total)+'%';
  document.getElementById('lgOther').textContent = Math.round(values[4]*100/total)+'%';
}

function translateStatus(status=''){
  const normalized = status.toLowerCase();
  if (normalized.includes('open')) return 'กำลังติดตาม';
  if (normalized.includes('closed')) return 'ปิดแล้ว';
  if (normalized.includes('pending')) return 'รอทบทวน';
  if (normalized.includes('investigation')) return 'อยู่ระหว่างสอบสวน';
  return status || 'ไม่ระบุ';
}

function translateHarmLevel(level=''){
  if (!level) return '';
  const normalized = level.toLowerCase();
  if (normalized.includes('death')) return 'เสียชีวิต';
  if (normalized.includes('severe')) return 'รุนแรง';
  if (normalized.includes('moderate')) return 'ปานกลาง';
  if (normalized.includes('low') || normalized.includes('minor')) return 'ต่ำ';
  if (normalized.includes('other')) return 'อื่น ๆ';
  return level;
}

function updateLastUpdated(items){
  const target = document.getElementById('lastUpdated');
  const dateFields = ['Report_Date','Incident_Date','Confirmation_Date','Resolution_Date'];
  const timestamps = items
    .flatMap(item => dateFields.map(field => item[field]).filter(Boolean))
    .map(value => new Date(value))
    .filter(date => !Number.isNaN(date.getTime()));
  const latest = timestamps.length ? new Date(Math.max(...timestamps.map(d => d.getTime()))) : new Date();
  target.textContent = latest.toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
}

function updateRowCount(count){
  document.getElementById('rowCount').textContent = count.toLocaleString('th-TH');
}

function fillTable(items){
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML='';
  if (!items.length){
    const tr = document.createElement('tr');
    tr.innerHTML = '<td class="empty-state" colspan="7">ไม่พบข้อมูลที่ตรงกับการค้นหา</td>';
    tbody.appendChild(tr);
    updateRowCount(0);
    return;
  }
  items.forEach(x=>{
    const tr = document.createElement('tr');
    const harm = translateHarmLevel(x.Harm_Level || '');
    const severityText = harm ? `${harm}${x.Severity_Code ? ` (${x.Severity_Code})` : ''}` : (x.Severity_Code || 'ไม่ระบุ');
    const statusText = translateStatus(x.Incident_Status || '');
    tr.innerHTML = `<td>${x.Incident_ID||'-'}</td>
      <td>${x.Incident_Type||'-'}</td>
      <td>${x.Incident_Type_Details||'-'}</td>
      <td>${x.Location||'-'}</td>
      <td>${severityText}</td>
      <td>${statusText}</td>` +
      `<td><a href="#" class="btn btn-ghost" title="เปิดรายละเอียดเหตุการณ์">ดูรายละเอียด</a></td>`;
    tbody.appendChild(tr);
  });
  updateRowCount(items.length);
}

// Simple search filter for table
function wireSearch(items){
  const input = document.getElementById('tableSearch');
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    const filtered = items.filter(x =>
      JSON.stringify(x).toLowerCase().includes(q)
    );
    fillTable(filtered);
  });
}

(async function init(){
  const items = await loadData();
  updateLastUpdated(items);
  setKPIs(items);
  buildTrend(items);
  buildDonut(items);
  fillTable(items);
  wireSearch(items);
})();
