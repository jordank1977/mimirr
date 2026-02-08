# Local Development Workflow

This workflow guides you through setting up and running the Mimirr application locally on Windows. It includes a critical workaround for the local migration system.

# Instructions:

1.  Read through the steps below carefully.
2.  Execute each step sequentially.
3.  Confirm successful execution of each step before proceeding to the next.
4.  If a step fails, stop and troubleshoot based on the error message.

# STEPS

1.  **Environment Configuration**
    Check if `.env.local` exists. If not, copy it from the example:
    
    **Command Prompt (cmd):**
    ```cmd
    if not exist .env.local copy .env.example .env.local
    ```

    **PowerShell:**
    ```powershell
    if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
    ```
    *Note: Ensure the `.env.local` file is configured correctly for your local environment.*

2.  **Install Dependencies**
    Ensure all project dependencies are installed and up to date:
    ```cmd
    npm install
    ```

3.  **Database Initialization (CRITICAL)**
    The local development environment has a known issue with the migration system. You MUST recreate the database using `drizzle-kit push` instead of `migrate`.
    
    Execute the following commands:

    **Command Prompt (cmd):**
    ```cmd
    if exist config\db.sqlite del config\db.sqlite
    ```

    **PowerShell:**
    ```powershell
    if (Test-Path config\db.sqlite) { Remove-Item config\db.sqlite }
    ```
    
    Then, push the schema directly to the database:
    ```cmd
    npx drizzle-kit push
    ```
    *Note: If the push command fails, try `npx drizzle-kit push --force`.*

4.  **Start Development Server**
    Start the Next.js development server:
    ```cmd
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

5.  **Verification**
    *   Open your browser (or use the `browser_action` tool) and navigate to `http://localhost:3000`.
    *   Verify that the application loads without errors.
    *   **Feature Verification**: If you are working on a specific feature, perform the necessary actions to verify its functionality (e.g., creating a request, checking a new page, etc.).
    *   Check the terminal for any runtime errors.

6.  **Optional: Database Inspection**
    If you need to inspect the database state, you can run:
    ```cmd
    npm run db:studio
    ```
