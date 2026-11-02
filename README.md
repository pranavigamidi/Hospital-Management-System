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

## Publish a public website

The website can be published at `https://pranavigamidi.github.io/Hospital-Management-System/` using GitHub Pages. The interactive dashboard also needs the Node.js backend and shared Supabase storage; GitHub Pages alone cannot run the API.

1. Create a Supabase project and run `backend/supabase-schema.sql` in its SQL editor.
2. In Render, create a Node.js web service from this repository. Set the root directory to `backend` and the start command to `npm start`.
3. Configure these environment variables on the Render service:
   - `PUBLIC_DEMO=true`
   - `NODE_ENV=production`
   - `SUPABASE_URL` — the Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — the service-role key; keep it private in Render and never add it to GitHub or frontend code.
4. Deploy the Render service and copy its HTTPS service URL.
5. In the GitHub repository, open **Settings → Secrets and variables → Actions → Variables** and add `HOSPITAL_API_BASE_URL` with the Render HTTPS URL (for example, `https://your-service.onrender.com`, without a path).
6. Open **Settings → Pages**, choose **GitHub Actions** as the build and deployment source, then push to `main` or run the **Deploy website to GitHub Pages** workflow.

The GitHub Actions workflow publishes only the `frontend/` directory and injects the configured backend URL during deployment. Its deployment fails with a clear error if `HOSPITAL_API_BASE_URL` is not set.

Anyone with the public link can view and change the same demo data. Use fictional data only; never enter real patient or other sensitive information. Keep the Render service to one running instance. Free hosting plans may sleep and take time to respond.

## Project layout

- `backend/server.js` — HTTP server, REST API, validation, automatic allocation, and JSON-file persistence.
- `backend/package.json` — backend run scripts.
- `backend/data/hospital.json` — created automatically; local application data and excluded from Git.
- `frontend/index.html` — website entry point.
- `frontend/api-config.js` — local default API endpoint; configured automatically for GitHub Pages.
- `frontend/styles.css` — responsive interface styling.
- `frontend/app.js` — browser UI and API client.
- `src/Main.java` — standalone Java console application.

This is a learning/demo application, not a production clinical system. It has no user authentication, authorization, or audit-grade storage. Use fictional data only; never enter real patient or other sensitive information.
