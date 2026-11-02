import java.util.ArrayList;
import java.util.List;
import java.util.Scanner;

public class Main {
    private static final Scanner INPUT = new Scanner(System.in);
    private static final List<Bed> BEDS = new ArrayList<>();
    private static final List<Doctor> DOCTORS = new ArrayList<>();
    private static final List<Patient> PATIENTS = new ArrayList<>();
    private static final List<Appointment> APPOINTMENTS = new ArrayList<>();
    private static final List<StockItem> BLOOD = new ArrayList<>();
    private static final List<StockItem> MEDICINES = new ArrayList<>();
    private static int nextPatientId = 1001;

    public static void main(String[] args) {
        seedResources();
        System.out.println("HOSPITAL RESOURCE MANAGEMENT SYSTEM");
        System.out.println("Live operational console | Changes apply immediately\n");

        boolean running = true;
        while (running) {
            printMenu();
            switch (readInt("Select an option: ", 0, 10)) {
                case 1 -> showDashboard();
                case 2 -> admitEmergencyPatient();
                case 3 -> scheduleAppointment();
                case 4 -> showAppointments();
                case 5 -> showDoctors();
                case 6 -> showBeds();
                case 7 -> manageBloodInventory();
                case 8 -> manageMedicineInventory();
                case 9 -> showPatientRecords();
                case 10 -> dischargePatient();
                case 0 -> running = false;
                default -> System.out.println("Choose an option from the menu.");
            }
            if (running) {
                System.out.println();
            }
        }
        System.out.println("System closed.");
    }

    private static void printMenu() {
        System.out.println("----------------------------------------");
        System.out.println("1. Live operations dashboard");
        System.out.println("2. Emergency admission (automatic allocation)");
        System.out.println("3. Schedule appointment");
        System.out.println("4. Appointment schedule");
        System.out.println("5. Doctor availability");
        System.out.println("6. Bed and ICU availability");
        System.out.println("7. Blood inventory");
        System.out.println("8. Medicine inventory");
        System.out.println("9. Patient records");
        System.out.println("10. Discharge patient");
        System.out.println("0. Exit");
    }

    private static void seedResources() {
        addBeds("General", 8);
        addBeds("ICU", 3);
        DOCTORS.add(new Doctor("Dr. Maya Chen", "General", "D-01"));
        DOCTORS.add(new Doctor("Dr. Omar Patel", "General", "D-02"));
        DOCTORS.add(new Doctor("Dr. Lena Brooks", "Critical Care", "D-03"));
        DOCTORS.add(new Doctor("Dr. Isaac Reed", "Critical Care", "D-04"));
        BLOOD.add(new StockItem("O-", 4, "units"));
        BLOOD.add(new StockItem("O+", 8, "units"));
        BLOOD.add(new StockItem("A-", 3, "units"));
        BLOOD.add(new StockItem("A+", 6, "units"));
        BLOOD.add(new StockItem("B-", 3, "units"));
        BLOOD.add(new StockItem("B+", 5, "units"));
        BLOOD.add(new StockItem("AB-", 2, "units"));
        BLOOD.add(new StockItem("AB+", 4, "units"));
        MEDICINES.add(new StockItem("Paracetamol", 120, "doses"));
        MEDICINES.add(new StockItem("Amoxicillin", 60, "doses"));
        MEDICINES.add(new StockItem("Saline", 45, "bags"));
        MEDICINES.add(new StockItem("Epinephrine", 18, "doses"));
    }

    private static void addBeds(String type, int count) {
        for (int i = 1; i <= count; i++) {
            BEDS.add(new Bed(type, String.format("%s-%02d", type.equals("ICU") ? "I" : "G", i)));
        }
    }

    private static void showDashboard() {
        long availableGeneral = countAvailableBeds("General");
        long availableIcu = countAvailableBeds("ICU");
        long availableDoctors = DOCTORS.stream().filter(doctor -> doctor.available).count();
        long activePatients = PATIENTS.stream().filter(patient -> patient.active).count();
        long lowStock = MEDICINES.stream().filter(item -> item.quantity <= 10).count();
        System.out.println("\nLIVE RESOURCE SNAPSHOT");
        System.out.printf("General beds: %d/%d available%n", availableGeneral, countBeds("General"));
        System.out.printf("ICU beds:     %d/%d available%n", availableIcu, countBeds("ICU"));
        System.out.printf("Doctors:      %d/%d available%n", availableDoctors, DOCTORS.size());
        System.out.printf("Inpatients:   %d%n", activePatients);
        System.out.printf("Appointments: %d scheduled%n", APPOINTMENTS.size());
        System.out.printf("Blood stock:  %d total units%n",
                BLOOD.stream().mapToInt(item -> item.quantity).sum());
        System.out.printf("Low medicine items (10 or fewer): %d%n", lowStock);
    }

