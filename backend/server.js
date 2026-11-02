const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'hospital.json');
const publicDemo = process.env.PUBLIC_DEMO === 'true';
const supabaseUrl = process.env.SUPABASE_URL && process.env.SUPABASE_URL.replace(/\/+$/, '');
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sharedDatabase = Boolean(supabaseUrl && supabaseServiceRoleKey);

if (Boolean(supabaseUrl) !== Boolean(supabaseServiceRoleKey)) {
  throw new Error('Set both SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to enable shared cloud storage.');
}

if (publicDemo && process.env.NODE_ENV === 'production' && !sharedDatabase) {
  throw new Error('Public demo deployments require Supabase shared storage. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const defaultState = {
  nextPatientId: 1001,
  beds: [
    ...Array.from({ length: 8 }, (_, index) => ({ id: `G-${index + 1}`, type: 'General', label: `G-${String(index + 1).padStart(2, '0')}`, occupiedBy: null })),
    ...Array.from({ length: 3 }, (_, index) => ({ id: `I-${index + 1}`, type: 'ICU', label: `I-${String(index + 1).padStart(2, '0')}`, occupiedBy: null }))
  ],
  doctors: [
    { id: 'D-01', name: 'Dr. Maya Chen', specialty: 'General', available: true },
    { id: 'D-02', name: 'Dr. Omar Patel', specialty: 'General', available: true },
    { id: 'D-03', name: 'Dr. Lena Brooks', specialty: 'Critical Care', available: true },
    { id: 'D-04', name: 'Dr. Isaac Reed', specialty: 'Critical Care', available: true }
  ],
  patients: [],
  appointments: [],
  inventory: {
    blood: [
      { name: 'O-', quantity: 4, unit: 'units' },
      { name: 'O+', quantity: 8, unit: 'units' },
      { name: 'A-', quantity: 3, unit: 'units' },
      { name: 'A+', quantity: 6, unit: 'units' },
      { name: 'B-', quantity: 3, unit: 'units' },
      { name: 'B+', quantity: 5, unit: 'units' },
      { name: 'AB-', quantity: 2, unit: 'units' },
      { name: 'AB+', quantity: 4, unit: 'units' }
    ],
    medicine: [
      { name: 'Paracetamol', quantity: 120, unit: 'doses' },
      { name: 'Amoxicillin', quantity: 60, unit: 'doses' },
      { name: 'Saline', quantity: 45, unit: 'bags' },
      { name: 'Epinephrine', quantity: 18, unit: 'doses' }
    ]
  }
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(defaultState, null, 2));
  }
}

function loadState() {
  if (publicDemo || sharedDatabase) {
    return structuredClone(defaultState);
  }

  ensureDataFile();
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    if (!raw.trim()) {
      return structuredClone(defaultState);
    }
    return JSON.parse(raw);
  } catch (error) {
    console.error('Failed to read state file. Resetting to defaults.');
    return structuredClone(defaultState);
  }
}

let state = loadState();

let saveQueue = Promise.resolve();

function saveState() {
  if (!sharedDatabase) {
    if (publicDemo) {
      return Promise.resolve();
    }
    fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
    return Promise.resolve();
  }

  const snapshot = structuredClone(state);
  saveQueue = saveQueue.catch(() => {}).then(async () => {
    const response = await fetch(`${supabaseUrl}/rest/v1/hospital_demo_state?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: supabaseServiceRoleKey,
        Authorization: `Bearer ${supabaseServiceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ id: 'default', state: snapshot, updated_at: new Date().toISOString() })
    });
    if (!response.ok) {
      throw new Error(`Shared database save failed (${response.status}): ${await response.text()}`);
    }
  });
  return saveQueue;
}

