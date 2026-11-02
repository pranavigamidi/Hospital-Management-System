const overviewCards = document.getElementById('overviewCards');
const heroLoad = document.getElementById('heroLoad');
const bedBoard = document.getElementById('bedBoard');
const doctorBoard = document.getElementById('doctorBoard');
const patientBoard = document.getElementById('patientBoard');
const appointmentBoard = document.getElementById('appointmentBoard');
const bloodBoard = document.getElementById('bloodBoard');
const medicineBoard = document.getElementById('medicineBoard');
const toast = document.getElementById('toast');
const nowCalling = document.getElementById('nowCalling');
const inventoryForm = document.getElementById('inventoryForm');
const inventoryTypeSelect = inventoryForm.elements.type;
const inventoryNameSelect = inventoryForm.elements.name;
const apiBaseUrl = (window.HOSPITAL_API_BASE_URL || '').replace(/\/+$/, '');
const inventoryItemsByType = { blood: [], medicine: [] };
let currentDoctors = [];
let dashboardLoadInProgress = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

function renderOverview(data) {
  const overview = data.overview;
  const loadState = overview.activePatients >= 6 ? 'High demand' : overview.activePatients >= 2 ? 'Busy' : 'Stable';
  heroLoad.textContent = loadState;

  const metrics = [
    { label: 'General Beds', value: `${overview.generalBedsAvailable}/${overview.generalBedsTotal}`, sub: 'available' },
    { label: 'ICU Beds', value: `${overview.icuBedsAvailable}/${overview.icuBedsTotal}`, sub: 'available' },
    { label: 'Doctors', value: `${overview.doctorsAvailable}/${overview.totalDoctors}`, sub: 'available' },
    { label: 'Inpatients', value: String(overview.activePatients), sub: 'current' },
    { label: 'Appointments', value: String(overview.appointmentsCount), sub: 'scheduled' },
    { label: 'Blood Units', value: String(overview.bloodUnits), sub: 'in stock' }
  ];

  overviewCards.innerHTML = metrics
    .map(
      (metric) => `
        <article class="metric-card">
          <p>${metric.label}</p>
          <strong>${metric.value}</strong>
          <span>${metric.sub}</span>
        </article>
      `
    )
    .join('');
}

