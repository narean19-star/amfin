# amfin

## Deployment

This app is a static frontend that connects directly to a Supabase backend for data storage.

The GitHub Pages workflow in .github/workflows/deploy.yml will publish the site from the repository root.

### Required Supabase Configuration

To run this application, you need a Supabase project.

1.  **Create a Supabase Project**: Go to supabase.com and create a new project.
2.  **Set up Database Schema**: In the Supabase dashboard, go to the **SQL Editor**, paste the content from `schema.sql`, and run it to create your tables.
3.  **Add Repository Secrets**:
    *   In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
    *   Create two new repository secrets:
        *   `SUPABASE_URL`: Your Supabase project URL (e.g., `https://<project-id>.supabase.co`).
        *   `SUPABASE_ANON_KEY`: Your Supabase `anon` public key.
    *   These secrets will be securely injected into the application during deployment.
4.  **(Optional) Run Data Migration**: To migrate existing data from `data.json`, run the migration script locally. You must set environment variables for this command:
    ```bash
    SUPABASE_URL="YOUR_URL" SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY" node migrate.js
    ```

**Security**: Your API keys are managed via GitHub Actions secrets and are not stored in the repository, ensuring your application remains secure.