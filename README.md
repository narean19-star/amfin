# amfin

## Deployment
This is a static web application (HTML, CSS, JS) that can be deployed to any modern static hosting provider like Netlify, Vercel, or GitHub Pages. It connects directly to a Supabase backend for data storage and Groq for AI features.

### Build Process
The application uses placeholders for API keys in `supabase-client.js` and `groq-client.js`. Before deployment, these placeholders must be replaced with your actual keys. A build script is included to automate this process.

1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Run Build**: The build process reads your secrets from environment variables and injects them into the necessary files.
    ```bash
    npm run build
    ```
    This command is typically run by your hosting provider's CI/CD pipeline.

### Required Supabase Configuration

To run this application, you need a Supabase project.

1.  **Create a Supabase Project**: Go to supabase.com and create a new project.
2.  **Set up Database Schema**: In the Supabase dashboard, go to the **SQL Editor**, paste the content from `schema.sql`, and run it to create your tables.
3.  **Configure Environment Variables**:
    *   For local development, create a `local-secrets.js` file (this is git-ignored).
    *   For production, set these as environment variables in your hosting provider's settings (e.g., Netlify, Vercel).
    *   The required variables are:
        *   `SUPABASE_URL`: Your Supabase project URL (e.g., `https://<project-id>.supabase.co`).
        *   `SUPABASE_ANON_KEY`: Your Supabase `anon` public key.
        *   `GROQ_API_KEY`: Your Groq API key for the AI Assistant feature.
4.  **(Optional) Run Data Migration**: To migrate existing data from `data.json`, run the migration script locally. You must set environment variables for this command:
    ```bash
    SUPABASE_URL="YOUR_URL" SUPABASE_SERVICE_KEY="YOUR_SERVICE_ROLE_KEY" node migrate.js
    ```

**Security**: Your API keys are managed via GitHub Actions secrets and are not stored in the repository, ensuring your application remains secure.

### Hosting
When deploying to a static host, you must configure it to handle Single-Page Application (SPA) routing. All requests should be redirected to `index.html`. For Netlify, a `_redirects` file is included to handle this automatically.