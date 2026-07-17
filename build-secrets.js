const fs = require('fs');
const path = require('path');

const filesToProcess = [
  'supabase-client.js',
  'groq-client.js'
];

const secrets = {
  '__SUPABASE_URL__': process.env.SUPABASE_URL,
  '__SUPABASE_ANON_KEY__': process.env.SUPABASE_ANON_KEY,
  '__GROQ_API_KEY__': process.env.GROQ_API_KEY
};

// Check if secrets are available in the build environment
if (!secrets.__SUPABASE_URL__ || !secrets.__SUPABASE_ANON_KEY__ || !secrets.__GROQ_API_KEY__) {
  console.error('Error: Missing one or more required environment variables (SUPABASE_URL, SUPABASE_ANON_KEY, GROQ_API_KEY).');
  console.error('These must be set in your hosting provider\'s build environment.');
  process.exit(1);
}

filesToProcess.forEach(fileName => {
  const filePath = path.join(__dirname, fileName);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    for (const [placeholder, value] of Object.entries(secrets)) {
      if (content.includes(placeholder)) {
        console.log(`Replacing ${placeholder} in ${fileName}...`);
        content = content.replace(new RegExp(placeholder, 'g'), value);
        changed = true;
      }
    }

    if (changed) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Finished processing ${fileName}.`);
    }
  }
});

console.log('Secret replacement process complete.');