    private static void admitEmergencyPatient() {
        System.out.println("\nEMERGENCY ADMISSION");
        String name = readText("Patient name: ");
        int age = readInt("Age: ", 0, 120);
        int acuity = readInt("Acuity (1 = stable, 5 = critical): ", 1, 5);
        boolean needsIcu = acuity >= 4;
        String bedType = needsIcu ? "ICU" : "General";

        Bed bed = BEDS.stream()
                .filter(candidate -> candidate.type.equals(bedType) && candidate.patient == null)
                .findFirst().orElse(null);
        Doctor doctor = DOCTORS.stream()
                .filter(candidate -> candidate.available)
                .filter(candidate -> needsIcu
                        ? candidate.specialty.equals("Critical Care")
                        : candidate.specialty.equals("General"))
                .findFirst().orElse(null);

        if (bed == null || doctor == null) {
            System.out.println("Admission not completed: "
                    + (bed == null ? "no " + bedType + " bed available" : "no matching doctor available")
                    + ". No resources were reserved.");
            return;
        }

        Patient patient = new Patient(nextPatientId++, name, age, acuity, bed, doctor);
        bed.patient = patient;
        doctor.available = false;
        PATIENTS.add(patient);
        System.out.printf("Admitted: Patient #%d | %s | %s bed %s | %s%n",
                patient.id, patient.name, bed.type, bed.label, doctor.name);
    }

    private static void scheduleAppointment() {
        System.out.println("\nSCHEDULE APPOINTMENT");
        String patientName = readText("Patient name: ");
        String specialty = readText("Specialty (General or Critical Care): ");
        String time = readText("Appointment date and time (for example, 2026-10-02 14:30): ");

        Doctor doctor = DOCTORS.stream()
                .filter(candidate -> candidate.specialty.equalsIgnoreCase(specialty.trim()))
                .filter(candidate -> APPOINTMENTS.stream().noneMatch(appointment ->
                        appointment.doctor == candidate && appointment.time.equalsIgnoreCase(time.trim())))
                .findFirst().orElse(null);
        if (doctor == null) {
            System.out.println("No matching doctor or no appointment slot at that time.");
            return;
        }
        APPOINTMENTS.add(new Appointment(patientName, doctor, time.trim()));
        System.out.printf("Appointment scheduled: %s with %s (%s)%n", patientName, doctor.name, time.trim());
    }

    private static void showAppointments() {
        System.out.println("\nAPPOINTMENTS");
        if (APPOINTMENTS.isEmpty()) {
            System.out.println("No appointments scheduled.");
            return;
        }
        for (Appointment appointment : APPOINTMENTS) {
            System.out.printf("%-20s  %-22s  %s%n", appointment.time, appointment.patientName,
                    appointment.doctor.name);
        }
    }

    private static void showDoctors() {
        System.out.println("\nDOCTOR AVAILABILITY");
        for (Doctor doctor : DOCTORS) {
            String assignment = doctor.available ? "Available" : "Assigned to inpatient";
            System.out.printf("%-8s  %-20s  %-15s  %s%n", doctor.id, doctor.name, doctor.specialty, assignment);
        }
    }

    private static void showBeds() {
        System.out.println("\nBED AVAILABILITY");
        for (String type : List.of("General", "ICU")) {
            List<Bed> beds = BEDS.stream().filter(bed -> bed.type.equals(type)).toList();
            long available = beds.stream().filter(bed -> bed.patient == null).count();
            System.out.printf("%s: %d/%d available%n", type, available, beds.size());
            for (Bed bed : beds) {
                System.out.printf("  %-8s %s%n", bed.label,
                        bed.patient == null ? "Available" : "Occupied by #" + bed.patient.id + " " + bed.patient.name);
            }
        }
    }

    private static void manageBloodInventory() {
        manageInventory("BLOOD INVENTORY", BLOOD);
    }

    private static void manageMedicineInventory() {
        manageInventory("MEDICINE INVENTORY", MEDICINES);
    }

