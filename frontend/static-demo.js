const demoAppointmentTime = (minutesFromNow) => {
  const appointment = new Date(Date.now() + minutesFromNow * 60 * 1000);
  const localTime = new Date(appointment.getTime() - appointment.getTimezoneOffset() * 60 * 1000);
  return localTime.toISOString().slice(0, 16);
};

window.HOSPITAL_STATIC_DATA = {
  overview: {
    generalBedsAvailable: 7,
    generalBedsTotal: 8,
    icuBedsAvailable: 2,
    icuBedsTotal: 3,
    doctorsAvailable: 3,
    totalDoctors: 4,
    activePatients: 2,
    appointmentsCount: 2,
    bloodUnits: 35,
    lowMedicineCount: 0,
    nextPatientId: 1003
  },
  beds: [
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `G-${index + 1}`,
      type: 'General',
      label: `G-${String(index + 1).padStart(2, '0')}`,
      occupiedBy: index === 0 ? 1001 : null
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      id: `I-${index + 1}`,
      type: 'ICU',
      label: `I-${String(index + 1).padStart(2, '0')}`,
      occupiedBy: index === 0 ? 1002 : null
    }))
  ],
  doctors: [
    { id: 'D-01', name: 'Dr. Maya Chen', specialty: 'General', available: true },
    { id: 'D-02', name: 'Dr. Omar Patel', specialty: 'General', available: true },
    { id: 'D-03', name: 'Dr. Lena Brooks', specialty: 'Critical Care', available: false },
    { id: 'D-04', name: 'Dr. Isaac Reed', specialty: 'Critical Care', available: true }
  ],
  patients: [
    { id: 1001, name: 'Demo Patient A', age: 34, acuity: 2, active: true, doctorId: 'D-01' },
    { id: 1002, name: 'Demo Patient B', age: 57, acuity: 4, active: true, doctorId: 'D-03' }
  ],
  appointments: [
    {
      id: 'DEMO-01',
      patientName: 'Demo Visitor A',
      specialty: 'General',
      time: demoAppointmentTime(45),
      estimatedTime: demoAppointmentTime(45),
      doctorId: 'D-02',
      status: 'scheduled'
    },
    {
      id: 'DEMO-02',
      patientName: 'Demo Visitor B',
      specialty: 'Critical Care',
      time: demoAppointmentTime(90),
      estimatedTime: demoAppointmentTime(90),
      doctorId: 'D-04',
      status: 'scheduled'
    }
  ],
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