async function initializeSharedState() {
  if (!sharedDatabase) {
    return;
  }

  const headers = {
    apikey: supabaseServiceRoleKey,
    Authorization: `Bearer ${supabaseServiceRoleKey}`
  };
  const selectUrl = `${supabaseUrl}/rest/v1/hospital_demo_state?id=eq.default&select=state`;
  let response = await fetch(selectUrl, { headers });
  if (!response.ok) {
    throw new Error(`Shared database read failed (${response.status}): ${await response.text()}`);
  }

  let rows = await response.json();
  if (rows.length === 0) {
    response = await fetch(`${supabaseUrl}/rest/v1/hospital_demo_state?on_conflict=id`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=minimal'
      },
      body: JSON.stringify({ id: 'default', state: defaultState })
    });
    if (!response.ok) {
      throw new Error(`Shared database initialization failed (${response.status}): ${await response.text()}`);
    }

    response = await fetch(selectUrl, { headers });
    if (!response.ok) {
      throw new Error(`Shared database read failed (${response.status}): ${await response.text()}`);
    }
    rows = await response.json();
  }

  if (!rows[0] || !rows[0].state) {
    throw new Error('Shared database is missing the demo state row.');
  }
  state = rows[0].state;
}

function getAvailableDoctor(specialty) {
  return state.doctors.find((doctor) => doctor.specialty === specialty && doctor.available);
}

function getFirstAvailableBed(type) {
  return state.beds.find((bed) => bed.type === type && !bed.occupiedBy);
}

function countAvailableBeds(type) {
  return state.beds.filter((bed) => bed.type === type && !bed.occupiedBy).length;
}

function countTotalBeds(type) {
  return state.beds.filter((bed) => bed.type === type).length;
}

function normalizeAppointmentTime(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, year, month, day, hours = '00', minutes = '00'] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hours) ||
    date.getMinutes() !== Number(minutes)
  ) {
    return null;
  }

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getAppointmentTime(appointment) {
  return appointment.estimatedTime || appointment.time;
}