    private static void manageInventory(String title, List<StockItem> inventory) {
        System.out.println("\n" + title);
        for (int i = 0; i < inventory.size(); i++) {
            StockItem item = inventory.get(i);
            System.out.printf("%2d. %-18s %4d %s%n", i + 1, item.name, item.quantity, item.unit);
        }
        System.out.println(" 0. Return to menu");
        int selection = readInt("Select an item to update: ", 0, inventory.size());
        if (selection == 0) {
            return;
        }
        StockItem item = inventory.get(selection - 1);
        int change = readInt("Quantity change (positive to receive, negative to dispense): ",
                -item.quantity, 10000);
        item.quantity += change;
        System.out.printf("Updated %s: %d %s on hand%n", item.name, item.quantity, item.unit);
        if (item.quantity <= 10) {
            System.out.println("LOW STOCK: replenishment may be needed.");
        }
    }

    private static void showPatientRecords() {
        System.out.println("\nPATIENT RECORDS");
        if (PATIENTS.isEmpty()) {
            System.out.println("No patient records yet.");
            return;
        }
        for (Patient patient : PATIENTS) {
            System.out.printf("#%-5d %-22s Age %d | acuity %d | %-10s | %s | %s%n",
                    patient.id, patient.name, patient.age, patient.acuity,
                    patient.active ? "Inpatient" : "Discharged", patient.bed.label, patient.doctor.name);
        }
    }

    private static void dischargePatient() {
        List<Patient> activePatients = PATIENTS.stream().filter(patient -> patient.active).toList();
        System.out.println("\nDISCHARGE PATIENT");
        if (activePatients.isEmpty()) {
            System.out.println("There are no active inpatients.");
            return;
        }
        for (Patient patient : activePatients) {
            System.out.printf("#%d  %-22s  %s%n", patient.id, patient.name, patient.bed.label);
        }
        int id = readInt("Patient ID to discharge (0 to cancel): ", 0, Integer.MAX_VALUE);
        if (id == 0) {
            return;
        }
        Patient patient = activePatients.stream().filter(candidate -> candidate.id == id).findFirst().orElse(null);
        if (patient == null) {
            System.out.println("No active inpatient found with that ID.");
            return;
        }
        patient.active = false;
        patient.bed.patient = null;
        patient.doctor.available = true;
        System.out.printf("Patient #%d discharged. %s and %s are available again.%n",
                patient.id, patient.bed.label, patient.doctor.name);
    }

    private static long countAvailableBeds(String type) {
        return BEDS.stream().filter(bed -> bed.type.equals(type) && bed.patient == null).count();
    }

    private static long countBeds(String type) {
        return BEDS.stream().filter(bed -> bed.type.equals(type)).count();
    }

    private static String readText(String prompt) {
        while (true) {
            System.out.print(prompt);
            String value = INPUT.nextLine().trim();
            if (!value.isEmpty()) {
                return value;
            }
            System.out.println("Please enter a value.");
        }
    }

    private static int readInt(String prompt, int minimum, int maximum) {
        while (true) {
            System.out.print(prompt);
            try {
                int value = Integer.parseInt(INPUT.nextLine().trim());
                if (value >= minimum && value <= maximum) {
                    return value;
                }
            } catch (NumberFormatException ignored) {
                // Re-prompt below for non-numeric input.
            }
            System.out.printf("Enter a whole number from %d to %d.%n", minimum, maximum);
        }
    }

    private static class Bed {
        private final String type;
        private final String label;
        private Patient patient;

        private Bed(String type, String label) {
            this.type = type;
            this.label = label;
        }
    }

    private static class Doctor {
        private final String name;
        private final String specialty;
        private final String id;
        private boolean available = true;

        private Doctor(String name, String specialty, String id) {
            this.name = name;
            this.specialty = specialty;
            this.id = id;
        }
    }

    private static class Patient {
        private final int id;
        private final String name;
        private final int age;
        private final int acuity;
        private final Bed bed;
        private final Doctor doctor;
        private boolean active = true;

        private Patient(int id, String name, int age, int acuity, Bed bed, Doctor doctor) {
            this.id = id;
            this.name = name;
            this.age = age;
            this.acuity = acuity;
            this.bed = bed;
            this.doctor = doctor;
        }
    }

    private static class Appointment {
        private final String patientName;
        private final Doctor doctor;
        private final String time;

        private Appointment(String patientName, Doctor doctor, String time) {
            this.patientName = patientName;
            this.doctor = doctor;
            this.time = time;
        }
    }

    private static class StockItem {
        private final String name;
        private final String unit;
        private int quantity;

        private StockItem(String name, int quantity, String unit) {
            this.name = name;
            this.quantity = quantity;
            this.unit = unit;
        }
    }
}