function renderBeds(beds) {
  const grouped = beds.reduce((acc, bed) => {
    acc[bed.type] = acc[bed.type] || [];
    acc[bed.type].push(bed);
    return acc;
  }, {});

  const content = Object.entries(grouped)
    .map(([type, items]) => {
      const rows = items
        .map(
          (bed) => `
            <div class="list-item">
              <div>
                <strong>${bed.label}</strong>
                <span>${bed.occupiedBy ? `Occupied by patient #${bed.occupiedBy}` : 'Available'}</span>
              </div>
              <span class="badge ${bed.occupiedBy ? 'occupied' : 'available'}">${bed.occupiedBy ? 'Occupied' : 'Open'}</span>
            </div>
          `
        )
        .join('');
      return `<div><h3>${escapeHtml(type)}</h3>${rows}</div>`;
    })
    .join('');

  bedBoard.innerHTML = content;
}

function renderDoctors(doctors) {
  const content = doctors
    .map(
      (doctor) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(doctor.name)}</strong>
            <span>${escapeHtml(doctor.specialty)} • ${escapeHtml(doctor.id)}</span>
          </div>
          <span class="badge ${doctor.available ? 'available' : 'occupied'}">${doctor.available ? 'Available' : 'Assigned'}</span>
        </div>
      `
    )
    .join('');

  doctorBoard.innerHTML = content;
}

function renderPatients(patients) {
  if (!patients.length) {
    patientBoard.innerHTML = '<div class="list-item"><span>No active patient records.</span></div>';
    return;
  }

  patientBoard.innerHTML = patients
    .map(
      (patient) => `
        <div class="list-item">
          <div>
            <strong>#${escapeHtml(patient.id)} ${escapeHtml(patient.name)}</strong>
            <span>Age ${patient.age} • Acuity ${patient.acuity} • ${patient.active ? 'Inpatient' : 'Discharged'} • ${patient.doctorId ? `Doctor ${patient.doctorId}` : 'Doctor unassigned'}</span>
          </div>
          <div class="patient-actions">
            ${patient.active ? `<button class="discharge-row-button" type="button" data-discharge-id="${patient.id}">Discharge</button>` : ''}
            <span class="badge ${patient.active ? 'available' : 'warning'}">${patient.active ? 'Active' : 'Discharged'}</span>
          </div>
        </div>
      `
    )
    .join('');
}

function appointmentTimestamp(time) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(time.trim());
  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  const [, year, month, day, hours = '0', minutes = '0'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  return Number.isNaN(date.getTime()) ? Number.MAX_SAFE_INTEGER : date.getTime();
}

function formatAppointmentTime(time) {
  const timestamp = appointmentTimestamp(time);
  if (timestamp === Number.MAX_SAFE_INTEGER) {
    return time;
  }

  const date = new Date(timestamp);
  const options = { month: 'short', day: 'numeric', year: 'numeric' };
  const hasTime = /[T ]\d{2}:\d{2}$/.test(time);
  return date.toLocaleString('en-US', hasTime ? { ...options, hour: 'numeric', minute: '2-digit' } : options);
}

function renderNowCalling(appointments, doctors) {
  const nextByDoctor = new Map();

  for (const appointment of appointments) {
    if (appointment.status === 'completed') {
      continue;
    }

    const timestamp = appointmentTimestamp(appointment.estimatedTime || appointment.time);
    if (timestamp === Number.MAX_SAFE_INTEGER) {
      continue;
    }

    const doctorId = appointment.doctorId || appointment.specialty;
    const nextAppointment = nextByDoctor.get(doctorId);
    if (!nextAppointment || timestamp < nextAppointment.timestamp) {
      nextByDoctor.set(doctorId, { appointment, timestamp });
    }
  }

  const nextAppointments = [...nextByDoctor.values()].sort((first, second) => first.timestamp - second.timestamp);
  const dueAppointments = nextAppointments.filter((item) => item.timestamp <= Date.now());
  let message;

  if (dueAppointments.length) {
    message = dueAppointments
      .map(({ appointment, timestamp }) => {
        const doctorName = doctors.find((doctor) => doctor.id === appointment.doctorId)?.name || appointment.specialty;
        const elapsed = Date.now() - timestamp;
        const targetDuration = 19 * 60 * 1000;
        const durationStatus = elapsed < targetDuration
          ? `<span>19-min target • ${Math.ceil((targetDuration - elapsed) / 60000)} min remaining</span>`
          : `<span class="appointment-duration-overdue" role="alert">${elapsed < targetDuration + 60000 ? '19-minute target reached' : `Over target by ${Math.floor((elapsed - targetDuration) / 60000)} min`} • Mark complete when finished</span>`;

        return `<div class="called-patient"><strong>${escapeHtml(appointment.patientName)}</strong><span>${escapeHtml(doctorName)} • ${escapeHtml(formatAppointmentTime(appointment.estimatedTime || appointment.time))}</span>${durationStatus}</div>`;
      })
      .join('');
  } else if (nextAppointments.length) {
    message = `<span>No patient is due yet. Next appointment at ${formatAppointmentTime(nextAppointments[0].appointment.estimatedTime || nextAppointments[0].appointment.time)}.</span>`;
  } else {
    message = '<span>No upcoming appointments.</span>';
  }

  if (nowCalling.innerHTML !== message) {
    nowCalling.innerHTML = message;
  }
}

function renderAppointments(appointments) {
  if (!appointments.length) {
    appointmentBoard.innerHTML = '<div class="list-item"><span>No scheduled appointments.</span></div>';
    return;
  }

  appointmentBoard.innerHTML = [...appointments]
    .sort((first, second) => appointmentTimestamp(first.time) - appointmentTimestamp(second.time))
    .map(
      (appointment) => `
        <div class="list-item">
          <div>
            <strong>${escapeHtml(appointment.patientName)}</strong>
            <span>${escapeHtml(appointment.specialty)} • ${escapeHtml(formatAppointmentTime(appointment.time))}</span>
          </div>
          <div class="appointment-actions">
            <span class="badge ${appointment.status === 'completed' ? 'available' : 'warning'}">${appointment.status === 'completed' ? 'Completed' : 'Scheduled'}</span>
            ${appointment.status === 'completed' ? '' : `<button class="appointment-complete-button" type="button" data-complete-appointment="${escapeHtml(appointment.id)}">Mark complete</button>`}
          </div>
        </div>
      `
    )
    .join('');
}

function renderInventory(items, target) {
  if (!items.length) {
    target.innerHTML = '<div class="list-item"><span>No inventory items.</span></div>';
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
        <div class="list-item">
          <div>
            <strong>${item.name}</strong>
            <span>${item.unit}</span>
          </div>
          <span class="badge ${item.quantity <= 10 ? 'low' : 'available'}">${item.quantity}</span>
        </div>
      `
    )
    .join('');
}

function updateInventoryNameOptions() {
  const items = inventoryItemsByType[inventoryTypeSelect.value] || [];
  const previousValue = inventoryNameSelect.value;
  const options = items.map(
    (item) => new Option(`${item.name} (${item.quantity} ${item.unit})`, item.name)
  );

  inventoryNameSelect.replaceChildren(new Option('Select an item', ''), ...options);
  inventoryNameSelect.value = items.some((item) => item.name === previousValue) ? previousValue : '';
  inventoryNameSelect.disabled = items.length === 0;
}

inventoryTypeSelect.addEventListener('change', updateInventoryNameOptions);

async function loadDashboard() {
  if (dashboardLoadInProgress) {
    return;
  }
  dashboardLoadInProgress = true;

  try {
    const data = await fetchJson('/api/overview');
    currentDoctors = data.doctors;
    inventoryItemsByType.blood = data.inventory.blood;
    inventoryItemsByType.medicine = data.inventory.medicine;
    updateInventoryNameOptions();
    renderOverview(data);
    renderBeds(data.beds);
    renderDoctors(data.doctors);
    renderPatients(data.patients);
    renderAppointments(data.appointments);
    renderNowCalling(data.appointments, data.doctors);
    renderInventory(data.inventory.blood, bloodBoard);
    renderInventory(data.inventory.medicine, medicineBoard);
  } catch (error) {
    showToast(error.message);
  } finally {
    dashboardLoadInProgress = false;
  }
}

async function initialize() {
  try {
    const config = await fetchJson('/api/config');
    if (config.publicDemo) {
      document.body.classList.add('public-demo');
      const demoNotice = document.getElementById('demoNotice');
      demoNotice.textContent = config.sharedDatabase
        ? 'Public editable demo. Anyone with this link can view and change this fictional data. Never enter real patient or sensitive information.'
        : 'Public read-only demo — fictional sample data only. Do not enter real patient or sensitive information.';
      demoNotice.hidden = false;
      document.getElementById('systemStatus').textContent = config.sharedDatabase ? 'Shared demo' : 'Public demo';
      if (config.readOnly) {
        document.body.classList.add('public-demo-readonly');
      }
    }
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function dischargePatient(patientId) {
  try {
    await fetchJson(`/api/patients/${patientId}/discharge`, {
      method: 'POST'
    });
    showToast('Patient discharged.');
    await loadDashboard();
    return true;
  } catch (error) {
    showToast(error.message);
    return false;
  }
}

patientBoard.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-discharge-id]');
  if (!button) {
    return;
  }

  button.disabled = true;
  const discharged = await dischargePatient(Number(button.dataset.dischargeId));
  if (!discharged) {
    button.disabled = false;
  }
});

document.getElementById('admitForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    name: form.get('name'),
    age: Number(form.get('age')),
    acuity: Number(form.get('acuity'))
  };

  try {
    await fetchJson('/api/patients/admit', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    showToast('Patient admitted successfully.');
    loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById('appointmentForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const payload = {
    patientName: form.get('patientName'),
    specialty: form.get('specialty'),
    time: form.get('time')
  };

  try {
    await fetchJson('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    showToast('Appointment scheduled.');
    loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

appointmentBoard.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-complete-appointment]');
  if (!button) {
    return;
  }

  button.disabled = true;
  try {
    await fetchJson(`/api/appointments/${encodeURIComponent(button.dataset.completeAppointment)}/complete`, {
      method: 'POST'
    });
    showToast('Appointment marked complete.');
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
    button.disabled = false;
  }
});

document.getElementById('dischargeForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const patientId = Number(form.get('patientId'));
  const discharged = await dischargePatient(patientId);
  if (discharged) {
    event.target.reset();
  }
});

document.getElementById('inventoryForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const type = form.get('type');
  const payload = {
    name: form.get('name'),
    change: Number(form.get('change'))
  };

  try {
    await fetchJson(`/api/inventory/${type}`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    event.target.reset();
    updateInventoryNameOptions();
    showToast('Inventory updated.');
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

initialize();
setInterval(loadDashboard, 5000);