function addMinutesToAppointmentTime(appointmentTime, minutes) {
  const date = new Date(Date.parse(appointmentTime) + minutes * 60 * 1000);
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function hasAppointmentGap(doctorId, appointmentTime, excludedAppointmentId = null) {
  const requestedTimestamp = Date.parse(appointmentTime);
  const minimumGap = 20 * 60 * 1000;

  return state.appointments.every((appointment) => {
    if (appointment.id === excludedAppointmentId || appointment.doctorId !== doctorId || appointment.status === 'completed') {
      return true;
    }

    const existingTime = normalizeAppointmentTime(getAppointmentTime(appointment));
    if (!existingTime) {
      return true;
    }

    return Math.abs(Date.parse(existingTime) - requestedTimestamp) >= minimumGap;
  });
}

function buildOverview() {
  return {
    generalBedsAvailable: countAvailableBeds('General'),
    generalBedsTotal: countTotalBeds('General'),
    icuBedsAvailable: countAvailableBeds('ICU'),
    icuBedsTotal: countTotalBeds('ICU'),
    doctorsAvailable: state.doctors.filter((doctor) => doctor.available).length,
    totalDoctors: state.doctors.length,
    activePatients: state.patients.filter((patient) => patient.active).length,
    appointmentsCount: state.appointments.filter((appointment) => appointment.status !== 'completed').length,
    bloodUnits: state.inventory.blood.reduce((sum, item) => sum + item.quantity, 0),
    lowMedicineCount: state.inventory.medicine.filter((item) => item.quantity <= 10).length,
    nextPatientId: state.nextPatientId
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  response.end(JSON.stringify(payload));
}

function serveStaticFile(response, requestPath) {
  const safePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '');
  const targetFile = path.join(frontendDir, safePath);

  if (!targetFile.startsWith(frontendDir)) {
    sendJson(response, 403, { message: 'Forbidden' });
    return;
  }

  fs.readFile(targetFile, (error, fileContent) => {
    if (error) {
      if (requestPath === '/') {
        sendJson(response, 404, { message: 'Frontend index not found' });
        return;
      }
      sendJson(response, 404, { message: 'File not found' });
      return;
    }

    const extension = path.extname(targetFile).toLowerCase();
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    };

    response.writeHead(200, {
      'Content-Type': contentTypes[extension] || 'text/plain; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    response.end(fileContent);
  });
}

function parseJsonBody(request, response, callback) {
  let body = '';

  request.on('data', (chunk) => {
    body += chunk;
    if (body.length > 1e6) {
      request.connection.destroy();
    }
  });

  request.on('end', () => {
    if (!body) {
      Promise.resolve(callback({})).catch((error) => handleApiError(response, error));
      return;
    }

    try {
      Promise.resolve(callback(JSON.parse(body))).catch((error) => handleApiError(response, error));
    } catch (error) {
      Promise.resolve(callback(null)).catch((callbackError) => handleApiError(response, callbackError));
    }
  });
}

function handleApiError(response, error) {
  console.error('API request failed.', error);
  if (!response.headersSent) {
    sendJson(response, 500, { message: 'The request could not be completed. Please try again.' });
  } else {
    response.destroy(error);
  }
}

async function handleApi(request, response) {
  const parsedUrl = new URL(request.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (request.method === 'OPTIONS') {
    response.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }

  if (publicDemo && !sharedDatabase && request.method !== 'GET') {
    sendJson(response, 403, { message: 'This public demo is read-only.' });
    return;
  }

  if (pathname === '/api/config' && request.method === 'GET') {
    sendJson(response, 200, { publicDemo, sharedDatabase, readOnly: publicDemo && !sharedDatabase });
    return;
  }

  if (pathname === '/api/overview' && request.method === 'GET') {
    sendJson(response, 200, {
      overview: buildOverview(),
      beds: state.beds,
      doctors: state.doctors,
      patients: state.patients,
      appointments: state.appointments,
      inventory: state.inventory
    });
    return;
  }

  if (pathname === '/api/beds' && request.method === 'GET') {
    sendJson(response, 200, state.beds);
    return;
  }

  if (pathname === '/api/doctors' && request.method === 'GET') {
    sendJson(response, 200, state.doctors);
    return;
  }

  if (pathname === '/api/patients' && request.method === 'GET') {
    sendJson(response, 200, state.patients);
    return;
  }

  if (pathname === '/api/appointments' && request.method === 'GET') {
    sendJson(response, 200, state.appointments);
    return;
  }

  if (pathname === '/api/inventory/blood' && request.method === 'GET') {
    sendJson(response, 200, state.inventory.blood);
    return;
  }

  if (pathname === '/api/inventory/medicine' && request.method === 'GET') {
    sendJson(response, 200, state.inventory.medicine);
    return;
  }

  if (pathname === '/api/patients/admit' && request.method === 'POST') {
    parseJsonBody(request, response, async (body) => {
      if (
        !body ||
        typeof body.name !== 'string' ||
        !body.name.trim() ||
        body.name.trim().length > 80 ||
        !Number.isInteger(Number(body.age)) ||
        Number(body.age) < 0 ||
        Number(body.age) > 120 ||
        !Number.isInteger(Number(body.acuity)) ||
        Number(body.acuity) < 1 ||
        Number(body.acuity) > 5
      ) {
        sendJson(response, 400, { message: 'Missing patient details.' });
        return;
      }

      const acuity = Number(body.acuity);
      const needsIcu = acuity >= 4;
      const bedType = needsIcu ? 'ICU' : 'General';
      const bed = state.beds.find((item) => item.type === bedType && !item.occupiedBy);
      const specialty = needsIcu ? 'Critical Care' : 'General';
      const doctor = state.doctors.find((item) => item.specialty === specialty && item.available);

      if (!bed) {
        sendJson(response, 409, {
          message: 'Admission failed. No matching bed is available.'
        });
        return;
      }

      const patient = {
        id: state.nextPatientId,
        name: body.name.trim(),
        age: Number(body.age),
        acuity,
        bedId: bed.id,
        doctorId: doctor ? doctor.id : null,
        active: true
      };

      state.nextPatientId += 1;
      state.patients.push(patient);
      bed.occupiedBy = patient.id;
      if (doctor) {
        doctor.available = false;
      }
      await saveState();

      sendJson(response, 201, { message: 'Patient admitted successfully.', patient });
    });
    return;
  }

  if (pathname === '/api/appointments' && request.method === 'POST') {
    parseJsonBody(request, response, async (body) => {
      if (
        !body ||
        typeof body.patientName !== 'string' ||
        !body.patientName.trim() ||
        body.patientName.trim().length > 80 ||
        typeof body.specialty !== 'string' ||
        !body.specialty.trim() ||
        !body.time
      ) {
        sendJson(response, 400, { message: 'Missing appointment details.' });
        return;
      }

      const appointmentTime = normalizeAppointmentTime(body.time);
      if (!appointmentTime) {
        sendJson(response, 400, { message: 'Enter a valid appointment date and time.' });
        return;
      }

      const specialty = body.specialty.trim();
      const appointmentsAtTime = state.appointments.filter(
        (appointment) => appointment.status !== 'completed' && normalizeAppointmentTime(appointment.time) === appointmentTime
      );

      if (appointmentsAtTime.length >= state.doctors.length) {
        sendJson(response, 409, { message: 'All doctors are booked for that date and time.' });
        return;
      }

      const doctor = state.doctors.find(
        (item) => item.specialty.toLowerCase() === specialty.toLowerCase() && item.available && hasAppointmentGap(item.id, appointmentTime)
      );

      if (!doctor) {
        sendJson(response, 409, {
          message: 'No available doctor of that specialty has a 20-minute gap around this time. Choose another time or complete an existing appointment.'
        });
        return;
      }

      const appointment = {
        id: `${Date.now()}`,
        patientName: body.patientName.trim(),
        specialty,
        time: appointmentTime,
        estimatedTime: appointmentTime,
        doctorId: doctor.id,
        status: 'scheduled'
      };

      state.appointments.push(appointment);
      await saveState();
      sendJson(response, 201, { message: 'Appointment scheduled.', appointment });
    });
    return;
  }

  if (pathname.startsWith('/api/appointments/') && pathname.endsWith('/delay') && request.method === 'POST') {
    const appointmentId = pathname.split('/')[3];
    const appointment = state.appointments.find((item) => item.id === appointmentId);

    if (!appointment) {
      sendJson(response, 404, { message: 'Appointment not found.' });
      return;
    }

    if (appointment.status === 'completed') {
      sendJson(response, 409, { message: 'A completed appointment cannot be delayed.' });
      return;
    }

    parseJsonBody(request, response, async (body) => {
      const delayMinutes = Number(body && body.delayMinutes);
      if (!Number.isInteger(delayMinutes) || delayMinutes < 5 || delayMinutes > 240) {
        sendJson(response, 400, { message: 'Delay must be between 5 and 240 minutes.' });
        return;
      }

      const currentTime = normalizeAppointmentTime(getAppointmentTime(appointment));
      if (!currentTime) {
        sendJson(response, 409, { message: 'This appointment has an invalid scheduled time.' });
        return;
      }

      const currentTimestamp = Date.parse(currentTime);
      const affectedAppointments = state.appointments.filter((item) => {
        if (item.doctorId !== appointment.doctorId || item.status === 'completed') {
          return false;
        }

        const itemTime = normalizeAppointmentTime(getAppointmentTime(item));
        return itemTime && Date.parse(itemTime) >= currentTimestamp;
      });

      for (const item of affectedAppointments) {
        const itemTime = normalizeAppointmentTime(getAppointmentTime(item));
        item.estimatedTime = addMinutesToAppointmentTime(itemTime, delayMinutes);
        item.delayMinutes = (Number(item.delayMinutes) || 0) + delayMinutes;
        item.status = 'delayed';
      }

      await saveState();
      sendJson(response, 200, {
        message: `Appointment and ${affectedAppointments.length - 1} later appointment(s) delayed by ${delayMinutes} minutes.`,
        affectedAppointments
      });
    });
    return;
  }

  if (pathname.startsWith('/api/appointments/') && pathname.endsWith('/reassign') && request.method === 'POST') {
    const appointmentId = pathname.split('/')[3];
    const appointment = state.appointments.find((item) => item.id === appointmentId);

    if (!appointment) {
      sendJson(response, 404, { message: 'Appointment not found.' });
      return;
    }

    if (appointment.status === 'completed') {
      sendJson(response, 409, { message: 'A completed appointment cannot be reassigned.' });
      return;
    }

    parseJsonBody(request, response, async (body) => {
      const doctor = state.doctors.find((item) => item.id === (body && body.doctorId));
      if (!doctor || doctor.specialty.toLowerCase() !== appointment.specialty.toLowerCase()) {
        sendJson(response, 400, { message: 'Choose a doctor with the matching specialty.' });
        return;
      }

      if (!doctor.available) {
        sendJson(response, 409, { message: 'That doctor is currently assigned to an inpatient.' });
        return;
      }

      if (doctor.id === appointment.doctorId) {
        sendJson(response, 200, { message: 'This doctor is already assigned to the appointment.', appointment });
        return;
      }

      const appointmentTime = normalizeAppointmentTime(getAppointmentTime(appointment));
      if (!appointmentTime || !hasAppointmentGap(doctor.id, appointmentTime, appointment.id)) {
        sendJson(response, 409, { message: 'That doctor has another appointment too close to this time.' });
        return;
      }

      appointment.doctorId = doctor.id;
      appointment.reassignedAt = new Date().toISOString();
      await saveState();
      sendJson(response, 200, { message: `Appointment reassigned to ${doctor.name}.`, appointment });
    });
    return;
  }

  if (pathname.startsWith('/api/appointments/') && pathname.endsWith('/complete') && request.method === 'POST') {
    const appointmentId = pathname.split('/')[3];
    const appointment = state.appointments.find((item) => item.id === appointmentId);

    if (!appointment) {
      sendJson(response, 404, { message: 'Appointment not found.' });
      return;
    }

    if (appointment.status !== 'completed') {
      appointment.status = 'completed';
      appointment.completedAt = new Date().toISOString();
      await saveState();
    }

    sendJson(response, 200, { message: 'Appointment marked complete.', appointment });
    return;
  }

  if (pathname.startsWith('/api/patients/') && pathname.endsWith('/discharge') && request.method === 'POST') {
    const patientId = Number(pathname.split('/')[3]);
    const patient = state.patients.find((item) => item.id === patientId && item.active);

    if (!patient) {
      sendJson(response, 404, { message: 'No active patient found with that ID.' });
      return;
    }

    const bed = state.beds.find((item) => item.id === patient.bedId);
    const doctor = state.doctors.find((item) => item.id === patient.doctorId);

    patient.active = false;
    if (bed) {
      bed.occupiedBy = null;
    }
    if (doctor) {
      doctor.available = true;
    }
    await saveState();

    sendJson(response, 200, {
      message: 'Patient discharged successfully.',
      patient,
      bed,
      doctor
    });
    return;
  }

  if (pathname.startsWith('/api/inventory/') && request.method === 'POST') {
    parseJsonBody(request, response, async (body) => {
      const inventoryType = pathname.split('/')[3];
      if (!body || typeof body.name !== 'string' || !body.name.trim() || body.change === undefined || body.change === null || body.change === '') {
        sendJson(response, 400, { message: 'Missing inventory update details.' });
        return;
      }

      const change = Number(body.change);
      if (!Number.isSafeInteger(change)) {
        sendJson(response, 400, { message: 'Quantity change must be a whole number.' });
        return;
      }

      const list = state.inventory[inventoryType];
      if (!list) {
        sendJson(response, 400, { message: 'Invalid inventory type.' });
        return;
      }

      const item = list.find((entry) => entry.name === body.name.trim());
      if (!item) {
        sendJson(response, 404, { message: 'Inventory item not found.' });
        return;
      }

      item.quantity = Math.max(0, item.quantity + change);
      await saveState();
      sendJson(response, 200, { message: 'Inventory updated.', item });
    });
    return;
  }

  if (pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok', uptime: process.uptime() });
    return;
  }

  sendJson(response, 404, { message: 'Not found' });
}

const server = http.createServer((request, response) => {
  const parsedUrl = new URL(request.url, 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    handleApi(request, response).catch((error) => handleApiError(response, error));
    return;
  }

  serveStaticFile(response, pathname);
});

const port = process.env.PORT || 3000;
initializeSharedState().then(() => server.listen(port, () => {
  console.log(`Hospital Resource Management running at http://localhost:${port}`);
  console.log(sharedDatabase ? 'Shared storage: Supabase' : `Persistent data file: ${dataFile}`);
})).catch((error) => {
  console.error('Unable to initialize shared storage.', error);
  process.exitCode = 1;
});
