# Hospital-Management-System
A Java-based Hospital Management System designed to streamline hospital operations through real-time bed availability tracking, medical inventory management, and efficient patient appointment scheduling. The system aims to improve resource utilization, simplify administrative workflows, and enhance the overall patient experience.

## Run the website

Requirements: Node.js 20 or newer. No npm packages are required.

From the repository root, run:

```powershell
cd backend
npm start
```

Open <http://localhost:3000>. Stop the server with `Ctrl+C`.

The backend creates `backend/data/hospital.json` on its first run. Patient admissions, appointments, resource availability, and inventory changes are saved locally and remain after restarting the server.

## Project layout

- `backend/server.js` — HTTP server, REST API, validation, automatic allocation, and JSON-file persistence.
- `backend/package.json` — backend run scripts.
- `backend/data/hospital.json` — created automatically; local application data and excluded from Git.
- `frontend/index.html` — website entry point.
- `frontend/styles.css` — responsive interface styling.
- `frontend/app.js` — browser UI and API client.
- `src/Main.java` — standalone Java console application.

This is a learning/demo application, not a production clinical system. It has no user authentication, authorization, or audit-grade storage. Use fictional data only; never enter real patient or other sensitive information.
