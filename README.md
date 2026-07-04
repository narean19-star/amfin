# amfin

## Deployment

This app is a static frontend that connects directly to a Supabase backend for data storage.

The GitHub Pages workflow in .github/workflows/deploy.yml will publish the site from the repository root.

### Required Supabase Configuration

To run this application, you need a Supabase project.

1. Create a project on supabase.com.
2. In the SQL Editor, run the schema scripts to create the necessary tables.
3. In `js/supabase-client.js`, replace the placeholder values with your **Project URL** and **anon public key** from your Supabase project's API settings.

**Important**: Never commit your Supabase keys directly into the `supabase-client.js` file if your repository is public. For public projects, consider loading these from a configuration file that is not checked into source control, or use environment variables during a build step.